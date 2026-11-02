const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.STUDENT_TEST_URL||'http://127.0.0.1:5176';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 fs.mkdirSync('/tmp/fluentxverse-nickname',{recursive:true});
 try{for(const width of [1440,390,320])for(const nickname of ['Mary Ann',undefined]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const tutor={userId:'nickname-fixture',firstName:'LegalFirst',lastName:'PrivateSurname',displayName:'LegalFirst PrivateSurname',nickname,bio:'A friendly tutor',languages:[],interests:[],education:[],specializations:[]};
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());if(url.origin===base)return route.continue();
   let json={success:true,data:[]};
   if(url.pathname==='/student/me')json={success:false};
   if(url.pathname==='/tutor/search')json.data={tutors:[tutor],total:1,page:1,hasMore:false};
   if(url.pathname==='/tutor/nickname-fixture')json.data=tutor;
   return route.fulfill({json});
  });
  await page.goto(`${base}/browse-tutors`,{waitUntil:'networkidle'});
  await expect(page.locator('.browse-tutor-card')).toHaveCount(1);
  await expect(page.getByRole('heading',{name:nickname||'LegalFirst',exact:true})).toBeVisible();
  await expect(page.locator('body')).not.toContainText('PrivateSurname');
  await page.goto(`${base}/tutor/nickname-fixture`,{waitUntil:'networkidle'});
  await expect(page.locator('.profile-name')).toHaveText(nickname||'LegalFirst');
  await expect(page.locator('body')).not.toContainText('PrivateSurname');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`/tmp/fluentxverse-nickname/student-${width}-${nickname?'nickname':'legacy'}.png`,fullPage:true});
  assert.deepEqual(errors,[]);await page.close();
  console.log(`PASS ${width}px ${nickname?'preferred nickname':'legacy first-name fallback'}: student discovery and public profile hide surname`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
