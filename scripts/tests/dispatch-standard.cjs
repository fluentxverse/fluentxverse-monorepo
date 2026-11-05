const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const bases = { student: process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5362', tutor: process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5363', dashboard: process.env.DASHBOARD_TEST_URL || 'http://127.0.0.1:5364' };
const savedSource = JSON.parse(fs.readFileSync('scripts/tests/fixtures/dispatch-source-20261105.json', 'utf8')).source;
const article = {
  id: 'standard-fixture', title: 'Dakar 2026: A New Era for the Youth Olympic Games', category: 'Sports', topic: 'olympic games', createdAt: '2026-11-05T01:00:00Z',
  warmUpQuestions: ['What do you know about the Youth Olympic Games?', 'Have you ever participated in or watched an Olympic event?'],
  vocabulary: ['ambassador', 'boycott', 'tradition', 'generation', 'represent'].map(word => ({ word, pronunciation: '/example/ [example]', partOfSpeech: 'noun', definition: 'A useful word for discussing international events.', exampleSentence: 'We discussed the event together.', additionalInfo: 'Related words and common phrases.' })),
  articleContent: { source: savedSource, paragraphs: [{ text: 'Sport brings people together. Young athletes share their ambitions and learn about different cultures.', comprehensionQuestion: { question: 'What can athletes learn about?', answer: 'TUTOR-ONLY ANSWER: Different cultures.' } }] },
  summaryQuestion: 'What is the main idea of the article?', discussionA: { topic: 'Sports and community', questions: ['Which sports do you watch?', 'What can a city learn from hosting an event?'] }, discussionB: { topic: 'Young athletes', questions: ['How can schools support young athletes?'] },
};
const routes = [
  ['student', 'student', '/materials/daily-dispatch/standard-fixture'],
  ['tutor', 'student', '/materials/daily-dispatch/standard-fixture?mode=student'],
  ['dashboard', 'student', '/daily-dispatch/student/standard-fixture'],
  ['tutor', 'tutor', '/materials/daily-dispatch/standard-fixture'],
  ['dashboard', 'tutor', '/daily-dispatch/preview/standard-fixture'],
  ['dashboard', 'tutor', '/daily-dispatch-preview/standard-fixture'],
];
const snapshot = root => root.evaluate(root => {
  const properties = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color', 'backgroundColor', 'borderLeftColor', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginBottom', 'borderRadius', 'display', 'gap'];
  const selectors = ['.ddp-content', '.ddp-title', '.ddp-section-header h2', '.ddp-list li', '.ddp-vocabulary', '.ddp-vocab-item', '.ddp-vocab-word', '.ddp-vocab-body p', '.ddp-paragraph > p', '.ddp-qa', '.ddp-question', '.ddp-summary-question', '.ddp-discussion h3', '.ddp-discussion-list li', '.ddp-source', '.ddp-source a', '.ddp-sidebar-title', '.ddp-sidebar-search input', '.ddp-sidebar-search-btn', '.ddp-font-size-btn'];
  return { text: root.querySelector('.ddp-content').textContent, styles: Object.fromEntries(selectors.map(selector => {
    const el = root.querySelector(selector), style = getComputedStyle(el);
    return [selector, { ...Object.fromEntries(properties.map(key => [key, key === 'borderLeftColor' && parseFloat(style.borderLeftWidth) === 0 ? 'none' : style[key]])), width: Math.round(el.getBoundingClientRect().width) }];
  })) };
});
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  fs.mkdirSync('/tmp/dispatch-standard', { recursive: true });
  try {
    for (const width of [1440, 390, 320]) for (const theme of ['light', 'dark']) {
      const reference = {};
      for (const [role, view, path] of routes) {
        const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme });
        await context.addInitScript(theme => {
          if (!/^https?:$/.test(location.protocol)) return;
          localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 }));
          localStorage.setItem('fxv_admin_theme', theme);
        }, theme);
        await context.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(?:localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, route => {
          const path = new URL(route.request().url()).pathname;
          if (path === '/dispatch/standard-fixture') return route.fulfill({ json: article });
          const json = { success: true, user: { userId: 'standard-' + role, id: 'standard-' + role, role, firstName: 'Test', email: 'fixture@example.invalid' }, data: [], archives: [{ month: 'November 2026', count: 4 }] };
          if (path === '/proof/tutor-certification/me') json.data = { snapshot: { writtenPassed: true, speakingPassed: true, profileApproved: true, interviewPassed: true, missingRequirements: [] } };
          if (path === '/notifications') json.data = { notifications: [], unreadCount: 0 };
          return route.fulfill({ json });
        });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(bases[role] + path, { waitUntil: 'domcontentloaded' });
        const root = page.locator('[data-dispatch-renderer="dispatch-shared-v1"]');
        await expect(root).toHaveAttribute('data-theme', theme);
        await expect(root).toHaveAttribute('data-view', view);
        await expect(root.locator('.ddp-title')).toHaveText(article.title);
        const sources = root.getByRole('note', { name: 'Article sources' });
        await expect(sources.getByRole('link')).toHaveText(['Reference 1', 'Reference 2', 'Reference 3', 'Reference 4', 'Reference 5']);
        await expect(sources).not.toContainText('http');
        await expect(sources).not.toContainText('provided by');
        if (view === 'student') {
          await expect(root).not.toContainText('TUTOR-ONLY ANSWER');
          await expect(root.locator('.ddp-instruction')).toHaveCount(0);
          if (role === 'student') await expect(root.locator('.ddp-view-toggle')).toHaveCount(0);
        } else await expect(root.locator('.ddp-answer')).toContainText('TUTOR-ONLY ANSWER');
        const actual = await snapshot(root);
        fs.writeFileSync(`/tmp/dispatch-standard/${role}-${view}-${width}-${theme}.json`, JSON.stringify(actual, null, 2));
        if (!reference[view]) reference[view] = actual;
        else assert.deepEqual(actual, reference[view], `${role} ${view} must match shared content and computed typography/colors/spacing`);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${role} ${width}: no overflow`);
        const nav = await root.locator('.ddp-header-bar').boundingBox(), header = await root.locator('.ddp-header').boundingBox();
        assert(header.y >= nav.y + nav.height, 'Header never covers the title');
        if (width === 1440) {
          if (role !== 'student') {
            await root.locator('.ddp-view-toggle').click();
            await expect(root).toHaveAttribute('data-view', view === 'student' ? 'tutor' : 'student');
            if (view === 'tutor') await expect(root).not.toContainText('TUTOR-ONLY ANSWER');
            await root.locator('.ddp-view-toggle').click();
            await expect(root).toHaveAttribute('data-view', view);
          }
          for (const [index, size] of ['S', 'M', 'L'].entries()) {
            await root.locator('.ddp-font-size-btn').nth(index).click();
            await expect(root).toHaveClass(new RegExp('ddp-font-' + size.toLowerCase()));
          }
        }
        await root.locator('.ddp-source').scrollIntoViewIfNeeded();
        if (width === 1440) {
          const position = await root.locator('.ddp-header-bar').boundingBox();
          assert(position.y >= 0 && position.y < 60, role + ' header remains visible while reading: ' + JSON.stringify(await root.locator('.ddp-header-bar').evaluate(el => {
            const chain = []; for (let node = el; node; node = node.parentElement) { const s = getComputedStyle(node); chain.push({ tag: node.tagName, class: node.className, position: s.position, overflow: s.overflow, height: s.height, y: node.getBoundingClientRect().y }); } return chain;
          })));
        }
        await page.screenshot({ path: `/tmp/dispatch-standard/${role}-${view}-${width}-${theme}.png` });
        if (width === 1440 && role !== 'dashboard') {
          await context.route(bases[role] + '/__standard_classroom', route => route.fulfill({ contentType: 'text/html', body: `<html data-theme="${theme}"><body><iframe title="Classroom material" style="width:100%;height:100vh;border:0" src="${path}"></iframe></body></html>` }));
          await page.goto(bases[role] + '/__standard_classroom');
          const frame = page.frameLocator('iframe'), material = frame.locator('[data-dispatch-renderer]');
          await expect(material).toHaveAttribute('data-theme', theme);
          assert.deepEqual(await snapshot(material), reference[view], 'Classroom content matches standalone template');
          const opposite = theme === 'dark' ? 'light' : 'dark';
          await page.evaluate(value => { document.documentElement.dataset.theme = value; }, opposite);
          await expect(material).toHaveAttribute('data-theme', opposite);
          await expect(material.getByRole('note', { name: 'Article sources' })).not.toContainText('http');
        }
        assert.deepEqual(errors, []);
        await context.close();
      }
      console.log(`PASS ${width} ${theme}: identical student/tutor material across all apps, five real source links, classroom parity, theme updates, no title overlap`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
