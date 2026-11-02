const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';
(async () => {
 const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 fs.mkdirSync('/tmp/fluentxverse-profile-guidelines',{recursive:true});
 try { for (const width of [1440,390,320]) for(const approved of [false,true]) {
  const page=await browser.newPage({viewport:{width,height:1000},colorScheme:approved?'dark':'light'}),uploads=[];
  const fixture=await page.evaluate(()=>{
   const c=document.createElement('canvas');c.width=c.height=600;const x=c.getContext('2d');x.fillStyle='#c8c8c8';x.fillRect(0,0,600,600);x.fillStyle='#2353a1';x.fillRect(200,150,200,300);
   const valid=c.toDataURL('image/jpeg').split(',')[1],png=c.toDataURL('image/png').split(',')[1];c.width=c.height=400;
   return {valid,png,small:c.toDataURL('image/jpeg').split(',')[1]};
  });
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin===base||url.protocol==='blob:')return route.continue();
   let json={success:true,data:[]};
   if(url.pathname==='/tutor/me')json.user={userId:'guidelines-fixture',firstName:'Test',role:'tutor',email:'fixture@example.invalid'};
   if(url.pathname==='/tutor/profile')json.data={firstName:'Test',profileStatus:approved?'approved':'incomplete',bio:'A tutor introduction',interests:['Reading'],education:[],teachingQualifications:[]};
   if(url.pathname==='/tutor/profile-picture'){
    uploads.push(route.request().postDataBuffer());json={success:true,url:'https://media.example.invalid/profile.jpg',hasPendingChanges:true};
   }
   if(url.pathname==='/tutor/user/personal-info')json.data={};
   if(url.pathname==='/notifications')json.data={notifications:[],unreadCount:0};
   return route.fulfill({json});
  });
  await page.goto(`${base}/application/profile`,{waitUntil:'networkidle'});
  await expect(page.locator('.profile-guidelines')).toHaveCount(0);
  await expect(page.getByText('Profile Approved',{exact:true})).toHaveCount(0);
  await expect(page.locator('.intro-video-limit')).toHaveCount(0);
  await expect(page.locator('.education-info')).not.toContainText('Teaching qualifications:');
  await page.screenshot({path:`/tmp/fluentxverse-profile-guidelines/${width}-${approved?'approved':'application'}.png`,fullPage:true});
  const input=page.locator('.profile-hero-content input[type=file]');
  await input.setInputFiles({name:'photo.png',mimeType:'image/png',buffer:Buffer.from(fixture.png,'base64')});
  await expect(page.getByText('Use a JPG or JPEG photo.',{exact:true})).toBeVisible();assert.equal(uploads.length,0);
  await input.setInputFiles({name:'small.jpg',mimeType:'image/jpeg',buffer:Buffer.from(fixture.small,'base64')});
  await expect(page.getByText('Your profile photo must be at least 480 x 480 pixels.',{exact:true})).toBeVisible();assert.equal(uploads.length,0);
  await input.setInputFiles({name:'photo.jpg',mimeType:'image/jpeg',buffer:Buffer.from(fixture.valid,'base64')});
  const cropper=page.getByRole('dialog',{name:'Crop profile photo',exact:true});await expect(cropper).toBeVisible();
  await expect(cropper.locator('.cropper-image')).toBeVisible();
  await expect(cropper.locator('.profile-guidelines')).toContainText('Profile photo guidelines');
  await expect(cropper.locator('.profile-guidelines')).toContainText('#C8C8C8');
  await expect(cropper.locator('.profile-guidelines')).toContainText('six months');
  await cropper.getByRole('button',{name:/Save Photo/}).click();await expect.poll(()=>uploads.length).toBe(1);
  assert.ok(uploads[0].includes(Buffer.from('image/jpeg')));
  const start=uploads[0].indexOf(Buffer.from([255,216,255])),end=uploads[0].indexOf(Buffer.from([255,217]),start)+2;
  const details=await page.evaluate(async data=>{const blob=await (await fetch('data:image/jpeg;base64,'+data)).blob(),bitmap=await createImageBitmap(blob),c=document.createElement('canvas');c.width=c.height=600;const x=c.getContext('2d');x.drawImage(bitmap,0,0);return {width:bitmap.width,height:bitmap.height,corner:[...x.getImageData(0,0,1,1).data]};},uploads[0].subarray(start,end).toString('base64'));
  assert.equal(details.width,600);assert.equal(details.height,600);assert.ok(details.corner.slice(0,3).every(n=>n>180),'Square crop has no baked-in black circle corners');
  await page.locator('.profile-tab-title-row').filter({has:page.getByRole('heading',{name:'Interests',exact:true})}).getByRole('button').click();
  await expect(page.getByRole('dialog',{name:'Edit profile'}).locator('.profile-guidelines')).toContainText('up to five');
  await page.getByRole('dialog',{name:'Edit profile'}).getByRole('button',{name:'Cancel',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  console.log(`PASS ${width}px ${approved?'approved edit':'first application'}: guidelines, photo rules, square crop, interests and clean profile`);
  await page.close();
 }} finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
