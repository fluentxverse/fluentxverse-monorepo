const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.TUTOR_TEST_URL||'http://127.0.0.1:5177';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 fs.mkdirSync('/tmp/fluentxverse-interest-contrast',{recursive:true});
 try{for(const width of [1440,320])for(const theme of ['light','dark']){
  const page=await browser.newPage({viewport:{width,height:800},colorScheme:theme,reducedMotion:'reduce'});
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());if(url.origin===base)return route.continue();
   let json={success:true,data:[]};
   if(url.pathname==='/tutor/me')json.user={userId:'contrast-fixture',firstName:'Test',role:'tutor',email:'test@example.invalid'};
   if(url.pathname==='/tutor/profile')json.data={firstName:'Test',profileStatus:'incomplete',interests:['Eating','Checking','Chess','Fishing','Internet'],education:[]};
   if(url.pathname==='/notifications')json.data={notifications:[],unreadCount:0};
   return route.fulfill({json});
  });
  await page.goto(`${base}/application/profile`,{waitUntil:'networkidle'});
  await page.locator('.profile-tab-title-row').filter({has:page.getByRole('heading',{name:'Interests',exact:true})}).getByRole('button').click();
  const dialog=page.getByRole('dialog',{name:'Edit profile'});
  await expect(dialog.locator('.interest-chip')).toHaveCount(5);
  const ratios=await dialog.locator('.interest-chip').evaluateAll(chips=>{
   const rgb=value=>value.match(/[\d.]+/g).slice(0,3).map(Number);
   const luminance=color=>rgb(color).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
   const contrast=(a,b)=>{a=luminance(a);b=luminance(b);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
   return chips.map(chip=>{const bg=getComputedStyle(chip).backgroundColor;return {text:contrast(getComputedStyle(chip.querySelector('span')).webkitTextFillColor,bg),remove:contrast(getComputedStyle(chip.querySelector('button')).color,bg)};});
  });
  assert.ok(ratios.every(r=>r.text>=4.5&&r.remove>=3),JSON.stringify(ratios));
  await page.screenshot({path:`/tmp/fluentxverse-interest-contrast/${width}-${theme}.png`});
  await dialog.getByRole('button',{name:'Remove Eating',exact:true}).click();
  await expect(dialog.locator('.interest-chip')).toHaveCount(4);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  console.log(`PASS ${width}px ${theme}: chip label/icon contrast and removal; minimum text ratio ${Math.min(...ratios.map(r=>r.text)).toFixed(2)}:1`);
  await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
