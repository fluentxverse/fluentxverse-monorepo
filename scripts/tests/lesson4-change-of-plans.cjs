const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const { readFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const root = resolve(__dirname, '../..');
const lesson = JSON.parse(readFileSync(resolve(root, 'output/lesson4-change-of-plans/preview.json'), 'utf8'));
const output = resolve(root, 'output/lesson4-change-of-plans/screenshots');
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
        const user = { userId: 'lesson4-' + role, id: 'lesson4-' + role, role: role === 'dashboard' ? 'superadmin' : role, firstName: 'Test', givenName: 'Test' };
        const json = { success: true, lesson, user, data: [], lessons: [] };
        if (path === '/proof/tutor-certification/me') json.data = { snapshot: { writtenPassed: true, speakingPassed: true, profileApproved: true, interviewPassed: true, missingRequirements: [] } };
        if (path === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        return route.fulfill({ json });
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const path = role === 'dashboard' ? '/conversational-skills-preview/' : '/materials/conversational-skills/';
      await page.goto(`https://${role}.fluentxverse.com${path}${lesson.id}?theme=${theme}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.csp-dialogue-line')).toHaveCount(12);
      await expect(page.locator('.csp-dialogue-speaker').first()).toHaveText('Claire:');
      await expect(page.locator('.csp-dialogue-lines')).toContainText('urgent request');
      await expect(page.locator('.csp-dialogue-lines')).toContainText('send you an update');
      await expect(page.locator('.csp-fullpage')).not.toContainText('90-second talk');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${role}: horizontal overflow`);
      const overlaps = await page.locator('.csp-dialogue-line').evaluateAll(lines => lines.some(line => {
        const a = line.querySelector('.csp-dialogue-speaker').getBoundingClientRect(), b = line.querySelector('.csp-dialogue-text').getBoundingClientRect();
        return b.left < a.right - 1 && b.top < a.bottom - 1 && b.bottom > a.top + 1;
      }));
      assert(!overlaps, `${role}: dialogue labels overlap text`);
      if (role === 'student') await expect(page.locator('.csp-guide-step:visible')).toHaveCount(0);
      else {
        await expect(page.locator('.csp-feedback-layout .csp-guide-step')).toHaveCount(6);
        await expect(page.locator('.csp-apply-layout .csp-guide-step')).toHaveCount(2);
      }
      assert.deepEqual(errors, []);
      await page.locator('.csp-apply-layout').screenshot({ path: resolve(output, `${role}-${width}-${theme}-apply.png`) });
      await context.close();
      console.log(`PASS ${role} ${width} ${theme}: dialogue, layout, guide standard and student/tutor visibility.`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
