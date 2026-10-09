const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const path = require('node:path');
const { isIP } = require('node:net');

(async () => {
  const args = ['--no-sandbox'];
  if (process.env.SITE_DNS_IP) {
    assert(isIP(process.env.SITE_DNS_IP));
    args.push(`--host-resolver-rules=MAP fluentxverse.com ${process.env.SITE_DNS_IP}, MAP www.fluentxverse.com ${process.env.SITE_DNS_IP}`);
    console.log('NOTE: frontend DNS override enabled; this is not proof of local DNS propagation');
  }
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args });
  const output = path.resolve(__dirname, '../../output/screenshots');
  await mkdir(output, { recursive: true });
  try {
    for (const host of ['fluentxverse.com', 'www.fluentxverse.com']) {
      for (const width of [1566, 375]) {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        const page = await context.newPage();
        const errors = [], badAssets = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('response', response => {
          const url = new URL(response.url());
          if (url.hostname !== host || !url.pathname.startsWith('/assets/')) return;
          if ((!response.ok() && response.status() !== 304) || (response.headers()['content-type'] || '').includes('text/html')) {
            badAssets.push({ path: url.pathname, status: response.status() });
          }
        });
        const home = await page.goto(`https://${host}/`, { waitUntil: 'networkidle' });
        assert.equal(home.status(), 200);
        assert.equal(home.headers()['x-content-type-options'], 'nosniff');
        await page.getByRole('heading', { level: 1 }).waitFor();
        for (const app of ['student', 'tutor']) {
          assert(await page.locator(`a[href="https://${app}.fluentxverse.com"]`).count() > 0);
        }
        for (const image of await page.locator('main img').all()) {
          await image.scrollIntoViewIfNeeded();
          await image.evaluate(img => img.decode());
        }
        await page.evaluate(() => scrollTo(0, 0));
        await page.evaluate(() => document.fonts.ready);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.screenshot({ path: path.join(output, `site-home-${host}-${width}.png`) });
        if (width === 375) await page.getByRole('button', { name: 'Open menu' }).click();
        await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'About', exact: true }).click();
        await page.waitForURL(`https://${host}/about`);
        await page.getByRole('heading', { level: 1 }).waitFor();
        const refreshed = await page.reload({ waitUntil: 'networkidle' });
        assert.equal(refreshed.status(), 200);
        assert.match(await page.title(), /About/);
        for (const image of await page.locator('main img').all()) {
          await image.scrollIntoViewIfNeeded();
          await image.evaluate(img => img.decode());
        }
        await page.evaluate(() => scrollTo(0, 0));
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.screenshot({ path: path.join(output, `site-about-${host}-${width}.png`) });
        assert.deepEqual(errors, []);
        assert.deepEqual(badAssets, []);
        console.log(`PASS ${host} ${width}px: home, mobile navigation, About refresh, images and app links`);
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
