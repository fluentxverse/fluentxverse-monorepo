const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.TUTOR_TEST_URL||'http://127.0.0.1:5282';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});fs.mkdirSync('/tmp/notifications-inbox',{recursive:true});
 try{for(const width of [1440,390,320])for(const theme of ['light','dark']){
 const context=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce'});
 await context.addInitScript(theme=>localStorage.setItem('theme-storage',JSON.stringify({state:{themeMode:theme,isDarkMode:theme==='dark'},version:2})),theme);
 let rows=Array.from({length:23},(_,i)=>({id:'n'+i,type:i%2?'booking_new':'system',title:i%2?'New Session Booked':'Submit lesson notes',message:'Complete and submit the feedback for your ended lesson.',timestamp:new Date(Date.now()-i*3600000).toISOString(),isRead:i>4,data:{link:'/lesson/fixture-'+i}})),fail=false,failAction=false;
 const errors=[];
 await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):\d+)\//,route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;
  if(url.origin===base)return route.continue();
  const user={userId:'inbox-fixture',firstName:'Alex',role:'tutor',email:'test@example.invalid'};
  const reply=data=>route.fulfill({json:{success:true,user,data}});
  if(path==='/notifications'&&req.method()==='GET'){
   if(fail&&url.searchParams.get('limit')==='20')return route.fulfill({status:503,json:{success:false}});
   const list=url.searchParams.get('isRead')==='false'?rows.filter(r=>!r.isRead):rows;
   return reply({notifications:list.slice(Number(url.searchParams.get('offset')||0),Number(url.searchParams.get('offset')||0)+Number(url.searchParams.get('limit')||50)),unreadCount:rows.filter(r=>!r.isRead).length});
  }
  if(path==='/notifications/unread-count')return reply({unreadCount:rows.filter(r=>!r.isRead).length});
  if(path.startsWith('/notifications/')&&['POST','DELETE'].includes(req.method())){
   if(failAction)return route.fulfill({status:503,json:{success:false}});
   if(path.endsWith('/read-all'))rows=rows.map(r=>({...r,isRead:true}));
   else if(req.method()==='DELETE')rows=rows.filter(r=>r.id!==path.split('/').at(-1));
   else rows=rows.map(r=>r.id===path.split('/')[2]?{...r,isRead:true}:r);
   return reply(null);
  }
  return reply([]);
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/notifications',{waitUntil:'networkidle'});const inbox=page.locator('.notification-inbox');
 await expect(inbox.locator('.ni-row')).toHaveCount(20);
 if(width>600){const box=await inbox.boundingBox();assert(box.width<=1040,'Inbox must stay centered and constrained');}
 for(const row of await inbox.locator('.ni-row').all()){
  const box=await row.boundingBox();assert(box.height<=(width>600?100:210),`Notification row too tall: ${box.height}`);
 }
 for(const section of await inbox.locator('.ni-feed,.ni-feed > section,.ni-day,ul').all())assert.equal(await section.evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
 await inbox.getByRole('button',{name:'Load more',exact:true}).click();await expect(inbox.locator('.ni-row')).toHaveCount(23);await expect(inbox.getByRole('button',{name:'Load more',exact:true})).toHaveCount(0);
 await expect(inbox.locator('.ni-link').first()).toHaveAttribute('href','/lesson/fixture-0');
 failAction=true;await inbox.getByRole('button',{name:'Mark as read: Submit lesson notes',exact:true}).first().click();await expect(inbox.getByRole('alert')).toContainText('Could not update');await expect(inbox.locator('.ni-unread')).toHaveCount(5);
 failAction=false;await inbox.getByRole('button',{name:'Mark as read: Submit lesson notes',exact:true}).first().click();await expect(inbox.locator('.ni-unread')).toHaveCount(4);
 await inbox.getByRole('button',{name:'Delete: New Session Booked',exact:true}).first().click();await expect(inbox.locator('.ni-row')).toHaveCount(22);
 await inbox.getByRole('group',{name:'Notification filter'}).getByRole('button',{name:/Unread/}).click();await expect(inbox.locator('.ni-row')).toHaveCount(3);
 await page.evaluate(()=>window.scrollTo(0,0));
 await expect(inbox.getByRole('heading',{name:'Notifications',exact:true})).toBeInViewport();
 await page.screenshot({path:`/tmp/notifications-inbox/${width}-${theme}.png`,fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 for(const button of await inbox.locator('.ni-actions button').all())assert.equal(await button.evaluate(el=>getComputedStyle(el).opacity),'1');
 await inbox.getByRole('button',{name:'Mark all as read',exact:true}).click();await expect(inbox.getByRole('heading',{name:'No unread notifications',exact:true})).toBeVisible();
 fail=true;await inbox.getByRole('button',{name:'Refresh notifications',exact:true}).click();await expect(inbox.getByRole('alert')).toContainText('Could not load');
 fail=false;await inbox.getByRole('button',{name:'Try again',exact:true}).click();await expect(inbox.getByRole('alert')).toHaveCount(0);
 await inbox.getByRole('button',{name:'All',exact:true}).click();await expect(inbox.locator('.ni-row')).toHaveCount(20);
 assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${width} ${theme}: pagination, read/delete failures and success, filters, empty/error/retry and accessible actions`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
