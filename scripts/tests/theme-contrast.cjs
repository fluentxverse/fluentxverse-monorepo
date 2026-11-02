const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const bases=[process.env.TUTOR_TEST_URL||'http://127.0.0.1:5286',process.env.STUDENT_TEST_URL||'http://127.0.0.1:5287'];
const linear=c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;};
const luminance=rgb=>rgb.map(linear).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 try{for(const base of bases)for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width:390,height:900}});
  await context.addInitScript(theme=>localStorage.setItem('theme-storage',JSON.stringify({state:{themeMode:theme,isDarkMode:theme==='dark'},version:2})),theme);
  await context.route('**/*',route=>{
   const url=new URL(route.request().url()),p=url.pathname;
   if(url.origin===base)return route.continue();
   const role=base.includes('5287')||base.includes('student.')?'student':'tutor';
   const user={userId:'contrast-'+role,id:'contrast-'+role,role,firstName:'Alex',email:'contrast@example.test'};
   let data=[];
   if(p==='/notifications')data={notifications:[],unreadCount:0};
   if(p.replace(/\/$/,'')==='/tutor/email-verification')data={verified:true};
   if(p==='/proof/tutor-certification/me')data={snapshot:{writtenPassed:true,speakingPassed:true,interviewPassed:true,profileApproved:true,missingRequirements:[]}};
   if(p==='/tutor/performance')data={slots:{bookable:1},lessons:{attended:1}};
   if(p==='/interview/my-booking')data={status:'completed',result:'pass'};
   return route.fulfill({json:{success:true,user,data,status:{passed:true,percentage:95}}});
  });
  const page=await context.newPage();await page.goto(base+'/home',{waitUntil:'domcontentloaded'});
  await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
  const samples=await page.evaluate(()=>{
   const sample=(color,background)=>{
    const node=document.createElement('span');Object.assign(node.style,{color,backgroundColor:background});document.body.append(node);
    const s=getComputedStyle(node),rgb=value=>value.match(/\d+(?:\.\d+)?/g).slice(0,3).map(Number),result={color:rgb(s.color),background:rgb(s.backgroundColor)};node.remove();return result;
   };
   const values=[];
   for(const color of ['--fxv-text','--fxv-text-muted','--fxv-text-soft'])for(const background of ['--fxv-bg','--fxv-surface','--fxv-surface-muted','--fxv-surface-soft'])
    values.push({color,background,...sample('var('+color+')','var('+background+')')});
   const probe=document.createElement('div');probe.className='App tutor-workspace';probe.innerHTML='<section><header>Section</header></section>';document.body.append(probe);
   const arbitrary=getComputedStyle(probe.firstChild).backgroundColor;probe.remove();
   return {values,arbitrary};
  });
  for(const sample of samples.values)assert(ratio(sample.color,sample.background)>=4.5,JSON.stringify({base,theme,...sample,contrast:ratio(sample.color,sample.background)}));
  assert.equal(samples.arbitrary,'rgba(0, 0, 0, 0)','Legacy CSS must not repaint arbitrary workspace sections');
  await context.close();console.log('PASS '+base+' '+theme+': primary, muted and soft text >= 4.5:1 on all base surfaces; no global section background');
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
