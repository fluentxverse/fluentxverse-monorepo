const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';
const article = {
  id: 'design-article', title: 'Learning through everyday conversations', createdAt: '2026-10-10T01:00:00Z',
  category: 'Education', topic: 'Communication', warmUpQuestions: ['Where do you practice English?'],
  vocabulary: [{ word: 'conversation', pronunciation: '', partOfSpeech: 'noun', definition: 'An exchange of ideas.', exampleSentence: 'We had a conversation.', additionalInfo: null }],
  articleContent: { paragraphs: [{ id: 'paragraph-one', text: 'Everyday conversations help learners build confidence.', comprehensionQuestion: { question: 'What helps build confidence?', answer: 'Everyday conversations.' } }], source: 'Design fixture' },
  summaryQuestion: 'What did you learn?', discussionA: { topic: 'Learning', questions: ['How do you learn?'] }, discussionB: { topic: 'Practice', questions: ['How often do you practice?'] },
};
const conversation = { id: 'design-conversation', course: 'conversational-skills', level: 3, chapter: 1, lessonNumber: 1, chapterName: 'Everyday English', lessonName: 'Introductions', goalTextEn: 'Introduce yourself with confidence.', status: 'published' };
const young = { id: 'design-young', level: 1, unit: 1, lessonNumber: 1, theme: 'Introductions', ageGroup: '6-8', unitLabel: 'Hello', lessonTitle: 'Hello, everyone!', mascot: 'sunny', backgroundColor: '#f5f7fa', greeting: 'Hello! Let us learn together.', vocabularyWords: [{ id: 'hello', word: 'Hello', translation: 'Greeting', image: '/assets/img/home-icons/community-v1.webp' }], song: null, story: null, activities: [] };
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1566, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      await context.addInitScript(theme => { if (/^https?:$/.test(location.protocol)) localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })); }, theme);
      await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, route => {
        const path = new URL(route.request().url()).pathname;
        let json = { success: true, user: { userId: 'design-tutor', role: 'tutor', firstName: 'Alex', email: 'paulanthonyarriola@gmail.com' }, data: [], archives: [] };
        if (path === '/dispatch/design-article') json = article;
        if (path === '/dispatch/archives/October%202026') json.articles = [article];
        if (path === '/lesson-materials/public/design-conversation') json.lesson = conversation;
        if (path === '/lesson-materials/public/design-business') json.lesson = { ...conversation, id: 'design-business', course: 'business-english', lessonName: 'Workplace introductions' };
        if (path === '/young-learners/public/design-young') json.lesson = young;
        if (path === '/lesson/design-conversation/tutor') json = { success: true, lesson: { title: 'Introductions' }, viewUrl: base + '/materials/conversational-skills/design-conversation' };
        if (path === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        if (path === '/schedule/week') json.data = { slots: [], weekStart: '2026-10-05', weekEnd: '2026-10-11' };
        return route.fulfill({ json });
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
      page.setDefaultTimeout(10000);
      for (const [path, ready] of [
        ['/materials/daily-dispatch/design-article', '.ddp-title'],
        ['/materials/daily-dispatch/archives/October%202026', '.dda-month-title'],
        ['/materials/conversational-skills/design-conversation', '.csp-fullpage:not(.csp-loading):not(.csp-error)'],
        ['/materials/business-english/design-business', '.beve-preview'],
        ['/materials/young-learners/lesson/design-young', '.yl-lesson-header'],
        ['/lesson/view?id=design-conversation', '.lesson-fullpage-iframe.loaded'],
      ]) {
        await page.goto(base + path, { waitUntil: 'networkidle' });
        await page.locator(ready).waitFor().catch(async error => { console.error(path, await page.locator('body').innerText(), errors); throw error; });
        assert.equal(await page.locator('.mobile-header').count(), 0, 'Standalone material pages do not overlap workspace headers');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), `${path} fits ${width}px`);
        assert.equal(await page.locator('i[class*="fa-"],i[class*="fi-"],i[class*="ri-"]').count(), 0, 'Controls use the shared icon system');
        if (path.includes('business-english')) {
          const canvas = await page.locator('.beve-canvas').boundingBox();
          assert(canvas.width >= (width < 600 ? width - 2 : 500), 'The lesson canvas is not squeezed by desktop navigation');
          const fits = await page.locator('.beve-col-student').evaluateAll(elements => elements.every(el => el.scrollWidth <= el.clientWidth + 2));
          assert(fits, 'Lesson content is not clipped inside hidden-overflow columns');
          assert.equal(await page.locator('.beve-header-lesson').first().evaluate(el => getComputedStyle(el).color), theme === 'light' ? 'rgb(32, 38, 54)' : 'rgb(243, 245, 247)', 'Lesson headings have readable shared text colors');
        }
        await page.screenshot({ path: `../output/screenshots/tutor-design/material-${path.split('/')[2]}-${theme}-${width}.png`, fullPage: true });
        if (path.includes('daily-dispatch/design-article')) {
          await page.locator('.ddp-logo').first().evaluate(img => img.decode());
          await page.goto(base + path + '?mode=student', { waitUntil: 'networkidle' });
          await page.getByRole('button', { name: 'Switch to Tutor View', exact: true }).waitFor();
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'Student preview fits');
          await page.getByRole('button', { name: 'Switch to Tutor View', exact: true }).click();
        }
        if (path.includes('young-learners')) assert.equal(await page.locator('.yl-back-button').getAttribute('title'), 'Back to Young Learners');
      }
      assert.deepEqual(errors, []);
      console.log(`PASS material details ${theme} ${width}: populated articles, conversation, young learners, embedded lesson, shared controls, responsive layout`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
