const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.SITE_URL || 'http://127.0.0.1:5341';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + '/about', { waitUntil: 'networkidle' });
      const story = page.locator('.story-copy'), paragraphs = story.locator(':scope > p');
      await expect(paragraphs).toHaveCount(3);
      await expect(paragraphs.nth(1)).toContainText('ESL gives that vision');
      await expect(paragraphs.nth(2)).toContainText('tutors are fairly compensated');
      await expect(paragraphs.nth(2)).toContainText('learners can clearly track their progress');
      await expect(story).not.toContainText('We want tutors to build sustainable livelihoods');
      await expect(story).not.toContainText('Our scope extends beyond English');
      await expect(story).not.toContainText('We plan to develop learning applications for other subjects');
      await expect(story.locator('.story-signature')).toBeVisible();
      const boxes = await paragraphs.evaluateAll(elements => elements.map(e => { const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; }));
      for (let i = 1; i < boxes.length; i++) assert(boxes[i].top >= boxes[i - 1].bottom);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await story.screenshot({ path: `/tmp/fluentxverse-about-mission-${width}.png` });
      console.log(`PASS ${width}px: mission copy, paragraph order and responsive layout`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
