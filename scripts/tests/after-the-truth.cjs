const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const { readFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const root = resolve(__dirname, '../..');
const numbers = [1, 2, 3, 4, 6, 7, 8, 9];
const lessons = numbers.map(n => JSON.parse(readFileSync(resolve(root, `output/after-the-truth/lesson-${n}.json`), 'utf8')));
assert(lessons.every(lesson => lesson.level === 4 && lesson.chapter === 1), 'Fixtures must use Level 4 Chapter 1.');
const output = resolve(root, 'output/after-the-truth/screenshots');
mkdirSync(output, { recursive: true });
const configs = [
  ['dashboard', 1440, 'light', numbers], ['tutor', 1440, 'dark', numbers], ['student', 390, 'dark', numbers],
  ['dashboard', 390, 'dark', [2, 3, 8]], ['tutor', 390, 'light', [2, 3, 8]], ['student', 1440, 'light', [2, 3, 8]],
];
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const [role, width, theme, selected] of configs) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme });
      await context.addInitScript(({ lessons, theme }) => {
        localStorage.setItem('csve-theme', theme);
        localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 }));
        for (const lesson of lessons) sessionStorage.setItem(`preview-${lesson.id}`, JSON.stringify(lesson));
      }, { lessons, theme });
      let lesson;
      await context.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(?:localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, route => {
        const request = route.request(), path = new URL(request.url()).pathname;
        if (request.method() !== 'GET') return route.fulfill({ status: 403, json: { error: 'No test writes' } });
        const user = { userId: 'after-truth-' + role, id: 'after-truth-' + role, role: role === 'dashboard' ? 'superadmin' : role, firstName: 'Test', givenName: 'Test' };
        const json = { success: true, lesson, user, data: [], lessons: [] };
        if (path === '/proof/tutor-certification/me') json.data = { snapshot: { writtenPassed: true, speakingPassed: true, profileApproved: true, interviewPassed: true, missingRequirements: [] } };
        if (path === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        return route.fulfill({ json });
      });
      for (const number of selected) {
        lesson = lessons.find(l => l.lessonNumber === number);
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const path = role === 'dashboard' ? '/conversational-skills-preview/' : '/materials/conversational-skills/';
        await page.goto(`https://${role}.fluentxverse.com${path}${lesson.id}?theme=${theme}`, { waitUntil: 'domcontentloaded' });
        const full = page.locator('.csp-fullpage');
        await expect(full).toContainText(lesson.lessonName);
        await expect(full).toContainText('After the Truth');
        await expect(full).toContainText(lesson.goalTextJp);
        await expect(page.locator('.csp-apply-activity-title')).toHaveText(lesson.skill.toUpperCase());
        await expect(full).not.toContainText(/\bkiss(?:ed|es|ing)?\b|invented adult character|No personal or romantic/i);
        await expect(page.locator('.csp-intro-image img, .csp-apply-image img, .csp-mission-image img')).toHaveCount(0);
        const mission = page.locator('.csp-mission-section').first();
        await expect(mission).toContainText(lesson.missionData.situation.match(/^You are \w+/)[0]);
        await expect(mission.locator('.csp-grammar-tip-items li')).toHaveCount(lesson.missionData.grammarTipItems.length);
        await expect(page.locator('.csp-mission-topic-card')).toHaveCount(3);
        if (lesson.skill === 'speaking') {
          await expect(page.locator('.csp-dialogue-line')).toHaveCount(10);
          await expect(page.locator('.csp-mission-reading-passage')).toHaveCount(0);
        } else if (lesson.skill === 'reading') {
          await expect(page.locator('.csp-reading-text-content')).toContainText(number === 3 ? "Claire's view" : "Emma's letter to Leo");
          await expect(mission.locator('.csp-mission-reading-passage')).toContainText(number === 3 ? 'before six' : 'does not mean we are getting back together');
        } else {
          await expect(page.locator('.csp-dialogue-line')).toHaveCount(0);
          if (role === 'student') await expect(full).not.toContainText('I have posted the handover notes in the team channel.');
          else await expect(full).toContainText('I have posted the handover notes in the team channel.');
        }
        if (role === 'student') await expect(page.locator('.csp-guide-step:visible')).toHaveCount(0);
        else {
          await expect(page.locator('.csp-apply-layout .csp-guide-step')).toHaveCount(2);
          await expect(mission.locator('.csp-guide-step')).toHaveCount(lesson.skill === 'speaking' ? 3 : 4);
          await expect(page.locator('.csp-feedback-layout .csp-guide-step')).toHaveCount(6);
        }
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Lesson ${number} ${role}: overflow`);
        assert.deepEqual(errors, []);
        await page.locator('.csp-apply-section').evaluate(el => el.scrollIntoView({ block: 'start' }));
        await page.screenshot({ path: resolve(output, `lesson${number}-${role}-${width}-${theme}-apply.png`) });
        if (lesson.skill === 'reading') await mission.locator('.csp-mission-reading-passage').screenshot({ path: resolve(output, `lesson${number}-${role}-${width}-${theme}-mission.png`) });
        await page.close();
        console.log(`PASS Level 4 Chapter 1 Lesson ${number}: ${role} ${width} ${theme}`);
      }
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
