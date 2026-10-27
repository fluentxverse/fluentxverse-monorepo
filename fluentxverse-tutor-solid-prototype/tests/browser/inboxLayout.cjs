const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';
const user = { userId: 'inbox-layout-tutor', firstName: 'Alex', lastName: 'Teacher', role: 'tutor' };
const fixtures = [
  { id: 'welcome', title: 'Welcome to your tutor inbox', content: 'Your teaching updates and announcements appear here.\nHave a great lesson!', category: 'announcement', isRead: false, isPinned: false },
  { id: 'update', title: 'Teaching resources updated', content: 'New materials are available for your next class.', category: 'update', isRead: true, isPinned: true },
].map(message => ({ ...message, createdAt: '2026-10-22T05:00:00Z' }));

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  await fs.mkdir('../output/screenshots/tutor-inbox', { recursive: true });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1566, 1024, 768, 375, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })), theme);
      let messages = structuredClone(fixtures);
      let fail = false;
      await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, async route => {
        const url = new URL(route.request().url());
        const path = url.pathname;
        let json = { success: true, user, data: [] };
        if (path === '/inbox/messages') {
          if (fail) return route.fulfill({ status: 503, json: { success: false, error: 'Inbox temporarily unavailable' } });
          json.data = { messages: messages.filter(m => (!url.searchParams.has('isRead') || m.isRead === (url.searchParams.get('isRead') === 'true')) && (!url.searchParams.has('isPinned') || m.isPinned)), stats: { total: messages.length, unread: messages.filter(m => !m.isRead).length } };
        }
        if (path.includes('/mark-read/')) messages.find(m => m.id === path.split('/').pop()).isRead = true;
        if (path === '/inbox/mark-all-read') messages.forEach(m => { m.isRead = true; });
        if (path.includes('/toggle-pin/')) {
          const message = messages.find(m => m.id === path.split('/').pop());
          message.isPinned = !message.isPinned; json.data = { isPinned: message.isPinned };
        }
        if (path.endsWith('/unread-count')) json.data = { unreadCount: 1 };
        if (path === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        return route.fulfill({ json });
      });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + '/inbox', { waitUntil: 'networkidle' });
      await page.locator('.message-item').first().waitFor();
      const layout = await page.evaluate(() => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect();
        const button = document.querySelector('.inbox-filter-btn');
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          headerBottom: rect('.inbox-header').bottom, filtersTop: rect('.inbox-filters').top,
          panelTop: rect('.inbox-content').top,
          errorHeight: rect('.inbox-error-slot').height,
          background: getComputedStyle(button).backgroundImage,
          before: getComputedStyle(button, '::before').content,
          subtitle: getComputedStyle(document.querySelector('.inbox-header-content p')).color,
        };
      });
      assert(!layout.overflow, `${theme} ${width}: horizontal overflow`);
      assert.equal(layout.errorHeight, 0);
      assert(layout.filtersTop - layout.headerBottom <= 25);
      if (width > 1024) assert(layout.panelTop < 270, JSON.stringify(layout));
      assert.equal(layout.background, 'none'); assert.equal(layout.before, 'none');
      assert.notEqual(layout.subtitle, 'rgb(255, 255, 255)');
      await page.screenshot({ path: `../output/screenshots/tutor-inbox/list-${theme}-${width}.png` });
      const welcome = page.getByRole('button', { name: /Welcome to your tutor inbox/ });
      await welcome.focus(); await page.keyboard.press('Enter');
      await page.locator('.detail-title').waitFor();
      assert(await page.locator('.inbox-sender img').evaluate(el => el.complete && el.naturalWidth > 0), 'Sender logo decodes');
      assert.equal(await page.locator('.detail-date time').getAttribute('datetime'), fixtures[0].createdAt);
      assert(await page.locator('.detail-subject').evaluate(el => parseFloat(getComputedStyle(el).borderLeftWidth) === 3), 'Subject category accent renders');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Reader fits viewport');
      await page.getByRole('button', { name: 'Pin message', exact: true }).click();
      await page.getByRole('button', { name: 'Unpin message', exact: true }).waitFor();
      await page.screenshot({ path: `../output/screenshots/tutor-inbox/read-${theme}-${width}.png` });
      if (width <= 1024) {
        assert(!await page.locator('.messages-list').isVisible());
        await page.getByRole('button', { name: 'Back to messages' }).click();
        assert(await page.locator('.messages-list').isVisible());
      }
      await page.getByRole('button', { name: 'Unread', exact: true }).click();
      await page.getByText('All caught up!', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Pinned', exact: true }).click();
      await page.locator('.message-item').first().waitFor();
      assert.equal(await page.locator('.message-item').count(), 2);
      fail = true;
      await page.getByRole('button', { name: /All Messages/ }).click();
      await page.locator('.inbox-error').waitFor();
      fail = false;
      await page.getByRole('button', { name: 'Try Again' }).click();
      await page.locator('.inbox-error').waitFor({ state: 'detached' });
      messages = [];
      await page.getByRole('button', { name: 'Pinned', exact: true }).click();
      await page.getByText('No pinned messages', { exact: true }).waitFor();
      assert.deepEqual(errors, []);
      console.log(`PASS ${theme} ${width}: compact layout, clean controls, keyboard read, pin, filters, empty state, error recovery`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
