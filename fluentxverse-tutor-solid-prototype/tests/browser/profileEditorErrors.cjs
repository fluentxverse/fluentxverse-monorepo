const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';
(async () => {
 const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 fs.mkdirSync('/tmp/fluentxverse-profile-errors',{recursive:true});
 try { for (const width of [1440,390,320]) for(const theme of ['light','dark']) {
  const page = await browser.newPage({viewport:{width,height:700},colorScheme:theme,reducedMotion:'reduce'});
  let writes=0, reject=true;
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());if(url.origin===base)return route.continue();
   let json={success:true,data:[]};
   if(url.pathname==='/tutor/me')json.user={userId:'error-fixture',firstName:'Test',role:'tutor',email:'fixture@example.invalid'};
   if(url.pathname==='/tutor/profile') {
    if(route.request().method()==='PATCH') {
     writes++;
     if(reject)return route.fulfill({status:400,json:{success:false,error:'Your profile could not be saved because this field needs correction. Please review the information you entered and try again.'}});
    }else json.data={firstName:'Test',profileStatus:'incomplete',bio:'A tutor introduction',interests:['Reading'],education:[]};
   }
   if(url.pathname==='/notifications')json.data={notifications:[],unreadCount:0};
   return route.fulfill({json});
  });
  await page.goto(`${base}/application/profile`,{waitUntil:'networkidle'});
  const dialog=page.getByRole('dialog',{name:'Edit profile'});
  const save=()=>dialog.getByRole('button',{name:'Save Changes',exact:true}).click();
  const visibleError=async text=>{
   const alert=dialog.getByRole('alert');await expect(alert).toContainText(text);await expect(alert).toBeInViewport();
   await expect(dialog.getByRole('button',{name:'Save Changes',exact:true})).toBeInViewport();
  };
  await page.getByRole('button',{name:'Edit preferred nickname',exact:true}).click();
  await dialog.getByLabel('Preferred nickname',{exact:true}).fill('Alex99');await save();
  await visibleError('Use 2-24 letters');assert.equal(writes,0);
  await expect(dialog.locator('.profile-guidelines')).toHaveAttribute('open','');
  await visibleError('Use 2-24 letters');
  await dialog.getByLabel('Preferred nickname',{exact:true}).fill('Alex');await save();
  await visibleError('Please review the information you entered and try again.');
  await page.screenshot({path:`/tmp/fluentxverse-profile-errors/${width}-${theme}.png`});
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  for(const heading of ['About Me','Education','Interests']) {
   if(heading==='About Me')await page.locator('.profile-bio-row button').click();
   else await page.locator('.profile-tab-title-row').filter({has:page.getByRole('heading',{name:heading,exact:true})}).getByRole('button').click();
   await expect(dialog.getByRole('alert')).toHaveCount(0);
   if(heading==='About Me') {
    await expect(dialog.locator('.profile-guidelines')).toHaveAttribute('open','');
    await expect(dialog.locator('.profile-guidelines-body')).toBeVisible();
    await expect(dialog.locator('.profile-guidelines-body')).toContainText('preferred nickname');
    await expect(dialog.locator('.profile-guidelines-body')).toContainText('contact details');
    await expect(dialog.locator('.profile-guidelines-body')).toContainText('Example:');
    await expect(dialog.locator('textarea')).toBeInViewport();
    await expect(dialog.getByRole('button',{name:'Save Changes',exact:true})).toBeInViewport();
    await page.screenshot({path:`/tmp/fluentxverse-profile-errors/bio-${width}-${theme}.png`});
   }
   if(heading==='Education') {
    const before=writes;await save();await visibleError('Enter your school');assert.equal(writes,before);
   }else {
    if(heading==='Interests') {
     await dialog.getByPlaceholder('Type an interest and press Enter...').fill('reading');
     await dialog.getByRole('button',{name:'Add',exact:true}).click();await visibleError('List each interest only once.');
     await dialog.getByPlaceholder('Type an interest and press Enter...').fill('');
    }
    await save();await visibleError('Please review the information you entered and try again.');
   }
   await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  }
  await page.locator('.profile-hero-content input[type=file]').setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from('invalid')});
  await expect(page.getByRole('alert')).toContainText('Use a JPG or JPEG photo.');
  await page.locator('.hero-video-section input[type=file]').setInputFiles({name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from('invalid')});
  await expect(page.locator('.hero-video-section').getByRole('alert')).toContainText('Please select a video file.');
  await page.getByRole('button',{name:'Edit preferred nickname',exact:true}).click();
  await dialog.getByLabel('Preferred nickname',{exact:true}).fill('Alex');reject=false;await save();await expect(dialog).toHaveCount(0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.close();console.log(`PASS ${width}px ${theme}: visible validation, full server errors, interests, education, media errors and corrected retry`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
