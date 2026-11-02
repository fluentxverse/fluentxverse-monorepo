const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.TUTOR_TEST_URL||'http://127.0.0.1:5282';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 fs.mkdirSync('/tmp/fluentxverse-first-lesson',{recursive:true});
 try{for(const width of [1440,1024,390,320])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
  await context.addInitScript(theme=>localStorage.setItem('theme-storage',JSON.stringify({state:{themeMode:theme,isDarkMode:theme==='dark'},version:2})),theme);
  let attended=0,slots=0,fail=false,qualified=true,reads=0;
  const errors=[],writes=[];
  await context.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url()),p=url.pathname;
   if(url.origin===base)return route.continue();
   if(!['GET','OPTIONS'].includes(req.method()))writes.push(p);
   const user={userId:'first-lesson-fixture',firstName:'Alex',role:'tutor',email:'alex@example.test'};
   let data=[];
   if(p.replace(/\/$/,'')==='/tutor/email-verification')data={verified:true};
   if(p==='/notifications')data={notifications:[],unreadCount:0};
   if(p==='/proof/tutor-certification/me')data={snapshot:{writtenPassed:true,speakingPassed:true,interviewPassed:true,profileApproved:qualified,missingRequirements:qualified?[]:['profile_approval']}};
   if(p==='/interview/my-booking')data={result:'pass',status:'completed'};
   if(p==='/schedule/week')data={slots:[]};
   if(p==='/tutor/lesson-issues')data={direction:'sent',statusCounts:{submitted:0,under_review:0,resolved:0},items:[]};
   if(p==='/tutor/performance'){
    reads++;assert.equal(url.searchParams.get('period'),'all');
    if(fail)return route.fulfill({status:503,json:{success:false,error:'Unavailable'}});
    data={slots:{bookable:slots},lessons:{attended,cancelled:2,ongoing:1,upcoming:1}};
   }
   return route.fulfill({json:{success:true,user,data,status:{passed:true,percentage:95}}});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.clock.install();
  await page.goto(base+'/home',{waitUntil:'domcontentloaded'});
  const guide=page.getByRole('region',{name:'Get ready for your first lesson'});
  await expect(guide).toBeVisible();await expect(guide.getByRole('button',{name:'Step 1: Choose times',exact:true})).toHaveAttribute('aria-pressed','true');
  for(const element of [guide,...await guide.locator('.first-lesson-guide-header,#first-lesson-guide-content,.first-lesson-guide-body,.first-lesson-guide-copy').all()])assert.equal(await element.evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)','Guide surfaces must match the Home page');
  await expect(guide.getByRole('link',{name:/Open schedule/})).toHaveAttribute('href','/schedule');
  for(const [index,label]of ['Choose times','Open slots','Attendance','Present','Booked lesson','Classroom','Material','Save notes','Submit'].entries()){
   await guide.getByRole('button',{name:`Step ${index+1}: ${label}`,exact:true}).click();
   const picture=guide.locator('.first-lesson-guide-image img');
   await expect.poll(()=>picture.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
   assert((await picture.getAttribute('src')).endsWith(`-${theme}.png`));
   if(index===2)await expect(guide).toContainText('35 and 11 minutes');
   if(index===4)await expect(guide).toContainText('not the clipboard');
   if(index===5)await expect(guide).toContainText('9:55 AM PHT');
   if(index===7)await expect(guide).toContainText('at least 100 characters');
   if(index===8){await expect(guide).toContainText('48 hours');await expect(guide.getByRole('button',{name:'Next step',exact:true})).toBeDisabled();}
   await guide.screenshot({path:`/tmp/fluentxverse-first-lesson/${width}-${theme}-step-${index+1}.png`});
   const enlarge=guide.locator('.first-lesson-guide-image');await enlarge.click();
   const dialog=page.getByRole('dialog',{name:'Schedule guide screenshot',exact:true});await expect(dialog).toBeVisible();
   await dialog.getByRole('button',{name:'Zoom screenshot',exact:true}).click();
   await expect.poll(()=>dialog.locator('.first-lesson-screenshot-scroll').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
   await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(enlarge).toBeFocused();
  }
  await guide.getByRole('button',{name:'Collapse first-lesson guide'}).click();await expect(guide.locator('#first-lesson-guide-content')).toHaveCount(0);
  await guide.getByRole('button',{name:'Expand first-lesson guide'}).click();
  slots=3;await page.reload({waitUntil:'domcontentloaded'});await expect(guide).toBeVisible();await expect(guide).toContainText('Slots opened');
  await expect(guide.getByRole('button',{name:'Step 3: Attendance',exact:true})).toHaveAttribute('aria-pressed','true');
  fail=true;await page.evaluate(()=>dispatchEvent(new Event('focus')));await expect(guide.getByRole('alert')).toBeVisible();
  fail=false;await guide.getByRole('button',{name:'Retry setup guide',exact:true}).click();await expect(guide.getByRole('alert')).toHaveCount(0);
  attended=1;await page.evaluate(()=>dispatchEvent(new Event('focus')));await expect(guide).toHaveCount(0);
  const before=reads;await page.clock.fastForward(60000);assert.equal(reads,before,'Stop polling after the first taught lesson');
  await page.reload({waitUntil:'domcontentloaded'});await expect(page.getByRole('region',{name:'Teaching Desk'})).toBeVisible();
  await expect.poll(()=>reads).toBeGreaterThan(before);await expect(guide).toHaveCount(0);
  await page.goto(base+'/home?preview=first-lesson',{waitUntil:'domcontentloaded'});
  await expect(guide).toBeVisible();await expect(guide.getByRole('button',{name:'Step 1: Choose times',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByText('First-lesson guide preview',{exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Exit preview',exact:true}).click();await expect(guide).toHaveCount(0);
  if(width<992){await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('dialog',{name:'Navigation',exact:true}).getByRole('button',{name:'Settings',exact:true}).click();}else await page.getByTitle('Settings',{exact:true}).click();
  const settings=page.getByRole('dialog',{name:'Account settings',exact:true});
  const guidelines=settings.locator('details.profile-guidelines');
  await expect(guidelines).not.toHaveAttribute('open');
  await guidelines.locator('summary').click();await expect(guidelines).toHaveAttribute('open','');
  await settings.getByRole('button',{name:'Close settings',exact:true}).click();
  if(width<992){await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('dialog',{name:'Navigation',exact:true}).getByRole('button',{name:'Settings',exact:true}).click();}else await page.getByTitle('Settings',{exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Account settings',exact:true}).locator('details.profile-guidelines')).not.toHaveAttribute('open');
  await page.getByRole('dialog',{name:'Account settings',exact:true}).getByRole('button',{name:'Close settings',exact:true}).click();
  attended=0;fail=true;await page.reload({waitUntil:'domcontentloaded'});await expect(page.getByText('Could not check first-lesson progress.')).toBeVisible();await expect(guide).toHaveCount(0);
  fail=false;await page.getByRole('button',{name:'Retry setup guide',exact:true}).click();await expect(guide).toBeVisible();
  qualified=false;const prior=reads;await page.reload({waitUntil:'domcontentloaded'});await expect(page.getByText('Your teaching journey',{exact:true})).toBeVisible();assert.equal(reads,prior);await expect(guide).toHaveCount(0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  await context.close();console.log(`PASS ${width}px ${theme}: guide steps, all screenshots, zoom/focus, slot persistence, first-lesson completion, reload, failures and applicant exclusion`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
