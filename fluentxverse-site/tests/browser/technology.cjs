const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const path = require('node:path');

const base = (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
const widths = process.env.SITE_WIDTHS ? process.env.SITE_WIDTHS.split(',').map(Number) : [1920, 1440, 1000, 820, 768, 390, 320];
assert(widths.length && widths.every(width => Number.isInteger(width) && width > 0));
const routes = [
  { path: '/', title: /Learning, backed by proof/ },
  { path: '/about', title: /About/ },
  { path: '/technology', title: /^Technology/ },
  { path: '/technology/ai', title: /^AI in Education/ },
  { path: '/onchain-education', title: /^Why Onchain Education/ },
];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const output = path.resolve(process.env.SITE_SCREENSHOTS || '/tmp/fluentxverse-technology-qa');
  await mkdir(output, { recursive: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const route of routes) {
        const response = await page.goto(`${base}${route.path}`, { waitUntil: 'networkidle' });
        assert.equal(response.status(), 200);
        await page.locator('main h1').waitFor();
        assert.equal(await page.locator('main h1').count(), 1);
        assert.match(await page.title(), route.title);
        const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
        assert.equal(canonical, `https://fluentxverse.com${route.path}`);
        for (const image of await page.locator('main img').all()) {
          await image.scrollIntoViewIfNeeded();
          await image.evaluate(img => img.decode());
        }
        const overflow = await page.evaluate(() => [...document.querySelectorAll('main h1, main h2, main h3, main p, nav a')]
          .filter(element => element.getBoundingClientRect().width && element.scrollWidth > element.clientWidth + 2)
          .map(element => element.textContent));
        assert.deepEqual(overflow, [], `Text overflow on ${route.path} at ${width}px`);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        if (route.path === '/technology') {
          assert.deepEqual(await page.locator('.technology-layer h3').allTextContents(), [
            'AI: more useful learning support.',
            'Web3: learning beyond one platform.',
            'ZK: trust without oversharing.',
          ]);
          assert.equal(await page.locator('.layer-purpose').count(), 3);
          assert.doesNotMatch(await page.locator('main').innerText(), /\b(WebRTC|TURN|RealtimeKit|Groth16|Circom|snarkjs|Sepolia|Volta|PostgreSQL|Memgraph)\b/);
          assert.equal(await page.locator('.status-list, .architecture-flow').count(), 0);
        }
        if (route.path.startsWith('/technology') || route.path === '/onchain-education') {
          assert.equal(await page.locator('.technology-nav .topic-active').count(), 1);
          assert.equal(await page.locator('.technology-nav .topic-active').getAttribute('href'), route.path);
          for (const detail of await page.locator('.research-faq details').all()) {
            await detail.locator('summary').click();
            assert(await detail.evaluate(element => element.open));
            assert(await detail.locator('p').isVisible());
            await detail.locator('summary').click();
            assert(!(await detail.evaluate(element => element.open)));
          }
        }
        await page.evaluate(() => scrollTo(0, 0));
        await page.evaluate(() => document.fonts.ready);
        if ([1440, 390].includes(width)) {
          const name = route.path === '/' ? 'home' : route.path.slice(1).replaceAll('/', '-');
          await page.screenshot({ path: path.join(output, `${name}-${width}.png`), fullPage: true });
        }
        console.log(`PASS ${width}px ${route.path}: route, metadata, images, layout, topics, accordions`);
      }
      await page.goto(`${base}/`, { waitUntil: 'networkidle' });
      const nav = page.getByRole('navigation', { name: 'Main navigation' });
      if (width <= 760) await page.getByRole('button', { name: 'Open menu' }).click();
      await nav.getByRole('link', { name: 'Technology', exact: true }).click();
      await page.waitForURL(`${base}/technology`);
      await page.getByRole('heading', { level: 1, name: 'Technology for real learning.' }).waitFor();
      if (width <= 760) assert.equal(await page.getByRole('button', { name: 'Open menu' }).getAttribute('aria-expanded'), 'false');
      await page.getByRole('navigation', { name: 'Technology topics' }).getByRole('link', { name: 'AI in education' }).click();
      await page.waitForURL(`${base}/technology/ai`);
      await page.getByRole('heading', { level: 1, name: 'AI in education.' }).waitFor();
      await page.reload({ waitUntil: 'networkidle' });
      assert.match(await page.title(), /^AI in Education/);
      await page.goBack({ waitUntil: 'networkidle' });
      await page.getByRole('heading', { level: 1, name: 'Technology for real learning.' }).waitFor();
      await page.goto(`${base}/does-not-exist`, { waitUntil: 'networkidle' });
      assert.match(await page.title(), /Page Not Found/);
      assert.equal(await page.locator('main h1').textContent(), 'A different direction.');
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
