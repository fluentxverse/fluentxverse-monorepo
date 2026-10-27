const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5204';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  await fs.mkdir('../output/screenshots/about-hero', { recursive: true });
  try {
    for (const [width, height] of [[320,640],[375,667],[390,844],[576,900],[375,600],[768,1024],[1024,900],[1566,950],[1920,1080]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.route(/https:\/\/api\.fluentxverse\.(com|xyz)\//, route => route.fulfill({ status: 401, json: { success: false } }));
      await page.goto(base + '/about');
      const image = page.locator('.about-hero-image');
      await image.evaluate(element => element.decode());
      assert((await image.evaluate(element => element.currentSrc)).endsWith(width <= 900 ? 'about-tutor-closeup-mobile-v2.webp' : 'about-tutor-closeup-wide-v2.webp'));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (width <= 900) {
        const photo = await image.boundingBox(), text = await page.locator('.about-hero-content').boundingBox();
        assert(photo.y + photo.height <= text.y, 'Photo clears hero text at every mobile height');
        assert(Math.abs(photo.width / photo.height - 1.5) < 0.01, 'Mobile photograph keeps its complete 3:2 framing');
        assert.equal(await image.evaluate(element => getComputedStyle(element).objectFit), 'cover');
      }
      await expect(page.getByRole('heading', { name: 'FluentXVerse', exact: true })).toBeVisible();
      await page.screenshot({ path: `../output/screenshots/about-hero/${width}-${height}.png` });
      await page.getByRole('link', { name: 'Our Mission', exact: true }).click();
      await expect(page).toHaveURL(/#our-mission$/);
      console.log(`PASS about hero ${width}x${height}`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
