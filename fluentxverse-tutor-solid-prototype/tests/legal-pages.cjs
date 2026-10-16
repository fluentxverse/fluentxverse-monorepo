const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const role = 'tutor';
const base = process.env.LEGAL_TEST_URL || 'http://127.0.0.1:5177';
(async () => {
  const browser = await chromium.launch({ executablePath:'/usr/bin/google-chrome', args:['--no-sandbox'] });
  const output = path.resolve('test-results/legal-pages');
  await fs.mkdir(output, { recursive:true });
  try {
    for (const width of [1440,375]) {
      const context = await browser.newContext({ viewport:{width,height:900} });
      await context.addInitScript(() => localStorage.setItem('fxv_theme','dark'));
      await context.route(/http:\/\/(localhost|127\.0\.0\.1):87\d\d\/.*|https:\/\/(api|ws)\.fluentxverse\.com\/.*|https:\/\/auth\.privy\.io\/.*/, route => route.fulfill({status:401,json:{success:false}}));
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror',error => errors.push(error.message));
      for (const [route,title] of [['privacy-policy','Privacy Policy'],['terms-of-service','Terms of Service']]) {
        await page.goto(base + '/' + route, {waitUntil:'domcontentloaded'});
        await page.getByRole('heading',{name:title,exact:true}).waitFor();
        assert.equal(await page.locator('h1').count(),1);
        assert.equal(await page.title(),title + ' | FluentXVerse');
        const body = await page.locator('.fxv-legal-body').innerText();
        assert(!/farm|agricultur|plant identification|June 26, 2025/i.test(body));
        assert(body.includes('support@fluentxverse.com'));
        assert(body.includes('30'));
        assert(body.includes('guardian'));
        if (role === 'tutor') {
          assert(body.includes('must sign'));
          assert(body.includes('standing tutor authorization'));
          assert(!body.includes('You can agree or decline'));
        } else {
          assert(body.includes('recording agreement before beginning teaching work'));
          assert(body.includes(route === 'privacy-policy' ? 'You can agree or decline' : 'recording remains optional'));
        }
        assert(await page.locator('.fxv-legal-body section').count() >= 16);
        assert.equal(await page.locator('.fxv-legal-tabs [aria-current="page"]').innerText(),title);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
        const image = await page.locator('.fxv-legal-heading img').evaluate(el => ({loaded:el.complete && el.naturalWidth>0,width:el.getBoundingClientRect().width}));
        assert(image.loaded && image.width >= 48);
        assert.equal(await page.locator('.fxv-legal-body').evaluate(el => getComputedStyle(el.querySelector('p')).color),'rgb(64, 81, 104)');
        await page.screenshot({path:path.join(output,role + '-' + route + '-' + width + '.png')});
        const target = route === 'privacy-policy' ? 'rights' : 'cancellation';
        if (width < 900) await page.locator('.fxv-legal-index summary').click();
        await page.locator('.fxv-legal-index a[href="#' + target + '"]').click();
        await page.waitForTimeout(300);
        assert.equal(new URL(page.url()).hash,'#' + target);
        const heading = page.locator('#' + target + '-title');
        assert(await heading.isVisible());
        await page.reload({waitUntil:'domcontentloaded'});
        await heading.waitFor();
        assert.equal(new URL(page.url()).hash,'#' + target);
        await page.emulateMedia({media:'print'});
        assert.equal(await page.locator('.fxv-legal-index').isVisible(),false);
        assert(await heading.isVisible());
        await page.emulateMedia({media:'screen'});
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
        console.log(role + ' ' + route + ' ' + width + ': passed');
      }
      assert.deepEqual(errors,[]);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
