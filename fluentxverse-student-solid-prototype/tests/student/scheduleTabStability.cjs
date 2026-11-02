const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.STUDENT_TEST_URL||'http://127.0.0.1:5275';
const now=Date.parse('2026-10-29T03:00:00Z');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',ignoreDefaultArgs:['--hide-scrollbars'],args:['--no-sandbox','--disable-features=OverlayScrollbar']});
 fs.mkdirSync('/tmp/fluentxverse-schedule-tabs',{recursive:true});
 try{for(const theme of ['light','dark'])for(const width of [1566,1200,1024,390]){
  const context=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce'});
  await context.addInitScript(theme=>localStorage.setItem('theme-storage',JSON.stringify({state:{themeMode:theme,isDarkMode:theme==='dark'},version:2})),theme);
  const errors=[],writes=[];
  await context.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(?:localhost|127\.0\.0\.1):(?:8765|8780|8782))\//,route=>{
   const path=new URL(route.request().url()).pathname;
   if(!['GET','OPTIONS'].includes(route.request().method()))writes.push(path);
   const user={userId:'schedule-tab-fixture',role:'student',givenName:'Mika',email:'test@example.invalid'};
   let data=[];
   if(path==='/student/profile')data=user;
   if(path==='/notifications')data={notifications:[],unreadCount:0};
   if(path==='/schedule/student-bookings')data=Array.from({length:14},(_,i)=>({bookingId:'past-'+i,tutorId:'tutor-fixture',tutorName:'Alex',slotDate:'2026-10-28',slotTime:`${String(9+Math.floor(i/2)).padStart(2,'0')}:${i%2?'30':'00'}`,durationMinutes:25,status:'completed'}));
   return route.fulfill({json:{success:true,user,data,profile:{},lessons:[]}});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install({time:new Date(now)});
  await page.goto(base+'/schedule',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'No Upcoming Lessons',exact:true})).toBeVisible({timeout:30000});
  await page.evaluate(()=>document.fonts.ready);
  const metrics=()=>page.evaluate(()=>{
   const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
   return {header:rect('.schedule-header'),tabs:rect('.schedule-tabs'),timezone:rect('.schedule-timezone'),container:rect('.schedule-page .container'),navigation:rect('.app-header-shell #sticky-header'),rootWidth:document.documentElement.getBoundingClientRect().width,scrollY,scrollHeight:document.documentElement.scrollHeight,gutter:getComputedStyle(document.documentElement).scrollbarGutter};
  });
  const upcoming=await metrics();
  assert.match(upcoming.gutter,/stable/);
  assert.ok(upcoming.rootWidth<width,'The test must exercise reserved, non-overlay scrollbar space');
  for(let i=0;i<4;i++){
   await page.getByRole('button',{name:/Past Lessons/}).click();
   await expect(page.getByRole('region',{name:'Past lessons calendar'})).toBeVisible();
   const past=await metrics();assert.ok(past.scrollHeight>950,'Past lessons must force page scrolling');
   for(const key of ['header','tabs','timezone','navigation'])assert.deepEqual(past[key],upcoming[key],`${key} shifted entering Past Lessons at ${width}px ${theme}`);
   assert.equal(past.container.x,upcoming.container.x);assert.equal(past.container.width,upcoming.container.width);
   assert.equal(past.rootWidth,upcoming.rootWidth);assert.equal(past.scrollY,upcoming.scrollY);
   assert.equal(new URL(page.url()).searchParams.get('tab'),'past');
   if(!i)await page.screenshot({path:`/tmp/fluentxverse-schedule-tabs/past-${theme}-${width}.png`});
   await page.getByRole('button',{name:/Upcoming/}).click();
   await expect(page.getByRole('heading',{name:'No Upcoming Lessons',exact:true})).toBeVisible();
   const restored=await metrics();
   for(const key of ['header','tabs','timezone','navigation','rootWidth','scrollY'])assert.deepEqual(restored[key],upcoming[key],`${key} shifted returning to Upcoming at ${width}px ${theme}`);
   assert.equal(new URL(page.url()).searchParams.has('tab'),false);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`/tmp/fluentxverse-schedule-tabs/upcoming-${theme}-${width}.png`});
  assert.deepEqual(errors,[]);assert.ok(writes.every(path=>path==='/schedule/preload'),'Tab switches must not mutate bookings');await context.close();
  console.log(`PASS stable schedule tabs ${theme} ${width}: repeated empty/list swaps preserve header, tabs, navigation and viewport position`);
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
