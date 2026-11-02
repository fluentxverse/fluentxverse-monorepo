const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.TUTOR_TEST_URL||'http://127.0.0.1:5274';
const api=/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(?:localhost|127\.0\.0\.1):(?:8765|8780|8782))\//;
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 fs.mkdirSync('/tmp/fluentxverse-home-status',{recursive:true});
 try{for(const theme of ['light','dark'])for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce'});
  await context.addInitScript(theme=>{
   localStorage.setItem('theme-storage',JSON.stringify({state:{themeMode:theme,isDarkMode:theme==='dark'},version:2}));
   window.__homeOnboardingFrames=0;window.__trackHomeOnboarding=true;
   new MutationObserver(()=>{
    if(window.__trackHomeOnboarding&&document.querySelector('.home-page-container .main-status-card,.home-page-container .certification-alert'))window.__homeOnboardingFrames++;
   }).observe(document,{childList:true,subtree:true,characterData:true});
  },theme);
  let releaseProof,releaseInterview;
  const proofGate=new Promise(resolve=>releaseProof=resolve),interviewGate=new Promise(resolve=>releaseInterview=resolve);
  let qualified=true,failProof=false,examReads=0,proofReads=0;
  const errors=[];
  await context.route(api,async route=>{
   const path=new URL(route.request().url()).pathname;
   const user={userId:'home-hydration-fixture',role:'tutor',firstName:'Alex',email:'test@example.invalid'};
   let data=[];const json={success:true,user,data};
   if(path.replace(/\/$/,'')==='/tutor/email-verification')json.data={verified:true};
   if(path==='/proof/tutor-certification/me'){
    proofReads++;await proofGate;
    if(failProof)return route.fulfill({json:{success:false,error:'Fixture status unavailable'}});
    json.data={snapshot:{writtenPassed:true,speakingPassed:true,profileApproved:qualified,profileStatus:qualified?'approved':'incomplete',interviewPassed:true,missingRequirements:qualified?[]:['profile_approval']}};
   }
   if(path==='/interview/my-booking'){await interviewGate;json.data={result:'pass',status:'completed',date:'2026-10-28',time:'2:00 PM'};}
   if(path.startsWith('/exam/')){examReads++;json.status={passed:true,percentage:95,attemptsThisMonth:1,maxAttemptsPerMonth:2};}
   if(path==='/notifications')json.data={notifications:[],unreadCount:0};
   if(path==='/schedule/week')json.data={slots:[]};
   if(path==='/tutor/lesson-issues')json.data={direction:'sent',summary:{sent:0,received:0},statusCounts:{submitted:0,under_review:0,resolved:0},items:[]};
   return route.fulfill({json});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install();
  await page.goto(base+'/home?certification=required',{waitUntil:'domcontentloaded'});
  const home=page.locator('.home-page-container'),loading=home.getByRole('status',{name:'Loading home',exact:true});
  await expect(loading).toBeVisible({timeout:30000}).catch(async error=>{console.error({url:page.url(),body:await page.locator('body').innerText(),errors,proofReads,examReads});throw error;});
  await expect(home.getByText('Your teaching journey',{exact:true})).toHaveCount(0);
  await expect(home.locator('.main-status-card,.certification-alert')).toHaveCount(0);
  assert.equal(examReads,0,'Unknown qualification must not render or fetch applicant-only assessments');
  releaseProof();await page.waitForTimeout(150);
  await expect(loading).toBeVisible();await expect(home.getByText(/Welcome back/)).toHaveCount(0);
  releaseInterview();
  const welcome=home.getByRole('heading',{name:'Welcome back, Alex'}),desk=home.getByRole('region',{name:'Teaching Desk'});
  await expect(welcome).toBeVisible();await expect(desk).toBeVisible();await expect(loading).toHaveCount(0);
  assert.equal(examReads,0,'Approved tutors must not wait for unnecessary assessment requests');
  assert.equal(await page.evaluate(()=>window.__homeOnboardingFrames),0,'Onboarding must never flash before the approved workspace');
  await desk.evaluate(el=>el.dataset.hydrationIdentity='stable');
  failProof=true;const before=proofReads;await page.clock.fastForward(15000);
  await expect.poll(()=>proofReads).toBeGreaterThan(before);
  await expect(home.getByText('Could not refresh application status',{exact:true})).toBeVisible();
  await expect(welcome).toBeVisible();await expect(desk).toHaveAttribute('data-hydration-identity','stable');
  await expect(home.locator('.main-status-card,.certification-alert')).toHaveCount(0);
  failProof=false;await home.getByRole('button',{name:'Try again',exact:true}).click();
  await expect(home.getByText('Could not refresh application status',{exact:true})).toHaveCount(0);
  await expect(desk).toHaveAttribute('data-hydration-identity','stable');
  assert.equal(await page.evaluate(()=>window.__homeOnboardingFrames),0);
  await page.screenshot({path:`/tmp/fluentxverse-home-status/approved-${theme}-${width}.png`,fullPage:true});
  await page.evaluate(()=>window.__trackHomeOnboarding=false);
  qualified=false;await page.clock.fastForward(15000);
  await expect(home.getByText('Your teaching journey',{exact:true})).toBeVisible();
  await expect(home.locator('.main-status-card')).toBeVisible();await expect(desk).toHaveCount(0);
  assert.ok(examReads>0,'Actual applicants still load assessment progress');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);await context.close();
  console.log(`PASS home hydration ${theme} ${width}: no onboarding flash, complete status gate, stable refresh/retry and real approval changes`);
 }
 for(const malformed of [false,true]){
 const context=await browser.newContext();
 await context.route(api,route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/proof/tutor-certification/me')return route.fulfill({json:malformed?{success:true,data:null}:{success:false,error:'Unavailable'}});
  let data=path==='/interview/my-booking'?null:[];
  if(path.replace(/\/$/,'')==='/tutor/email-verification')data={verified:true};
  if(path==='/notifications')data={notifications:[],unreadCount:0};
  if(path==='/notifications/unread-count'||path==='/inbox/unread-count')data={unreadCount:0};
  return route.fulfill({json:{success:true,user:{userId:'failed-home-fixture',role:'tutor',firstName:'Test',email:'test@example.invalid'},data}});
 });
 const page=await context.newPage();page.on('console',message=>{if(message.type()==='error')console.error('Initial-failure console:',message.text());});page.on('pageerror',error=>console.error('Initial-failure page error:',error.message));await page.goto(base+'/home',{waitUntil:'domcontentloaded'});
 await expect(page.getByText('Could not refresh application status',{exact:true})).toBeVisible({timeout:30000}).catch(async error=>{console.error({malformed,url:page.url(),body:await page.locator('body').innerText()});throw error;});
 await expect(page.locator('.main-status-card,.certification-alert,.tutor-home-shortcuts')).toHaveCount(0);
 await context.close();console.log('PASS initial status failure: retry shown without assuming applicant or approved status');
 }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
