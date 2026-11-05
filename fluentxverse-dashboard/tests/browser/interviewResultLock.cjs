const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const base=process.env.INTERVIEW_DASHBOARD_URL||'http://127.0.0.1:5303';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 try{for(const width of [1440,390])for(const decision of ['pass','fail']){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();
  let saved=null,attempts=0,failSave=true,failRefresh=false;const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.routeWebSocket('**/*',ws=>ws.close());
  await context.route('**/*',route=>{
   const url=new URL(route.request().url()),path=url.pathname;
   if(url.origin===base)return route.continue();
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204});
   if(path==='/admin/me')return route.fulfill({json:{success:true,user:{userId:'reviewer',username:'Reviewer',role:'superadmin'}}});
   if(path==='/interview/result'){
    attempts++;
    if(failSave){failSave=false;return route.fulfill({status:503,json:{success:false,error:'Save unavailable'}});}
    saved=route.request().postDataJSON().result;failRefresh=true;
    return route.fulfill({json:{success:true}});
   }
   if(path==='/interview/room/result-lock-fixture'){
    if(failRefresh)return route.fulfill({status:503,json:{success:false,error:'Refresh unavailable'}});
    return route.fulfill({json:{success:true,data:{id:'result-lock-fixture',tutorId:'test-tutor',tutorName:'Test Tutor',status:'completed',mediaClosed:true,
      result:saved,reviewedAt:saved?'2026-11-03T00:00:00Z':null}}});
   }
   return route.fulfill({json:{success:true,data:[]}});
  });
  await page.goto(base+'/interview-room/result-lock-fixture');
  const tab=page.getByRole('tab',{name:'Evaluation',exact:true});await tab.click();
  const pass=page.locator('.btn-pass'),fail=page.locator('.btn-fail');
  const choose=async()=>{await (decision==='pass'?pass:fail).click();await page.getByRole('button',{name:decision==='pass'?'Confirm Pass':'Confirm Fail',exact:true}).click();};
  await expect(pass).toBeEnabled();await choose();await expect(page.getByText('Save unavailable',{exact:true})).toBeVisible();
  await expect(pass).toBeEnabled();await expect(fail).toBeEnabled();
  await choose();await expect(page.getByRole('heading',{name:`Saved result: ${decision==='pass'?'Passed':'Failed'}`,exact:true})).toBeVisible();
  await expect(pass).toBeDisabled();await expect(fail).toBeDisabled();
  await page.locator('.note-input-area textarea').fill('Updated note');
  await expect(pass).toBeDisabled();await expect(fail).toBeDisabled();assert.equal(attempts,2);
  failRefresh=false;await page.reload();await tab.click();
  await expect(pass).toBeDisabled();await expect(fail).toBeDisabled();assert.equal(attempts,2);assert.deepEqual(errors,[]);
  console.log(`PASS ${width} ${decision}: failed save retry, saved lock despite refresh failure, note edits and page reload`);await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
