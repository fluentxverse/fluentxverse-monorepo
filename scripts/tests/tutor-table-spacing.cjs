const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('@playwright/test');
const base = process.env.ADMIN_TEST_URL || 'http://127.0.0.1:5308';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  await fs.mkdir('/tmp/fxv-tutor-table', { recursive: true });
  try {
    for (const width of [1566, 1440, 1280, 1024, 390]) for (const theme of ['light', 'dark']) for (const finance of [true, false]) {
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      await context.addInitScript(value => localStorage.setItem('fxv_admin_theme', value), theme);
      const tutors = ['pending_profile', 'pending', 'certified', 'test_qualified'].map((status, i) => ({
        id: `test-${i}`, name: i === 0 ? 'Paul Anthony Arriola' : `Example Tutor ${i}`, email: `tutor-${i}@example.invalid`, status,
        languages: ['English'], totalSessions: 0, rating: 0, isBlocked: false,
        profileStatus: ['incomplete', 'pending_review', 'rejected', 'approved'][i],
        identityStatus: 'not_submitted',
      }));
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin === base) return route.continue();
        const headers = { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'content-type,cache-control,pragma' };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        assert.equal(request.method(), 'GET', 'Layout tests must never mutate data');
        const json = { success: true, data: [] };
        if (url.pathname === '/admin/me') json.user = { userId: 'spacing-test', username: 'Test Admin', role: 'admin' };
        if (url.pathname === '/admin/operations/access') json.data = { permissions: finance ? ['support', 'operations', 'finance'] : ['support'] };
        if (url.pathname === '/admin/tutors') json.data = { tutors, total: tutors.length };
        if (url.pathname === '/admin/operations/compensation') json.data = tutors.map(t => ({ tutorId: t.id, currency: 'USD', baseRateCents: 1000 }));
        return route.fulfill({ headers, json });
      });
      await context.routeWebSocket('**/*', ws => ws.close());
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/tutors');
      await page.locator('.tutors-table tbody tr').nth(3).waitFor();
      await page.waitForFunction(expected => document.querySelectorAll('.tutors-table th').length === expected, finance ? 13 : 12);
      const overflowingHeaders = await page.locator('.tutors-table th').evaluateAll(headers => headers.filter(cell => {
        const range = document.createRange(); range.selectNodeContents(cell);
        const bounds = cell.getBoundingClientRect();
        return [...range.getClientRects()].some(r => r.left < bounds.left || r.right > bounds.right);
      }).map(cell => cell.textContent));
      assert.deepEqual(overflowingHeaders, [], `Header containment at ${width} finance=${finance}`);
      assert(await page.locator('.tutors-table :is(.status-badge,.proof-badge,.action-btn)').evaluateAll(items => items.every(item => {
        const cell = item.closest('td').getBoundingClientRect(), bounds = item.getBoundingClientRect();
        return bounds.left >= cell.left + 5 && bounds.right <= cell.right - 5 && item.scrollWidth <= item.clientWidth + 1;
      })), 'Badges and actions must fit inside their cells without overflowing text');
      const result = await page.locator('.tutors-table').evaluate(table => {
        const headers = [...table.tHead.rows[0].cells];
        const statusIndex = headers.findIndex(cell => cell.textContent.trim() === 'Status');
        const box = el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width }; };
        return [...table.tBodies[0].rows].map(row => ({
          cells: [...row.cells].map(box), headers: headers.map(box),
          badges: [statusIndex, statusIndex + 1].map(i => ({ cell: box(row.cells[i]), badge: box(row.cells[i].querySelector('.status-badge')) })),
        }));
      });
      for (const row of result) {
        for (const { cell, badge } of row.badges) {
          assert(badge.left >= cell.left + 5, 'Badge must retain left cell padding');
          assert(badge.right <= cell.right - 5, 'Badge must retain right cell padding');
        }
        assert(row.badges[1].badge.left - row.badges[0].badge.right >= 11, 'Adjacent badges need a clear gutter');
        row.cells.forEach((cell, i) => assert(Math.abs(cell.left - row.headers[i].left) < 1, 'Column alignment'));
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Only table scrolls horizontally');
      if (width > 1100) assert(await page.locator('.tutors-table-card').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Desktop table must fit without horizontal scrolling');
      await page.screenshot({ path: `/tmp/fxv-tutor-table/${width}-${theme}-${finance}.png` });
      assert.deepEqual(errors, []);
      console.log(`PASS ${width} ${theme} finance=${finance}: badges contained, gutter preserved, columns aligned`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
