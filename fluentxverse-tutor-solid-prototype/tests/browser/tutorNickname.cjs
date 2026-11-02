const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';
(async () => {
  const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
  fs.mkdirSync('/tmp/fluentxverse-nickname',{recursive:true});
  try { for (const width of [1440,390,320]) for(const approved of [false,true]) {
    const page = await browser.newPage({viewport:{width,height:1000},colorScheme:approved?'dark':'light',reducedMotion:'reduce'});
    const writes = [], errors = [];
    const profile = {firstName:'LegalFirst',lastName:'PrivateSurname',displayName:'LegalFirst PrivateSurname',nickname:approved?'Alex':undefined,profileStatus:approved?'approved':'incomplete',bio:'A complete tutor introduction',schoolAttended:'Sample School',major:'English',interests:['Reading'],profilePicture:'https://media.example.invalid/photo.jpg',videoIntroUrl:''};
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>{
      const url = new URL(route.request().url()); if(url.origin===base)return route.continue();
      let json={success:true,data:[]};
      if(url.pathname==='/tutor/me')json.user={userId:'nickname-fixture',...profile,role:'tutor',email:'fixture@example.invalid'};
      if(url.pathname==='/tutor/profile') {
        if(route.request().method()==='PATCH'){
          const body=route.request().postDataJSON();writes.push(body);
          if(!approved)Object.assign(profile,body);
          json={success:true,hasPendingChanges:approved};
        }else json.data=profile;
      }
      if(url.pathname==='/notifications')json.data={notifications:[],unreadCount:0};
      return route.fulfill({json});
    });
    await page.goto(`${base}/application/profile`,{waitUntil:'networkidle'});
    await expect(page.locator('.profile-guidelines')).toHaveCount(0);
    await expect(page.locator('.profile-name')).toHaveText(approved?'Alex':'LegalFirst');
    await expect(page.locator('.profile-hero')).not.toContainText('PrivateSurname');
    if(!approved)await expect(page.getByText('Preferred nickname required',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Edit preferred nickname',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Edit profile'});
    await expect(dialog.locator('.profile-guidelines')).toContainText('easy to read');
    await expect(dialog.locator('.profile-guidelines')).toContainText('Leave out your surname');
    const input=dialog.getByLabel('Preferred nickname',{exact:true});
    await input.fill('Alex99');await dialog.getByRole('button',{name:/Save/}).click();
    await expect(dialog.getByRole('alert')).toContainText('Use 2-24 letters');assert.equal(writes.length,0);
    await input.fill('Mary Ann');await dialog.getByRole('button',{name:/Save/}).click();
    await expect(dialog).toHaveCount(0);assert.deepEqual(writes,[{nickname:'Mary Ann'}]);
    await expect(page.locator('.profile-name')).toHaveText(approved?'Alex':'Mary Ann');
    if(approved)await expect(page.getByText('Changes submitted for review.',{exact:false})).toBeVisible();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.waitForTimeout(400);
    await page.screenshot({path:`/tmp/fluentxverse-nickname/tutor-${width}-${approved}.png`,fullPage:true});
    assert.deepEqual(errors,[]);await page.close();
    console.log(`PASS ${width}px ${approved?'approved change stays pending':'initial preferred nickname'}: guidelines, validation and public profile name`);
  }} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
