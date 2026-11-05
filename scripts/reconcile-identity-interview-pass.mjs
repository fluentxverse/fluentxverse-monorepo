import {ssh,quote} from './lib/cloud-ssh.mjs';
const code = `import{initDriver,getDriver,closeDriver}from'./src/db/memgraph';
import{lockApplicant}from'./src/services/exam.services/applicationPolicy';
import{currentIdentity}from'./src/services/tutorIdentity/service';
await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD,1);
const s=getDriver().session();let held=0,eligible=0;
try{
 const candidates=(await s.run("MATCH(j:TutorIdentityCredential {status:'awaiting_configuration'}) WHERE j.revoked=false RETURN j.id AS id,j.tutorId AS tutorId")).records;
 for(const row of candidates){const id=row.get('id'),tutorId=row.get('tutorId');
  const result=await s.executeWrite(async tx=>{
   const u=await lockApplicant(tx,tutorId,true),i=await currentIdentity(tx,tutorId);
   const j=(await tx.run("MATCH(j:TutorIdentityCredential {id:$id,status:'awaiting_configuration',revoked:false}) RETURN j",{id})).records[0];
   if(!j)return null;
   const slot=i?.interviewId?(await tx.run('MATCH(s:InterviewSlot {id:$id,tutorId:$tutorId}) RETURN s',{id:i.interviewId,tutorId})).records[0]?.get('s').properties:null;
   const ok=i?.id===id&&i.status==='verified'&&u.interviewPassed===true&&u.interviewSlotId===i.interviewId&&slot?.result==='pass'&&!u.identityBanned;
   await tx.run("MATCH(j:TutorIdentityCredential {id:$id}) SET j.preInterviewPolicyStatus=coalesce(j.preInterviewPolicyStatus,j.status),j.status=$status,j.eligibilityReconciledAt=$at,j.interviewId=$interviewId,j.interviewPassedAt=$passedAt",{id,status:ok?'awaiting_configuration':'awaiting_interview_pass',at:new Date().toISOString(),interviewId:i?.interviewId||null,passedAt:ok?slot.reviewedAt:null});
   if(i?.id===id&&i.status==='verified')await tx.run('MATCH(i:TutorIdentity {id:$id}) SET i.credentialStatus=$status',{id,status:ok?'awaiting_credential_configuration':'awaiting_interview_pass'});
   return ok;
  });if(result===true)eligible++;if(result===false)held++;
 }
 console.log(JSON.stringify({eligibleRequests:eligible,heldUntilInterviewPass:held,chainTransactions:0}));
}finally{await s.close();await closeDriver();}`;
if(ssh("docker inspect fluentxverse-server --format '{{.Config.Image}}'").trim()!=='fluentxverse-cloud/api:identity-interview-pass-20261102')throw Error('Deploy pass gate first');
console.log(ssh('docker exec fluentxverse-server bun --no-env-file -e '+quote(code)));
