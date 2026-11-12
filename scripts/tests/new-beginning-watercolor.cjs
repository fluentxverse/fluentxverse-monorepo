const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const { readFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const root = resolve(__dirname, '../..');
const lessons = [1, 2].map(n => JSON.parse(readFileSync(resolve(root, `output/new-beginning-watercolor/lesson-${n}.json`), 'utf8')));
const output = resolve(root, 'output/new-beginning-watercolor/screenshots');
mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const role of ['dashboard', 'tutor', 'student']) for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme });
      await context.addInitScript(({ lessons, theme }) => {
        localStorage.setItem('csve-theme', theme);
        localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 }));
        for (const lesson of lessons) sessionStorage.setItem(`preview-${lesson.id}`, JSON.stringify(lesson));
      }, { lessons, theme });
      let lesson;
      await context.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(?:localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, route => {
        const request = route.request(), path = new URL(request.url()).pathname;
        if (path.includes('/lesson/files/')) return route.continue();
        if (request.method() !== 'GET') return route.fulfill({ status: 403, json: { error: 'No test writes' } });
        const user = { userId: 'art-' + role, id: 'art-' + role, role: role === 'dashboard' ? 'superadmin' : role, firstName: 'Test', givenName: 'Test' };
        const json = { success: true, lesson, user, data: [], lessons: [] };
        if (path === '/proof/tutor-certification/me') json.data = { snapshot: { writtenPassed: true, speakingPassed: true, profileApproved: true, interviewPassed: true, missingRequirements: [] } };
        if (path === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        return route.fulfill({ json });
      });
      for (lesson of lessons) {
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const path = role === 'dashboard' ? '/conversational-skills-preview/' : '/materials/conversational-skills/';
        await page.goto(`https://${role}.fluentxverse.com${path}${lesson.id}?theme=${theme}`, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('.csp-fullpage')).toContainText(lesson.lessonName);
        for (const [section, selector, url] of [
          ['introduce', '.csp-intro-image img', lesson.introductionData.introImage],
          ['apply', '.csp-apply-image img', lesson.applyData.situationImage],
          ['challenge1', '.csp-mission-section .csp-mission-image img', lesson.missionData.image],
        ]) {
          const image = page.locator(selector).first();
          await expect(image).toHaveAttribute('src', url);
          await image.scrollIntoViewIfNeeded();
          await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth === 1536 && img.naturalHeight === 1024)).toBe(true);
          const box = await image.boundingBox();
          assert(box && box.width > 100 && box.height > 80, 'Artwork must have visible dimensions');
          if ((role === 'dashboard' && width === 1440 && theme === 'light') || (role === 'student' && width === 390 && theme === 'dark')) await image.screenshot({ path: resolve(output, `lesson${lesson.lessonNumber}-${section}-${role}-${width}-${theme}.png`) });
        }
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal overflow');
        if (role === 'student' && lesson.lessonNumber === 2) await expect(page.locator('.csp-fullpage')).not.toContainText('I start work at six, so I get up at five.');
        assert.deepEqual(errors, []);
        console.log(`PASS Lesson ${lesson.lessonNumber}: six-scene watercolor integration, ${role} ${width} ${theme}`);
        await page.close();
      }
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
