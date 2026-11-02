const {chromium,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.TUTOR_TEST_URL||'http://127.0.0.1:5286';
const output=path.resolve('fluentxverse-tutor-solid-prototype/public/assets/img/first-lesson'),id='completion-guide-example';
const feedback='The student explained everyday routines clearly and practiced asking follow-up questions. Keep reviewing new vocabulary and use complete sentences in the next conversation.';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 fs.mkdirSync(output,{recursive:true});
 try{for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce',permissions:['camera','microphone']});
  await context.addInitScript(theme=>localStorage.setItem('theme-storage',JSON.stringify({state:{themeMode:theme},version:2})),theme);
  let summary={studentComment:'',tutorMemo:'',englishLevelAssessment:null,updatedAt:null},submitted=false;
  const workflow=()=>({startsAt:'2026-10-31T01:00:00Z',endsAt:'2026-10-31T01:25:00Z',editableUntil:'2026-11-02T01:25:00Z',serverNow:'2026-10-31T02:00:00Z',canEdit:true,closed:false,notesStatus:submitted?'submitted':'draft',attendanceVerified:submitted,studentAttendance:'present',outcome:'attended'});
  await context.route('**/*',route=>{
   const request=route.request(),url=new URL(request.url()),p=url.pathname;
   if(url.origin===base)return route.continue();
   const user={userId:'guide-tutor',role:'tutor',firstName:'Alex',email:'alex@example.test'};
   let data=[];
   if(request.method()!=='GET'&&request.method()!=='OPTIONS'){
    if(p==='/tutor/classroom-lesson-notes/'+id&&request.method()==='PUT')summary={...summary,...request.postDataJSON(),updatedAt:'2026-10-31T02:00:00Z'};
    else if(p==='/lesson-workflow/tutor/'+id+'/submit'&&request.method()==='POST'){submitted=true;data=workflow();}
    else if(!['/tutor/refresh','/student/refresh'].includes(p))throw Error('Unexpected capture write '+p);
   }
   if(p.endsWith('/socket-token'))return route.fulfill({json:{success:true,token:'fixture'}});
   if(p.replace(/\/$/,'')==='/tutor/email-verification')data={verified:true};
   if(p==='/notifications')data={notifications:[],unreadCount:0};
   if(p==='/proof/tutor-certification/me')data={snapshot:{writtenPassed:true,speakingPassed:true,interviewPassed:true,profileApproved:true,missingRequirements:[]}};
   if(p.includes('/lesson-request'))data={studentPreferences:{cameraOn:true,proficiency:'Level 3',errorCorrection:'during_feedback'},lessonId:'',courseId:''};
   if(p==='/dispatch/classroom-library')return route.fulfill({json:{success:true,articles:[{id:'sample-article',title:'Small habits for better conversations',category:'Lifestyle',status:'published',postedDate:'2026-10-31',createdAt:'2026-10-31T00:00:00Z'}]}});
   if(p==='/schedule/tutor-lesson/'+id)data={bookingId:id,sessionId:id,studentId:'sample-student',slotDate:'2026-10-31',slotTime:'9:00 AM',durationMinutes:25,status:'completed'};
   if(p==='/tutor/student/sample-student')data={id:'sample-student',givenName:'Sample',familyName:'Student',country:'Japan',joinDate:'2026-09-01',totalLessons:1,hobbies:[]};
   if(p==='/lesson-workflow/tutor/'+id||p==='/tutor/lesson-notes-edit-window/'+id)data=workflow();
   if(p==='/tutor/classroom-lesson-notes/'+id)data={...summary,materials:[],studentAttendance:'present'};
   if(p==='/tutor/lesson-notes/'+id)data=summary.updatedAt?[{sessionId:id,startsAt:workflow().startsAt,studentAttendance:'present',notes:[],...summary,summaryUpdatedAt:summary.updatedAt}]:[];
   if(p.includes('/trouble-report'))data={canReport:false,eligible:false,serverNow:workflow().serverNow,startsAt:workflow().startsAt,endsAt:workflow().endsAt};
   return route.fulfill({json:{success:true,user,data,articles:[],lessons:[]}});
  });
  await context.routeWebSocket('**/socket.io/**',ws=>{
   ws.onMessage(raw=>{
    raw=String(raw);if(raw.startsWith('40'))return ws.send('40{"sid":"guide-socket"}');
    const match=raw.match(/^42(\d*)(\[.*\])$/);if(!match)return;
    const[event]=JSON.parse(match[2]);
    if(event==='session:join')ws.send('42'+JSON.stringify(['session:state',{sessionId:id,mediaProvider:'webrtc',startsAt:'2026-10-31T02:02:00Z',endsAt:'2026-10-31T02:27:00Z',serverNow:'2026-10-31T02:00:00Z',participants:{tutorId:'guide-tutor',studentId:'sample-student'}}]));
    if(event==='chat:request-history')ws.send('42["chat:history",[]]');
   });
   ws.send('0{"sid":"guide-engine","upgrades":[],"pingInterval":9000000,"pingTimeout":9000000,"maxPayload":1000000}');
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-10-31T02:00:00Z')});
  const clear=()=>page.evaluate(()=>document.querySelectorAll('[data-guide-callout]').forEach(el=>el.remove()));
  const mark=async(locator,number)=>{
   await locator.evaluate((el,number)=>{
    const r=el.getBoundingClientRect(),box=document.createElement('div'),parent=el.closest('dialog');
    box.dataset.guideCallout='true';
    Object.assign(box.style,{position:parent?'fixed':'absolute',pointerEvents:'none',zIndex:'2147483647',left:(r.left+(parent?0:scrollX)-3)+'px',top:(r.top+(parent?0:scrollY)-3)+'px',width:(r.width+6)+'px',height:(r.height+6)+'px',border:'3px solid #dc2626',borderRadius:'7px',boxSizing:'border-box'});
    const badge=document.createElement('span');badge.textContent=number;
    Object.assign(badge.style,{position:'absolute',top:'-14px',left:'-14px',display:'grid',placeItems:'center',width:'26px',height:'26px',borderRadius:'50%',background:'#dc2626',color:'#fff',font:'700 15px Arial',border:'2px solid #fff'});
    box.append(badge);(parent||document.body).append(box);
   },number);
  };
  const capture=async(name,locator)=>{
   const r=await locator.boundingBox();
   await page.screenshot({path:path.join(output,name+'-'+theme+'.png'),clip:{x:Math.max(0,r.x-16),y:Math.max(0,r.y-16),width:r.width+32,height:r.height+32}});
   await clear();
  };
  await page.goto(base+'/classroom/'+id,{waitUntil:'domcontentloaded'});
  const course=page.locator('.material-selector-trigger');await expect(course).toBeVisible();await course.click();
  await page.getByRole('option',{name:/Daily Dispatch/}).click();
  const open=page.getByRole('button',{name:'Open article: Small habits for better conversations',exact:true});await expect(open).toBeVisible();
  await page.locator('.material-content').evaluate(el=>el.scrollTop=0);
  await mark(course,1);await mark(open,2);await capture('choose-material',page.locator('.material-selector-section'));
  await page.goto(base+'/lesson/'+id,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Edit notes',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Edit lesson notes',exact:true});await expect(dialog).toBeVisible();
  const field=dialog.getByRole('textbox',{name:'Student feedback',exact:true});await field.fill(feedback);await field.scrollIntoViewIfNeeded();
  const save=dialog.locator('.lne-save');await expect(save).toBeEnabled();
  await mark(field,1);await mark(save,2);await capture('save-lesson-notes',dialog);
  await save.click();await expect(save).toBeDisabled();
  await dialog.getByRole('button',{name:'Close editor',exact:true}).click();
  const card=page.locator('.lesson-notes-card'),submit=card.getByRole('button',{name:'Submit notes & confirm attendance',exact:true});
  await expect(submit).toBeEnabled();await card.scrollIntoViewIfNeeded();await mark(submit,1);await capture('submit-lesson-notes',card);
  await submit.click();await expect(card).toContainText('Notes submitted');
  assert(submitted);assert.deepEqual(errors,[]);await context.close();
  console.log('PASS captured material, draft save and submission: '+theme);
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
