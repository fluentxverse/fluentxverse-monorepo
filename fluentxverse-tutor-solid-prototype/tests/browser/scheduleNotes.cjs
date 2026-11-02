const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.TUTOR_TEST_URL||'http://127.0.0.1:5273';
const now=Date.parse('2026-10-28T14:00:00Z');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 fs.mkdirSync('/tmp/fluentxverse-schedule-notes',{recursive:true});
 try{for(const theme of ['light','dark'])for(const width of [1440,375]){
  const context=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce'});
  await context.addInitScript(theme=>localStorage.setItem('theme-storage',JSON.stringify({state:{themeMode:theme,isDarkMode:theme==='dark'},version:2})),theme);
  let submitted=false,reads=0;const writes=[],errors=[];
  await context.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(?:localhost|127\.0\.0\.1):(?:8765|8780|8782))\//,route=>{
   const path=new URL(route.request().url()).pathname;
   if(!['GET','OPTIONS'].includes(route.request().method()))writes.push(path);
   const user={userId:'schedule-notes-tutor',firstName:'Test',role:'tutor',email:'test@example.invalid'};
   let data=[];
   if(path==='/proof/tutor-certification/me')data={snapshot:{writtenPassed:true,speakingPassed:true,interviewPassed:true,profileApproved:true,missingRequirements:[]}};
   if(path==='/notifications')data={notifications:[],unreadCount:0};
   if(path==='/schedule/week'){
    reads++;
    data={weekStart:'2026-10-26',weekEnd:'2026-11-01',slots:[
     ['missing','20:00',submitted?'submitted':'draft'],['complete','20:30','submitted'],['changes','21:00','changes_pending'],
     ['exempt','21:30','not_required'],['ongoing','22:00','draft'],['future','22:30','draft']
    ].map(([id,time,notesStatus])=>({date:'2026-10-28',time,status:'booked',slotId:id,bookingId:id,studentId:'student-'+id,studentName:id,attendanceTutor:'present',notesStatus,
      lessonEndsAt:new Date(Date.parse(`2026-10-28T${time}:00+08:00`)+25*60000).toISOString()}))};
   }
   return route.fulfill({json:{success:true,user,data}});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install({time:new Date(now)});
  await page.goto(base+'/schedule',{waitUntil:'domcontentloaded'});
  const missing=page.getByRole('button',{name:/Lesson notes incomplete for missing at/});
  await expect(missing).toBeVisible({timeout:30000});await expect(missing).toBeEnabled();
  await expect(missing.locator('svg')).toHaveClass(/clipboard-x/);
  const complete=page.getByRole('button',{name:/Lesson notes complete for complete at/});
  await expect(complete.locator('svg')).toHaveClass(/clipboard-check/);
  await expect(page.getByRole('button',{name:/Lesson notes incomplete for changes at/})).toHaveAttribute('title',/unsubmitted changes/);
  for(const id of ['exempt','ongoing','future'])await expect(page.getByRole('button',{name:new RegExp(`Update attendance for ${id} at`)})).toBeVisible();
  const future=page.getByRole('button',{name:/Update attendance for future at/});await future.click();await expect(future).toHaveAttribute('aria-pressed','true');await future.click();
  const colors=await Promise.all([missing,complete].map(button=>button.evaluate(el=>getComputedStyle(el).color)));
  assert.notEqual(colors[0],colors[1]);
  await page.screenshot({path:`/tmp/fluentxverse-schedule-notes/${theme}-${width}.png`,fullPage:true});
  const before=reads;submitted=true;await page.clock.fastForward(30000);
  await expect.poll(()=>reads).toBeGreaterThan(before);
  const updated=page.getByRole('button',{name:/Lesson notes complete for missing at/});await expect(updated.locator('svg')).toHaveClass(/clipboard-check/);
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[],'Displaying or selecting notes/attendance must not mutate saved records');
  const opened=context.waitForEvent('page');await updated.click();const lesson=await opened;
  await expect.poll(()=>lesson.url()).toContain('/lesson/missing');await lesson.close();
  console.log(`PASS schedule notes ${theme} ${width}: X/check, live refresh, exemptions, ongoing lessons, attendance and notes navigation`);
  await context.close();
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
