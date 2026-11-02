const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.STUDENT_TEST_URL||'http://127.0.0.1:5271';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 fs.mkdirSync('/tmp/fluentxverse-guest-login',{recursive:true});
 try{for(const width of [1440,375,320]){
  const context=await browser.newContext({viewport:{width,height:900},timezoneId:'Asia/Tokyo',reducedMotion:'reduce'});
  let modeRequests=0,configLoaded=false,oauthRedirect=false;
  const mutations=[];
  await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780)|https:\/\/api\.fluentxverse\.(?:com|xyz))\//,route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname;
   if(request.method()==='OPTIONS')return route.fulfill({status:204});
   if(['/schedule/book','/schedule/reserve','/student/auth/privy'].includes(path))mutations.push(path);
   const reply=data=>route.fulfill({json:{success:true,data}});
   if(path==='/student/me'||path==='/student/refresh')return route.fulfill({status:401,json:{success:false}});
   if(path==='/lesson-passes/mode'){modeRequests++;return reply({mode:'legacy_erc1155'});}
   if(path==='/tutor/search')return reply({tutors:[{userId:'guest-login-tutor',firstName:'Alex',nickname:'Alex',displayName:'Alex',isAvailable:true}],total:1,hasMore:false});
   if(path.startsWith('/schedule/available/'))return reply([{slotId:'guest-slot',tutorId:'guest-login-tutor',date:url.searchParams.get('startDate'),time:'22:00',durationMinutes:25}]);
   return reply([]);
  });
  // Stop at the provider authorization screen. Never authenticate or create an account.
  await context.route('https://accounts.google.com/**',route=>{oauthRedirect=true;return route.fulfill({contentType:'text/html',body:'<!doctype html><title>OAuth redirect verified</title>'});});
  const page=await context.newPage();
  page.on('response',response=>{
   const url=new URL(response.url());
   if(url.hostname==='auth.privy.io'&&url.pathname.includes('/apps/')&&response.status()===200)configLoaded=true;
  });
  await page.clock.install({time:new Date('2026-10-28T02:00:00Z')});
  await page.goto(`${base}/browse-tutors`,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Show schedule for Alex',exact:true}).click();
  const modal=page.locator('.booking-dialog');
  await expect(modal.locator('.booking-modal-time-slot')).toHaveCount(1);
  const signIn=modal.getByRole('button',{name:'Sign In to Book',exact:true});
  await modal.locator('.booking-modal-time-slot').click();await expect(signIn).toBeEnabled();await signIn.click();
  const login=page.getByRole('dialog',{name:'Sign in or register'});
  await expect(login).toBeVisible();
  await expect.poll(()=>configLoaded,{timeout:45000}).toBe(true);
  await expect(login.getByRole('button',{name:/Continue with Google/})).toBeEnabled({timeout:45000});
  await expect(login).not.toContainText('not configured');
  await page.screenshot({path:`/tmp/fluentxverse-guest-login/${width}.png`});
  if(process.env.VERIFY_LIVE_OAUTH==='1'&&width===1440){
   await login.getByRole('button',{name:/Continue with Google/}).click();
   await expect.poll(()=>oauthRedirect,{timeout:45000}).toBe(true);
  }else{
   await login.getByRole('button',{name:'Close sign in',exact:true}).click();
   await expect(modal).toBeVisible();await expect(modal.locator('.booking-modal-time-slot.selected')).toHaveCount(1);
  }
  assert.equal(modeRequests,0,'Guests can sign in without booking-credit configuration');
  assert.deepEqual(mutations,[],'No session exchange, booking or ticket spending during sign-in checks');
  await context.close();console.log(`PASS ${width}px: guest sign-in enabled, live public SDK configuration loaded, selection retained${oauthRedirect?', Google OAuth authorization redirect verified':''}`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
