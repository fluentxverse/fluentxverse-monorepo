const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';
const output = process.env.ISSUE_SCREENSHOTS || '/tmp/fluentxverse-metrics-lesson-issues';
const month = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 7);
const previousMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)) - 2, 1)).toISOString().slice(0, 7);
const timestamp = new Date().toISOString();
const user = { userId: 'issue-ui-tutor', firstName: 'Metrics', email: 'issue-ui@example.test', role: 'tutor' };

function metrics(period, selectedMonth, page) {
  return { period: { period, month: period === 'month' ? selectedMonth : null }, page, pageSize: 20, totalPages: 0,
    generatedAt: timestamp, slots: { bookable: 0, booked: 0 }, lessons: { total: 0, attended: 0, teachingHours: 0, upcoming: 0, ongoing: 0,
      cancelled: 0, tutor_absent: 0, student_absent: 0, awaiting_verification: 0, unclassified: 0 },
    attendance: { present: 0, absent: 0, unverified: 0, rate: null }, notes: { submitted: 0, pendingUpdates: 0, drafts: 0, overdue: 0, notRequired: 0, submissionRate: null },
    reliability: { score: null, bookedSlots: 0, unbookedSlots: 0, penaltyPoints: 0, weights: {}, penaltyCounts: {} }, cancellation: { rate: null },
    recentLessons: [], trend: [], penalties: [], penaltyTotal: 0, rating: { average: null, totalReviews: 0 }, survey: { total: 0, topics: [], distribution: [], average: null }, penaltyReference: [] };
}
function reports(url) {
  const period = url.searchParams.get('period'), selectedMonth = url.searchParams.get('month');
  const direction = url.searchParams.get('direction'), status = url.searchParams.get('status'), page = Number(url.searchParams.get('page'));
  const empty = period === 'month' && selectedMonth !== month;
  const total = empty ? 0 : direction === 'sent' ? 21 : 2;
  const rows = Array.from({ length: total }, (_, index) => ({ id: `${direction}-${index}`, bookingId: `issue-lesson-${index}`, studentName: `Issue Student ${index + 1}`,
    startsAt: timestamp, createdAt: timestamp, reviewedAt: timestamp, direction, duration: 'up_to_ten', reason: direction === 'sent' ? 'student' : 'tutor',
    reasonLabel: direction === 'sent' ? 'Student-related issue' : 'Tutor-related issue', issueLabel: direction === 'sent' ? 'Student is late' : 'Tutor did not join the classroom',
    status: direction === 'sent' ? ['submitted', 'under_review', 'resolved'][index % 3] : index === 0 ? 'under_review' : 'resolved',
    details: direction === 'received' ? 'Student description: <img src=x onerror=alert(1)> ' + 'detail '.repeat(80) : '',
    resolution: 'The lesson report was reviewed. Public resolution only.' }));
  const statusCounts = { submitted: 0, under_review: 0, resolved: 0 };
  for (const row of rows) statusCounts[row.status]++;
  const filtered = rows.filter(row => status === 'all' || row.status === status);
  return { period: { period, month: period === 'month' ? selectedMonth : null }, timezone: 'Asia/Manila', generatedAt: timestamp, direction, status,
    summary: { sent: empty ? 0 : 21, received: empty ? 0 : 2 }, statusCounts, total: filtered.length,
    items: filtered.slice((page - 1) * 20, page * 20), page, pageSize: 20, totalPages: Math.ceil(filtered.length / 20) };
}

