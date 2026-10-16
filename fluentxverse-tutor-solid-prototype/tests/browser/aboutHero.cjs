const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const [width, height] of [[1920, 1080], [1566, 900], [1024, 768], [768, 1024], [375, 812], [375, 667], [320, 568]]) {
      const context = await browser.newContext({ viewport: { width, height }, colorScheme: 'dark' });
      await context.addInitScript(() => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: 'dark' }, version: 2 })));
      const page = await context.newPage();
      await page.goto(`${base}/about`, { waitUntil: 'domcontentloaded' });
      await page.locator('.about-hero-title').waitFor();
      await page.locator('.about-hero-image').evaluate(img => img.decode());
      await page.evaluate(() => document.fonts.ready);
      const layout = await page.evaluate(() => {
        const hero = document.querySelector('.about-hero-section').getBoundingClientRect();
        const content = document.querySelector('.about-hero-content').getBoundingClientRect();
        const mission = document.querySelector('.about-mission-section').getBoundingClientRect();
        const img = document.querySelector('.about-hero-image');
        const canvas = document.createElement('canvas');
        canvas.width = 32; canvas.height = 32;
        const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, 32, 32);
        const pixels = ctx.getImageData(0, 0, 32, 32).data;
        let min = 255, max = 0;
        for (let i = 0; i < pixels.length; i += 4) { min = Math.min(min, pixels[i]); max = Math.max(max, pixels[i]); }
        const elements = [...document.querySelectorAll('.about-hero-content h1, .about-hero-content p, .about-hero-actions a')];
        return {
          theme: document.documentElement.dataset.theme,
          image: img.currentSrc,
          pixelRange: max - min,
          contentFits: content.top >= hero.top && content.bottom <= hero.bottom,
          elementsFit: elements.every(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }),
          nextSectionVisible: mission.top < innerHeight - 40,
          overflow: document.documentElement.scrollWidth > innerWidth,
          brandAligned: Math.abs(document.querySelector('.menu-nav .brand-text').getBoundingClientRect().top - document.querySelector('.menu-nav .logo').getBoundingClientRect().top) < 15,
        };
      });
      assert.equal(layout.theme, 'light');
      assert.ok(layout.image.includes(width <= 600 ? 'mobile-v1' : 'wide-v2'));
      assert.ok(layout.pixelRange > 50, 'Hero image is nonblank');
      assert.ok(layout.contentFits && layout.elementsFit, 'Hero content fits');
      assert.equal(layout.overflow, false);
      assert.ok(layout.brandAligned, 'Header brand stays next to the logo');
      assert.ok(layout.nextSectionVisible, 'Next section peeks into first viewport');
      assert.equal(await page.locator('.about-hero-primary').getAttribute('href'), '/register');
      await page.screenshot({ path: `../output/screenshots/about-hero-${width}x${height}.png` });
      await page.locator('.about-hero-secondary').click();
      assert.ok(page.url().endsWith('#our-mission'));
      const headingTop = await page.locator('#about-mission-title').evaluate(el => el.getBoundingClientRect().top);
      assert.ok(headingTop >= 90, 'Mission heading is clear of sticky header');
      console.log(`PASS About hero ${width}x${height}: image, layout, light mode, CTA, mission link`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
