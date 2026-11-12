const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const { readFileSync, mkdirSync } = require('node:fs');
const { resolve, join } = require('node:path');
const root = resolve(__dirname, '../..');
const lesson = JSON.parse(readFileSync(resolve(root, 'output/lesson6-please-dont-cancel/preview.json'), 'utf8'));
const output = resolve(root, 'output/lesson6-please-dont-cancel/screenshots');
const release = process.env.LESSON6_RELEASE;
const live = process.env.LESSON6_LIVE === '1';
const apps = {dashboard:'fluentxverse-dashboard',tutor:'fluentxverse-tutor-solid-prototype',student:'fluentxverse-student-solid-prototype'};
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
        const user = { userId: 'lesson6-' + role, id: 'lesson6-' + role, role: role === 'dashboard' ? 'superadmin' : role, firstName: 'Test', givenName: 'Test' };
        const json = { success: true, lesson, user, data: [], lessons: [] };
        if (path === '/proof/tutor-certification/me') json.data = { snapshot: { writtenPassed: true, speakingPassed: true, profileApproved: true, interviewPassed: true, missingRequirements: [] } };
        if (path === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        return route.fulfill({ json });
      });
      const path = role === 'dashboard' ? '/conversational-skills-preview/' : '/materials/conversational-skills/';
      const url = `https://${role}.fluentxverse.com${path}${lesson.id}?theme=${theme}`;
      if (release && !live) {
        const dist = join(release, role, 'frontend', apps[role], 'dist');
        await context.route(`https://${role}.fluentxverse.com/**`, route => {
          const pathname = new URL(route.request().url()).pathname;
          const file = pathname.startsWith('/assets/') ? join(dist, pathname) : pathname === '/' || pathname.startsWith(path) ? join(dist, 'index.html') : null;
          return file ? route.fulfill({ path:file }) : route.continue();
        });
      }
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.csp-fullpage')).toContainText("Please Don't Cancel");
      const mission = page.locator('.csp-mission-section').first();
      const useful = mission.locator('.csp-mission-grammar-tip');
      await expect(useful).toBeVisible();
      await expect(useful.locator('li')).toHaveCount(5);
      for (const phrase of lesson.missionData.grammarTipItems) await expect(useful).toContainText(phrase);
      await expect(page.locator('.csp-dialogue-line')).toHaveCount(0);
      await expect(page.locator('.csp-apply-situation')).toContainText('two short messages');
      await expect(page.locator('.csp-mission-topics .csp-mission-topic-card')).toHaveCount(3);
      await expect(page.locator('.csp-exercise-layout').first()).toContainText('change (of / for) plans');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${role}: horizontal overflow`);
      if (role === 'student') {
        await expect(page.locator('.csp-guide-step:visible')).toHaveCount(0);
        await expect(page.locator('.csp-listening-script-box:visible')).toHaveCount(0);
        await expect(page.locator('.csp-fullpage')).not.toContainText('He has her phone number');
        await expect(page.locator('.csp-fullpage')).not.toContainText("Didn't you listen to my message?");
      } else {
        await expect(page.locator('.csp-feedback-layout .csp-guide-step')).toHaveCount(6);
        await expect(page.locator('.csp-apply-layout .csp-guide-step')).toHaveCount(2);
        await expect(mission.locator('.csp-guide-step')).toHaveCount(4);
        await expect(mission.locator('.csp-listening-script-box')).toContainText('He has her phone number');
        await expect(mission).toContainText("I'll be Leo. Please be Emma.");
      }
      const overflow = await useful.evaluate(el => el.scrollWidth > el.clientWidth + 1);
      assert(!overflow, `${role}: useful language overflow`);
      assert.deepEqual(errors, []);
      await useful.screenshot({ path: resolve(output, `${role}-${width}-${theme}-useful-language.png`) });
      await page.locator('.csp-apply-section').evaluate(el => el.scrollIntoView({ block: 'start' }));
      await page.screenshot({ path: resolve(output, `${role}-${width}-${theme}-apply.png`) });
      await context.close();
      console.log(`PASS ${role} ${width} ${theme}: listening, useful language, guide standard and transcript visibility.`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
