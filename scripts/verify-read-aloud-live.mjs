import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { ssh, quote } from './lib/cloud-ssh.mjs';

if (!process.argv.includes('--run-live-qa')) throw Error('Use --run-live-qa for the synthetic recording pilot.');
const id = 'read-aloud-qa-' + randomUUID(), email = id + '@example.invalid';
const prelude = `
import assert from 'node:assert/strict';
import {initDriver,getDriver,closeDriver} from './src/db/memgraph';
import {signAuthToken} from './src/utils/jwt';
const id=${JSON.stringify(id)},email=${JSON.stringify(email)};
await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD);
const db=getDriver().session();
const cookie='tutorAuth='+await signAuthToken({userId:id,email,role:'tutor'});
const req=async(path,method='GET',body)=>{
  const r=await fetch('https://api.fluentxverse.com'+path,{method,
    headers:{cookie,origin:'https://tutor.fluentxverse.com','content-type':'application/json'},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(100000)});
  return {status:r.status,body:await r.json()};
};`;
const remote = (code, input, timeout = 180000) => JSON.parse(ssh(
  'docker exec ' + (input ? '-i ' : '') + 'fluentxverse-server bun --no-env-file -e ' + quote(code),
  { ...(input ? { input: JSON.stringify(input) } : {}), timeout }));
let summary;
try {
  const generated = remote(prelude + `
try {
  await db.run('CREATE(:User {id:$id,email:$email,role:"tutor",verifiedEmail:true,verifiedEmailAddress:$email,writtenExamPassed:true,createdAt:$at})',
    {id,email,at:new Date().toISOString()});
  const response=await req('/exam/speaking/generate','POST',{});
  assert.equal(response.status,200,'Public oral generation');
  const exam=response.body.exam;
  assert.equal(exam.format,'read-aloud.v1');assert.equal(exam.tasks.length,10);
  assert(exam.tasks.every((t,i)=>t.type==='read-aloud'&&t.id===i+1&&t.timeLimit===30));
  const again=await req('/exam/speaking/generate','POST',{});
  assert.equal(again.status,200);assert.deepEqual(again.body.exam.tasks,exam.tasks);
  console.log(JSON.stringify({exam}));
}finally{await db.close();await closeDriver();}process.exit(0);`);
  const exam = generated.exam;
  const recordings = exam.tasks.map(task => {
    const audio = execFileSync('espeak-ng', ['--stdout', '-v', 'en-us', '-s', '145', task.sentence], { maxBuffer: 2 * 1024 * 1024 });
    // eSpeak's streamed WAV declares an unknown RIFF length; sample data is mono PCM16.
    const duration = (audio.length - 44) / 44100;
    assert(duration >= 0.5 && duration <= 30);
    return { taskId: task.id, audioUrl: 'data:audio/wav;base64,' + audio.toString('base64'), duration };
  });
  summary = remote(prelude + `
const {examId,recordings}=await Bun.stdin.json();
try{
  for(const recording of recordings){
    const saved=await req('/exam/speaking/recording','POST',{examId,recording});
    assert.equal(saved.status,200,'Recording upload');assert.equal(saved.body.saved,true);
  }
  assert.equal((await req('/exam/speaking/recording','POST',{examId,recording:recordings[0]})).status,200,'Idempotent recording retry');
  const resumed=await req('/exam/speaking/active');
  assert.equal(resumed.status,200);assert.equal(resumed.body.exam.savedTaskIds.length,10);
  assert(resumed.body.exam.tasks.every(t=>t.type==='read-aloud'));
  const submitted=await req('/exam/speaking/submit','POST',{examId});
  assert.equal(submitted.status,202,'Asynchronous submission');
  assert([200,202].includes((await req('/exam/speaking/submit','POST',{examId})).status));
  const until=Date.now()+240000;
  let status;
  do{
    const response=await req('/exam/speaking/status');assert.equal(response.status,200);status=response.body.status;
    assert(!status.gradingFailed,'Provider job must finish without failing');
    if(status.hasCompletedExam)break;await Bun.sleep(2000);
  }while(Date.now()<until);
  assert(status.hasCompletedExam,'Bounded grading wait');
  const response=await req('/exam/speaking/result/'+encodeURIComponent(examId));assert.equal(response.status,200);
  const result=response.body.result;
  assert.equal(result.format,'read-aloud.v1');assert.equal(result.rubricVersion,'read-aloud-transcript.v1');
  assert.equal(result.taskScores.length,10);
  assert(result.taskScores.every(t=>t.taskType==='read-aloud'&&t.transcription.trim().length));
  assert.equal(result.sectionAverages.pronunciation,null);assert.equal(result.sectionAverages.fluency,null);
  assert.equal(result.decisionStatus,'human_review_required');
  const stored=(await db.run('MATCH(e:Exam {id:$examId}) RETURN e',{examId})).records[0].get('e').properties;
  const evidence=JSON.parse(stored.screeningAudioEvidence);
  assert.equal(evidence.length,10);assert(evidence.every(e=>e.source==='server-transcription'&&/^[a-f0-9]{64}$/.test(e.audioHash)));
  const user=(await db.run('MATCH(u:User {id:$id}) RETURN u',{id})).records[0].get('u').properties;
  assert.notEqual(user.certificationStatus,'certified');
  console.log(JSON.stringify({liveReadAloudPassed:true,generatedSentences:10,recordingsSaved:10,
    realTranscriptionAndGrading:true,recordingRetryIdempotent:true,resumePassed:true,duplicateSubmitPassed:true,
    overallScore:result.overallScore,provisional:true,authenticatedAudioEvidence:true,noCertificateIssued:true}));
}finally{await db.close();await closeDriver();}process.exit(0);`, { examId: exam.examId, recordings }, 360000);
  console.log(JSON.stringify(summary));
} catch {
  console.error('Read-aloud live pilot failed. No private recording or provider output is logged.');
  process.exitCode = 1;
} finally {
  const cleanup = remote(prelude + `
try{
  await db.executeWrite(async tx=>{
    await tx.run('MATCH(:User {id:$id})-[:TAKES]->(:Exam)-[:HAS_RECORDING]->(r:SpeakingRecording) DETACH DELETE r',{id});
    await tx.run('MATCH(:User {id:$id})-[:TAKES]->(e:Exam) DETACH DELETE e',{id});
    await tx.run('MATCH(u:User {id:$id,email:$email}) DETACH DELETE u',{id,email});
  });
  assert.equal(Number((await db.run('MATCH(u:User {id:$id}) RETURN count(u) AS n',{id})).records[0].get('n')),0);
  console.log(JSON.stringify({temporaryApplicantExamAndRecordingsRemoved:true}));
}finally{await db.close();await closeDriver();}process.exit(0);`);
  console.log(JSON.stringify(cleanup));
  if (summary) {
    mkdirSync('output/release/read-aloud-screening-20261026', { recursive: true });
    writeFileSync('output/release/read-aloud-screening-20261026/live-pilot.json', JSON.stringify({ ...summary, ...cleanup, verifiedAt: new Date().toISOString() }, null, 2));
  }
}