(async () => {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const [width, theme] of [[1440, 'light'], [375, 'light'], [320, 'light'], [375, 'dark']]) {
      const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: 'reduce' });
      await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme }, version: 2 })), theme);
      let failure = false, delayed = false;
      const calls = [], writes = [], errors = [];
      await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, async route => {
        const request = route.request(), url = new URL(request.url());
        if (!['GET', 'OPTIONS'].includes(request.method())) { writes.push(url.pathname); return route.abort(); }
        let json = { success: true, user, data: [], status: { passed: true } };
        if (url.pathname === '/schedule/week') json.data = { slots: [] };
        if (url.pathname === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        if (url.pathname.endsWith('/unread-count')) json.data = { unreadCount: 0 };
        if (url.pathname === '/proof/tutor-certification/me') json.data = { snapshot: { missingRequirements: [] } };
        if (url.pathname === '/tutor/performance') json.data = metrics(url.searchParams.get('period'), url.searchParams.get('month'), Number(url.searchParams.get('page')));
        if (url.pathname === '/tutor/lesson-issues') {
          calls.push(Object.fromEntries(url.searchParams));
          if (failure) return route.fulfill({ status: 500, json: { success: false, error: 'Lesson reports are temporarily unavailable.' } });
          if (delayed && url.searchParams.get('direction') === 'sent') await new Promise(resolve => setTimeout(resolve, 350));
          json.data = reports(url);
        }
        return route.fulfill({ json });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && message.text().startsWith('ErrorBoundary')) errors.push(message.text()); });
      await page.goto(base + '/performance-metrics');
      await page.getByRole('heading', { name: 'Lesson outcomes', exact: true }).waitFor({ timeout: 10000 }).catch(async error => {
        console.error({ url: page.url(), errors, body: await page.locator('body').innerText() });
        await page.screenshot({ path: `${output}/issues-debug.png` });
        throw error;
      });
      assert.equal(calls.length, 0, 'Issue history is lazy loaded');
      const nav = page.getByRole('navigation', { name: 'Performance views' });
      const names = await nav.locator('button').allTextContents();
      assert.equal(names.indexOf('Lesson issues'), names.indexOf('Attendance & reliability') + 1);
      await nav.getByRole('button', { name: 'Lesson issues', exact: true }).click();
      await page.waitForURL('**#issues');
      const section = page.locator('.metrics-issues');
      await expect(section.getByRole('list', { name: 'Sent lesson issues' }).getByRole('listitem')).toHaveCount(20);
      await expect(section.getByRole('button', { name: 'Sent reports' })).toHaveAttribute('aria-pressed', 'true');
      await expect(section.locator('.metrics-issue-counts dd').first()).toHaveText('21');
      await expect(section.getByRole('link', { name: 'Open lesson', exact: true }).first()).toHaveAttribute('href', '/lesson/issue-lesson-0');
      await expect(section.locator('.metrics-issue-meta dt').filter({ hasText: /^Student$/ })).toHaveCount(0);
      await expect(section.getByText(/Issue Student \d+/)).toHaveCount(0);
      await expect(section.getByRole('link', { name: /Issue Student/ })).toHaveCount(0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.ok(await section.locator('.metrics-issue-directions button').evaluateAll(buttons => buttons.every(button => button.scrollWidth <= button.clientWidth)), 'Direction labels and counts fit');
      await section.getByRole('button', { name: 'Next issues page' }).click();
      await expect(section.getByText('Page 2 of 2', { exact: true })).toBeVisible();
      await expect(section.getByRole('listitem')).toHaveCount(1);
      await section.getByLabel('Issue review status').selectOption('under_review');
      await expect(section.getByRole('listitem')).toHaveCount(7);
      assert.equal(calls.at(-1).page, '1');
      await section.getByLabel('Issue review status').selectOption('all');
      await section.getByRole('button', { name: 'Received reports' }).click();
      await expect(section.getByRole('list', { name: 'Received lesson issues' }).getByRole('listitem')).toHaveCount(2);
      await expect(section.locator('.metrics-issue-meta').first().locator('dt')).toHaveCount(3);
      await expect(section.locator('.metrics-issue-meta dt').filter({ hasText: /^Student$/ })).toHaveCount(0);
      await expect(section.getByText(/Issue Student \d+/)).toHaveCount(0);
      await expect(section.getByRole('link', { name: /Issue Student/ })).toHaveCount(0);
      await section.locator('summary').first().click();
      await expect(section.getByText('The lesson report was reviewed. Public resolution only.', { exact: true }).first()).toBeVisible();
      assert.equal(await section.locator('.metrics-issue-details img').count(), 0, 'Report details are escaped text');
      await expect(section.locator('.metrics-issue-details p').first()).toContainText('<img src=x onerror=alert(1)>');
      await section.scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await section.screenshot({ path: `${output}/issues-received-${theme}-${width}.png`, style: '.mobile-header-logged, .dashboard-header { visibility: hidden !important; }' });
      await page.reload();
      await expect(nav.getByRole('button', { name: 'Lesson issues', exact: true })).toHaveAttribute('aria-current', 'page');
      await expect(section.getByRole('listitem')).toHaveCount(20);
      delayed = true;
      await section.getByRole('button', { name: 'Received reports' }).click();
      await expect(section.getByRole('listitem')).toHaveCount(2);
      await section.getByRole('button', { name: 'Sent reports' }).click();
      await section.getByRole('button', { name: 'Received reports' }).click();
      await expect(section.getByRole('list', { name: 'Received lesson issues' }).getByRole('listitem')).toHaveCount(2);
      await page.waitForTimeout(450);
      await expect(section.getByRole('button', { name: 'Received reports' })).toHaveAttribute('aria-pressed', 'true');
      await expect(section.getByRole('listitem')).toHaveCount(2);
      delayed = false;
      await page.getByLabel('Metrics period').selectOption('30days');
      await expect.poll(() => calls.at(-1).period).toBe('30days');
      await expect(section.getByRole('listitem')).toHaveCount(2);
      await expect(section.getByRole('button', { name: 'Received reports' })).toHaveAttribute('aria-pressed', 'true');
      await page.getByLabel('Metrics period').selectOption('all');
      await expect.poll(() => calls.at(-1).period).toBe('all');
      assert.equal(calls.at(-1).month, undefined);
      await page.getByLabel('Metrics period').selectOption('month');
      await page.getByLabel('Metrics month').fill(previousMonth);
      await expect(section.getByText('No received lesson issues in this period.', { exact: true })).toBeVisible();
      await section.getByRole('button', { name: 'Sent reports' }).click();
      await expect(section.getByText('No sent lesson issues in this period.', { exact: true })).toBeVisible();
      failure = true;
      await page.getByRole('button', { name: 'Refresh metrics' }).click();
      await expect(section.getByRole('alert')).toContainText('Lesson reports are temporarily unavailable.');
      failure = false;
      await section.getByRole('button', { name: 'Retry', exact: true }).click();
      await expect(section.getByText(/No (sent|received) lesson issues in this period\./)).toBeVisible();
      await nav.getByRole('button', { name: 'Attendance & reliability', exact: true }).click();
      await expect(section).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Reliability', exact: true })).toBeVisible();
      assert.deepEqual(writes, []);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS ${theme} ${width}: sent/received, period/status filters, pagination, escaped details, deep links, race, empty and retry states`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
