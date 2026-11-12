const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const { readFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const root = resolve(__dirname, '../..');
const numbers = [1, 2, 3, 4, 6, 7, 8, 9];
const lessons = numbers.map(n => JSON.parse(readFileSync(resolve(root, `output/everyday-life/lesson-${n}.json`), 'utf8')));
const output = resolve(root, 'output/everyday-life/screenshots');
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
        const user = { userId: 'everyday-' + role, id: 'everyday-' + role, role: role === 'dashboard' ? 'superadmin' : role, firstName: 'Test', givenName: 'Test' };
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
        await expect(full).toContainText('Everyday Life & Unexpected Moments');
        await expect(full).toContainText(lesson.goalTextJp);
        await expect(page.locator('.csp-apply-activity-title')).toHaveText(lesson.skill.toUpperCase());
        await expect(full).not.toContainText('No personal or romantic');
        await expect(full).not.toContainText('invented adult character');
        await expect(page.locator('.csp-intro-image img, .csp-apply-image img, .csp-mission-image img')).toHaveCount(0);
        const mission = page.locator('.csp-mission-section').first();
        await expect(mission).toContainText('You are Emma');
        await expect(mission.locator('.csp-grammar-tip-items li')).toHaveCount(lesson.missionData.grammarTipItems.length);
        await expect(page.locator('.csp-mission-topic-card')).toHaveCount(3);
        if (lesson.skill === 'speaking') {
          await expect(page.locator('.csp-dialogue-line')).toHaveCount(10);
          await expect(page.locator('.csp-mission-reading-passage')).toHaveCount(0);
        } else if (lesson.skill === 'reading') {
          await expect(page.locator('.csp-reading-text-content')).toContainText(number === 3 ? 'Afternoon helper card' : 'Aya? She works with me.');
          await expect(mission.locator('.csp-mission-reading-passage')).toContainText(number === 3 ? 'table 4' : 'Kamo House at 6:30');
        } else {
          await expect(page.locator('.csp-dialogue-line')).toHaveCount(0);
          if (role === 'student') await expect(full).not.toContainText('My extra order is finished.');
          else await expect(full).toContainText('My extra order is finished.');
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
        console.log(`PASS Chapter 3 Lesson ${number}: ${role} ${width} ${theme}`);
      }
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
