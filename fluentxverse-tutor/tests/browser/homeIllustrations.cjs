const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.TUTOR_TEST_URL || 'http://localhost:5173';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const width of [1566, 768, 375]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: 'dark' });
      const page = await context.newPage();
      const errors = [], failures = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => {
        if (response.url().includes('/home-icons/') && !response.ok()) failures.push(response.url());
      });
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.locator('.hero-title').waitFor();
      const images = page.locator('.home-illustration');
      assert.equal(await images.count(), 13);
      for (const img of await images.all()) {
        await img.scrollIntoViewIfNeeded();
        await img.evaluate(el => el.decode());
      }
      const result = await page.evaluate(() => {
        const images = [...document.querySelectorAll('.home-illustration')];
        return {
          theme: document.documentElement.dataset.theme,
          overflow: document.documentElement.scrollWidth > window.innerWidth,
          images: images.map(img => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let occupied = 0;
            for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) occupied++;
            const box = img.getBoundingClientRect();
            return { src: img.src, alt: img.alt, cornerAlpha: pixels[3], occupied, width: box.width, height: box.height };
          }),
          overlaps: [...document.querySelectorAll('.benefit-card, .step-card-inner')].some(card => {
            const img = card.querySelector('.home-illustration').getBoundingClientRect();
            const title = card.querySelector('h3').getBoundingClientRect();
            return img.bottom > title.top;
          }),
        };
      });
      assert.equal(result.theme, 'light');
      assert.equal(result.overflow, false);
      assert.equal(result.overlaps, false);
      assert.equal(new Set(result.images.map(img => img.src)).size, 6);
      for (const img of result.images) {
        assert.equal(img.alt, '');
        assert.equal(img.cornerAlpha, 0, 'Actual transparent background');
        assert.ok(img.occupied > 10000, 'Artwork is not blank');
        assert.equal(img.width, img.height, 'Stable square framing');
      }
      assert.equal(await page.locator('.benefit-icon i, .step-icon-box i, .feature-badge i').count(), 0);
      assert.deepEqual(failures, []);
      assert.deepEqual(errors, []);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.locator('.benefit-card').first().hover();
      const motion = await page.locator('.benefit-icon').first().evaluate(el => ({
        duration: getComputedStyle(el).transitionDuration,
        transform: getComputedStyle(el).transform,
      }));
      assert.ok(motion.duration.split(',').every(value => Number.parseFloat(value) <= 0.0001));
      assert.equal(motion.transform, 'none');
      await page.mouse.move(0, 0);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `../output/screenshots/tutor-home-custom-${width}.png` });
      await page.locator('.benefits-section').screenshot({ path: `../output/screenshots/tutor-benefits-custom-${width}.png`, style: 'header, header * { visibility: hidden !important; }' });
      await page.locator('.how-it-works-section').screenshot({ path: `../output/screenshots/tutor-steps-custom-${width}.png`, style: 'header, header * { visibility: hidden !important; }' });
      console.log(`PASS ${width}px: all 13 images rendered, transparency, no overlaps or overflow`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
