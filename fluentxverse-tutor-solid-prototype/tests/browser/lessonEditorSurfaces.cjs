const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.TUTOR_TEST_URL||'http://127.0.0.1:5271';
const id='notes-surface-fixture';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 fs.mkdirSync('/tmp/fluentxverse-lesson-notes-surface',{recursive:true});
 try{for(const width of [1440,390,320])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:1000},colorScheme:theme,reducedMotion:'reduce'});
  await context.addInitScript(theme=>localStorage.setItem('theme-storage',JSON.stringify({state:{themeMode:theme,isDarkMode:theme==='dark'},version:2})),theme);
  let populated=false,evidenceRequests=0;
  const writes=[],errors=[];
  const startsAt=new Date(Date.now()-3600000).toISOString();
  await context.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780|8782))\//,route=>{
   const request=route.request(),path=new URL(request.url()).pathname;
   if(request.method()==='OPTIONS')return route.fulfill({status:204});
   if(request.method()!=='GET')writes.push(path);
   if(path.includes('/evidence'))evidenceRequests++;
   const user={userId:'notes-tutor',firstName:'Test',email:'test@example.invalid',role:'tutor'};
   let json={success:true,user,data:[]};
   if(path==='/proof/tutor-certification/me')json.data={snapshot:{writtenPassed:true,speakingPassed:true,profileApproved:true,interviewPassed:true,missingRequirements:[]}};
   if(path==='/notifications')json.data={notifications:[],unreadCount:0};
   if(path===`/schedule/tutor-lesson/${id}`)json.data={bookingId:id,sessionId:id,studentId:'notes-student',slotDate:'2026-10-30',slotTime:'8:00 PM',durationMinutes:25,status:'confirmed'};
   if(path==='/tutor/student/notes-student')json.data={id:'notes-student',givenName:'Test',familyName:'Student',country:'Japan',joinDate:'2026-04-03',hobbies:[]};
   if(path===`/tutor/lesson-notes-edit-window/${id}`)json.data={startsAt,editableUntil:'2026-11-01T12:25:00Z',serverNow:'2026-10-28T12:00:00Z',reason:null,studentAttendance:'present',canEdit:true};
   if(path===`/lesson-workflow/tutor/${id}`)json.data={startsAt,endsAt:'2026-10-30T12:25:00Z',editableUntil:'2026-11-01T12:25:00Z',serverNow:'2026-10-28T12:00:00Z',canEdit:true,closed:false,notesStatus:'draft',studentAttendance:'present',attendanceVerified:false};
   if(path===`/tutor/classroom-lesson-notes/${id}`)json.data={studentAttendance:'present',materials:[],studentComment:'',tutorMemo:'',englishLevelAssessment:null,updatedAt:null};
   if(path===`/tutor/lesson-notes/${id}`)json.data=populated?[{sessionId:id,startsAt,tutorName:'Test Tutor',studentAttendance:'present',notes:[],englishLevelAssessment:3,studentComment:'Good conversation practice.',tutorMemo:'Continue with everyday vocabulary.',summaryUpdatedAt:startsAt}]:[];
   if(json.data && !Array.isArray(json.data) && json.data.editableUntil){json.data.startsAt=startsAt;json.data.editableUntil=new Date(Date.now()+47*3600000).toISOString();json.data.serverNow=new Date().toISOString();}
   return route.fulfill({json});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));

  await page.goto(`${base}/lesson/${id}`,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Edit notes',exact:true}).click();
  const editor=page.getByRole('dialog',{name:'Edit lesson notes',exact:true});
  await expect(editor.getByLabel('Material used',{exact:true})).toBeVisible();
  for(const element of await editor.locator('.lesson-student-attendance,.dispatch-notes-section,.dispatch-notes-label,.lesson-assessment-options').all()){
   assert.equal(await element.evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
  }
  await expect(editor.getByRole('radio')).toHaveCount(11);
  await page.screenshot({path:`/tmp/lesson-editor-surfaces-${theme}-${width}.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await editor.getByRole('button',{name:'Close editor',exact:true}).click();
  await expect(editor).toHaveCount(0);
  assert.equal(evidenceRequests,0);assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  await context.close();console.log(`PASS ${width}px ${theme}: consistent editor surfaces, assessment controls and modal close`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
