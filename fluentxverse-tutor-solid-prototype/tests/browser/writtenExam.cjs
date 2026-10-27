const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5236';
const output = '../output/screenshots/written-exam';
const makeExam = () => ({ examId: 'written-ui-fixture', title: 'Written Proficiency Test', timeLimit: 25, passingScore: 90,
  startedAt: new Date().toISOString(), passages: [{ id: 1, title: 'A shared school garden', content: 'The school opened a garden so learners could practise English while growing vegetables. Each group recorded its observations weekly. The teacher helped the learners compare their notes and explain changes in the plants. At the end of the term, the class shared its findings with families.' }],
  questions: Array.from({ length: 30 }, (_, i) => i < 20 ? { id: i + 1, type: i < 10 ? 'grammar' : 'vocabulary',
    sentence: i < 10 ? 'By the time she arrived, the lesson ____.' : 'The unsafe building was scheduled to be ____ after inspectors ruled out repairs.',
    options: i < 10 ? ['had started', 'has started', 'will start', 'is starting'] : ['demolished', 'enlarged', 'decorated', 'occupied'] }
    : { id: i + 1, type: 'comprehension', passageId: 1, question: 'Why did the school open the garden?', options: ['To combine English practice with gardening', 'To replace all classroom lessons', 'To sell vegetables every day', 'To prepare for a sports competition'] }) });

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const width of [1440, 768, 390, 320]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      await context.addInitScript(value => { localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: value }, version: 2 })); }, theme);
      let active = false, saved = Array(30).fill(-1), position = 0;
      const exam = makeExam(), errors = [];
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname.replace(/\/$/, '');
        if (url.origin === base) return route.continue();
        const headers = { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,cache-control,pragma' };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        let json = { success: true, data: [] };
        if (path === '/tutor/me') json.user = { userId: 'written-ui-test', firstName: 'Test', email: 'test@example.invalid', role: 'tutor' };
        if (path === '/tutor/email-verification') json.data = { verified: true, email: 'test@example.invalid' };
        if (path === '/exam/status') json.status = { passed: null, attemptsThisMonth: 0, maxAttemptsPerMonth: 2 };
        if (path === '/exam/written/check-expired') json.expired = false;
        if (path === '/exam/active') json.exam = active ? { ...exam, savedAnswers: saved, currentQuestion: position } : null;
        if (path === '/exam/written/generate') { active = true; json.exam = exam; }
        if (path === '/exam/written/save') { const b = request.postDataJSON(); saved = b.answers; position = b.currentQuestion; }
        if (path.includes('/unread-count')) json.data = { unreadCount: 0 };
        if (path.includes('/notifications')) json.data = { notifications: [], unreadCount: 0 };
        return route.fulfill({ headers, json });
      });
      await context.routeWebSocket('**/*', ws => ws.close());
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + '/exam/written');
      await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme);
      await expect(page.getByRole('heading', { name: 'Written Proficiency Test', exact: true })).toBeVisible();
      assert.equal(await page.locator('.written-section').count(), 3);
      await expect(page.locator('.written-section').last()).toContainText('10 questions');
      await expect.poll(() => page.locator('.written-heading img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
      assert.equal(await page.locator('.written-exam-page').evaluate(e => getComputedStyle(e, '::before').display), 'none');
      await page.screenshot({ path: `${output}/${width}-${theme}-intro.png`, fullPage: true });
      await page.getByRole('button', { name: 'Start Exam', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Question 30, unanswered', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Question 13, unanswered', exact: true }).click();
      await page.getByRole('button', { name: /A demolished/ }).click();
      await expect(page.getByRole('button', { name: /A demolished/ })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.section-label').last()).toContainText('21-30');
      await expect(page.locator('.exam-timer')).toContainText(/\d\d:\d\d/);
      assert.notEqual(await page.locator('.exam-timer').evaluate(e => getComputedStyle(e).webkitTextFillColor), 'rgba(0, 0, 0, 0)');
      const tops = await page.locator('.section-label').evaluateAll(elements => elements.map(e => e.getBoundingClientRect().top));
      assert(Math.max(...tops) - Math.min(...tops) < 2, 'Section labels must share a single row');
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: `${output}/${width}-${theme}-vocabulary.png`, fullPage: true });
      await page.getByRole('button', { name: 'Question 21, unanswered', exact: true }).click();
      await expect(page.locator('.passage-box')).toContainText('A shared school garden');
      await page.getByRole('button', { name: /A To combine English/ }).click();
      await page.waitForTimeout(2300);
      await page.reload();
      await expect(page.locator('.exam-resume-banner')).toBeVisible();
      await expect(page.getByRole('button', { name: /A To combine English/ })).toHaveAttribute('aria-pressed', 'true');
      await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: `${output}/${width}-${theme}-reading.png`, fullPage: true });
      const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1,
        tinyButtons: [...document.querySelectorAll('.question-nav-btn,.answer-option')].some(e => e.getBoundingClientRect().height < 39),
        clipped: [...document.querySelectorAll('.written-exam-page h1,.option-text,.section-label')].some(e => e.scrollWidth > e.clientWidth + 1) }));
      assert.deepEqual(layout, { overflow: false, tinyButtons: false, clipped: false });
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS written exam ${width}/${theme}: artwork, neutral surface, 30-question labels, readable controls, selection, reading and refresh resume`);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
