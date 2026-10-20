import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash, createPublicKey, randomUUID, verify } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const api='https://api.fluentxverse.com';
const release=JSON.parse(readFileSync(path.join(root,'output/release/lesson-dispute-20261018/api-release.json'),'utf8'));
const prefix='evidence-smoke-'+randomUUID();
const ids={prefix,...Object.fromEntries(['student','other','tutor','admin','finance','booking','studentReport','tutorReport'].map(name=>[name,randomUUID()]))};
let checks=0,fixture={ids,startsAt:new Date(Date.now()-3600000).toISOString()},browser;
const check=(value,message)=>{assert.ok(value,message);checks++;};
function inside(source) {
  const result=spawnSync('docker',['exec','-i','fluentxverse-server','bun','-'],{input:source,encoding:'utf8',maxBuffer:4*1024*1024});
  if(result.status!==0)throw new Error('Synthetic fixture operation failed: '+result.stderr.replace(/eyJ[A-Za-z0-9_.-]+/g,'[token-redacted]').slice(0,2000));
  return result.stdout.trim()?JSON.parse(result.stdout.trim()):null;
}
const setup=`
import {initDriver,getDriver,closeDriver} from './src/db/memgraph';
import {query,closePool} from './src/db/postgres';
import {signAuthToken} from './src/utils/jwt';
import {StudentLessonIssueReportService} from './src/services/studentLessonIssueReport.service';
import {LessonTroubleReportService} from './src/services/lessonTroubleReport.service';
const ids=${JSON.stringify(ids)},prefix=ids.prefix;
const startsAt=${JSON.stringify(fixture.startsAt)};
await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD);
const graph=getDriver().session();
try{
  await graph.run(\`CREATE (s:Student {id:$student,givenName:'Evidence Test',familyName:'Temporary',evidenceSmokeTest:$prefix}),
    (:Student {id:$other,evidenceSmokeTest:$prefix}),
    (:User {id:$tutor,firstName:'Evidence Test',lastName:'Temporary',displayName:'Evidence Test (temporary)',teachingStatus:'pending',evidenceSmokeTest:$prefix}),
    (:Admin {id:$admin,role:'admin',permissions:['support'],evidenceSmokeTest:$prefix}),
    (:Admin {id:$finance,role:'admin',permissions:['finance'],evidenceSmokeTest:$prefix}),
    (:Booking {bookingId:$booking,tutorId:$tutor,status:'completed',durationMinutes:25,slotDateTime:datetime($startsAt),
      notesSubmittedAt:$now,notesReminderStage:'overdue',attendanceTutor:'present',attendanceStudent:'present',evidenceSmokeTest:$prefix})-[:BOOKED_BY]->(s)\`,{...ids,startsAt,now:new Date().toISOString()});
  for(const role of ['student','tutor']){
    const start=Date.parse(startsAt)+(role==='tutor'?2:0)*60000;
    await query(\`INSERT INTO session_participants(session_id,user_id,user_type,socket_id,joined_at,last_seen_at,left_at,is_active)
      VALUES($1,$2,$3,$4,$5,$6,$7,false)\`,[ids.booking,ids[role],role,crypto.randomUUID(),new Date(start),new Date(start+20*60000),new Date(start+20*60000)]);
  }
  await new StudentLessonIssueReportService().ensureSchema();await new LessonTroubleReportService().ensureSchema();
  const cookies={};
  for(const [name,role]of Object.entries({student:'student',other:'student',tutor:'tutor',admin:'admin',finance:'admin'}))
    cookies[name]=(role==='admin'?'adminAuth':role+'Auth')+'='+await signAuthToken({userId:ids[name],email:name+'@evidence-test.invalid',role});
  console.log(JSON.stringify({ids,cookies,startsAt}));
}finally{await graph.close();await closeDriver();await closePool();}
`;
async function request(route,actor,body,method=body===undefined?'GET':'POST') {
  const origin=actor==='tutor'?'https://tutor.fluentxverse.com':['admin','finance'].includes(actor)?'https://dashboard.fluentxverse.com':'https://student.fluentxverse.com';
  const response=await fetch(api+'/lesson-privacy'+route,{method,headers:{origin,'content-type':'application/json',...(actor?{cookie:fixture.cookies[actor]}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const value=await response.json();return {response,value};
}
async function data(route,actor,body,method) {
  const {response,value}=await request(route,actor,body,method);
  check(response.ok&&value.success,`Live request failed: ${method||'GET/POST'} ${route} (${response.status})`);
  check(response.headers.get('cache-control')?.includes('no-store'),'Private response must not be cacheable');
  return value.data;
}
const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
function verifyEnvelope(envelope) {
  check(envelope.publicKey===release.publicKey&&envelope.keyId===release.keyId,'Evidence issuer must match the deployment trust pin');
  check(createHash('sha256').update(Buffer.from(envelope.publicKey,'base64')).digest('hex')===release.keyId,'Issuer key fingerprint matches');
  const key=createPublicKey({key:Buffer.from(release.publicKey,'base64'),type:'spki',format:'der'});
  check(verify(null,Buffer.from(canonical(envelope.payload)),key,Buffer.from(envelope.signature,'base64')),'Independent Ed25519 signature verification');
  check(!JSON.stringify(envelope).includes(fixture.ids.booking)&&!JSON.stringify(envelope).includes(fixture.ids.student),'Export excludes raw booking/student identifiers');
}
function reportFixtures() {
  inside(`import {query,closePool} from './src/db/postgres';const ids=${JSON.stringify(fixture.ids)};
    try{await query("INSERT INTO student_lesson_issue_reports(id,booking_id,student_id,duration,reason,details) VALUES($1,$2,$3,'over_ten','connection','Synthetic evidence deployment check')",[ids.studentReport,ids.booking,ids.student]);
    await query("INSERT INTO lesson_trouble_reports(id,booking_id,tutor_id,duration,reason) VALUES($1,$2,$3,'over_ten','connection')",[ids.tutorReport,ids.booking,ids.tutor]);}finally{await closePool();}`);
}
async function browserChecks() {
  const require=createRequire(path.join(root,'fluentxverse-student-solid-prototype/package.json'));
  const {chromium,expect}=require('@playwright/test');
  browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
  const out=path.join(root,'output/lesson-privacy/live');mkdirSync(out,{recursive:true});
  const b=fixture.ids.booking,report={id:fixture.ids.studentReport,bookingId:b,source:'student',reason:'connection',details:'Synthetic evidence deployment check',status:'submitted',priority:'normal',createdAt:new Date().toISOString(),dueAt:new Date(Date.now()+86400000).toISOString(),internalHistory:[],reviewHistory:[]};
  async function context(actor,width) {
    const context=await browser.newContext({viewport:{width,height:950}});
    const [name,...value]=fixture.cookies[actor].split('=');
    await context.addCookies([{name,value:value.join('='),domain:'api.fluentxverse.com',path:'/',secure:true,httpOnly:true,sameSite:'Lax'}]);
    await context.routeWebSocket(/socket\.io/,socket=>socket.close());
    await context.route('https://api.fluentxverse.com/**',route=>{
      const p=new URL(route.request().url()).pathname;
      if(p.startsWith('/lesson-privacy/'))return route.continue();
      const result=data=>route.fulfill({json:{success:true,data}});
      if(p==='/student/me'||p==='/tutor/me'||p==='/admin/me')return route.fulfill({json:{success:true,user:{userId:fixture.ids[actor],role:actor==='admin'?'admin':actor,givenName:'Evidence Test',firstName:'Evidence Test',familyName:'Temporary',lastName:'Temporary',username:'Evidence Test',email:actor+'@evidence-test.invalid'}}});
      if(p==='/proof/tutor-certification/me')return result({snapshot:{missingRequirements:[]}});
      if(p.startsWith('/notifications'))return result({notifications:[],unreadCount:0});
      if(p==='/schedule/week')return result({slots:[],weekStart:'2026-10-12',weekEnd:'2026-10-18'});
      if(p===`/schedule/lesson/${b}`||p===`/schedule/tutor-lesson/${b}`)return result({bookingId:b,studentId:fixture.ids.student,tutorId:fixture.ids.tutor,tutorName:'Evidence Test',startsAt:fixture.startsAt,slotDate:fixture.startsAt.slice(0,10),slotTime:'1:00 PM',durationMinutes:25,status:'completed',bookedAt:fixture.startsAt});
      if(p===`/tutor/student/${fixture.ids.student}`)return result({id:fixture.ids.student,givenName:'Evidence Test',familyName:'Temporary',hobbies:[]});
      if(p.includes('/lesson-recap/'))return result({startsAt:fixture.startsAt,materials:[],studentComment:'Synthetic lesson',studentAttendance:'present',workflow:{notesStatus:'submitted',attendanceVerified:true,closed:true}});
      if(p.endsWith('/issue-report'))return result({startsAt:fixture.startsAt,lessonEndsAt:fixture.startsAt,closesAt:new Date(Date.now()+3600000).toISOString(),serverNow:new Date().toISOString(),eligible:false,report});
      if(p.endsWith('/trouble-report'))return result({startsAt:fixture.startsAt,endsAt:fixture.startsAt,serverNow:new Date().toISOString(),report:{id:fixture.ids.tutorReport,status:'submitted',createdAt:fixture.startsAt},studentReport:null});
      if(p.includes('lesson-notes-edit-window'))return result({startsAt:fixture.startsAt,endsAt:fixture.startsAt,editableUntil:fixture.startsAt,serverNow:new Date().toISOString(),canEdit:false});
      if(p.endsWith('/survey'))return result({eligible:false,reason:'expired',topics:[]});
      if(p==='/admin/operations/access')return result({role:'admin',permissions:['support']});
      if(p==='/admin/operations/reports')return result([report]);
      return result([]);
    });
    return context;
  }
  for(const width of [1440,375]){
    const student=await context('student',width),page=await student.newPage();
    await page.goto(`https://student.fluentxverse.com/lesson/${b}`,{waitUntil:'domcontentloaded'});
    const panel=page.getByRole('region',{name:'Private dispute evidence'});await expect(panel).toBeVisible({timeout:30000});
    await panel.getByLabel('Shared time in the lesson room').check();await panel.getByRole('button',{name:'Create private snapshot'}).click();
    await expect(panel.getByText('Private snapshot created. This new snapshot has not been shared with support.',{exact:true})).toBeVisible();
    const consent=panel.getByLabel('Share this snapshot with support for my lesson issue').first();await consent.check();
    await expect(panel.getByText('Snapshot shared with authorized support.',{exact:true})).toBeVisible();
    check((await data(`/admin/reports/student/${fixture.ids.studentReport}/evidence`,'admin')).length===1,'Public student UI consent reaches the real support API');
    await panel.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`student-${width}.png`),fullPage:true});
    const admin=await context('admin',width),support=await admin.newPage();
    await support.goto('https://dashboard.fluentxverse.com/lesson-operations?tab=issues',{waitUntil:'domcontentloaded'});
    await support.getByRole('button',{name:'Private evidence',exact:true}).click();
    const evidence=support.getByRole('region',{name:'Consented dispute evidence'});await expect(evidence).toContainText('Snapshot ID:',{timeout:30000});
    await evidence.scrollIntoViewIfNeeded();await support.screenshot({path:path.join(out,`support-${width}.png`),fullPage:true});
    await consent.uncheck();await expect(panel.getByText('Support access revoked.',{exact:true})).toBeVisible();
    await support.getByRole('button',{name:'Refresh private evidence'}).click();await expect(evidence).toContainText('No unexpired evidence is shared');
    await admin.close();await student.close();
    const tutor=await context('tutor',width),tutorPage=await tutor.newPage();
    await tutorPage.goto(`https://tutor.fluentxverse.com/lesson/${b}`,{waitUntil:'domcontentloaded'});
    const tutorPanel=tutorPage.getByRole('region',{name:'Private dispute evidence'});await expect(tutorPanel).toBeVisible({timeout:30000});
    await tutorPanel.getByLabel('Attendance threshold for each participant').check();await tutorPanel.getByRole('button',{name:'Create private snapshot'}).click();
    await expect(tutorPanel.getByText('Private snapshot created. This new snapshot has not been shared with support.',{exact:true})).toBeVisible();
    await tutorPanel.scrollIntoViewIfNeeded();await tutorPage.screenshot({path:path.join(out,`tutor-${width}.png`),fullPage:true});
    await tutor.close();checks+=3;
  }
}
try {
  fixture=inside(setup);
  const b=fixture.ids.booking,evidencePath=`/student/${b}/evidence`;
  const issuer=await data('/issuer');check(issuer.keyId===release.keyId,'Public API issuer is configured');
  check((await request(evidencePath)).response.status===401,'Anonymous evidence access rejected');
  check((await request(evidencePath,'other')).response.status===404,'Another student cannot read this lesson');
  check((await request(evidencePath,'tutor')).response.status===401,'Wrong cookie role rejected');
  const options=await data(evidencePath,'student');check(options.enabled&&options.canCreate&&!options.canShare,'Evidence enabled and private before a report exists');
  const snapshot=await data(evidencePath,'student',{fields:['attendance','overlap','cancellation']});verifyEnvelope(snapshot.envelope);
  check(snapshot.envelope.payload.claims.overlap==='threshold_met','Real API derives shared-time threshold from synthetic room records');
  check(!snapshot.sharedWithSupport,'New snapshots are not automatically shared');
  const consent=`${evidencePath}/${snapshot.id}/support`;
  check((await request(consent,'student',{shared:true},'PUT')).response.status===400,'Support sharing requires an existing own report');
  reportFixtures();
  const support=`/admin/reports/student/${fixture.ids.studentReport}/evidence`;
  check((await data(support,'admin')).length===0,'Support cannot see unconsented evidence');
  await data(consent,'student',{shared:true},'PUT');check((await data(support,'admin')).length===1,'Support sees the explicitly consented snapshot');
  check((await request(support,'finance')).response.status===403,'Finance-only administrator denied');
  const tutorSnapshot=await data(`/tutor/${b}/evidence`,'tutor',{fields:['attendance']});verifyEnvelope(tutorSnapshot.envelope);
  check((await data(`/tutor/${b}/evidence`,'tutor')).records.length===1,'Tutor evidence is separately owner-scoped');
  await data(consent,'student',{shared:false},'PUT');check((await data(support,'admin')).length===0,'Revocation stops further support reads');
  if(process.argv.includes('--browser'))await browserChecks();
  console.log(`PASS ${checks} live HTTPS evidence checks${process.argv.includes('--browser')?' and public frontend checks':''}; synthetic identities only.`);
  writeFileSync(path.join(root,'output/release/lesson-dispute-20261018/live-smoke.json'),JSON.stringify({passed:true,checks,browser:process.argv.includes('--browser'),at:new Date().toISOString(),syntheticOnly:true},null,2)+'\n');
} finally {
  if(browser)await browser.close();
  if(fixture)inside(`import {initDriver,getDriver,closeDriver} from './src/db/memgraph';import {query,closePool} from './src/db/postgres';const ids=${JSON.stringify(fixture.ids)};
    try{
      await query('DELETE FROM lesson_privacy_audit WHERE actor_id IN ($1,$2,$3,$4,$5)',[ids.student,ids.tutor,ids.admin,ids.finance,ids.other]);
      await query('DELETE FROM lesson_privacy_records WHERE booking_id=$1 AND owner_id IN ($2,$3)',[ids.booking,ids.student,ids.tutor]);
      await query('DELETE FROM session_participants WHERE session_id=$1 AND user_id IN ($2,$3)',[ids.booking,ids.student,ids.tutor]);
      await query('DELETE FROM student_lesson_issue_reports WHERE id=$1 AND booking_id=$2',[ids.studentReport,ids.booking]);
      await query('DELETE FROM lesson_trouble_reports WHERE id=$1 AND booking_id=$2',[ids.tutorReport,ids.booking]);
      await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD);const s=getDriver().session();
      try{await s.run('MATCH(n) WHERE n.evidenceSmokeTest=$prefix OR n.userId IN $users OR n.actorId IN $users DETACH DELETE n',{prefix:ids.prefix,users:[ids.student,ids.tutor,ids.admin,ids.finance,ids.other]});}finally{await s.close();await closeDriver();}
    }finally{await closePool();}`);
}
