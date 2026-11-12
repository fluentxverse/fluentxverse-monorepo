const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const { readFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const root = resolve(__dirname, '../..');
const lesson = JSON.parse(readFileSync(resolve(root, 'output/exhibition-skill-pattern/lesson-8.json'), 'utf8'));
const output = resolve(root, 'output/exhibition-skill-pattern/lesson8-screenshots');
mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const role of ['dashboard', 'tutor', 'student']) for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme });
      await context.addInitScript(({ lesson, theme }) => {
        localStorage.setItem('csve-theme', theme);
        localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 }));
        sessionStorage.setItem(`preview-${lesson.id}`, JSON.stringify(lesson));
      }, { lesson, theme });
      await context.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(?:localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, route => {
        const request = route.request(), path = new URL(request.url()).pathname;
        if (request.method() !== 'GET') return route.fulfill({ status: 403, json: { error: 'No test writes' } });
        const user = { userId: 'lesson8-' + role, id: 'lesson8-' + role, role: role === 'dashboard' ? 'superadmin' : role, firstName: 'Test', givenName: 'Test' };
        const json = { success: true, lesson, user, data: [], lessons: [] };
        if (path === '/proof/tutor-certification/me') json.data = { snapshot: { writtenPassed: true, speakingPassed: true, profileApproved: true, interviewPassed: true, missingRequirements: [] } };
        if (path === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        return route.fulfill({ json });
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const path = role === 'dashboard' ? '/conversational-skills-preview/' : '/materials/conversational-skills/';
      await page.goto(`https://${role}.fluentxverse.com${path}${lesson.id}?theme=${theme}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.csp-fullpage')).toContainText('The Correct Notice');
      await expect(page.locator('.csp-apply-activity-title')).toHaveText('READING');
      const apply = page.locator('.csp-reading-text-content');
      await expect(apply).toContainText('OLD POSTER');
      await expect(apply).toContainText('CORRECTED NOTICE');
      await expect(apply).toContainText('Sunday, 3-5 p.m.');
      await expect(page.locator('.csp-dialogue-line')).toHaveCount(0);
      await expect(page.locator('.csp-listening-script-box')).toHaveCount(0);
      const mission = page.locator('.csp-mission-section').first();
      const reading = mission.locator('.csp-mission-reading-passage');
      await expect(reading.locator('.csp-reading-block')).toHaveCount(2);
      for (const text of ['Gojo Art Room', 'side entrance', '800 yen', 'Saturday at 6 p.m.']) await expect(reading).toContainText(text);
      await expect(mission.locator('.csp-grammar-tip-items li')).toHaveCount(4);
      await expect(page.locator('.csp-mission-topic-card')).toHaveCount(3);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${role}: horizontal overflow`);
      if (role === 'student') {
        await expect(page.locator('.csp-guide-step:visible')).toHaveCount(0);
        await expect(page.locator('.csp-fullpage')).not.toContainText("I'll be a visitor. Please be Emma.");
      } else {
        await expect(page.locator('.csp-feedback-layout .csp-guide-step')).toHaveCount(6);
        await expect(page.locator('.csp-apply-layout .csp-guide-step')).toHaveCount(2);
        await expect(mission.locator('.csp-guide-step')).toHaveCount(4);
        await expect(mission).toContainText("I'll be a visitor. Please be Emma.");
      }
      assert.deepEqual(errors, []);
      await page.locator('.csp-apply-section').evaluate(el => el.scrollIntoView({ block: 'start' }));
      await page.screenshot({ path: resolve(output, `${role}-${width}-${theme}-apply.png`) });
      await reading.screenshot({ path: resolve(output, `${role}-${width}-${theme}-mission.png`) });
      await context.close();
      console.log(`PASS ${role} ${width} ${theme}: reading passages, useful language, standard guides, no overflow.`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
