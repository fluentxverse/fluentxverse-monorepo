const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.TUTOR_TEST_URL||'http://127.0.0.1:5177';
const expected=['written-test-v1.webp','speaking-test-v1.webp','schedule-v1.webp','contact-check-v1.webp','interview-guide-v1.webp','schedule-v1.webp'];
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 fs.mkdirSync('/tmp/fluentxverse-onboarding-artwork',{recursive:true});
 try{for(const width of [1440,390,320])for(const theme of ['light','dark']){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];
  await page.addInitScript(theme=>localStorage.setItem('theme-storage',JSON.stringify({state:{themeMode:theme,isDarkMode:theme==='dark'},version:2})),theme);
  let state='new';page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());if(url.origin===base)return route.continue();
   let json={success:true,data:[]};
   if(url.pathname==='/tutor/me')json.user={userId:'artwork-fixture',firstName:'Test',email:'fixture@example.invalid',role:'tutor'};
   if(url.pathname.replace(/\/$/,'')==='/tutor/email-verification')json.data={verified:true};
   if(url.pathname==='/exam/status')json.status={passed:state==='new'?null:state!=='failed',percentage:state==='new'?undefined:state==='failed'?60:93,attemptsThisMonth:0,maxAttemptsPerMonth:2};
   if(url.pathname==='/exam/speaking/status')json.status={passed:state==='graded'?true:state==='failed'?false:null,isProcessing:state==='processing',percentage:state==='graded'?90:undefined,attemptsThisMonth:0,maxAttemptsPerMonth:2};
   if(url.pathname==='/interview/my-booking')json.data=null;
   if(url.pathname==='/proof/tutor-certification/me')json.data={snapshot:{writtenPassed:state!=='new'&&state!=='failed',speakingPassed:state==='graded',interviewPassed:false,profileApproved:false,profileStatus:'incomplete',missingRequirements:['interview_pass','profile_approval']},credential:{status:'retired'}};
   if(url.pathname==='/notifications')json.data={notifications:[],unreadCount:0};
   return route.fulfill({json});
  });
  for(state of ['new','processing','graded','failed']){
   await page.goto(`${base}/home`,{waitUntil:'networkidle'});
   const icons=page.locator('.test-icon--artwork img');await expect(icons).toHaveCount(6);
   await expect.poll(()=>icons.evaluateAll(images=>images.every(img=>img.complete&&img.naturalWidth>0))).toBe(true);
   assert.deepEqual(await icons.evaluateAll(images=>images.map(img=>new URL(img.src).pathname.split('/').pop())),expected);
   const geometry=await icons.evaluateAll(images=>images.every(img=>{
    const box=img.getBoundingClientRect(),frame=img.parentElement.getBoundingClientRect();
    return box.width===44&&box.height===44&&box.left>=frame.left-1&&box.right<=frame.right+1&&getComputedStyle(img.parentElement).backgroundColor==='rgba(0, 0, 0, 0)';
   }));assert.equal(geometry,true,'Artwork remains visible without a colored tile or clipping');
   await expect(page.locator('.test-icon--artwork svg')).toHaveCount(0);
   if(state==='processing')await expect(page.getByText('Your saved recordings are being graded.',{exact:false})).toBeVisible();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(state==='processing')await page.screenshot({path:`/tmp/fluentxverse-onboarding-artwork/${width}-${theme}.png`,fullPage:true});
  }
  assert.deepEqual(errors,[]);await page.close();console.log(`PASS ${width}px ${theme}: six custom illustrations in new, processing, graded and failed states`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
