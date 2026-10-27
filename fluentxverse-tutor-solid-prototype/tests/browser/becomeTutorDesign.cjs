const { chromium, expect } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const output = '../output/screenshots/tutor-application-design';
  await fs.mkdir(output, { recursive: true });
  try {
    for (const width of [1920, 1566, 1024, 768, 576, 390, 375, 320]) {
      const page = await browser.newPage({ viewport: { width, height: width < 768 ? 850 : 1000 }, colorScheme: 'dark' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: 'dark' }, version: 2 })));
      await page.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780|8782))\//,
        route => route.fulfill({ status: 401, json: { success: false } }));
      await page.goto(base + '/become-tutor', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Become aFluentXVerse Tutor');
      await expect(page.locator('.bt-qualification')).toHaveCount(6);
      await expect(page.locator('.bt-setup-item')).toHaveCount(4);
      await expect(page.locator('.bt-process > li')).toHaveCount(3);
      assert.deepEqual(await page.locator('.bt-platforms h3').allTextContents(), ['Windows', 'macOS', 'Linux']);
      assert.equal(await page.locator('.become-tutor-page').getByText(/Windows Windows|Linux Linux|Apple macOS/).count(), 0);
      await expect(page.locator('.bt-hero-actions .bt-button')).toHaveAttribute('href', '/register');
      await expect(page.locator('.bt-cta .bt-button')).toHaveAttribute('href', '/register');
      await expect(page.locator('.bt-specs').first()).toContainText('At least 8 GB RAM');
      await expect(page.locator('.bt-specs').last()).toContainText('15 Mbps upload & download');
      for (const image of await page.locator('.become-tutor-page img').all()) {
        await image.evaluate(element => { element.loading = 'eager'; return element.decode(); });
        assert(await image.evaluate(element => element.naturalWidth > 0));
      }
      const pixels = await page.locator('.bt-setup .tutor-art').evaluateAll(images => images.map(image => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0, 32, 32);
        const bytes = context.getImageData(0, 0, 32, 32).data;
        let opaque = 0, clear = 0;
        for (let i = 3; i < bytes.length; i += 4) { if (bytes[i] > 100) opaque++; if (bytes[i] === 0) clear++; }
        return { opaque, clear };
      }));
      assert(pixels.every(image => image.opaque > 120 && image.clear > 20), 'All setup artwork is visible with real alpha');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      const layout = await page.locator('.become-tutor-page').evaluate(main => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        clipped: [...main.querySelectorAll('h1,h2,h3,p,dd,a')].filter(element => element.scrollWidth > element.clientWidth + 1).map(element => element.textContent),
        headers: [...main.querySelectorAll('.bt-setup-item > header')].every(header => {
          const image = header.querySelector('img').getBoundingClientRect(), title = header.querySelector('div').getBoundingClientRect();
          return image.right <= title.left && title.right <= header.getBoundingClientRect().right + 1;
        }),
      }));
      assert.equal(layout.overflow, false); assert.deepEqual(layout.clipped, []); assert(layout.headers);
      if (width < 768) {
        const photo = await page.locator('.bt-hero-media').boundingBox();
        const header = await page.locator('.tutor-public-header .menu-wrap').boundingBox();
        const copy = await page.locator('.bt-hero-content .bt-eyebrow').boundingBox();
        assert(photo.y >= header.y + header.height, 'Mobile hero photo clears the fixed header');
        assert(photo.y + photo.height <= copy.y, 'Mobile hero text clears the photograph');
      }
      await page.screenshot({ path: `${output}/${width}-hero.png` });
      await page.locator('.bt-jump-nav a[href="#setup"]').click();
      await expect(page).toHaveURL(/#setup$/);
      await page.locator('.bt-setup').screenshot({ path: `${output}/${width}-setup.png` });
      await page.locator('.bt-security').screenshot({ path: `${output}/${width}-security.png` });
      for (const path of ['/become-tutor', '/contact']) {
        if (path === '/contact') await page.goto(base + path, { waitUntil: 'domcontentloaded' });
        const social = page.locator('footer .footer-social');
        await social.scrollIntoViewIfNeeded();
        assert.deepEqual(await social.locator('a').evaluateAll(links => links.map(link => link.getAttribute('aria-label'))), ['FluentXVerse on LinkedIn', 'FluentXVerse on Facebook', 'FluentXVerse on X']);
        await expect(social.locator('svg')).toHaveCount(3);
        assert.equal((await social.innerText()).trim(), '');
        await expect(social.locator('a').first()).toHaveAttribute('href', 'https://www.linkedin.com/company/fluentxverse');
        await page.keyboard.press('Tab');
        await social.locator('a').first().focus();
        assert.equal(await social.locator('a').first().evaluate(element => getComputedStyle(element).outlineStyle), 'solid');
        await page.locator('footer').screenshot({ path: `${output}/${width}-${path.slice(1)}-footer.png` });
      }
      if (width < 992) {
        await page.getByRole('button', { name: 'Open mobile menu', exact: true }).click();
        const menu = page.getByRole('dialog', { name: 'Navigation', exact: true });
        await expect(menu.locator('.social-links svg')).toHaveCount(3);
        await expect(menu.getByRole('link', { name: 'X', exact: true })).toHaveAttribute('href', 'https://x.com/fluentxverse');
        await page.keyboard.press('Escape');
        await expect(menu).toHaveCount(0);
      }
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`PASS tutor application ${width}: layout, artwork pixels/alpha, platform labels, anchors, footer/contact and menu`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
