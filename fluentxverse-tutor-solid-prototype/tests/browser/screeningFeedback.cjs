const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5237';
const output = '../output/screenshots/screening-feedback';

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const width of [1440, 390, 320]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme }, version: 2 })), theme);
      let completed = false, passed = false, format = 'read-aloud.v1';
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname.replace(/\/$/, '');
        if (url.origin === base) return route.continue();
        const headers = { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,cache-control,pragma' };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        const json = { success: true, data: [] };
        if (path === '/tutor/me') json.user = { userId: 'screening-ui-test', firstName: 'Test', email: 'test@example.invalid', role: 'tutor' };
        if (path === '/tutor/email-verification') json.data = { verified: true, email: 'test@example.invalid' };
        if (path === '/exam/status') json.status = { passed: true, attemptsThisMonth: 1, maxAttemptsPerMonth: 2 };
        if (path === '/exam/speaking/status') json.status = { passed: completed ? passed : null,
          hasCompletedExam: completed, isProcessing: false, examId: completed ? 'oral-fixture' : null,
          percentage: completed ? (passed ? 95 : 60) : null, attemptsThisMonth: completed ? 1 : 0, maxAttemptsPerMonth: 2 };
        if (path === '/exam/speaking/result/oral-fixture') json.result = { format, passed, overallScore: passed ? 95 : 60,
          taskScores: [], sectionAverages: { pronunciation: null, fluency: null, vocabulary: 3, grammar: 3, coherence: 3, taskCompletion: 3 },
          // Old records must not bring back a final failure announcement.
          overallFeedback: passed ? 'You passed.' : 'You failed.' };
        if (path.includes('/unread-count')) json.data = { unreadCount: 0 };
        if (path.includes('/notifications')) json.data = { notifications: [], unreadCount: 0 };
        return route.fulfill({ headers, json });
      });
      await context.routeWebSocket('**/*', ws => ws.close());
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + '/exam/speaking');
      await expect(page.getByRole('heading', { name: 'Speaking Proficiency Test', exact: true })).toBeVisible();
      await expect(page.getByText('85% Content Threshold', { exact: true })).toBeVisible();
      await expect(page.getByText('10 Sentences', { exact: true })).toBeVisible();
      await expect(page.getByText('30 Seconds Each', { exact: true })).toBeVisible();
      await expect(page.locator('.category-tag')).toHaveCount(1);
      await expect(page.locator('.category-tag')).toHaveText('Read Aloud Only');
      await expect(page.locator('.exam-intro-description')).toContainText('not a final application');
      completed = true;
      for (const outcome of [false, true]) {
        passed = outcome;
        await page.reload();
        await expect(page.getByRole('heading', { name: 'Read-Aloud Results' })).toBeVisible();
        await expect(page.locator('.score-category').first()).toHaveText('Pronunciation');
        await expect(page.locator('.section-scores')).toContainText('Words read');
        await expect(page.locator('.overall-feedback')).toContainText('does not measure spontaneous speaking');
        await expect(page.locator('.result-badge')).toHaveText('AI CONTENT ASSESSMENT');
        await expect(page.getByText('Provisional Content Score', { exact: true })).toBeVisible();
        assert.equal(await page.locator('.overall-score .score-value').evaluate(e => getComputedStyle(e).color), 'rgb(30, 41, 59)');
        assert.equal(await page.locator('.overall-score .score-label').evaluate(e => getComputedStyle(e).color), 'rgb(51, 65, 85)');
        await expect(page.locator('.passing-note')).toContainText('Human review is required');
        if (!passed) await expect(page.locator('.passing-note')).toContainText('not a final rejection');
        assert(!/\b(PASSED|FAILED|You failed\.)\b/.test(await page.locator('.speaking-results').innerText()));
        await expect(page.getByRole('link', { name: 'Contact Tutor Applications' })).toHaveAttribute('href', 'mailto:tutor@fluentxverse.com');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Results must fit the viewport');
        await page.screenshot({ path: `${output}/${width}-${theme}-${passed ? 'above' : 'below'}.png`, fullPage: true });
      }
      format = undefined;
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Speaking Exam Results' })).toBeVisible();
      await page.goto(base + '/home');
      const speaking = page.locator('.test-card').filter({ has: page.getByRole('heading', { name: 'SPEAKING TEST', exact: true }) });
      await expect(speaking).toContainText('PROVISIONAL AI SCORE');
      await expect(speaking).not.toContainText('FAILED');
      passed = false;
      await page.reload();
      await expect(speaking).toContainText('PROVISIONAL AI SCORE');
      await expect(speaking).not.toContainText('FAILED');
      await expect(speaking).toContainText('require human review');
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS ${width}/${theme}: intro, both provisional outcomes, legacy summary, support link, home status`);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
