const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const { readFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const root = resolve(__dirname, '../..');
const output = resolve(root, 'output/discussion-questions');
const lessons = JSON.parse(readFileSync(resolve(output, 'materials.json'), 'utf8')).map(l => ({ ...l, lessonTitle: `Lesson ${l.lessonNumber}: ${l.lessonName}`, chapterLabel: `Chapter 1: ${l.chapterName}`, levelBadge: l.level <= 2 ? 'STARTER' : l.level <= 4 ? 'BEGINNER' : 'ELEMENTARY' }));
const screenshots = resolve(output, 'screenshots');
mkdirSync(screenshots, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  let cases = 0;
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      let activeLesson = lessons[0];
      const blockedWrites = [];
      await context.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(?:localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, async route => {
        const req = route.request(), path = new URL(req.url()).pathname;
        if (req.method() !== 'GET') {
          blockedWrites.push(path);
          return route.fulfill({ status: 403, json: { error: 'Read-only authoring verification' } });
        }
        const user = { userId: 'dq-read-only', username: 'dq-read-only', firstName: 'Test', role: 'superadmin' };
        return route.fulfill({ json: { success: true, user, lesson: activeLesson, lessons, data: path === '/notifications' ? { notifications: [], unreadCount: 0 } : [] } });
      });
      const catalog = await context.newPage();
      const catalogErrors = [];
      catalog.on('pageerror', e => catalogErrors.push(e.message));
      await catalog.goto('https://dashboard.fluentxverse.com/discussion-questions-editor', { waitUntil: 'domcontentloaded' });
      await expect(catalog.locator('.cse-header')).toContainText('50 topics across 5 levels');
      await expect(catalog.locator('.cse-level-header')).toHaveCount(5);
      await expect(catalog.locator('.cse-level-count')).toHaveText(Array(5).fill('10 topics'));
      for (let i = 0; i < 5; i++) {
        await catalog.locator('.cse-level-header').nth(i).click();
        const rows = catalog.locator('.cse-level').nth(i).locator('.cse-lesson-row');
        await expect(rows).toHaveCount(10);
        for (const [j, l] of lessons.filter(l => l.level === i + 1).entries()) await expect(rows.nth(j)).toContainText(l.lessonName);
      }
      assert.deepEqual(catalogErrors, []);
      await catalog.screenshot({ path: resolve(screenshots, `catalog-${width}.png`), fullPage: width === 1440 });
      await catalog.close(); cases++;
      console.log(`PASS catalog ${width}: five levels with ten topics each`);
      for (const lesson of lessons.filter(l => width === 1440 || l.lessonNumber === 10)) {
        activeLesson = lesson;
        const page = await context.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(`https://dashboard.fluentxverse.com/discussion-questions-visual-editor/${lesson.id}`, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('.dqve-hero-title')).toHaveValue(lesson.lessonName);
        await expect(page.locator('.dqve-hero-desc')).toHaveValue(lesson.discussionQuestionsData.topicDescription);
        await expect(page.locator('.dqve-filled-badge')).toHaveText('20 of 20 filled');
        await expect(page.locator('.dqve-q-input')).toHaveCount(20);
        assert.deepEqual(await page.locator('.dqve-q-input').evaluateAll(els => els.map(el => el.value)), lesson.discussionQuestionsData.questions.map(q => q.question));
        await expect(page.locator('.csve-fb-goal-text')).toHaveValue(lesson.goalTextEn);
        const guideValues = await page.locator('.csve-intro-right input, .csve-intro-right textarea').evaluateAll(els => els.map(el => el.value));
        assert(guideValues.includes(lesson.discussionQuestionsData.tutorSteps[1].script), 'Tutor opening is loaded into the guide');
        const values = await page.locator('input,textarea').evaluateAll(els => els.map(el => el.value).join('\n'));
        const visible = await page.locator('.csve-canvas').innerText();
        assert(!/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(values + visible), 'No Japanese default content should appear');
        assert.deepEqual(errors, []);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No document-level horizontal overflow');
        if (lesson.lessonNumber === 10 || lesson.level === 1 && lesson.lessonNumber === 1) {
          await page.screenshot({ path: resolve(screenshots, `level-${lesson.level}-topic-${lesson.lessonNumber}-${width}.png`) });
          const firstQuestion = page.locator('.dqve-q').first();
          await firstQuestion.evaluate(el => el.scrollIntoView({ block: 'center' }));
          await firstQuestion.screenshot({ path: resolve(screenshots, `level-${lesson.level}-question-${width}.png`) });
          const goal = page.locator('.csve-fb-goal-card');
          await goal.evaluate(el => el.scrollIntoView({ block: 'center' }));
          await expect(goal).toBeVisible();
          await goal.screenshot({ path: resolve(screenshots, `level-${lesson.level}-feedback-${width}.png`) });
        }
        await page.close(); cases++;
        console.log(`PASS Level ${lesson.level} Topic ${lesson.lessonNumber} ${width}: twenty questions, guide and English feedback`);
      }
      assert(!blockedWrites.some(path => path.includes('/ai/')), 'No model-backed authoring requests');
      await context.close();
    }
    console.log(`VERIFIED ${cases} read-only browser cases`);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
