const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.TUTOR_TEST_URL||'http://127.0.0.1:5177';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 fs.mkdirSync('/tmp/fluentxverse-upload-guidelines',{recursive:true});
 try{for(const width of [1440,390,320])for(const approved of [false,true]){
  const page=await browser.newPage({viewport:{width,height:800},colorScheme:approved?'dark':'light',reducedMotion:'reduce'});
  let chooserCount=0;page.on('filechooser',()=>chooserCount++);
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());if(url.origin===base)return route.continue();
   let json={success:true,data:[]};
   if(url.pathname==='/tutor/me')json.user={userId:'upload-fixture',firstName:'Test',role:'tutor',email:'test@example.invalid'};
   if(url.pathname==='/tutor/profile')json.data={firstName:'Test',profileStatus:approved?'approved':'incomplete',interests:[],education:[],videoIntroUrl:approved?'https://media.example.invalid/video.mp4':''};
   if(url.pathname==='/notifications')json.data={notifications:[],unreadCount:0};
   return route.fulfill({json});
  });
  await page.goto(`${base}/application/profile`,{waitUntil:'networkidle'});
  await expect(page.locator('.profile-guidelines')).toHaveCount(0);
  for(const kind of ['photo','video']){
   if(kind==='photo')await page.getByTitle('Upload new avatar',{exact:true}).click({force:true});
   else await page.getByRole('button',{name:approved?'Replace Video':'Upload Video',exact:true}).click({force:true});
   const dialog=page.getByRole('dialog',{name:kind==='photo'?'Upload profile photo':'Upload introduction video',exact:true});
   await expect(dialog).toBeVisible();assert.equal(chooserCount,kind==='photo'?0:1);
   await expect(dialog.locator('.profile-guidelines')).toHaveAttribute('open','');
   await expect(dialog.locator('.profile-guidelines-body')).toBeVisible();
   await expect(dialog).toContainText(kind==='photo'?'#C8C8C8':'35-70');
   await expect(dialog.getByRole('button',{name:kind==='photo'?'Choose photo':'Choose video',exact:true})).toBeInViewport();
   await page.screenshot({path:`/tmp/fluentxverse-upload-guidelines/${width}-${approved}-${kind}.png`});
   const chooser=page.waitForEvent('filechooser');
   await dialog.getByRole('button',{name:kind==='photo'?'Choose photo':'Choose video',exact:true}).click();
   await (await chooser).setFiles({name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from('invalid')});
   await expect(dialog.getByRole('alert')).toContainText(kind==='photo'?'JPG or JPEG':'select a video');
   await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(dialog).toHaveCount(0);
  }
  await page.getByRole('button',{name:'Edit preferred nickname',exact:true}).click();
  const edit=page.getByRole('dialog',{name:'Edit profile'});
  await expect(edit.locator('.profile-guidelines-body')).toBeVisible();
  await expect(edit.getByLabel('Preferred nickname',{exact:true})).toBeInViewport();
  await edit.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.locator('.profile-tab-title-row').filter({has:page.getByRole('heading',{name:'Interests',exact:true})}).getByRole('button').click();
  await expect(edit.locator('.profile-guidelines-body')).toBeVisible();
  const art=edit.locator('.profile-guidelines img');await expect(art).toHaveAttribute('src',/interests-v1.webp/);
  await expect.poll(()=>art.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  await edit.getByRole('button',{name:'Cancel',exact:true}).click();
  if(approved){
   await page.locator('.profile-tabs').getByRole('button',{name:'Settings',exact:true}).click();
   await page.getByRole('button',{name:/Account Settings/}).click();
   const settings=page.getByRole('dialog',{name:'Account settings',exact:true});
   await settings.getByTitle('Upload new avatar',{exact:true}).click({force:true});
   const upload=page.getByRole('dialog',{name:'Upload profile photo',exact:true});
   await expect(upload.locator('.profile-guidelines-body')).toBeVisible();
   const chooser=page.waitForEvent('filechooser');
   await upload.getByRole('button',{name:'Choose photo',exact:true}).click();
   await (await chooser).setFiles({name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from('invalid')});
   await expect(upload.getByRole('alert')).toContainText('JPG or JPEG');
   await upload.getByRole('button',{name:'Cancel',exact:true}).click();
   await expect(settings).toBeVisible();
   await settings.getByRole('button',{name:'Close settings',exact:true}).click();
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.close();console.log(`PASS ${width}px ${approved?'approved replacements/dark':'initial uploads/light'}: guidelines precede picker, expanded editors, inline upload errors, Interests artwork`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
