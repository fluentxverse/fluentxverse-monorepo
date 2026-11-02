import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {ssh,quote} from './lib/cloud-ssh.mjs';
const dir=join(homedir(),'.local/state/fluentxverse/identity-reset-20261102');
const backup=JSON.parse(readFileSync(join(dir,'backup-1793611292350.json')));
const restore=backup.records.map(r=>{
 const exams=r.exams.filter(e=>{try{return e.type==='speaking'&&e.status==='completed'&&JSON.parse(e.result).passed===true;}catch{return false;}});
 if(!exams.length)throw Error('Original passed speaking evidence is missing; refusing to fabricate a pass.');
 exams.sort((a,b)=>String(b.completedAt||'').localeCompare(String(a.completedAt||'')));
 const latest=exams[0],result=JSON.parse(latest.result);
 return {id:r.user.id,score:r.user.speakingExamScore??result.overallScore,passedAt:r.user.speakingExamPassedAt??latest.completedAt,
  exams:r.exams.filter(e=>e.type==='speaking').map(e=>({id:e.id,status:e.status}))};
});
const init=`import{initDriver,getDriver,closeDriver}from'./src/db/memgraph';await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD,1);const s=getDriver().session();`;
const snapshot=init+`try{const r=await s.run("MATCH(u:User) WHERE u.id IN $ids OPTIONAL MATCH(u)-[:TAKES]->(e:Exam {type:'speaking'}) RETURN u,collect(e) AS exams",{ids:${JSON.stringify(restore.map(r=>r.id))}});console.log(JSON.stringify(r.records.map(r=>({user:r.get('u').properties,exams:r.get('exams').map(e=>e.properties)}))));}finally{await s.close();await closeDriver();}`;
writeFileSync(join(dir,'before-speaking-restore-'+Date.now()+'.json'),ssh('docker exec fluentxverse-server bun --no-env-file -e '+quote(snapshot)),{mode:0o600,flag:'wx'});
if(!process.argv.includes('--apply')){console.log(JSON.stringify({passedSpeakingRecordsToRestore:restore.length}));process.exit(0);}
const source=init+`const restore=await Bun.stdin.json();try{await s.executeWrite(async tx=>{for(const item of restore){const u=(await tx.run("MATCH(u:User {id:$id}) SET u.identityRestoreRevision=coalesce(u.identityRestoreRevision,0)+1 RETURN u",{id:item.id})).records[0]?.get('u').properties;if(!u?.identityResetAt)throw Error('No matching identity reset');if(u.interviewPassed===true)throw Error('New interview approval exists; manual review required');for(const e of item.exams){await tx.run("MATCH(u:User {id:$id})-[:TAKES]->(e:Exam {id:$examId,status:'identity_reset'}) WHERE e.identityResetAt=$resetAt SET e.status=$status,e.speakingRestoredAt=$at",{id:item.id,examId:e.id,status:e.status,resetAt:u.identityResetAt,at:new Date().toISOString()});}await tx.run("MATCH(u:User {id:$id}) SET u.speakingExamPassed=true,u.speakingExamScore=$score,u.speakingExamPassedAt=$passedAt,u.identityRequired=true,u.identityVerified=false,u.certificationStatus='pending'",{id:item.id,score:item.score,passedAt:item.passedAt});await tx.run("MATCH(t:Tutor {odIuser:$id}) SET t.speakingExamPassed=true,t.speakingExamScore=$score",{id:item.id,score:item.score});await tx.run("CREATE(:TutorIdentityResetCorrection {id:$event,tutorId:$id,at:$at,reason:'preserve_completed_speaking_require_id_next'})",{event:crypto.randomUUID(),id:item.id,at:new Date().toISOString()});}});console.log(JSON.stringify({speakingPassesRestored:restore.length,interviewApprovalRestored:false,profileApprovalRestored:false}));}finally{await s.close();await closeDriver();}`;
console.log(ssh('docker exec -i fluentxverse-server bun --no-env-file -e '+quote(source),{input:JSON.stringify(restore)}));
