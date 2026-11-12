const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const { readFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '../..');
const lessons = JSON.parse(readFileSync(resolve(root, 'output/lesson-guide-standardization/preview.json'), 'utf8'));
const base = process.env.ADMIN_TEST_URL || 'https://dashboard.fluentxverse.com';
const output = resolve(root, 'output/lesson-guide-standardization/screenshots');
mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
      const palettes = [];
      for (const lesson of lessons) {
        const context = await browser.newContext({ viewport: { width, height: 1000 } });
        await context.addInitScript(({ lesson, theme }) => {
          localStorage.setItem('csve-theme', theme);
          sessionStorage.setItem(`preview-${lesson.id}`, JSON.stringify(lesson));
        }, { lesson, theme });
        await context.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(?:localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, route => {
          const request = route.request();
          if (request.method() !== 'GET') return route.fulfill({ status: 403, json: { error: 'No test writes' } });
          if (new URL(request.url()).pathname.startsWith('/lesson/files/')) return route.abort();
          return route.fulfill({ json: { success: true, lesson, user: { userId: 'guide-test', role: 'superadmin' } } });
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${base}/conversational-skills-preview/${lesson.id}?theme=${theme}`, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('.csp-guide-step').first()).toBeVisible();
        const feedback = page.locator('.csp-feedback-layout');
        await expect(feedback.locator('.csp-guide-step')).toHaveCount(6);
        const instructions = await feedback.locator('.csp-guide-instruction').allTextContents();
        assert.deepEqual(instructions, lessons[2].feedbackData.tutorSteps.map(step => step.instruction));
        for (const part of ['discussionPart', 'pronunciationPart']) assert.equal(lesson.learnData.steps[0][part].tutorSteps.length, 5);
        const palette = await feedback.locator('.csp-guide-step').first().evaluate(step => {
          const marker = step.querySelector('.csp-guide-number');
          const style = getComputedStyle(step), number = getComputedStyle(marker);
          const content = step.querySelector('.csp-guide-content');
          return { background: style.backgroundColor, border: style.borderColor, marker: number.backgroundColor, font: number.fontSize, overlap: marker.getBoundingClientRect().right > content.getBoundingClientRect().left };
        });
        assert(!palette.overlap, 'Step number overlaps its instruction');
        palettes.push(palette);
        if (lesson.lessonNumber === 2) {
          await expect(page.locator('.csp-listening-script-box').filter({ hasText: "Hi everyone, I'm Nao." }).first()).toHaveCount(1);
        }
        assert.deepEqual(errors, []);
        await feedback.screenshot({ path: resolve(output, `${lesson.lessonNumber}-${width}-${theme}-feedback.png`) });
        await context.close();
      }
      assert.deepEqual(palettes[0], palettes[2], 'Lesson 1 guide styling differs from Lesson 3');
      assert.deepEqual(palettes[1], palettes[2], 'Lesson 2 guide styling differs from Lesson 3');
      console.log(`PASS ${width} ${theme}: Lessons 1-3 guide styling and six-step feedback match; listening script retained.`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
