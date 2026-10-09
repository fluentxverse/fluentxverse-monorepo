// Fixtures exercise the UI without writing to the shared database.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.TUTOR_TEST_URL || 'http://localhost:5173';
const month = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 7);
const previousMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)) - 2, 1)).toISOString().slice(0, 7);
const startsAt = new Date(Date.now() - 3600000).toISOString();
function fixture(period, selectedMonth, page, empty, corrected) {
  const lessons = Array.from({ length: empty ? 0 : 25 }, (_, i) => ({ bookingId: `metrics-${i}`, startsAt, durationMinutes: 25, studentName: `Student ${i + 1}`, outcome: i < 3 ? 'attended' : i < 8 ? 'tutor_absent' : i < 10 ? 'student_absent' : 'awaiting_verification', notesStatus: i < 3 ? 'submitted' : i < 10 ? 'not_required' : i < 12 ? 'changes_pending' : 'draft' }));
  return { period: { period, month: period === 'month' ? selectedMonth : null, from: null, to: null }, timezone: 'Asia/Manila', generatedAt: startsAt,
    slots: { bookable: empty ? 0 : 40, booked: empty ? 0 : 25 },
    cancellation: { rate: empty ? null : corrected ? 20 : 40, affectedSlots: empty ? 0 : corrected ? 8 : 16, eligibleSlots: empty ? 0 : 40 },
    survey: { total: empty ? 0 : 4, average: empty ? null : 4.3,
      distribution: [1, 2, 3, 4, 5].map(rating => ({ rating, count: empty ? 0 : rating === 5 ? 2 : rating >= 3 ? 1 : 0 })),
      topics: [{ id: 'connection', label: 'Audio and connection quality', positiveEnabled: true, positive: empty ? 0 : 2, improvement: empty ? 0 : 1, positiveRate: empty ? null : 50, improvementRate: empty ? null : 25 },
        { id: 'environment', label: 'Quiet learning environment', positiveEnabled: false, positive: 0, improvement: 0, positiveRate: empty ? null : 0, improvementRate: empty ? null : 0 }] },
    lessons: { total: lessons.length, attended: empty ? 0 : 3, tutor_absent: empty ? 0 : 5, student_absent: empty ? 0 : 2, awaiting_verification: empty ? 0 : 15, upcoming: 0, ongoing: 0, cancelled: 0, unclassified: 0, teachingHours: empty ? 0 : 1.25, teachingMinutes: empty ? 0 : 75 },
    attendance: { present: empty ? 0 : 5, absent: empty ? 0 : 5, unverified: empty ? 0 : 15, rate: empty ? null : 50 },
    notes: { submitted: empty ? 0 : 3, pendingUpdates: empty ? 0 : 2, drafts: empty ? 0 : 13, overdue: empty ? 0 : 4, notRequired: empty ? 0 : 7, onTime: empty ? 0 : 3, submissionRate: empty ? null : 16.7 },
    reliability: { score: empty ? null : corrected ? 80 : 0, eligibleSlots: empty ? 0 : 25, bookedSlots: empty ? 0 : 25, unbookedSlots: 0, penaltyPoints: empty ? 0 : corrected ? 5 : 26, penaltyCounts: { '301': empty ? 0 : 5, '302': empty ? 0 : 4, '303': empty ? 0 : 3 }, weights: { '301': 3, '302': 2, '303': 1 } },
    trend: Array.from({ length: period === 'all' ? 12 : 7 }, (_, i) => ({ date: period === 'all' ? `2026-${String(i + 1).padStart(2, '0')}` : `${month}-${String(i + 1).padStart(2, '0')}`, attended: empty ? 0 : i % 3, tutorAbsent: empty ? 0 : i % 2, studentAbsent: empty ? 0 : i === 3 ? 2 : 0, unverified: empty ? 0 : i % 4, minutes: i % 3 * 25 })),
    recentLessons: lessons.slice((page - 1) * 20, page * 20), page, pageSize: 20, totalPages: empty ? 0 : 2,
    penalties: empty ? [] : [{ id: 'penalty', bookingId: 'metrics-4', code: 'TA-301', reason: 'Tutor missed the classroom entry deadline', startsAt, createdAt: startsAt, points: corrected ? 0 : 3, excludedFromScore: corrected }], penaltyTotal: empty ? 0 : 1,
    rating: { average: null, totalReviews: 0, scope: 'all_time', distribution: null }, penaltyReference: [{ code: 'TA-301', description: 'Tutor absence for a booked slot', weight: 3 }] };
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  await fs.mkdir('../output/screenshots', { recursive: true });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1566, 375]) {
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })), theme);
      let failed = false, corrected = false, calls = 0;
      const errors = [];
      await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):8765|https:\/\/api\.fluentxverse\.(?:com|xyz))\//, async route => {
        const url = new URL(route.request().url()), path = url.pathname;
        const user = { userId: 'metrics-tutor', id: 'metrics-tutor', role: 'tutor', firstName: 'Metrics', email: 'paulanthonyarriola@gmail.com' };
        if (path === '/tutor/me') return route.fulfill({ json: { success: true, user } });
        if (path === '/schedule/week') return route.fulfill({ json: { success: true, data: { slots: [] } } });
        if (path === '/notifications' || path === '/notifications/') return route.fulfill({ json: { success: true, data: { notifications: [], unreadCount: 0 } } });
        if (path === '/tutor/performance') {
          calls++;
          if (failed) return route.fulfill({ status: 500, json: { success: false, error: 'Metrics temporarily unavailable' } });
          const selected = url.searchParams.get('month') || month, period = url.searchParams.get('period') || 'month';
          return route.fulfill({ json: { success: true, data: fixture(period, selected, Number(url.searchParams.get('page') || 1), period === 'month' && selected !== month, corrected) } });
        }
        if (path === '/tutor/profile') return route.fulfill({ json: { success: true, data: { firstName: 'Metrics', lastName: 'Tutor', email: user.email, profileStatus: 'approved', totalSessions: 999 } } });
        return route.fulfill({ json: { success: true, data: [], user, profile: {}, notifications: [] } });
      });
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && message.text().startsWith('ErrorBoundary')) errors.push(message.text()); });
      await page.goto(`${base}/performance-metrics`);
      await page.getByRole('heading', { name: 'Lesson outcomes', exact: true }).waitFor({ timeout: 10000 }).catch(async error => {
        console.error({ url: page.url(), calls, errors, body: await page.locator('body').innerText() });
        await page.screenshot({ path: '../output/screenshots/metrics-debug.png', fullPage: true });
        throw error;
      });
      const kpi = label => page.locator('.metrics-kpi').filter({ has: page.getByText(label, { exact: true }) }).locator('strong');
      assert.equal(await kpi('Bookable slots').innerText(), '40');
      assert.equal(await kpi('Booked slots').innerText(), '25');
      assert.equal(await kpi('Cancellation/absence ratio').innerText(), '40%');
      assert.equal(await page.locator('.metrics-overview-card').first().getByRole('heading').innerText(), 'Scheduling');
      assert.equal(await page.locator('.metrics-overview-card').first().locator('.metrics-kpi').count(), 2);
      assert.equal(await page.locator('.metrics-section').first().evaluate(el => getComputedStyle(el).borderRadius), '8px');
      assert.equal(await kpi('Teaching hours').innerText(), '1.25');
      assert.equal(await kpi('Reliability').innerText(), '0%', 'Zero is not replaced with 100');
      assert.equal(await page.locator('.metrics-table tbody tr').count(), 20);
      if (theme === 'dark') {
        const rows = page.locator('.metrics-table tbody tr');
        assert.equal(await page.locator('.metrics-table').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)', 'Table uses the card background');
        for (const index of [0, 1]) assert.equal(await rows.nth(index).evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)', 'Odd and even rows use the card background');
        await rows.first().hover();
        assert.equal(await rows.first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(48, 48, 48)', 'Hover stays neutral rather than blue');
        await page.mouse.move(0, 0);
      }
      assert.equal(await page.locator('.metrics-table tbody a').first().getAttribute('href'), '/lesson/metrics-0');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), JSON.stringify(await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('.performance-metrics-page, .performance-metrics-page *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 20).map(el => ({ tag: el.tagName, class: el.className, right: el.getBoundingClientRect().right })) }))));
      await page.screenshot({ path: `../output/screenshots/metrics-lessons-${theme}-${width}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Next page', exact: true }).click();
      await page.getByText('Page 2 of 2', { exact: true }).waitFor();
      assert.equal(await page.locator('.metrics-table tbody tr').count(), 5);
      const beforeTab = calls;
      await page.getByRole('button', { name: 'Attendance & reliability', exact: true }).click();
      await page.getByText('Tutor missed the classroom entry deadline', { exact: true }).waitFor();
      assert.equal(calls, beforeTab, 'Switching tabs uses loaded metrics');
      assert.equal(await page.getByRole('heading', { name: 'Cancellation/absence ratio', exact: true }).count(), 1);
      assert.equal(await page.getByText('Ratio (lower is better)', { exact: true }).count(), 1);
      corrected = true;
      await page.getByRole('button', { name: 'Refresh metrics', exact: true }).click();
      await page.getByText('80%', { exact: true }).first().waitFor();
      assert.equal(await kpi('Cancellation/absence ratio').innerText(), '20%');
      await page.screenshot({ path: `../output/screenshots/metrics-reliability-${theme}-${width}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Rating', exact: true }).click();
      await page.getByText('No ratings', { exact: true }).waitFor();
      await page.getByRole('heading', { name: 'Satisfaction points', exact: true }).waitFor();
      assert.equal(await page.getByLabel('Audio and connection quality: satisfaction', { exact: true }).getAttribute('value'), '50');
      assert.equal(await page.getByLabel('Audio and connection quality: improvement', { exact: true }).getAttribute('value'), '25');
      assert.equal(await page.locator('.metrics-survey-positive progress').count(), 1);
      assert.equal(await page.locator('.metrics-survey-improvement progress').count(), 2);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Survey charts do not overflow');
      await page.screenshot({ path: `../output/screenshots/metrics-surveys-${theme}-${width}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Calculations', exact: true }).click();
      await page.locator('.metrics-definitions dt').filter({ hasText: 'TA-301' }).waitFor();
      assert.equal(await page.locator('.metrics-definitions dt').getByText('Cancellation/absence ratio', { exact: true }).count(), 1);
      await page.getByLabel('Metrics period').selectOption('30days');
      await page.getByText('Updated', { exact: false }).first().waitFor();
      await page.getByLabel('Metrics period').selectOption('all');
      await page.getByText('Updated', { exact: false }).first().waitFor();
      assert.equal(await page.getByLabel('Metrics month').count(), 0);
      await page.getByLabel('Metrics period').selectOption('month');
      await page.getByLabel('Metrics month').fill(previousMonth);
      await page.getByRole('button', { name: 'Lessons', exact: true }).click();
      await page.getByText('No booked lessons in this period.', { exact: true }).waitFor();
      assert.equal(await kpi('Reliability').innerText(), 'No data');
      assert.equal(await kpi('Cancellation/absence ratio').innerText(), 'No data');
      failed = true;
      await page.getByRole('button', { name: 'Refresh metrics', exact: true }).click();
      await page.getByRole('alert').getByText('Metrics temporarily unavailable', { exact: false }).waitFor();
      failed = false;
      await page.getByRole('button', { name: 'Retry', exact: true }).click();
      await page.getByText('No booked lessons in this period.', { exact: true }).waitFor();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow');
      await page.goto(`${base}/profile`);
      await page.locator('.profile-tabs button').filter({ hasText: 'Stats' }).click();
      await page.locator('.profile-stat-card-value').filter({ hasText: '80%' }).waitFor();
      assert.equal(await page.locator('.profile-stat-card-value').first().innerText(), '25', 'Profile counters use the same API');
      await page.locator('.profile-stat-card').last().click();
      await page.getByRole('heading', { name: 'Reliability', exact: true }).waitFor();
      assert.equal(await page.getByLabel('Metrics period').inputValue(), 'all');
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS ${theme} ${width}: totals, zero reliability, pagination, tab cache, refresh, filters, empty/error states, and profile consistency`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
