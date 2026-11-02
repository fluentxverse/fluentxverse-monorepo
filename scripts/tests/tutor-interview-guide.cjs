const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const base=process.env.INTERVIEW_GUIDE_URL||'http://127.0.0.1:5198';
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 const out=require('node:path').resolve(__dirname,'../../output/screenshots/tutor-interview-guide');await fs.mkdir(out,{recursive:true});
 try{for(const width of [1440,768,390,320])for(const theme of ['light','dark']){
  const c=await b.newContext({viewport:{width,height:950}});let identity=null;
  await c.addInitScript(theme=>localStorage.setItem('theme-storage',JSON.stringify({state:{themeMode:theme,isDarkMode:theme==='dark'},version:2})),theme);
  await c.route('**/*',async r=>{
   const u=new URL(r.request().url());if(u.origin===base)return r.continue();u.pathname=u.pathname.replace(/\/$/,'');
   const headers={'access-control-allow-origin':base,'access-control-allow-credentials':'true','access-control-allow-headers':'content-type,cache-control,pragma','access-control-allow-methods':'GET,POST,OPTIONS'};
   if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers});
   const j={success:true,data:[]};
   if(u.pathname==='/tutor/me')j.user={userId:'interview-guide-test',firstName:'Test',email:'test@example.invalid',role:'tutor'};
   if(u.pathname==='/tutor/email-verification')j.data={verified:true};
   if(u.pathname==='/interview/my-booking')j.data=null;
   if(u.pathname==='/tutor-identity/status')j.data={enabled:true,record:identity};
   if(u.pathname==='/exam/status'||u.pathname==='/exam/speaking/status')j.status={passed:true,percentage:93,attemptsThisMonth:0,maxAttemptsPerMonth:2};
   if(u.pathname==='/proof/tutor-certification/me')j.data={snapshot:{writtenPassed:true,speakingPassed:true,interviewPassed:false,profileApproved:false,profileStatus:'incomplete',missingRequirements:['interview_pass','profile_approval']},credential:{status:'retired'}};
   if(u.pathname.includes('notifications'))j.data={notifications:[],unreadCount:0};
   return r.fulfill({headers,json:j});
  });
  await c.routeWebSocket('**/*',ws=>ws.close());
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/home');
  try { await expect(p.getByText('ID submission required',{exact:true})).toBeVisible(); }
  catch(e) { console.error({errors,url:p.url(),body:(await p.locator('body').innerText()).slice(-3000)}); throw e; }
  await expect(p.getByRole('button',{name:'BOOK A SCHEDULE',exact:true})).toBeDisabled();
  await expect(p.getByRole('link',{name:'SUBMIT YOUR ID',exact:true})).toHaveAttribute('href','/interview');
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await p.screenshot({path:`${out}/home-${width}-${theme}.png`,fullPage:true});
  identity={status:'accepted',bookingDeadline:new Date(Date.now()+84*3600000).toISOString()};await p.reload();
  await expect(p.getByRole('button',{name:'BOOK A SCHEDULE',exact:true})).toBeEnabled();
  await p.getByRole('link',{name:'Read the interview guide'}).click();
  await expect(p.getByRole('heading',{name:'Your FluentXVerse interview',exact:true})).toBeVisible();
  await expect(p.getByRole('heading',{name:'What to expect on the call'})).toBeVisible();
  const check=p.getByRole('checkbox',{name:'Same submitted ID within reach'});await check.check();await expect(check).toBeChecked();
  await expect(p.getByText('1 of 4 ready',{exact:true})).toBeVisible();await p.getByRole('button',{name:'Reset checklist'}).click();await expect(check).not.toBeChecked();
  const images=p.locator('.interview-preparation img');await expect(images).toHaveCount(7);
  await expect.poll(()=>images.evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0))).toBe(true);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await p.evaluate(()=>window.scrollTo(0,0));
  await p.screenshot({path:`${out}/guide-${width}-${theme}.png`,fullPage:true});
  assert.deepEqual(errors,[]);await c.close();console.log(`PASS guide ${width}/${theme}`);
 }}finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
