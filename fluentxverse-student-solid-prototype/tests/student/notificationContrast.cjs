const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.STUDENT_TEST_URL||'http://127.0.0.1:5283';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 fs.mkdirSync('/tmp/fluentxverse-notification-contrast',{recursive:true});
 try{for(const width of [1440,390,320])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce'});
  await context.addInitScript(theme=>localStorage.setItem('theme-storage',JSON.stringify({state:{themeMode:theme,isDarkMode:theme==='dark'},version:2})),theme);
  const errors=[],writes=[];
  await context.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url()),path=url.pathname;
   if(url.origin===base)return route.continue();
   if(!['GET','OPTIONS'].includes(req.method())&&/^(api\.fluentxverse\.(com|xyz)|localhost|127\.0\.0\.1)$/.test(url.hostname))writes.push(path);
   const user={userId:'contrast-student',givenName:'Mika',role:'student',email:'mika@example.test'};
   let data=[];
   if(path==='/student/profile')data=user;
   if(path.replace(/\/$/,'')==='/notifications')data={notifications:[
    {id:'read',title:'Lesson issue report updated',message:'Your lesson issue report has been resolved. View the outcome on the lesson page.',timestamp:'2026-10-29T13:23:55Z',isRead:true,data:{link:'/lesson/example'}},
    {id:'unread',title:'Lesson feedback ready',message:'Your tutor has submitted your lesson notes.',timestamp:'2026-10-16T06:56:59Z',isRead:false,data:{link:'/lesson/feedback'}}],unreadCount:1};
   return route.fulfill({json:{success:true,user,data,profile:{},lessons:[]}});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/schedule',{waitUntil:'networkidle'});
  const bell=page.locator('.student-notification-bell');
  if(width===320){await bell.focus();await page.keyboard.press('Enter');}
  else await bell.click();
  const dialog=page.getByRole('dialog',{name:'Notifications',exact:true});await expect(dialog).toBeVisible();await expect(dialog.locator('a')).toHaveCount(2);
  const results=await dialog.evaluate(el=>{
   const rgb=value=>(value.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
   const lum=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
   const bg=rgb(getComputedStyle(el).backgroundColor);
   return [...el.querySelectorAll('h2,a strong,a > span,time,header button')].map(node=>{
    const color=rgb(getComputedStyle(node).color);let opacity=1;
    for(let parent=node;parent&&parent!==el.parentElement;parent=parent.parentElement)opacity*=Number(getComputedStyle(parent).opacity);
    const blended=color.map((value,index)=>value*opacity+bg[index]*(1-opacity));
    const a=lum(blended),b=lum(bg);return {text:node.textContent,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),opacity};
   });
  });
  for(const item of results){assert(item.ratio>=4.5,`${theme}: ${item.text} contrast ${item.ratio}`);assert.equal(item.opacity,1);}
  await expect(dialog.locator('a.is-read')).toHaveAttribute('href','/lesson/example');
  const box=await dialog.boundingBox();assert(box.x>=0&&box.x+box.width<=width);
  await page.screenshot({path:`/tmp/fluentxverse-notification-contrast/${width}-${theme}.png`});
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
  assert.deepEqual(errors,[]);assert(writes.every(path=>path==='/schedule/preload'));
  await context.close();console.log(`PASS ${width}px ${theme}: read/unread title, message, timestamp and close-button contrast >=4.5:1; modal fits and closes`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
