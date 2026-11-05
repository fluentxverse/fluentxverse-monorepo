import {root} from './identity-mainnet-operations.mjs';
import {quote} from './lib/cloud-ssh.mjs';
const email=process.argv.find(a=>a.startsWith('--email='))?.slice(8).toLowerCase();
if(email!=='paul.arriola@fluentxverse.com')throw Error('This repair is scoped to the confirmed affected account.');
const apply=process.argv.includes('--apply');
const code=`import{initDriver,getDriver,closeDriver}from'./src/db/memgraph';import{invalidateCache}from'./src/db/redis';import{validateTutorNickname}from'../shared/tutorPublicName';await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD,1);const s=getDriver().session();try{const result=await s.executeWrite(async tx=>{
const rows=(await tx.run('MATCH(u:User) WHERE toLower(u.email)=$email RETURN u',{email:${JSON.stringify(email)}})).records;if(rows.length!==1)throw Error('Expected exactly one applicant');let u=rows[0].get('u').properties;
if(${apply})u=(await tx.run('MATCH(u:User {id:$id}) SET u.applicationRevision=coalesce(u.applicationRevision,0)+1 RETURN u',{id:u.id})).records[0].get('u').properties;
const d=(await tx.run('MATCH(d:ProfileScreeningDecision {id:$id,tutorId:$tutorId}) RETURN d',{id:u.profileScreeningDecisionId||'',tutorId:u.id})).records[0]?.get('d').properties;
if(!d||d.status!=='approved')throw Error('No recorded approved decision; manual review required');
const statuses=JSON.parse(u.profileItemStatuses||'{}');const six=['nickname','profilePicture','videoIntro','bio','education','interests'];
if(!six.every(k=>statuses[k]?.status==='approved')||d.itemStatuses!==u.profileItemStatuses)throw Error('Recorded item approvals differ; manual review required');
validateTutorNickname(u.nickname);
const fields=['firstName','lastName','bio','education','profilePicture','videoIntroUrl'];const mismatches=fields.filter(k=>JSON.stringify(u[k]??null)!==JSON.stringify(d[k]??null));
if(mismatches.length)throw Error('Profile differs from approved snapshot: '+mismatches.join(', '));
if(!['pending_review','approved'].includes(u.profileStatus)||u.hasPendingChanges===true)throw Error('Unexpected current state; manual review required');
if(${apply}&&u.profileStatus!=='approved'){const at=new Date().toISOString();await tx.run("MATCH(u:User {id:$id}) SET u.profileStatus='approved',u.profileApprovalReconciledAt=$at CREATE(:AdminOperationsAudit {id:$event,actorId:'operator',action:'profile_approval_reconciled',subjectId:$id,createdAt:$at,reason:'Previously approved profile resubmission downgraded status; all six recorded approvals and stored snapshot checked',beforeJson:$before,afterJson:$after})",{id:u.id,at,event:crypto.randomUUID(),before:JSON.stringify({profileStatus:u.profileStatus,decisionId:d.id}),after:JSON.stringify({profileStatus:'approved',decisionId:d.id})});}
return {id:u.id,applied:${apply},previousStatus:u.profileStatus,status:${apply}?'approved':u.profileStatus,approvedItems:6,snapshotMatches:true,preservedDecision:true};});if(${apply}){await invalidateCache('tutor:profile:'+result.id);await invalidateCache('tutor:search:*');}delete result.id;console.log(JSON.stringify(result));}finally{await s.close();await closeDriver();}`;
console.log(root('docker exec fluentxverse-server bun --no-env-file -e '+quote(code)));
