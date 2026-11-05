import { ssh, quote } from './lib/cloud-ssh.mjs';

const email = process.argv.find(a => a.startsWith('--email='))?.slice(8).trim().toLowerCase();
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw Error('Supply the confirmed exact applicant email with --email=.');
const apply = process.argv.includes('--apply');
// Explicitly scoped re-enrollment: retain the minted token and invalidate its live
// issuer status. Never treat an in-flight or ambiguous mint as safely resettable.
const invalidateIssued = process.argv.find(a => a.startsWith('--invalidate-issued='))?.slice('--invalidate-issued='.length) || '';
if (invalidateIssued && !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(invalidateIssued)) throw Error('Supply the exact issued submission ID.');
const code = `import{initDriver,getDriver,closeDriver}from'./src/db/memgraph';
import{lockApplicant}from'./src/services/exam.services/applicationPolicy';
import{currentIdentity}from'./src/services/tutorIdentity/service';
import{identityStorage}from'./src/services/tutorIdentity/storage';
await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD,1);
const s=getDriver().session(),email=${JSON.stringify(email)},apply=${apply},invalidateIssued=${JSON.stringify(invalidateIssued)};
try{
 const rows=(await s.run('MATCH(u:User) WHERE toLower(u.email)=$email RETURN u.id AS id',{email})).records;
 if(rows.length!==1)throw Error('Expected exactly one matching applicant; no changes made');
 const id=rows[0].get('id');let imageId=null;
 const summary=await s.executeWrite(async tx=>{
  const u=apply?await lockApplicant(tx,id,true):(await tx.run('MATCH(u:User {id:$id}) RETURN u',{id})).records[0].get('u').properties;
  const i=await currentIdentity(tx,id);
  const jobs=(await tx.run('MATCH(j:TutorIdentityCredential {tutorId:$id}) RETURN j',{id})).records.map(r=>r.get('j').properties);
  if(${process.argv.includes('--status')})return {submissionId:i?.id||null,identityStatus:i?.status||null,credentialStatus:i?.credentialStatus||null,interviewPassed:u.interviewPassed===true,jobs:jobs.map(j=>{
    const issuance=j.issuanceJson?JSON.parse(j.issuanceJson):{};
    return {id:j.id,revoked:j.revoked,status:j.status,stage:j.issuanceStage||null,leaseUntil:j.issuanceLeaseUntil||null,proofSubmissionId:j.proofSubmissionId||null,
      mintTransactionId:j.mintTransactionId||null,mintTransactionHash:j.mintTransactionHash||null,
      holder:issuance.binding?.holder,tokenId:issuance.tokenId,arbitrumReceipt:issuance.arbitrumReceipt};
  })};
  const onchainJobs=jobs.filter(j=>j.mintTransactionId||j.mintTransactionHash||j.status==='issued'
    || ['minting','mint_submitted','issued','reconciliation_required','revocation_required'].includes(j.issuanceStage));
  if(invalidateIssued && !onchainJobs.some(j=>j.id===invalidateIssued && j.id===i?.id && j.revoked===false && j.issuanceStage==='issued'
    && j.mintTransactionHash && JSON.parse(j.issuanceJson||'{}').stage==='issued'))throw Error('Expected the exact current finalized issued credential; no changes made');
  if(onchainJobs.some(j=>j.issuanceStage!=='issued' || !j.mintTransactionHash || JSON.parse(j.issuanceJson||'{}').stage!=='issued'
    || !(j.revoked===true || (invalidateIssued && j.id===invalidateIssued && j.id===i?.id))))throw Error('On-chain credential reconciliation required before reset');
  if(jobs.some(j=>j.issuanceLeaseUntil && j.issuanceLeaseUntil>new Date().toISOString()))throw Error('Credential worker is active; wait for its lease to finish before resetting');
  const live=await tx.run("MATCH(v:InterviewSlot {tutorId:$id,status:'booked'}) WHERE v.mediaClosedAt IS NULL AND (v.tutorEnteredAt IS NOT NULL OR v.adminEnteredAt IS NOT NULL) RETURN v.id AS id",{id});
  if(live.records.length)throw Error('Interview may be active; close it before resetting');
  if(apply){
   const at=new Date().toISOString();
   if(i){imageId=i.id;await tx.run("MATCH(i:TutorIdentity {id:$identityId}) SET i.preOperatorResetStatus=i.status,i.status='resubmit',i.reason='Applicant reset to ID submission by operator',i.deleteAt=$at,i.credentialStatus='cancelled'",{identityId:i.id,at});}
   await tx.run("MATCH(j:TutorIdentityCredential {tutorId:$id}) WHERE j.revoked=false SET j.revoked=true,j.status='revoked',j.revokedAt=$at,j.revokedReason='operator_requested_id_and_interview_reset'",{id,at});
   await tx.run("MATCH(v:InterviewSlot {tutorId:$id}) WHERE v.id=$slotId OR v.status='booked' SET v.preOperatorResetStatus=v.status,v.status='operator_reset',v.mediaClosedAt=$at",{id,slotId:u.interviewSlotId||'',at});
   await tx.run("MATCH(u:User {id:$id}) SET u.interviewPassed=false,u.identityVerified=false,u.identityRequired=true,u.certificationStatus='pending',u.identityResetAt=$at REMOVE u.identitySubmissionId,u.identitySubmittedAt,u.interviewSlotId,u.interviewPassedAt,u.interviewCompletedAt,u.interviewFailedAt,u.interviewRubricScores",{id,at});
   await tx.run("MATCH(t:Tutor {odIuser:$id}) SET t.interviewPassed=false,t.certificationStatus='pending'",{id});
   await tx.run("CREATE(:TutorIdentityResetAudit {id:$event,tutorId:$id,at:$at,previousSubmissionId:$submission,previousInterviewId:$slot,invalidatedIssuedSubmissionId:$issued,reason:'operator_requested_id_and_interview_reset'})",{event:crypto.randomUUID(),id,at,submission:i?.id||'',slot:u.interviewSlotId||'',issued:invalidateIssued});
  }
  const verified=(await tx.run('MATCH(u:User {id:$id}) RETURN u',{id})).records[0].get('u').properties;
  if(apply && (verified.interviewPassed!==false || verified.identityVerified!==false || verified.identitySubmissionId || verified.interviewSlotId
    || verified.writtenExamPassed!==u.writtenExamPassed || verified.speakingExamPassed!==u.speakingExamPassed))throw Error('Reset verification failed; transaction rolled back');
  return{matchedApplicants:1,applied:apply,invalidatedIssuedSubmissionId:invalidateIssued||null,existingOnchainTokensPreserved:onchainJobs.length,writtenPassPreserved:verified.writtenExamPassed===true,speakingPassPreserved:verified.speakingExamPassed===true,previousInterviewPassed:u.interviewPassed===true,hadIdSubmission:!!i,
    ...(apply?{identityVerified:verified.identityVerified,interviewPassed:verified.interviewPassed,readyForIdSubmission:!verified.identitySubmissionId}: {})};
 });
 if(imageId){await identityStorage.remove(imageId);await s.run('MATCH(i:TutorIdentity {id:$id}) SET i.deletedAt=$at',{id:imageId,at:new Date().toISOString()});}
 console.log(JSON.stringify({...summary,imageDeleted:!!imageId,chainTransactions:0}));
}finally{await s.close();await closeDriver();}`;
console.log(ssh('docker exec fluentxverse-server bun --no-env-file -e '+quote(code)));
