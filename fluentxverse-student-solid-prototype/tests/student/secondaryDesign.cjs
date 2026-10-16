const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176';
const apiPattern = /^(http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780)|https:\/\/api\.fluentxverse\.(?:com|xyz))\//;
const article = { id:'article-fixture', title:'New conversations around the world', createdAt:'2026-10-08T12:00:00Z', category:'Education', topic:'Language learning', warmUpQuestions:['What do you enjoy learning?'], vocabulary:[{word:'conversation',pronunciation:'/conversation/',partOfSpeech:'noun',definition:'An exchange of ideas.',exampleSentence:'We had a conversation.',additionalInfo:null}], articleContent:{paragraphs:[{id:'one',text:'People are finding new ways to practice English.',comprehensionQuestion:{question:'What are people practicing?',answer:'Hidden answer'}}],source:'Editorial fixture'}, summaryQuestion:'What is the main idea?', discussionA:{topic:'New connections',questions:['Who do you enjoy talking with?']}, discussionB:{topic:'Learning',questions:['How do you practice?']} };
const young = {id:'young-fixture',level:1,unit:1,lessonNumber:1,theme:'colors',ageGroup:'5-8',unitLabel:'Getting started',lessonTitle:'Everyday colors',mascot:'foxy',greeting:'Welcome to our lesson!',vocabularyWords:[{id:'blue',word:'Blue',translation:'Blue',image:'/assets/img/home-icons/training-v1.webp'}],song:null,story:null,activities:[]};
(async () => {
  const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
  try {
    for (const theme of (process.env.TEST_THEME ? [process.env.TEST_THEME] : ['light','dark'])) for (const width of (process.env.TEST_WIDTHS || '1566,768,375,320').split(',').map(Number)) {
      let authenticated = true, failedRead = false, failedPin = false, expireRequests = false;
      const context = await browser.newContext({viewport:{width,height:width < 600 ? 760 : 950},timezoneId:'Pacific/Auckland',reducedMotion:'reduce'});
      await context.addInitScript(theme => { if (/^https?:$/.test(location.protocol)) localStorage.setItem('theme-storage',JSON.stringify({state:{themeMode:theme,isDarkMode:theme==='dark'},version:2})); },theme);
      const errors=[], writes=[];
      await context.route(apiPattern, async route => {
        const request=route.request(), url=new URL(request.url()), path=url.pathname;
        const reply=json=>route.fulfill({json});
        if (request.method()==='OPTIONS') return route.fulfill({status:204});
        if (expireRequests && (path==='/student/me' || (request.method()==='POST' && path.startsWith('/inbox/')))) return route.fulfill({status:401,json:{success:false,error:'Session expired'}});
        if (path==='/student/me') return authenticated ? reply({success:true,user:{userId:'secondary-student',role:'student',givenName:'Mika',email:'mika@example.test',walletAddress:'0x'+'a'.repeat(40)}}) : route.fulfill({status:401,json:{success:false}});
        if (request.method()==='POST' && path.startsWith('/inbox/')) {
          writes.push({path,data:request.postDataJSON()});
          if ((failedRead && path.includes('/mark-read/')) || (failedPin && path.includes('/toggle-pin/'))) return reply({success:false,error:'Could not update this message.'});
          return reply({success:true,data:{isPinned:true}});
        }
        if(path==='/inbox/messages') return reply({success:true,data:{messages:[{id:'message-fixture',title:'Your lesson update',content:'Your next conversation is scheduled.\nWe look forward to seeing you.',category:'update',createdAt:'2026-10-08T12:00:00Z',isRead:false,isPinned:false}],stats:{total:1,unread:1,pinned:0}}});
        if(path==='/tickets/my-purchases') return reply({success:true,data:[{id:'purchase-fixture',tier:'premium',quantity:30,totalPrice:225,pricePerTicket:7.5,purchaseDate:'2026-10-08T12:00:00Z',status:'completed',transferTxId:'0x'+'a'.repeat(64)},{id:'pending-fixture',tier:'basic',quantity:1,totalPrice:6,pricePerTicket:6,purchaseDate:'2026-10-09T12:00:00Z',status:'pending'}]});
        if(path.startsWith('/tickets/balance/')) return reply({success:true,data:{basic:5,premium:2,trial:0,total:7}});
        if(path==='/tutor/tutor-fixture') return reply({success:true,data:{userId:'tutor-fixture',firstName:'Alexandra',lastName:'Montgomery',displayName:'Alexandra Rivera Montgomery',isAvailable:true,isVerified:true,rating:4.9,totalReviews:18,country:'Philippines',bio:'Thoughtful conversations and clear explanations, with space to build confidence.',profilePicture:'/assets/img/banner/banner_woman.webp',specializations:['Conversation','Business English'],interests:['Music','Travel'],videoIntroUrl:'/fixture-intro.mp4'}});
        if(path.startsWith('/schedule/available/')) return reply({success:true,data:[{slotId:'public-slot',date:url.searchParams.get('startDate'),time:'22:00',durationMinutes:25}]});
        if(path==='/dispatch/archives') return reply({success:true,archives:[{month:'October 2026',count:1}]});
        if(path.startsWith('/dispatch/archives/')) return reply({success:true,articles:[{...article,excerpt:'English practice around the world'}]});
        if(path==='/dispatch/article-fixture') return reply(article);
        if(path==='/young-learners/published') return reply({success:true,lessons:[young]});
        if(path==='/young-learners/public/young-fixture') return reply({success:true,lesson:young});
        if(path==='/lesson/view-fixture/student') return reply({success:true,lesson:{id:'view-fixture',title:'Conversation fixture'},viewUrl:base+'/fixture-lesson.html'});
        if(path==='/notifications/') return reply({success:true,data:{notifications:[{id:'notice-fixture',title:'Lesson booked',message:'Your booking is confirmed.',timestamp:'2026-10-08T12:00:00Z',isRead:false,data:{link:'/lesson/booking-fixture'}}]}});
        return reply({success:true,data:[],profile:{},lessons:[]});
      });
      await context.route('**/fixture-intro.mp4',route=>route.fulfill({status:404}));
      await context.route('**/fixture-lesson.html',route=>route.fulfill({body:'<html><body><h1>Conversation fixture</h1></body></html>',contentType:'text/html'}));
      await context.route('https://www.openstreetmap.org/**',route=>route.fulfill({body:'<html><body>Map fixture</body></html>',contentType:'text/html'}));
      const page=await context.newPage(); page.on('pageerror',error=>errors.push(error.message));
      const visit=async(path,selector)=>{
        if(process.env.TEST_PROGRESS) console.log('Visiting',path);
        await page.goto(base+path,{waitUntil:'domcontentloaded',timeout:60000});
        try { await page.locator(selector).first().waitFor(); }
        catch(error) {
          console.error('Page state:',path,page.url(),errors,await page.locator('body').innerText());
          await page.screenshot({path:'../output/screenshots/secondary-failure.png',fullPage:true}); throw error;
        }
      };
      const layout=async(name,scope)=>{
        if(process.env.TEST_PROGRESS) console.log('Checking',name);
        await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
        const result=await page.evaluate(async scope=>{
          const root=document.querySelector(scope);
          const images=[...root.querySelectorAll('img[src*="home-icons"]'),...document.querySelectorAll('.logo__face')];
          await Promise.all(images.map(img=>new Promise((resolve,reject)=>{
            const timeout=setTimeout(()=>reject(new Error('Artwork load timed out: '+img.src)),15000);
            img.decode().then(()=>{clearTimeout(timeout);resolve();},error=>{clearTimeout(timeout);reject(error);});
          })));
          const dialog=document.querySelector('dialog[open]'), box=dialog?.getBoundingClientRect();
          return {overflow:document.documentElement.scrollWidth>innerWidth,legacy:root.querySelectorAll('i').length,art:root.querySelectorAll('img[src*="home-icons"]').length,dialogFits:!box||(box.left>=0&&box.right<=innerWidth+1&&box.top>=0&&box.bottom<=innerHeight+1),bg:getComputedStyle(root).backgroundImage};
        },scope);
        assert.equal(result.overflow,false,name+' horizontal overflow'); assert.equal(result.legacy,0,name+' legacy icon fonts'); assert.equal(result.dialogFits,true,name+' dialog clipping'); assert.equal(result.bg,'none',name+' decorative gradient');
        await page.screenshot({path:'../output/screenshots/secondary-'+theme+'-'+width+'-'+name+'.png',fullPage:true});
      };
      await visit('/purchase-history','.purchase-card'); await layout('purchases','.purchase-history-page');
      assert.equal(await page.locator('.purchase-card-icon img').count(),2);
      await visit('/inbox','.message-item'); await layout('inbox','.inbox-page');
      failedRead=true; await page.locator('.message-item').click(); await page.getByRole('alert').getByText('Could not update this message.',{exact:true}).waitFor();
      await layout('inbox-error','.inbox-page'); failedRead=false;
      await page.getByRole('button',{name:'Back',exact:true}).click(); await page.locator('.message-item').click(); await page.getByText('0 unread messages',{exact:true}).waitFor();
      failedPin=true; await page.getByRole('button',{name:'Pin message',exact:true}).click(); await page.getByRole('alert').waitFor(); failedPin=false;
      await page.getByRole('button',{name:'Pin message',exact:true}).click(); await page.getByRole('button',{name:'Unpin message',exact:true}).waitFor();
      await layout('message','.inbox-page'); assert.ok(writes.every(write=>write.data.userId==='secondary-student'));
      await visit('/tutor/tutor-fixture','.profile-name'); await page.getByText('Video unavailable. Please try again later.',{exact:true}).waitFor(); await layout('tutor','.tutor-profile-page');
      const videoLayout=await page.locator('.fxv-video-player').evaluate(player=>{
        const box=player.getBoundingClientRect();
        const buttons=[...player.querySelectorAll('button')].map(button=>({name:button.title,box:button.getBoundingClientRect().toJSON()}));
        return {box:box.toJSON(),buttons,fits:buttons.every(button=>button.box.left>=box.left-1&&button.box.right<=box.right+1)};
      });
      assert.ok(videoLayout.fits,'video controls fit the player: '+JSON.stringify(videoLayout));
      await page.locator('.profile-tabs').getByRole('button',{name:'Schedule',exact:true}).click(); await page.getByRole('button',{name:/Book .* JST/}).first().waitFor(); await layout('tutor-schedule','.tutor-profile-page');
      // Public schedule + auth dialog is tested by browseTutors.cjs without ticket transfers.
      await visit('/young-learners','.yl-level-header'); await page.locator('.yl-unit-header').click(); await layout('young-library','.yl-page');
      await page.locator('.yl-lesson-card').click(); await page.locator('.yl-lesson-header').waitFor(); await layout('young-lesson','.yl-lesson-page');
      await page.getByRole('button',{name:'Next',exact:true}).click(); await page.getByRole('button',{name:'Show meaning of Blue'}).press('Enter'); assert.match(await page.locator('.yl-vocab-card').getAttribute('class'),/flipped/);
      await visit('/materials/daily-dispatch/article-fixture','.ddp-title'); await layout('article','.ddp-container');
      assert.equal(await page.getByText('Hidden answer',{exact:true}).count(),0);
      await page.getByRole('button',{name:'Font size large'}).click(); assert.equal(await page.getByRole('button',{name:'Font size large'}).getAttribute('aria-pressed'),'true');
      await visit('/materials/daily-dispatch/archives/October%202026','.dda-header'); assert.equal(await page.locator('.dda-article-card').count(),1); await layout('archive','.ddp-container');
      await visit('/privacy-policy','.privacy-content'); await layout('privacy','.student-legal');
      await visit('/terms-of-service','.privacy-content'); await layout('terms','.student-legal');
      await visit('/contact','.student-contact-faq'); await page.getByText('How do I book a lesson?',{exact:true}).click(); await layout('support','.student-contact');
      await page.getByRole('button',{name:/Notifications/}).click(); await page.getByRole('dialog',{name:'Notifications',exact:true}).waitFor(); await layout('notifications','.student-notification-dialog');
      assert.equal(await page.getByRole('link',{name:/Lesson booked Your booking/}).getAttribute('href'),'/lesson/booking-fixture'); await page.keyboard.press('Escape');
      await visit('/unknown-fixture','.student-not-found'); await layout('not-found','.student-not-found');
      await visit('/lesson/view?id=view-fixture','.lesson-fullpage-iframe.loaded');
      await page.frameLocator('.lesson-fullpage-iframe').getByRole('heading',{name:'Conversation fixture'}).waitFor();
      await visit('/lesson/view','.lesson-fullpage-error'); await layout('viewer-error','.lesson-fullpage');
      await visit('/inbox','.message-item'); await page.clock.install(); await page.clock.fastForward(27*60*1000+1000);
      await page.getByRole('dialog',{name:'Session expiring soon'}).waitFor(); await layout('session-warning','.student-dialog');
      await page.getByRole('button',{name:'Refresh session',exact:true}).click(); await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
      await page.clock.resume(); expireRequests=true; await page.getByRole('button',{name:'Mark all as read',exact:true}).click();
      await page.getByRole('dialog',{name:'Session expired',exact:true}).waitFor(); await layout('session-expired','.student-dialog');
      expireRequests=false; authenticated=false;
      await page.getByRole('button',{name:'Go to Login',exact:true}).click();
      await page.waitForURL(base+'/');
      await visit('/register','.register-form-card'); await layout('register','.student-registration');
      assert.equal(await page.locator('.public-secondary-header .menu-area').evaluate(element=>getComputedStyle(element).backgroundColor),'rgb(255, 255, 255)');
      await page.getByLabel(/^Family name/).fill('Tanaka'); await page.getByLabel(/^Given name/).fill('Mika');
      await page.getByLabel('Birth year').selectOption('2000'); await page.getByLabel('Birth month').selectOption('4'); await page.getByLabel('Birth day').selectOption('3');
      await page.getByLabel(/^Email/).fill('mika@example.test'); await page.getByLabel(/^Phone number/).fill('09012345678'); await page.getByLabel(/^Password/).fill('Example123!');
      await page.getByRole('button',{name:'Continue',exact:true}).click(); await page.getByText('Tell Us About Your English Goals',{exact:true}).waitFor(); await layout('register-goals','.student-registration');
      await page.getByRole('checkbox').first().check(); await page.getByRole('button',{name:'Back',exact:true}).click();
      await page.getByRole('button',{name:'Sign in',exact:true}).click(); await page.getByRole('dialog',{name:'Sign in or register'}).waitFor(); await layout('auth','.social-login-dialog');
      await page.keyboard.press('Escape'); await page.waitForFunction(()=>!document.querySelector('dialog[open]')); assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
      for(const path of ['/contact','/privacy-policy','/terms-of-service','/tutor/tutor-fixture']) { await visit(path,path.includes('tutor')?'.profile-name':path==='/contact'?'.student-contact':'.privacy-content'); await page.waitForFunction(()=>document.documentElement.dataset.theme==='light'); assert.equal(await page.getByRole('button',{name:/Switch to .* mode/}).count(),0); }
      await visit('/','.how-it-works');
      for (const selector of ['.how-it-works','.pricing-section','.why-choose-section']) {
        const section=page.locator(selector); await section.scrollIntoViewIfNeeded();
        assert.equal(await section.locator('i').count(),0);
        await section.locator('img[src*="home-icons"]').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
        await page.screenshot({path:'../output/screenshots/secondary-'+theme+'-'+width+'-landing-'+selector.slice(1)+'.png'});
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'public home overflow');
      assert.deepEqual(errors,[]); console.log('PASS secondary '+theme+' '+width+': pages, actions, public theme, dialogs, artwork and viewport checks'); await context.close();
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
