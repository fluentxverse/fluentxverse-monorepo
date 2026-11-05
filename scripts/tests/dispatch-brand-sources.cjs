const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const bases = {
  student: process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5362',
  tutor: process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5363',
  dashboard: process.env.DASHBOARD_TEST_URL || 'http://127.0.0.1:5364',
};
const opaque = 'https://news.google.com/rss/articles/' + 'ABCdef123'.repeat(100) + '?oc=5';
const direct = 'https://www.nbcsports.com/news/youth-games?a=1&b=2';
const article = {
  id: 'brand-sources-fixture', title: 'Youth sports and community', category: 'Sports', topic: 'Youth games', createdAt: '2026-11-05T01:00:00Z', postedDate: '2026-11-05', updatedAt: '2026-11-05T01:00:00Z',
  warmUpQuestions: ['Which sport do you enjoy?'], vocabulary: [],
  articleContent: { paragraphs: [{ id: 'one', text: 'Athletes learn about different cultures.', comprehensionQuestion: { question: 'What do athletes learn about?', answer: 'PRIVATE ANSWER' } }], source: `This article was adapted from sources including NBC Sports and Olympics. Source URLs: ${opaque}, ${direct}, [Olympics](https://olympics.com/news/youth-games).` },
  summaryQuestion: '', discussionA: { topic: '', questions: [] }, discussionB: { topic: '', questions: [] },
};
const expected = ['Reference 1', 'NBC Sports', 'Olympics'];

async function checkLogo(page) {
  const logo = page.locator('img.ddp-logo');
  await expect(logo).toHaveAttribute('src', '/assets/img/home-icons/dispatch-v2.png');
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  const pixels = await logo.evaluate(el => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
    const ctx = canvas.getContext('2d'); ctx.drawImage(el, 0, 0, 32, 32);
    const data = ctx.getImageData(0, 0, 32, 32).data;
    let yellow = 0, transparent = 0;
    for (let i = 0; i < data.length; i += 4) { if (data[i] > 190 && data[i+1] > 120 && data[i+2] < 80 && data[i+3] > 200) yellow++; if (data[i+3] === 0) transparent++; }
    return { yellow, transparent };
  });
  assert(pixels.yellow > 100 && pixels.transparent > 100, 'Logo contains the approved yellow mark and real transparency');
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  fs.mkdirSync('/tmp/dispatch-brand-sources', { recursive: true });
  try {
    for (const [role, base] of Object.entries(bases)) for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme });
      await context.addInitScript(theme => {
        if (!/^https?:$/.test(location.protocol)) return;
        localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 }));
      }, theme);
      let source = article.articleContent.source;
      await context.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(?:localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, route => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/dispatch/' + article.id) return route.fulfill({ json: { ...article, articleContent: { ...article.articleContent, source } } });
        if (path === '/dispatch') return route.fulfill({ json: [article] });
        const json = { success: true, user: { userId: 'brand-' + role, id: 'brand-' + role, role, firstName: 'Test', email: 'test@example.invalid' }, data: [], archives: [{ month: 'November 2026', count: 1 }] };
        if (path === '/proof/tutor-certification/me') json.data = { snapshot: { writtenPassed: true, speakingPassed: true, profileApproved: true, interviewPassed: true, missingRequirements: [] } };
        if (path.includes('/dispatch/archives/')) json.articles = [article];
        if (path === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        return route.fulfill({ json });
      });
      const page = await context.newPage(), errors = [];
      page.setDefaultTimeout(15000);
      page.on('pageerror', error => errors.push(error.message));
      const routes = role === 'dashboard' ? ['/daily-dispatch/preview/', '/daily-dispatch/student/'] : ['/materials/daily-dispatch/'];
      for (const prefix of routes) for (const mode of role === 'tutor' ? ['', '?mode=student'] : ['']) {
        const path = prefix + article.id + mode;
        await page.goto(base + path, { waitUntil: 'domcontentloaded' });
        const sources = page.getByRole('note', { name: 'Article sources' });
        await expect(sources.getByRole('link')).toHaveText(expected);
        await expect(sources).not.toContainText('https://');
        await expect(sources).not.toContainText('provided by');
        await expect(sources.locator('p')).toHaveText('This article was adapted from sources including NBC Sports and Olympics.');
        await expect(sources).toHaveCSS('text-transform', 'none');
        await expect(sources.getByRole('link').nth(0)).toHaveAttribute('href', opaque);
        await expect(sources.getByRole('link').nth(1)).toHaveAttribute('href', direct);
        await expect(sources.getByRole('link').nth(2)).toHaveAttribute('target', '_blank');
        await expect(sources.getByRole('link').nth(2)).toHaveAttribute('rel', 'noopener noreferrer');
        await checkLogo(page);
        assert(await sources.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Sources do not overflow on mobile');
        if (role !== 'dashboard') assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Page has no horizontal overflow');
        if (role === 'student' || mode || prefix.includes('/student/')) await expect(page.locator('.ddp-container')).not.toContainText('PRIVATE ANSWER');
        await sources.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `/tmp/dispatch-brand-sources/${role}-${width}-${theme}${mode ? '-student' : prefix.includes('/student/') ? '-preview' : ''}.png` });
        if (width === 1440) {
          const link = sources.getByRole('link').nth(2);
          await context.route('https://olympics.com/news/youth-games', route => route.fulfill({ contentType: 'text/html', body: '<h1>Source destination</h1>' }));
          const opened = page.waitForEvent('popup');
          await link.click();
          const popup = await opened;
          await expect(popup).toHaveURL('https://olympics.com/news/youth-games');
          await popup.close();
        }
      }
      if (width === 1440) {
        source = 'Reuters';
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('note', { name: 'Article sources' })).toContainText('Reuters');
        await expect(page.getByRole('note', { name: 'Article sources' }).getByRole('link')).toHaveCount(0);
        source = '';
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('note', { name: 'Article sources' })).toHaveCount(0);
        if (role !== 'dashboard') {
          source = article.articleContent.source;
          const materialPath = '/materials/daily-dispatch/' + article.id + (role === 'tutor' ? '?mode=student' : '');
          await context.route(base + '/__dispatch_sources_frame', route => route.fulfill({ contentType: 'text/html', body: `<html data-theme="${theme}"><body><iframe src="${materialPath}" style="width:100%;height:100vh"></iframe></body></html>` }));
          await page.goto(base + '/__dispatch_sources_frame', { waitUntil: 'domcontentloaded' });
          const frame = page.frameLocator('iframe');
          await expect(frame.getByRole('note', { name: 'Article sources' }).getByRole('link')).toHaveText(expected);
          await checkLogo(frame);
          const opposite = theme === 'dark' ? 'light' : 'dark';
          await page.evaluate(value => { document.documentElement.dataset.theme = value; }, opposite);
          await expect(frame.locator('.ddp-container')).toHaveAttribute('data-theme', opposite);
          await expect(frame.getByRole('note', { name: 'Article sources' })).not.toContainText('https://');
        }
      }
      const archive = role === 'dashboard' ? '/daily-dispatch/archives/' : '/materials/daily-dispatch/archives/';
      await page.goto(base + archive + 'November%202026', { waitUntil: 'domcontentloaded' });
      await checkLogo(page);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS ${role} ${width} ${theme}: compact citations, destination links, transparent logo, archive logo, no JS errors`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
