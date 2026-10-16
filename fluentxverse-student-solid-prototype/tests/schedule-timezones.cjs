const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const { readFileSync, writeFileSync } = require('node:fs');
const fixturePath = process.env.TIMEZONE_QA_FIXTURE;
assert.ok(fixturePath?.startsWith('/tmp/fxv-cancellation-timezone-20261014.'));
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
const base = process.env.STUDENT_TEST_URL || 'https://student.fluentxverse.com';
const instant = new Date(fixture.startsAt);
const expectedTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instant);
const expectedDay = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', day: 'numeric' }).format(instant);

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const results = [];
  try {
    for (const [width, timezoneId] of [[1440, 'America/Los_Angeles'], [375, 'Asia/Manila'], [320, 'Europe/London']]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, timezoneId });
      await context.routeWebSocket(/.*/, socket => socket.close());
      const calls = [], errors = [];
      await context.route(/^https:\/\/api\.fluentxverse\.(com|xyz)\//, async route => {
        const req = route.request(), path = new URL(req.url()).pathname;
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
        calls.push({ method: req.method(), path });
        const reply = data => route.fulfill({ json: { success: true, data } });
        if (path === '/student/me') return route.fulfill({ json: { success: true, user: { userId: fixture.studentId, role: 'student', firstName: 'Timezone QA', walletAddress: fixture.wallet } } });
        if (path === '/schedule/student-bookings') return reply(fixture.bookings);
        if (path === '/schedule/preload') return reply({ stats: {}, bookingsCount: 1, activityCount: 0 });
        if (path === '/lesson-passes/mode') return reply({ mode: 'legacy_erc1155' });
        if (req.method() !== 'GET') throw new Error(`Unexpected mutation blocked: ${path}`);
        return reply([]);
      });
      const page = await context.newPage(); page.on('pageerror', err => errors.push(err.message));
      await page.goto(base + '/schedule', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.schedule-card.upcoming')).toHaveCount(1);
      const card = page.locator('.schedule-card.upcoming');
      await expect(page.locator('.schedule-timezone')).toContainText('Japan Time (JST)');
      await expect(card.locator('.date-day')).toHaveText(expectedDay);
      await expect(card).toContainText(`${expectedTime} JST`);
      const open = card.getByRole('link', { name: 'Open Lesson', exact: true });
      await expect(open).toHaveAttribute('href', `/lesson/${fixture.bookings[0].bookingId}`);
      await expect(open).toBeVisible();
      await expect(card.getByRole('link', { name: 'View Tutor', exact: true })).toBeVisible();
      const layout = await page.evaluate(() => {
        const card = document.querySelector('.schedule-card.upcoming'), text = card.querySelector('.schedule-card-info').getBoundingClientRect(),
          actions = card.querySelector('.schedule-card-actions').getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth > innerWidth + 1,
          overlap: Math.min(text.right, actions.right) > Math.max(text.left, actions.left) + 1 && Math.min(text.bottom, actions.bottom) > Math.max(text.top, actions.top) + 1,
          controlsFit: [...card.querySelectorAll('.action-btn')].every(n => n.scrollWidth <= n.clientWidth + 1) };
      });
      assert.equal(layout.overflow, false); assert.equal(layout.overlap, false); assert.equal(layout.controlsFit, true);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(card).toContainText(`${expectedTime} JST`);
      await expect(card.locator('.date-day')).toHaveText(expectedDay);
      assert.deepEqual(errors, []);
      assert.ok(calls.every(c => c.method === 'GET' || c.path === '/schedule/preload'));
      await page.screenshot({ path: fixturePath.replace('timezone-fixture.json', `schedule-${width}-${timezoneId.replaceAll('/', '-')}.png`), fullPage: false });
      results.push({ width, timezoneId, displayedTime: `${expectedTime} JST`, displayedDay: expectedDay, sameBookingId: fixture.bookings[0].bookingId, layout });
      await context.close();
    }
    const report = { testedAt: new Date().toISOString(), passed: true, synthetic: true, base, image: fixture.image,
      startsAt: fixture.startsAt, epochMs: instant.getTime(), results, scope: 'Deployed UI, real isolated server booking response, synthetic auth; schedule intentionally displays JST independent of device timezone.' };
    writeFileSync(fixturePath.replace('timezone-fixture.json', 'schedule-timezones.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
