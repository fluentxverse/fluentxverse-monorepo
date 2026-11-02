const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.TUTOR_TEST_URL||'http://127.0.0.1:5177';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 fs.mkdirSync('/tmp/fluentxverse-guidelines-reminder',{recursive:true});
 try{for(const width of [1440,390,320])for(const theme of ['light','dark']){
  const page=await browser.newPage({viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce'});
  let status='incomplete';
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());if(url.origin===base)return route.continue();
   let json={success:true,data:[]};
   if(url.pathname==='/tutor/me')json.user={userId:'reminder-fixture',firstName:'Test',role:'tutor',email:'test@example.invalid'};
   if(url.pathname==='/tutor/profile')json.data={firstName:'Test',profileStatus:status,interests:[],education:[]};
   if(url.pathname==='/notifications')json.data={notifications:[],unreadCount:0};
   return route.fulfill({json});
  });
  await page.goto(`${base}/application/profile`,{waitUntil:'networkidle'});
  const panel=page.getByRole('complementary',{name:'Profile guidelines reminder'});
  await expect(panel).toBeVisible();await expect(panel).toBeInViewport();
  for(const field of ['nickname','bio','profile photo','introduction video','interests'])await expect(panel).toContainText(field);
  assert.ok(await panel.evaluate(el=>el.getBoundingClientRect().bottom <= document.querySelector('.profile-hero').getBoundingClientRect().top));
  await expect.poll(()=>panel.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`/tmp/fluentxverse-guidelines-reminder/${width}-${theme}.png`});
  status='approved';await page.reload({waitUntil:'networkidle'});await expect(panel).toHaveCount(0);
  await page.close();console.log(`PASS ${width}px ${theme}: reminder above profile, required sections, loaded artwork, no overflow, hidden after approval`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
