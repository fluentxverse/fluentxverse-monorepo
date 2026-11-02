const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const directory = '../output/screenshots/lesson-issue-threads';
  await fs.mkdir(directory, { recursive: true });
  try {
    for (const role of ['tutor', 'admin']) for (const theme of ['light', 'dark']) for (const width of [1440, 375]) {
      const base = role === 'tutor' ? 'http://127.0.0.1:5197' : 'http://127.0.0.1:5195';
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })), theme);
      const user = { userId: role + '-test', firstName: 'Alex', lastName: 'Teacher', role: role === 'admin' ? 'superadmin' : 'tutor', permissions: ['all'] };
      const thread = { id: 'thread-test', tutorId: 'tutor-test', bookingId: 'lesson-test', startsAt: '2026-10-30T10:00:00Z',
        createdAt: '2026-10-30T10:00:00Z', deadline: '2026-10-31T10:00:00Z', state: 'awaiting_tutor', replies: [],
        body: 'You selected Other for the lesson on Friday, Oct 30, 2026, 6:00 PM to 6:25 PM (Asia/Manila, UTC+08:00).\n\nWarning: Reply within 24 hours, by Saturday, Oct 31, 2026, 6:00 PM PHT, or this lesson will be marked TA-301.' };
      let posts = 0, fail = true;
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=', 'base64');
      await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, async route => {
        const request = route.request(), path = new URL(request.url()).pathname;
        let json = { success: true, user, data: [] };
        if (path.startsWith('/inbox/lesson-issues')) {
          if (path.includes('/images/')) return route.fulfill({ contentType: 'image/png', body: png });
          if (path.endsWith('/decision')) {
            const data = request.postDataJSON(); assert.equal(data.decision, 'no_penalty');
            thread.state = data.decision; thread.decisionReason = data.reason; thread.decisionRevision = 1;
            return route.fulfill({ json: { success: true } });
          }
          if (request.method() === 'POST') {
            posts++;
            if (fail) return route.fulfill({ status: 503, json: { success: false, error: 'Could not save reply. Please retry.' } });
            const headers = await request.allHeaders();
            const form = await new Request(request.url(), { method:'POST',headers,body:request.postDataBuffer() }).formData();
            assert.equal(form.getAll('images').length, 1);
            thread.replies.push({ id: 'reply-' + posts, role, body: String(form.get('text')), createdAt: '2026-10-30T11:00:00Z', attachments: [{ id: 'image-test' }] });
            if (role === 'tutor') thread.state = 'awaiting_admin';
            json.data = {};
          } else json.data = [thread];
        } else if (path.startsWith('/inbox/')) json.data = { messages: [], total: 0, stats: { unread: 0 }, unreadCount: 0 };
        if (path === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        return route.fulfill({ json });
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/inbox', { waitUntil: 'networkidle' });
      if (role === 'admin' && theme === 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click();
      if (role === 'admin') assert.equal(await page.locator('html').getAttribute('data-admin-theme'), theme);
      const section = page.locator('.lesson-issue-threads');
      try { await section.getByRole('heading', { name: 'Lesson issue conversations' }).waitFor(); }
      catch (e) { await page.screenshot({path:`${directory}/failure-${role}-${theme}-${width}.png`,fullPage:true}); console.error(page.url(),(await page.locator('body').innerText()).slice(0,1500),errors); throw e; }
      await section.locator('summary').click();
      await section.getByText(/Warning: Reply within 24 hours/).waitFor();
      const field = section.getByLabel(role === 'admin' ? 'Staff reply' : 'Your reply', {exact:true});
      await field.fill('The student requested that we discuss a different lesson.');
      await section.locator('input[type=file]').setInputFiles({ name: 'screenshot.png', mimeType: 'image/png', buffer: png });
      await section.getByRole('button', { name: 'Refresh', exact: true }).click();
      await page.waitForTimeout(300);
      assert.equal(await field.inputValue(), 'The student requested that we discuss a different lesson.');
      await section.getByRole('button', { name: 'Send reply', exact: true }).click();
      await section.getByRole('alert').waitFor();
      assert.equal(posts, 1); assert((await field.inputValue()).length > 10);
      fail = false;
      await section.getByRole('button', { name: 'Send reply', exact: true }).click();
      await section.locator('.issue-thread-reply').waitFor();
      assert.equal(posts, 2); assert.equal(await field.inputValue(), '');
      await section.locator('.issue-thread-images img').waitFor();
      assert(await section.locator('.issue-thread-images img').evaluate(img => img.complete && img.naturalWidth > 0));
      if (role === 'admin') {
        await section.getByRole('combobox', {name:'Staff outcome'}).selectOption('no_penalty');
        await section.getByLabel('Decision reason', {exact:true}).fill('The explanation has been verified by staff.');
        page.once('dialog', dialog => dialog.accept());
        await section.getByRole('button', {name:'Apply decision'}).click();
        await section.locator('summary').filter({hasText:'No penalty'}).waitFor();
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `${directory}/${role}-${theme}-${width}.png`, fullPage: true });
      console.log(`PASS ${role} ${theme} ${width}: warning, draft persistence, failure recovery, reply and layout`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
