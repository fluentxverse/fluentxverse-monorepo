const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const bases = { student: process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5292', tutor: process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5291' };
const article = {
  id: 'renderer-fixture', title: 'A New Era for the Youth Olympic Games', createdAt: '2026-11-05T01:00:00Z', category: 'Sports', topic: 'olympic games',
  warmUpQuestions: ['What do you know about the Youth Olympic Games?', 'Have you watched an Olympic event?', 'How does hosting a sporting event affect a city?'],
  vocabulary: ['ambassador', 'boycott', 'tradition', 'generation', 'represent'].map(word => ({ word, pronunciation: '/example/ [example]', partOfSpeech: 'noun', definition: 'A useful word for discussing international events.', exampleSentence: 'We discussed the event together.', additionalInfo: 'Related words and common phrases.' })),
  articleContent: { paragraphs: [{ id: 'one', text: 'Sport brings people together. Young athletes share their ambitions and learn about different cultures.', comprehensionQuestion: { question: 'What can young athletes learn about?', answer: 'PRIVATE ANSWER: different cultures.' } }], source: 'Renderer test fixture' },
  summaryQuestion: 'Summarize the main idea.', discussionA: { topic: 'Sport and community', questions: ['What can a city learn from hosting an event?'] }, discussionB: { topic: 'Young athletes', questions: ['How can schools support young athletes?'] },
};
const palette = locator => locator.evaluate(root => {
  const style = selector => { const el = root.querySelector(selector), s = getComputedStyle(el); return { color: s.color, background: s.backgroundColor, border: s.borderLeftColor, font: s.fontFamily }; };
  return { page: getComputedStyle(root).backgroundColor, header: style('.ddp-section-header h2'), vocab: style('.ddp-vocab-item'), word: style('.ddp-vocab-word'), question: style('.dds-question-only'), summary: style('.ddp-summary-question') };
});

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  fs.mkdirSync('/tmp/daily-dispatch-renderer', { recursive: true });
  try {
    for (const width of [1440, 390, 320]) for (const theme of ['light', 'dark']) {
      const snapshots = {};
      for (const role of ['student', 'tutor']) {
        const base = bases[role], context = await browser.newContext({ viewport: { width, height: 1100 }, colorScheme: theme });
        await context.addInitScript(theme => { if (/^https?:$/.test(location.protocol)) localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })); }, theme);
        let failArticle = false;
        await context.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(?:localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, route => {
          const path = new URL(route.request().url()).pathname;
          if (path === '/dispatch/renderer-fixture') return route.fulfill({ status: failArticle ? 503 : 200, json: failArticle ? { error: 'Unavailable' } : article });
          const json = { success: true, user: { userId: 'renderer-' + role, id: 'renderer-' + role, role, firstName: 'Test', email: 'fixture@example.invalid' }, data: [], archives: [{ month: 'November 2026', count: 1 }] };
          if (path === '/proof/tutor-certification/me') json.data = { snapshot: { writtenPassed: true, speakingPassed: true, profileApproved: true, interviewPassed: true, missingRequirements: [] } };
          if (path.includes('/dispatch/archives/')) json.articles = [article];
          if (path === '/notifications') json.data = { notifications: [], unreadCount: 0 };
          return route.fulfill({ json });
        });
        const page = await context.newPage(), errors = [];
        page.setDefaultTimeout(10000);
        page.on('pageerror', error => errors.push(error.message));
        const path = '/materials/daily-dispatch/renderer-fixture' + (role === 'tutor' ? '?mode=student' : '');
        await page.goto(base + path);
        const root = page.locator('.ddp-container');
        await expect(root).toHaveAttribute('data-theme', theme).catch(async error => { console.error({ role, url: page.url(), body: await page.locator('body').innerText(), errors }); throw error; });
        await expect(root.locator('.ddp-vocab-item')).toHaveCount(5);
        await expect(root).not.toContainText('PRIVATE ANSWER');
        await expect(root.locator('.ddp-section-header h2').first()).toHaveCSS('background-color', 'rgb(18, 18, 18)');
        await expect(root.locator('.ddp-vocab-item').first()).toHaveCSS('border-left-color', 'rgb(255, 203, 5)');
        snapshots[role] = await palette(root);
        const columns = await root.locator('.ddp-vocabulary').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
        assert.equal(columns, width > 1000 ? 3 : 1, 'Vocabulary uses a responsive grid');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${role} ${width}: no horizontal overflow`);
        await page.screenshot({ path: `/tmp/daily-dispatch-renderer/${role}-${width}-${theme}.png`, fullPage: true });
        if (width === 1440) {
          const fontSizes = [];
          for (const index of [0, 1, 2]) {
            await root.locator('.ddp-font-size-btn').nth(index).click();
            fontSizes.push(await root.locator('.ddp-paragraph > p').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize)));
          }
          assert(fontSizes[0] < fontSizes[1] && fontSizes[1] < fontSizes[2], 'All font sizes affect the reading passage');
          await context.route(base + '/__dispatch_theme_test', route => route.fulfill({ contentType: 'text/html', body: `<html data-theme="${theme === 'light' ? 'dark' : 'light'}"><body style="margin:0"><iframe title="Classroom material" style="border:0;width:100%;height:100vh" src="${path}"></iframe></body></html>` }));
          await page.goto(base + '/__dispatch_theme_test');
          const frame = page.frameLocator('iframe'), material = frame.locator('.ddp-container');
          const opposite = theme === 'light' ? 'dark' : 'light';
          await expect(material).toHaveAttribute('data-theme', opposite);
          assert.equal((await palette(material)).page, opposite === 'dark' ? 'rgb(26, 26, 26)' : 'rgb(255, 255, 255)');
          await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
          await expect(material).toHaveAttribute('data-theme', theme);
          assert.deepEqual(await palette(material), snapshots[role], 'Classroom theme updates match standalone article styling');
          failArticle = true;
          await page.goto(base + path);
          await expect(page.locator('.ddp-error')).toHaveAttribute('data-theme', theme);
          failArticle = false;
          if (role === 'student') await page.getByRole('button', { name: 'Try again', exact: true }).click();
          else await page.reload();
          await expect(page.locator('.ddp-title')).toBeVisible();
        }
        await page.goto(base + '/materials/daily-dispatch/archives/November%202026');
        await expect(page.locator('.dda-month-title')).toBeVisible();
        await expect(page.locator('.dda-article-title').first()).toHaveText(article.title);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Archives still fit the viewport');
        assert.deepEqual(errors, []);
        await context.close();
      }
      assert.deepEqual(snapshots.student, snapshots.tutor, 'Both apps use the same article palette and typography');
      console.log(`PASS ${width} ${theme}: article grid, classroom parity, private answers hidden, responsive layout${width === 1440 ? ', font controls, theme changes, retry' : ''}`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
