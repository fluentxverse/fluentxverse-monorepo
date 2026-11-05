const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const base=process.env.TUTOR_TEST_URL||'http://127.0.0.1:5301';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();
  let status='pending_review',errors=[];
  const items=Object.fromEntries(['nickname','profilePicture','videoIntro','bio','education','interests','legacy'].map(k=>[k,{status:'approved'}]));
  page.on('pageerror',e=>errors.push(e.message));await context.routeWebSocket('**/*',ws=>ws.close());
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());if(url.origin===base)return route.continue();
   let json={success:true,data:[]};
   if(url.pathname==='/tutor/me')json.user={userId:'review-status-fixture',firstName:'Test',role:'tutor',email:'test@example.invalid'};
   if(url.pathname==='/tutor/profile')json.data={userId:'review-status-fixture',nickname:'Test Tutor',firstName:'Test',bio:'An experienced English tutor.',profileStatus:status,profileItemStatuses:items,interests:['Reading'],education:[],profilePicture:'/assets/img/logo/logo.png',videoIntroUrl:''};
   if(url.pathname==='/notifications')json.data={notifications:[],unreadCount:0};
   return route.fulfill({json});
  });
  await page.goto(base+'/application/profile');
  await expect(page.getByText('Review Progress: 6/6 items approved',{exact:true})).toBeVisible();
  assert.equal(await page.locator('.progress-bar-fill').evaluate(el=>el.style.width),'100%');
  status='approved';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading',{name:'Profile Approved',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Profile Under Review',exact:true})).toHaveCount(0);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`/tmp/profile-review-status-${width}.png`,fullPage:true});
  assert.deepEqual(errors,[]);console.log(`PASS ${width}: six-item progress bounded, extra legacy key ignored, approved status refreshes without reload`);await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
