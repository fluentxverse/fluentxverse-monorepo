const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const { readFileSync, writeFileSync } = require('node:fs');
const fixturePath = process.env.SLOT_QA_FIXTURE;
assert.ok(fixturePath?.startsWith('/tmp/fxv-slot-contention-20261014.'));
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
const backend = 'http://127.0.0.1:5197';
const base = process.env.STUDENT_TEST_URL || 'https://student.fluentxverse.com';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const contexts = [], pages = [], calls = [[], []], errors = [], selections = [];
  let pendingReserve = [];
  try {
    for (let i = 0; i < 2; i++) {
      const student = fixture.students[i];
      const context = await browser.newContext({ viewport: { width: i === 0 ? 1440 : 390, height: 1000 }, timezoneId: 'Asia/Manila' });
      contexts.push(context);
      await context.routeWebSocket(/.*/, socket => socket.close());
      await context.route(/^https:\/\/api\.fluentxverse\.(com|xyz)\//, async route => {
        const req = route.request(), url = new URL(req.url()), path = url.pathname;
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
        const call = { path, method: req.method() };
        calls[i].push(call);
        const reply = data => route.fulfill({ json: { success: true, data } });
        const tutor = { userId: fixture.tutorId, firstName: 'QA', lastName: 'Tutor', displayName: 'QA Tutor', tier: 1, isAvailable: true, bio: 'Synthetic isolated booking test.', profilePicture: '/assets/img/banner/banner_woman.webp' };
        if (path === '/student/me') return route.fulfill({ json: { success: true, user: { userId: student.id, role: 'student', firstName: `QA Student ${i}`, email: `${student.id}@example.invalid`, walletAddress: student.wallet } } });
        if (path === '/tutor/search') return reply({ tutors: [tutor], total: 1, hasMore: false });
        if (path === '/lesson-passes/mode') return reply({ mode: 'legacy_erc1155' });
        if (path === '/schedule/preload') return reply({ stats: {}, bookingsCount: 0, activityCount: 0 });
        if (path.startsWith('/schedule/available/')) {
          // Both clients see the same advertised slot before either submits checkout.
          return reply([{ slotId: fixture.slotId, tutorId: fixture.tutorId, date: fixture.date, time: fixture.time, durationMinutes: 25 }]);
        }
        if (path === '/schedule/reserve') {
          await new Promise(resolve => { pendingReserve.push(resolve); if (pendingReserve.length === 2) pendingReserve.forEach(release => release()); });
        }
        if (path === '/schedule/reserve' || path === '/schedule/book' || path === '/schedule/release-reservation' || path === '/schedule/recover-transfer' || path.startsWith('/schedule/reservation/') || path === '/tickets/consume' || path.startsWith('/tickets/balance/')) {
          const response = await fetch(backend + path + url.search, { method: req.method(), headers: {
            cookie: `studentAuth=${student.token}`, 'content-type': 'application/json', origin: 'https://student.fluentxverse.com',
          }, body: req.method() === 'GET' ? undefined : req.postData() });
          const payload = await response.json();
          Object.assign(call, { status: response.status, success: payload.success, error: payload.error });
          return route.fulfill({ status: response.status, json: payload });
        }
        if (req.method() !== 'GET') throw new Error(`Unexpected write blocked: ${path}`);
        if (path === '/student/favorites') return reply({ favorites: [], total: 0 });
        return reply([]);
      });
      const page = await context.newPage(); pages.push(page);
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/browse-tutors', { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: /Tomorrow/ }).click();
      await page.getByRole('button', { name: 'Show schedule for QA Tutor', exact: true }).click();
      await page.locator('.booking-modal-time-slot').first().click();
      selections.push(page.getByRole('button', { name: /Confirm Booking|Book Lesson|Use.*Ticket/ }).last());
    }
    await Promise.all(selections.map(button => button.click()));
    await expect.poll(async () => {
      const s = await fetch(backend + '/qa/summary').then(r => r.json());
      return [s.bookings.length, s.deductions];
    }, { timeout: 15000 }).toEqual([1, 1]);
    const summary = await fetch(backend + '/qa/summary').then(r => r.json());
    const winner = fixture.students.findIndex(s => s.id === summary.bookings[0].studentId), loser = 1 - winner;
    await expect(pages[winner].getByRole('heading', { name: 'Booking Confirmed!', exact: true })).toBeVisible();
    await expect(pages[loser].locator('.booking-modal-error')).toContainText(/available|reserved/i);
    assert.equal(calls[winner].filter(c => c.path === '/tickets/consume').length, 1);
    assert.equal(calls[loser].filter(c => c.path === '/tickets/consume').length, 0);
    assert.equal(calls[loser].filter(c => c.path === '/schedule/book').length, 0);
    assert.equal(summary.students[winner].balance, 1); assert.equal(summary.students[loser].balance, 2);
    assert.equal(summary.students[loser].transfers, 0);
    assert.deepEqual(errors, []);
    for (let i = 0; i < 2; i++) await pages[i].screenshot({ path: fixturePath.replace('browser-fixture.json', `browser-student-${i}.png`), fullPage: false });
    const report = { testedAt: new Date().toISOString(), base, image: fixture.image, synthetic: true, passed: true,
      scope: 'Deployed student UI in separate desktop/mobile contexts; synthetic authentication and discovery, actual isolated booking/payment HTTP handlers and Memgraph',
      winnerRequests: calls[winner], loserRequests: calls[loser], summary };
    writeFileSync(fixturePath.replace('browser-fixture.json', 'browser-contention.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ passed: true, bookings: 1, deductions: 1, loserTransfers: 0, loserBookingCalls: 0, winnerBalance: 1, loserBalance: 2, desktopAndMobile: true }));
  } catch (error) {
    console.error(JSON.stringify({ calls, errors }));
    for (let i = 0; i < pages.length; i++) await pages[i].screenshot({ path: fixturePath.replace('browser-fixture.json', `browser-error-${i}.png`), fullPage: false }).catch(() => {});
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
