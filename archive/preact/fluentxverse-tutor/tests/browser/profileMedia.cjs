const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.TUTOR_TEST_URL || 'http://localhost:5173';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64');

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const width of [1566, 375]) for (const valid of [true, false]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const requests = [];
      const photo = 'https://api.fluentxverse.xyz/lesson/files/user/media-tutor/profile/photo.png';
      await context.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(localhost|127\.0\.0\.1):8765)\//, route => {
        const path = new URL(route.request().url()).pathname.replace(/\/$/, '');
        const user = { userId: 'media-tutor', firstName: 'Paul', lastName: 'Arriola', email: 'paulanthonyarriola@gmail.com', role: 'tutor', profilePicture: photo };
        let json = { success: true, user, data: [] };
        if (path.startsWith('/lesson/files/user/')) return path.endsWith('/new.png') || valid
          ? route.fulfill({ contentType: 'image/png', body: png })
          : route.fulfill({ status: 404, json: { error: 'File not found' } });
        if (path === '/tutor/profile') json.data = { profilePicture: photo, bio: '', education: [], interests: [] };
        if (path === '/tutor/user/personal-info') json.data = { firstName: 'Paul', lastName: 'Arriola' };
        if (path === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        if (path === '/notifications/unread-count') json.data = { unreadCount: 0 };
        if (path === '/schedule/week') json.data = { slots: [], weekStart: '2026-10-05', weekEnd: '2026-10-11' };
        if (path === '/tutor/profile-picture') json = { success: true, url: 'http://fluentxverse-seaweed-filer:8888/user/media-tutor/profile/new.png' };
        return route.fulfill({ json });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
      page.on('request', request => requests.push(request.url()));
      await page.goto(`${base}/profile`, { waitUntil: 'domcontentloaded' });
      await page.locator('.profile-name').waitFor().catch(async error => {
        console.error(await page.locator('body').innerText(), errors, requests);
        throw error;
      });
      await page.waitForFunction(valid => {
        const el = document.querySelector('.profile-avatar-large');
        return valid ? el instanceof HTMLImageElement && el.complete && el.naturalWidth > 0 : el?.tagName === 'DIV' && el.textContent.trim() === 'PA';
      }, valid, { timeout: 10000 }).catch(async error => {
        console.error(await page.locator('.profile-avatar-wrapper').innerHTML());
        throw error;
      });
      if (width === 375) {
        assert.equal(await page.locator('.mobile-header-user img').count(), valid ? 1 : 0);
        if (!valid) assert.equal(await page.locator('.mobile-header-user [role="img"]').count(), 1);
      }
      await page.locator('.profile-tabs .tab-btn').last().click();
      await page.locator('button.profile-settings-link').click();
      await page.locator('.settings-modal').waitFor();
      if (!valid) await page.locator('.settings-avatar [role="img"]').waitFor();
      else assert.ok(await page.locator('.settings-avatar img').evaluate(el => el.complete && el.naturalWidth > 0));
      const before = requests.filter(url => url.includes('/profile/photo.png')).length;
      await page.waitForTimeout(2000);
      assert.equal(requests.filter(url => url.includes('/profile/photo.png')).length, before, 'Failed photos do not retry in a loop');
      assert.ok(!requests.some(url => url.includes('via.placeholder.com') || url.includes('fluentxverse-seaweed-filer') || new URL(url).hostname === 'api.fluentxverse.xyz'), 'Browser never requests retired API, Docker storage or external placeholders');
      await page.screenshot({ path: `../output/screenshots/profile-media-${width}-${valid ? 'valid' : 'missing'}.png` });
      await page.locator('.settings-avatar input[type="file"]').setInputFiles({ name: 'new.png', mimeType: 'image/png', buffer: png });
      await page.waitForFunction(() => {
        const el = document.querySelector('.settings-avatar img');
        return el?.src.includes('/lesson/files/user/media-tutor/profile/new.png') && el.complete && el.naturalWidth > 0;
      });
      assert.deepEqual(errors, []);
      console.log(`PASS ${width} ${valid ? 'valid' : 'missing'}: proxied photo, local fallback, no retry loop, replacement upload`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
