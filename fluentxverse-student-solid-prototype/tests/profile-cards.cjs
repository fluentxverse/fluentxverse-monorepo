const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176';
const videoPath = '/tmp/fluentxverse-profile-cards.mp4';
execFileSync('ffmpeg', ['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','testsrc=size=320x180:rate=10','-t','2','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',videoPath]);
const video = fs.readFileSync(videoPath);
const portrait = fs.readFileSync(process.env.PROFILE_CARDS_PORTRAIT || '../fluentxverse-tutor-solid-prototype/public/assets/img/banner/about-tutor-closeup-mobile-v2.webp');
(async () => {
  const browser = await chromium.launch({ executablePath:'/usr/bin/google-chrome',args:['--no-sandbox'] });
  fs.mkdirSync('/tmp/fluentxverse-profile-cards',{recursive:true});
  try { for(const width of [1440,768,390,320]) for(const theme of ['light','dark']) {
    const page = await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
    await page.addInitScript(theme => localStorage.setItem('theme-storage',JSON.stringify({state:{themeMode:theme,isDarkMode:theme==='dark'},version:2})),theme);
    const errors=[],writes=[];
    page.on('pageerror',e=>errors.push(e.message));
    const tutor = {userId:'cards-fixture',nickname:'Mary Ann',firstName:'PrivateFirst',lastName:'PrivateSurname',displayName:'PrivateFirst PrivateSurname',profilePicture:`${base}/__fixture__/portrait.webp`,bio:'Practical English for everyday conversations and your next career step.',introduction:'Hi, I am Mary Ann. I help learners speak with confidence, one conversation at a time.\n\nTogether, we can work on clear pronunciation, natural expressions, and the English you use at work.',languages:['English','Filipino'],schoolAttended:'Rizal Technological University',major:'Bachelor of Secondary Education, English',interests:['Reading','Travel','Japanese culture','Cooking','Photography'],specializations:['Conversational English','Business English','Pronunciation'],rating:4.9,totalReviews:0,isVerified:true,isAvailable:true,videoIntroUrl:'http://fluentxverse-seaweed-filer:8888/user/cards-fixture/video/intro.mp4'};
    await page.route('**/*', route => {
      const req=route.request(),url=new URL(req.url()),path=url.pathname;
      if(path==='/__fixture__/portrait.webp')return route.fulfill({contentType:'image/webp',body:portrait});
      if(path==='/lesson/files/user/cards-fixture/video/intro.mp4/stream')return route.fulfill({contentType:'video/mp4',body:video});
      if(url.origin===base)return route.continue();
      let json={success:true,data:[]};
      if(path==='/student/me')json.user={userId:'cards-student',firstName:'Learner',givenName:'Learner',role:'student',email:'fixture@example.invalid'};
      if(path==='/tutor/cards-fixture')json.data=tutor;
      if(path.endsWith('/check'))json.isFavorite=false;
      if(path==='/student/favorites/cards-fixture'&&req.method()!=='GET')writes.push(req.method());
      if(path.includes('/anonymous-reviews/'))json.data={enabled:false,summaries:[]};
      if(path==='/notifications')json.data={notifications:[],unreadCount:0};
      return route.fulfill({json});
    });
    await page.goto(`${base}/tutor/cards-fixture`,{waitUntil:'networkidle'});
    await expect(page.locator('.profile-name')).toHaveText('Mary Ann');
    await expect(page.locator('.profile-avatar-large')).toBeVisible();
    await expect.poll(()=>page.locator('.profile-avatar-large img, img.profile-avatar-large').evaluateAll(images=>images.some(img=>img.complete&&img.naturalWidth>0))).toBe(true);
    const cards=page.locator('.profile-info-card');await expect(cards).toHaveCount(5);
    for(const name of ['About Me','Education','Interests','Areas of Expertise'])await expect(page.getByRole('article',{name,exact:true})).toBeVisible();
    const colors=await cards.evaluateAll(nodes=>nodes.map(el=>({background:getComputedStyle(el).backgroundColor,border:getComputedStyle(el).borderTopWidth,radius:getComputedStyle(el).borderRadius,nested:!!el.parentElement.closest('.profile-info-card,.profile-hero')})));
    for(const color of colors){assert.notEqual(color.background,'rgba(0, 0, 0, 0)');assert.equal(color.border,'1px');assert.equal(color.radius,'8px');assert.equal(color.nested,false);}
    await expect(page.locator('.hero-video-section video')).toBeVisible();
    await expect(page.locator('.profile-tabs').getByRole('tab')).toHaveCount(2);
    await expect(page.getByRole('tab',{name:/Reviews/})).toHaveCount(0);
    await expect(page.getByRole('heading',{name:'Student Reviews',exact:true})).toHaveCount(0);
    await expect(page.locator('.profile-rating-row .rating-score')).toHaveText('4.9');
    await expect(page.locator('.profile-rating-row .star-rating svg')).toHaveCount(5);
    await expect(page.locator('.profile-rating-row .rating-count')).toHaveText('(0 reviews)');
    const checkHeadingArtwork=async()=>{
      for(const icon of await page.locator('.profile-heading img,.profile-content .section-title img,.video-section-title img').all())
        await expect.poll(()=>icon.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
    };
    await checkHeadingArtwork();
    for(const [id,file] of [['profile-about-title','profile-v1.webp'],['profile-education-title','training-v1.webp'],['profile-interests-title','interests-v1.webp']]) {
      const icon=page.locator(`#${id} img`);
      await expect(icon).toHaveAttribute('src',`/assets/img/home-icons/${file}`);
      await expect.poll(()=>icon.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
      const box=await icon.boundingBox(),size=width<=600?28:32;assert.equal(box.width,size);assert.equal(box.height,size);
    }
    await expect.poll(()=>page.locator('.hero-video-section video').evaluate(v=>v.readyState)).toBeGreaterThanOrEqual(2);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:`/tmp/fluentxverse-profile-cards/${width}-${theme}.png`,fullPage:true});
    const about=page.getByRole('tab',{name:'About',exact:true});await about.focus();await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab',{name:'Schedule',exact:true})).toHaveAttribute('aria-selected','true');
    await expect(page.getByRole('region',{name:'Available Time Slots'})).toBeVisible();
    await checkHeadingArtwork();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.keyboard.press('Home');await expect(about).toHaveAttribute('aria-selected','true');
    await page.keyboard.press('End');await expect(page.getByRole('tab',{name:'Schedule',exact:true})).toHaveAttribute('aria-selected','true');
    await page.keyboard.press('Home');await expect(about).toHaveAttribute('aria-selected','true');
    await page.getByRole('button',{name:'Add to favorites',exact:true}).click();await expect(page.getByRole('button',{name:'Remove from favorites',exact:true})).toHaveAttribute('aria-pressed','true');
    await page.getByRole('button',{name:'Remove from favorites',exact:true}).click();
    await expect(page.getByRole('button',{name:'Add to favorites',exact:true})).toHaveAttribute('aria-pressed','false');
    assert.deepEqual(writes,['POST','DELETE']);
    await expect(page.locator('.profile-hero').getByRole('button',{name:/Book/})).toHaveCount(0);
    await expect(page.locator('.profile-booking-card .btn-book-trial')).toHaveCount(1);
    await page.locator('.profile-booking-card .btn-book-trial').click();await expect(page.getByRole('dialog',{name:'Book a lesson with Mary Ann'})).toBeVisible();
    await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'Book a lesson with Mary Ann'})).toHaveCount(0);
    Object.assign(tutor,{interests:[],specializations:[],schoolAttended:undefined,major:undefined,videoIntroUrl:undefined,profilePicture:undefined});
    await page.reload({waitUntil:'networkidle'});
    await expect(page.locator('.profile-info-card')).toHaveCount(1);
    await expect(page.getByRole('article',{name:'About Me',exact:true})).toBeVisible();
    await expect(page.locator('.profile-avatar-placeholder')).toHaveText('MA');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors,[]);await page.close();console.log(`PASS ${width}px ${theme}: separate cards, portrait/video, responsive layout, keyboard tabs, favorites and booking`);
  }} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
