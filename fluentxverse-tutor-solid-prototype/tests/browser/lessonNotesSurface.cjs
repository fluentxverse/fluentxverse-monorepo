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
  const startsAt='2026-10-30T12:00:00Z';
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
   if(path===`/tutor/lesson-notes-edit-window/${id}`)json.data={startsAt,editableUntil:'2026-11-01T12:25:00Z',serverNow:'2026-10-28T12:00:00Z',reason:'not_started',studentAttendance:'present',canEdit:false};
   if(path===`/lesson-workflow/tutor/${id}`)json.data={startsAt,endsAt:'2026-10-30T12:25:00Z',editableUntil:'2026-11-01T12:25:00Z',serverNow:'2026-10-28T12:00:00Z',canEdit:false,closed:false,notesStatus:'draft',studentAttendance:'present',attendanceVerified:false};
   if(path===`/tutor/lesson-notes/${id}`)json.data=populated?[{sessionId:id,startsAt,tutorName:'Test Tutor',studentAttendance:'present',notes:[],englishLevelAssessment:3,studentComment:'Good conversation practice.',tutorMemo:'Continue with everyday vocabulary.',summaryUpdatedAt:startsAt}]:[];
   return route.fulfill({json});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  for(populated of [false,true]){
   await page.goto(`${base}/lesson/${id}`,{waitUntil:'networkidle'});
   const card=page.locator('.lesson-notes-card');await expect(card).toBeVisible();
   await expect(card.locator('.lesson-assessment-section')).toBeVisible();
   await expect(page.getByRole('region',{name:'Private dispute evidence',exact:true})).toHaveCount(0);
   const targets=card.locator('.lesson-student-attendance,.lesson-assessment-section,.lesson-assessment-section > h4');
   assert.equal(await targets.count(),3);
   for(const el of await targets.all())assert.equal(await el.evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
   await expect(card.getByRole('tab',{name:'This Lesson',exact:true})).toHaveAttribute('aria-selected','true');
   if(populated)await expect(card).toContainText('Good conversation practice.');
   await card.scrollIntoViewIfNeeded();
   await page.screenshot({path:`/tmp/fluentxverse-lesson-notes-surface/${width}-${theme}-${populated?'filled':'empty'}.png`});
   await card.getByRole('tab',{name:'Recent Lessons',exact:true}).click();
   await expect(card.getByRole('tab',{name:'Recent Lessons',exact:true})).toHaveAttribute('aria-selected','true');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  assert.equal(evidenceRequests,0);assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  await context.close();console.log(`PASS ${width}px ${theme}: no evidence panel or requests, consistent note surfaces, empty/filled notes and tab navigation`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
