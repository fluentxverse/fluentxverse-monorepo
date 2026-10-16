const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.STUDENT_TEST_URL || 'http://localhost:5174';
const bookings = [
  ['multi-late', '2026-10-07', '10:30 AM', 'Morgan Tutor', 'absent'],
  ['multi-early', '2026-10-07', '9:00 AM', 'Alex Tutor', 'present'],
  ['single-oct', '2026-10-05', '1:00 PM', 'Jamie Tutor', 'present'],
  ['midnight', '2026-09-30', '11:30 PM', 'Night Tutor', 'present'],
  ['september', '2026-09-15', '2:00 PM', 'September Tutor', 'present'],
  ['leap-day', '2024-02-29', '2:00 PM', 'Leap Tutor', 'present'],
  ['upcoming', '2026-10-08', '12:00 PM', 'Upcoming Tutor', null],
].map(([bookingId, slotDate, slotTime, tutorName, attendanceStudent]) => ({ bookingId, slotDate, slotTime, tutorName, attendanceStudent, tutorId: `tutor-${bookingId}`, status: bookingId === 'upcoming' ? 'confirmed' : 'completed', durationMinutes: 25, bookedAt: '2026-01-01T00:00:00Z' }));
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1566, 375]) {
      let empty = false, failSchedule = false, failClaim = true, claimCount = 0;
      let proofs = [{ bookingId: 'multi-early', eligible: true, status: 'ready' }, { bookingId: 'multi-late', eligible: false, status: 'ready' }];
      const errors = [];
      const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'America/Los_Angeles' });
      await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })), theme);
      await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):8765|https:\/\/api\.fluentxverse\.(?:com|xyz))\//, async route => {
        const request = route.request(), path = new URL(request.url()).pathname;
        const reply = json => route.fulfill({ json });
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
        const user = { userId: 'calendar-student-test', role: 'student', firstName: 'Calendar', email: 'paulanthonyarriola@gmail.com' };
        if (path === '/student/me') return reply({ success: true, user });
        if (path === '/schedule/student-bookings') {
          if (failSchedule) { failSchedule = false; return route.fulfill({ status: 503, json: { success: false } }); }
          return reply({ success: true, data: empty ? [] : bookings });
        }
        if (path === '/proof/student-lessons/me') return reply({ success: true, data: proofs });
        if (path.endsWith('/claim')) {
          claimCount++;
          if (failClaim) { failClaim = false; return route.fulfill({ status: 503, json: { error: 'Proof service unavailable' } }); }
          const proof = { bookingId: 'multi-early', eligible: true, status: 'verified', commitment: 'fixture-commitment' };
          proofs = [proof, proofs[1]]; return reply({ success: true, data: proof });
        }
        if (path.startsWith('/schedule/lesson-material-request/')) return reply({ success: true, data: { canRequestMaterial: false, materialRequest: null } });
        if (path.endsWith('/issue-report')) return reply({ success: true, data: { startsAt: '2026-10-05T05:00:00Z', lessonEndsAt: '2026-10-05T05:25:00Z', closesAt: '2026-10-07T05:25:00Z', serverNow: '2026-10-07T06:00:00Z', report: null, eligible: false, reason: 'expired' } });
        if (path.startsWith('/schedule/lesson-recap/')) return reply({ success: true, data: { startsAt: '2026-10-05T05:00:00Z', studentAttendance: 'present', materials: [], studentComment: '', englishLevelAssessment: null } });
        if (path.startsWith('/schedule/lesson/')) return reply({ success: true, data: { ...bookings[2], startsAt: '2026-10-05T05:00:00Z' } });
        return reply({ success: true, data: [], user, profile: {}, lessons: [] });
      });
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      await page.clock.setFixedTime(new Date('2026-10-07T06:00:00Z'));
      await page.goto(`${base}/schedule`, { waitUntil: 'domcontentloaded' });
      await page.locator('.schedule-list .schedule-card').waitFor();
      assert.equal(await page.locator('.schedule-list .schedule-card').count(), 1);
      await page.getByRole('button', { name: /Past Lessons/ }).click();
      await page.getByRole('heading', { name: 'October 2026', exact: true }).waitFor();
      assert.equal(await page.locator('.past-calendar-grid > *').count(), 42);
      assert.equal(await page.locator('.past-calendar-toolbar p').textContent(), '4 lessons');
      assert.equal(await page.locator('.past-calendar-day-count').first().evaluate(element => getComputedStyle(element).color), theme === 'dark' ? 'rgb(121, 181, 255)' : 'rgb(2, 69, 174)');
      assert.equal(await page.locator('.past-calendar-lesson').count(), 2);
      assert.match(await page.locator('.past-calendar-lesson').first().textContent(), /10:00 JST.*Alex Tutor/);
      const multi = page.getByRole('button', { name: 'Wednesday, October 7, 2026: 2 lessons', exact: true });
      await multi.click();
      assert.equal(new URL(page.url()).pathname, '/schedule');
      assert.equal(await multi.getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('.past-calendar-lesson .past-calendar-open-lesson').first().getAttribute('href'), '/lesson/multi-early');
      await page.getByRole('button', { name: /Claim proof/ }).click();
      await page.getByRole('alert').filter({ hasText: 'Service is temporarily unavailable' }).waitFor();
      await page.getByRole('button', { name: /Claim proof/ }).click();
      await page.getByRole('link', { name: /Verified proof/ }).waitFor();
      assert.equal(claimCount, 2);
      await page.locator('.past-calendar').evaluate(element => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 120));
      await page.locator('.past-calendar').screenshot({ path: `/tmp/student-past-calendar-${theme}-${width}.png` });
      await page.screenshot({ path: `/tmp/student-past-calendar-page-${theme}-${width}.png`, fullPage: true });
      await page.locator('.past-calendar-agenda').screenshot({ path: `/tmp/student-past-calendar-agenda-${theme}-${width}.png` });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Calendar does not overflow the page');
      assert(await page.locator('.past-calendar-day').evaluateAll(elements => elements.every(element => element.scrollWidth <= element.clientWidth)), 'Labels fit inside date tiles');
      const single = page.getByRole('link', { name: 'Monday, October 5, 2026: 1 lesson', exact: true });
      await single.click(); await page.waitForURL('**/lesson/single-oct', { waitUntil: 'domcontentloaded' });
      await page.goBack({ waitUntil: 'domcontentloaded' }); await page.waitForURL('**/schedule?**', { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'October 2026', exact: true }).waitFor();
      assert.equal(await page.getByRole('combobox', { name: 'Lesson day', exact: true }).inputValue(), '2026-10-05', 'Browser Back restores the calendar and selected day');
      await page.getByRole('combobox', { name: 'Lesson day', exact: true }).selectOption('2026-10-01');
      assert.match(await page.locator('.past-calendar-lesson').textContent(), /00:30 JST.*Night Tutor/);
      await page.getByRole('button', { name: 'Previous month', exact: true }).click();
      await page.getByRole('heading', { name: 'September 2026', exact: true }).waitFor();
      assert.equal(await page.locator('.past-calendar-toolbar p').textContent(), '1 lesson');
      await page.getByRole('button', { name: 'Previous month', exact: true }).click();
      await page.getByText('No past lessons in August 2026.', { exact: true }).waitFor();
      assert.equal(await page.locator('.past-calendar-lesson').count(), 0);
      await page.getByRole('button', { name: 'Current month', exact: true }).click();
      await page.getByRole('heading', { name: 'October 2026', exact: true }).waitFor();
      await page.getByLabel('Calendar month', { exact: true }).fill('2024-02');
      await page.getByRole('heading', { name: 'February 2024', exact: true }).waitFor();
      assert.equal(await page.getByRole('link', { name: 'Thursday, February 29, 2024: 1 lesson', exact: true }).getAttribute('href'), '/lesson/leap-day');
      await page.getByRole('button', { name: 'Upcoming', exact: false }).click();
      assert.equal(await page.locator('.past-calendar').count(), 0);
      assert.equal(await page.locator('.schedule-list .schedule-card').count(), 1);
      await page.getByRole('button', { name: /Past Lessons/ }).click();
      empty = true; await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByText('No past lessons in October 2026.', { exact: true }).waitFor();
      assert.equal(await page.locator('.past-calendar-grid > *').count(), 42);
      failSchedule = true; await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Error Loading Schedule', exact: true }).waitFor();
      await page.getByRole('button', { name: /Try Again/ }).click();
      await page.getByText('No past lessons in October 2026.', { exact: true }).waitFor();
      assert.deepEqual(errors, []);
      console.log(`PASS ${theme} ${width}: calendar, multiple/single lessons, history, timezone rollover, month navigation, proof actions, empty and error states`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
