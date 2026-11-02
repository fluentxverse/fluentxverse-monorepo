const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.STUDENT_TEST_URL||'http://127.0.0.1:5271';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 fs.mkdirSync('/tmp/fluentxverse-booking-initialization',{recursive:true});
 try{for(const width of [1440,375,320]){
  const context=await browser.newContext({viewport:{width,height:900},timezoneId:'Asia/Tokyo',reducedMotion:'reduce'});
  let mode='trial',modeCalls=0,slotCalls=0,delayMode=false,releaseMode,failSlotOnce=false;
  const writes=[],errors=[];
  await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780)|https:\/\/api\.fluentxverse\.(?:com|xyz))\//,async route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname;
   if(request.method()==='OPTIONS')return route.fulfill({status:204});
   const reply=data=>route.fulfill({json:{success:true,data}});
   if(request.method()!=='GET' && path!=='/schedule/preload')writes.push(path);
   if(path==='/student/me')return route.fulfill({json:{success:true,user:{userId:'booking-init-student',role:'student',firstName:'Mika',email:'test@example.invalid'}}});
   if(path==='/tutor/search')return reply({tutors:[{userId:'booking-init-tutor',firstName:'Alex',nickname:'Alex',displayName:'Alex',isAvailable:true}],total:1,hasMore:false});
   if(path==='/lesson-passes/mode'){
    modeCalls++;
    const responseMode=mode;
    if(delayMode)await new Promise(resolve=>releaseMode=resolve);
    return reply({mode:responseMode,trialLessonLimit:1});
   }
   if(path.startsWith('/schedule/available/')){
    slotCalls++;
    if(failSlotOnce){failSlotOnce=false;return route.fulfill({status:401,json:{success:false,error:'Student authentication required'}});}
    return reply([{slotId:'init-slot',tutorId:'booking-init-tutor',date:url.searchParams.get('startDate'),time:'22:00',durationMinutes:25}]);
   }
   return reply([]);
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-10-28T02:00:00Z')});
  await page.goto(`${base}/browse-tutors`,{waitUntil:'networkidle'});
  const open=()=>page.getByRole('button',{name:'Show schedule for Alex',exact:true}).click();
  const modal=page.locator('.booking-dialog');
  const close=()=>modal.getByRole('button',{name:'Close booking',exact:true}).click();
  delayMode=true;await open();await expect.poll(()=>Boolean(releaseMode)).toBe(true);
  await expect(modal.getByRole('status')).toBeVisible();await expect(modal.getByRole('alert')).toHaveCount(0);
  await expect(modal.locator('.booking-modal-time-slot')).toHaveCount(0);
  delayMode=false;releaseMode();await expect(modal.locator('.booking-modal-time-slot')).toHaveCount(1);
  await expect(modal.getByRole('alert')).toHaveCount(0);await close();
  mode='legacy_erc1155';await open();await expect(modal.getByRole('alert')).toContainText('Trial booking is not available');
  const before=modeCalls;await modal.getByRole('button',{name:'Retry',exact:true}).click();
  await expect.poll(()=>modeCalls).toBe(before+1);await expect(modal.getByRole('alert')).toContainText('Trial booking is not available');
  await expect(modal.locator('.booking-modal-time-slot')).toHaveCount(0);
  mode='trial';await modal.getByRole('button',{name:'Retry',exact:true}).click();
  await expect(modal.locator('.booking-modal-time-slot')).toHaveCount(1);await expect(modal.getByRole('alert')).toHaveCount(0);
  await modal.locator('.booking-modal-time-slot').click();await expect(modal.locator('.booking-modal-confirm')).toBeEnabled();
  await page.screenshot({path:`/tmp/fluentxverse-booking-initialization/${width}.png`});await close();
  failSlotOnce=true;const slotsBefore=slotCalls;await open();
  await expect(modal.locator('.booking-modal-time-slot')).toHaveCount(1);await expect(modal.getByRole('alert')).toHaveCount(0);
  assert.equal(slotCalls,slotsBefore+2,'A rejected read recovers the session and replays once');await close();
  delayMode=true;releaseMode=null;mode='legacy_erc1155';await open();await expect.poll(()=>Boolean(releaseMode)).toBe(true);
  const oldRelease=releaseMode;await close();delayMode=false;mode='trial';await open();
  await expect(modal.locator('.booking-modal-time-slot')).toHaveCount(1);oldRelease();
  await page.waitForTimeout(200);await expect(modal.getByRole('alert')).toHaveCount(0);
  assert.deepEqual(writes,[],'Read-only initialization never books or spends a ticket');assert.deepEqual(errors,[]);
  await context.close();console.log(`PASS ${width}px: coordinated initial load, full retry, fail-closed mode, session repair and stale-response protection`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
