const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base=process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5316';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 await fs.mkdir('/tmp/fxv-replacement-preference',{recursive:true});
 try{for(const width of [1440,390])for(const theme of ['light','dark']){
  let enabled=false,fail=false,writes=0;
  const context=await browser.newContext({viewport:{width,height:950}});
  await context.addInitScript(theme=>localStorage.setItem('theme-storage',JSON.stringify({state:{themeMode:theme,isDarkMode:theme==='dark'},version:2})),theme);
  await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780|8782))\//,async route=>{
   const r=route.request(),p=new URL(r.url()).pathname;
   if(r.method()==='OPTIONS')return route.fulfill({status:204});
   const json={success:true,data:[],profile:{},lessons:[],user:{userId:'replacement-test',id:'replacement-test',givenName:'Test',familyName:'Student',email:'test@example.invalid',role:'student',tier:1}};
   if(p==='/student/replacement-preference'){
    if(r.method()==='PUT'){writes++;if(fail)return route.fulfill({status:503,json:{success:false}});enabled=r.postDataJSON().enabled;}
    json.data={enabled};
   }
   if(p==='/schedule/student-stats')json.data={lessonsCompleted:0,upcomingLessons:0,totalHours:0};
   if(p==='/student/favorites')json.data={favorites:[],total:0,page:1,totalPages:0};
   if(p.startsWith('/tickets/balance/'))json.data={basic:0,premium:0,trial:0};
   if(p==='/student/profile')json.data={id:'replacement-test',givenName:'Test',familyName:'Student',fullName:'Test Student',email:'test@example.invalid',totalLessons:0,upcomingLessons:0,attendance:0};
   return route.fulfill({json});
  });
  await context.routeWebSocket('**/*',ws=>ws.close());
  const page=await context.newPage();
  page.on('pageerror',e=>console.error(e.message));
  page.on('console',m=>{if(m.type()==='error')console.error(m.text());});
  await page.goto(base+'/home');
  await page.getByRole('heading',{name:/Welcome back/}).waitFor().catch(async error=>{console.error(page.url(),await page.locator('body').innerText());throw error;});
  const open=async()=>{
   if(width<992){await page.getByRole('button',{name:'Open mobile menu'}).click();await page.getByRole('button',{name:'Account settings',exact:true}).click();}
   else await page.getByRole('link',{name:'Account settings',exact:true}).click();
  };
  await open();const toggle=page.getByRole('switch',{name:'Automatically find a replacement tutor'});
  await toggle.waitFor();await page.waitForFunction(()=>!document.querySelector('.account-replacement input').disabled);
  assert.equal(await toggle.isChecked(),false);await toggle.click();await page.waitForFunction(()=>!document.querySelector('.account-replacement input').disabled);
  assert.equal(enabled,true);
  await page.getByRole('button',{name:'Close settings',exact:true}).click();await open();
  await page.waitForFunction(()=>document.querySelector('.account-replacement input').checked);
  fail=true;await toggle.click();await page.locator('.account-replacement [role=alert]').waitFor();assert.equal(await toggle.isChecked(),true);
  assert.equal(writes,2);
  assert(await page.locator('.student-account-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth));
  await page.screenshot({path:`/tmp/fxv-replacement-preference/${width}-${theme}.png`});
  await context.close();console.log(`PASS ${width} ${theme}: opt-in persistence, failure retains saved value, layout`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
