const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const base=process.env.IDENTITY_DASHBOARD_URL||'http://127.0.0.1:5304';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();
  let fail=false,errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.routeWebSocket('**/*',ws=>ws.close());
  await context.route('**/*',route=>{
   const url=new URL(route.request().url()),path=url.pathname;
   if(url.origin===base)return route.continue();
   let json={success:true,data:[]};
   if(path==='/admin/me')json={success:true,user:{userId:'reviewer',username:'Reviewer',role:'superadmin'}};
   if(path==='/admin/operations/access')json.data={permissions:['operations','support','finance']};
   if(path==='/admin/activity'){
    if(fail)return route.fulfill({status:503,json:{success:false,error:'Unavailable'}});
    json.data=Array.from({length:Number(url.searchParams.get('limit'))},(_,i)=>({id:`event-${i}`,type:['identity_reviewed','lesson_report','interview_reviewed'][i%3],message:`Activity ${i+1}`,timestamp:'2026-11-03T00:00:00Z',href:'/identity-reviews'}));
   }
   return route.fulfill({json});
  });
  await page.goto(base+'/identity-reviews');
  await expect(page.getByText('No identity submissions.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Activity feed',exact:true}).click();
  await expect(page.locator('.notification-item')).toHaveCount(25);
  await page.getByRole('button',{name:'Show more',exact:true}).click();
  await expect(page.locator('.notification-item')).toHaveCount(50);
  await expect(page.getByRole('link',{name:'View details'}).first()).toHaveAttribute('href','/identity-reviews');
  fail=true;await page.locator('.notification-header .mark-read-btn').click();
  await expect(page.getByRole('alert')).toContainText('Could not refresh activity');
  await expect(page.locator('.notification-item')).toHaveCount(50);
  fail=false;await page.locator('.notification-header .mark-read-btn').click();
  await expect(page.locator('.notification-error')).toHaveCount(0);
  const box=await page.locator('.notification-dropdown').boundingBox();
  assert(box.x>=0 && box.x+box.width<=width,`Dropdown outside viewport: ${JSON.stringify(box)}`);
  await page.screenshot({path:`/tmp/admin-activity-feed-${width}.png`,fullPage:true});
  assert.deepEqual(errors,[]);console.log(`PASS ${width}: expanded feed, more history, links, failed refresh recovery and layout`);
  await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
