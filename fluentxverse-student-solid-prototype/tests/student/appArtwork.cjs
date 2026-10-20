const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const bases = { student: process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176', tutor: process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177' };
const output = process.env.ARTWORK_SCREENSHOTS || '/tmp/fluentxverse-artwork';
const names = ['notifications', 'inbox', 'profile', 'video', 'reviews', 'support', 'issue', 'business', 'vocabulary', 'music', 'story', 'certificate', 'privacy', 'classroom'];
const apiPattern = /^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780|8782))\//;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  await fs.mkdir(output, { recursive: true });
  try {
    for (const app of ['student', 'tutor']) for (const theme of ['light', 'dark']) for (const width of [1440, 375]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })), theme);
      const user = { userId: 'artwork-fixture', role: app, givenName: 'Alex', firstName: 'Alex', lastName: 'Teacher', email: 'artwork@example.test' };
      const errors = [], writes = [];
      await context.route(apiPattern, route => {
        const req = route.request(), path = new URL(req.url()).pathname;
        if (!['GET', 'OPTIONS'].includes(req.method())) { writes.push(path); return route.fulfill({ json: { success: true } }); }
        const json = { success: true, user, data: [], lessons: [], articles: [], status: { passed: true, percentage: 90 } };
        if (path === '/tutor/profile' || path === '/tutor/artwork-fixture') json.data = { ...user, displayName: 'Alex Teacher', bio: 'Practical English for everyday conversations.', interests: ['Travel'], education: ['Language education'], specializations: ['Conversation'], profileStatus: 'approved', totalReviews: 1, rating: 5, videoIntroUrl: '/artwork-fixture-video.mp4' };
        if (path.includes('/personal-info')) json.data = user;
        if (path === '/notifications' || path === '/notifications/') json.data = { notifications: [], unreadCount: 0 };
        if (path.endsWith('/unread-count')) json.data = { unreadCount: 0 };
        if (path === '/inbox/messages') json.data = { messages: [], stats: { total: 0, unread: 0, pinned: 0 } };
        if (path === '/schedule/week') json.data = { slots: [] };
        if (path === '/young-learners/public/artwork-lesson') return route.fulfill({ json: { success: true, lesson: {
          id: 'artwork-lesson', level: 1, unit: 1, lessonNumber: 1, theme: 'colors', ageGroup: '5-8', unitLabel: 'Getting started', lessonTitle: 'Everyday colors', mascot: 'foxy', greeting: 'Welcome!',
          vocabularyWords: [{ id: 'blue', word: 'Blue', translation: 'Blue', image: '/assets/img/home-icons/vocabulary-v1.webp' }],
          song: { title: 'Color song', lyrics: [{ id: 'one', line: 'Blue sky' }] },
          story: { title: 'A colorful day', pages: [{ id: 'one', text: 'The sky is blue.', image: '' }] }, activities: [],
        } } });
        return route.fulfill({ json });
      });
      await context.route('**/artwork-fixture-video.mp4', route => route.fulfill({ status: 404 }));
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      const check = async (path, icon, heading) => {
        await page.goto(bases[app] + path, { waitUntil: 'domcontentloaded' });
        if (heading) await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible();
        const art = page.locator(`img[src$="/home-icons/${icon}-v1.webp"]`).first();
        await expect(art).toBeVisible();
        await art.evaluate(image => image.decode());
        assert.equal(await art.evaluate(image => image.naturalWidth), 384);
        const fits = await art.evaluate(image => {
          const r = image.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && Math.abs(r.width - r.height) < 1 && r.left >= 0 && r.right <= innerWidth;
        });
        assert.ok(fits, `${app} ${path}: icon is square and not clipped`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        await page.screenshot({ path: `${output}/${app}-${theme}-${width}-${icon}.png` });
      };
      await check('/inbox', 'inbox', 'Inbox');
      await check('/materials/business-english', 'business', 'Business English');
      await check('/privacy-policy', 'privacy', 'Privacy Policy');
      if (app === 'student') {
        await check('/contact', 'support', 'Contact Us');
        await page.getByRole('button', { name: /^Notifications/ }).click();
        const dialog = page.getByRole('dialog', { name: 'Notifications', exact: true });
        await expect(dialog.locator('img')).toHaveAttribute('src', '/assets/img/home-icons/notifications-v1.webp');
        await page.keyboard.press('Escape');
        await check('/tutor/artwork-fixture', 'profile', 'About Me');
        await page.getByRole('button', { name: /Reviews/ }).click();
        await expect(page.getByRole('heading', { name: 'Student Reviews' }).locator('img')).toHaveAttribute('src', '/assets/img/home-icons/reviews-v1.webp');
      } else {
        await check('/notifications', 'notifications', 'Notifications');
        await check('/profile', 'profile', 'About Me');
        await expect(page.getByRole('heading', { name: 'Introduction Video' }).locator('img')).toHaveAttribute('src', '/assets/img/home-icons/video-v1.webp');
      }
      await page.goto(bases[app] + (app === 'student' ? '/young-learners/lesson/' : '/materials/young-learners/lesson/') + 'artwork-lesson', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.yl-lesson-header')).toBeVisible();
      if (app === 'tutor') {
        await page.locator('.yl-nav-btn.next').hover();
        const contrast = await page.locator('.yl-nav-btn.next').evaluate(el => {
          const style = getComputedStyle(el);
          const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
          const a = luminance(style.color), b = luminance(style.backgroundColor);
          return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        });
        assert.ok(contrast >= 4.5, 'Next button text stays readable when hovered');
      }
      for (const icon of ['vocabulary', 'music', 'story']) {
        await page.locator('.yl-nav-btn.next').click();
        const heading = page.locator('.yl-section-title');
        await expect(heading.locator('img')).toHaveAttribute('src', `/assets/img/home-icons/${icon}-v1.webp`);
        await heading.locator('img').evaluate(image => image.decode());
        const rect = await heading.boundingBox();
        assert.ok(rect.x >= 0 && rect.x + rect.width <= width + 1, 'Young-learner heading fits');
        await page.screenshot({ path: `${output}/${app}-${theme}-${width}-${icon}.png` });
      }
      const pixels = await page.evaluate(async names => {
        const results = [];
        for (const name of names) {
          const image = new Image(); image.src = `/assets/img/home-icons/${name}-v1.webp`; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
          const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0, 32, 32);
          const rgba = ctx.getImageData(0, 0, 32, 32).data;
          let opaque = 0, transparent = 0;
          for (let i = 3; i < rgba.length; i += 4) { if (rgba[i] > 200) opaque++; if (rgba[i] === 0) transparent++; }
          results.push({ name, width: image.naturalWidth, opaque, transparent });
        }
        return results;
      }, names);
      for (const icon of pixels) {
        assert.equal(icon.width, 384, icon.name);
        assert.ok(icon.opaque > 220 && icon.transparent > 50, `${icon.name}: nonblank and genuinely transparent at 32px`);
      }
      assert.deepEqual(errors, []);
      assert.ok(writes.every(path => path === '/schedule/preload'), 'No live mutations: ' + writes);
      console.log(`PASS artwork ${app} ${theme} ${width}: semantic headings, fourteen decoded transparent icons, no overflow`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
