const { chromium, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';
for (const seconds of [30,31]) execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=blue:s=128x72:r=1','-t',String(seconds),'-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',`/tmp/fxv-intro-${seconds}.mp4`]);
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 try{for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1000}}),uploads=[];
  await page.route('**/*',route=>{
   const u=new URL(route.request().url());if(u.origin===base||u.protocol==='blob:')return route.continue();
   let json={success:true,data:[]};
   if(u.pathname==='/tutor/me')json.user={userId:'duration-fixture',role:'tutor',firstName:'Test',email:'fixture@example.invalid'};
   if(u.pathname==='/tutor/profile')json.data={firstName:'Test',profileStatus:'incomplete',interests:[],education:[]};
   if(u.pathname==='/tutor/intro-video'){uploads.push(1);json={success:true,url:'https://media.example.invalid/new.mp4',hasPendingChanges:true};}
   if(u.pathname==='/notifications')json.data={notifications:[],unreadCount:0};
   return route.fulfill({json});
  });
  await page.goto(`${base}/application/profile`,{waitUntil:'networkidle'});
  const input=page.locator('.hero-video-section input[type=file]');
  await input.setInputFiles('/tmp/fxv-intro-31.mp4');
  await expect(page.getByText(/Introduction videos must be 30 seconds or shorter/)).toBeVisible();
  assert.equal(uploads.length,0,'Long videos never upload');
  await input.setInputFiles({name:'broken.mp4',mimeType:'video/mp4',buffer:Buffer.from('invalid')});
  await expect(page.getByText(/Could not read this video/)).toBeVisible();
  assert.equal(uploads.length,0);
  await input.setInputFiles('/tmp/fxv-intro-30.mp4');
  await expect.poll(()=>uploads.length).toBe(1);
  console.log(`PASS ${width}px: 31s and corrupt video rejected before upload; exactly 30s accepted`);
  await page.close();
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
