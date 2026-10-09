const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const path = require('node:path');
const { isIP } = require('node:net');

const legacyTutorImages = new Set([
  '/assets/img/others/author_img.png',
  '/assets/img/others/sidebar_img01.png',
  '/assets/img/others/sidebar_img02.png',
  '/assets/img/others/sidebar_img03.png',
]);

// Public assets and anonymous sessions are real; no identity/API fixtures are installed.
(async () => {
  const domains = (process.env.WORKERS_TEST_DOMAINS || 'fluentxverse.xyz').split(',');
  const args = ['--no-sandbox'];
  if (process.env.WORKERS_DNS_IP) {
    assert(isIP(process.env.WORKERS_DNS_IP), 'DNS override must be a literal edge IP');
    args.push(`--host-resolver-rules=MAP student.fluentxverse.com ${process.env.WORKERS_DNS_IP}, MAP tutor.fluentxverse.com ${process.env.WORKERS_DNS_IP}`);
    console.log('NOTE: frontend DNS overridden for this browser; this does not verify local DNS propagation or backend availability');
  }
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args,
  });
  const screenshots = path.resolve(__dirname, '../../output/screenshots');
  await mkdir(screenshots, { recursive: true });
  try {
    for (const domain of domains) {
      for (const app of ['student', 'tutor']) {
        for (const width of [1566, 375]) {
          const context = await browser.newContext({ viewport: { width, height: 900 } });
          const errors = [], apiHosts = [], badAssets = [], assetResponses = [], legacyMissing = new Set();
          const origin = `https://${app}.${domain}`;
          const page = await context.newPage();
          page.on('pageerror', error => errors.push(error.message));
          page.on('request', request => {
            const url = new URL(request.url());
            if (url.hostname.startsWith('api.fluentxverse.')) apiHosts.push(url.hostname);
          });
          page.on('response', response => {
            const url = new URL(response.url());
            if (url.origin !== origin || !url.pathname.startsWith('/assets/')) return;
            const type = response.headers()['content-type'] || '';
            if (/\.(js|css|png|webp|jpg|jpeg|woff2?)$/.test(url.pathname)) {
              assetResponses.push(url.pathname);
              if ((!response.ok() && response.status() !== 304) || type.includes('text/html')) {
                if (app === 'tutor' && legacyTutorImages.has(url.pathname)) legacyMissing.add(url.pathname);
                else badAssets.push({ path: url.pathname, status: response.status(), type });
              }
            }
          });
          const response = await page.goto(origin, { waitUntil: 'domcontentloaded' });
          assert.equal(response.status(), 200);
          assert.equal(response.headers()['x-content-type-options'], 'nosniff');
          assert.match(response.headers()['cache-control'], /no-store/);
          await page.waitForFunction(() => document.body.innerText.trim().length > 20);
          await page.waitForTimeout(2000);
          assert(assetResponses.some(asset => asset.endsWith('.js')), 'Published JavaScript must load');
          assert(apiHosts.length > 0, 'Anonymous session restoration must reach the API');
          assert(apiHosts.every(host => host === `api.${domain}`), 'API selection must match the app domain');
          assert(await page.evaluate(() => [...document.images].some(img => img.complete && img.naturalWidth > 0)), 'At least one visual asset must render');
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'The app must not overflow horizontally');
          await page.screenshot({ path: path.join(screenshots, `workers-${app}-${domain}-${width}.png`), fullPage: false });
          // Isolate hosting fallback from the anonymous classroom authentication redirect.
          const fallbackContext = await browser.newContext({ javaScriptEnabled: false });
          const fallbackPage = await fallbackContext.newPage();
          const nested = await fallbackPage.goto(`${origin}/classroom/hosting-smoke-test`, { waitUntil: 'domcontentloaded' });
          assert.equal(nested.status(), 200);
          assert.match(nested.headers()['content-type'], /text\/html/);
          const reloaded = await fallbackPage.reload({ waitUntil: 'domcontentloaded' });
          assert.equal(reloaded.status(), 200);
          await fallbackContext.close();
          await page.waitForTimeout(500);
          assert.deepEqual(badAssets, []);
          assert.deepEqual(errors, []);
          if (legacyMissing.size) console.log(`WARN ${app}.${domain}: ${legacyMissing.size} pre-existing missing images in the unused HTML offcanvas template`);
          console.log(`PASS ${app}.${domain} ${width}px: real public assets, rendering, same-site API selection and deep-link refresh`);
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
