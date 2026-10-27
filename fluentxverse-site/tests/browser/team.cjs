const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');

const base = (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
const members = [
  ['Paul Anthony Arriola', 'CEO', 'paul-anthony-arriola-a0436321b'],
  ['Mark Anthony Vibas', 'Head of Operations', 'mark-anthony-vibas-306356b5'],
  ['Yehna Lee', 'Head of Growth', 'yehna-lee-0b539b26a'],
  ['Agnes Atwel-Velasco', 'Head of Instructional Design', 'agnes-atwel-161a60340'],
];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const output = process.env.SITE_SCREENSHOTS || '/tmp/fluentxverse-team-qa';
  await mkdir(output, { recursive: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const width of [1440, 1101, 1024, 768, 570, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto(`${base}/about`, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200);
      assert.deepEqual(await page.locator('.team-member h3').allTextContents(), members.map(member => member[0]));
      assert.equal(await page.locator('.team-member').count(), 4);
      for (const [index, member] of members.entries()) {
        const card = page.locator('.team-member').nth(index);
        await card.scrollIntoViewIfNeeded();
        const image = card.locator('.team-portrait img');
        await image.evaluate(img => img.decode());
        assert.equal(await card.locator('.team-role').textContent(), member[1]);
        assert.equal(await card.locator('.portrait-index').textContent(), `0${index + 1}`);
        const social = card.locator('.team-social');
        assert.equal(await social.getAttribute('href'), `https://www.linkedin.com/in/${member[2]}/`);
        assert.equal(await social.getAttribute('target'), '_blank');
        assert.match(await social.getAttribute('rel'), /noopener/);
        const heading = await card.locator('h3').boundingBox();
        const icon = await social.boundingBox();
        assert(heading.x + heading.width <= icon.x, `${member[0]} overlaps the LinkedIn icon at ${width}px`);
        assert(await card.locator('h3').evaluate(element => element.scrollWidth <= element.clientWidth + 1));
      }
      assert.equal(await page.locator('.team-member').nth(1).locator('.team-portrait img').getAttribute('src'), '/assets/img/team/mark.webp');
      for (const index of [1, 3]) {
        assert.equal(await page.locator('.team-member').nth(index).locator('.team-portrait img').evaluate(img => getComputedStyle(img).objectPosition), '50% 0%');
      }
      const columns = await page.locator('.team-grid').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length);
      assert.equal(columns, width > 1100 ? 4 : width > 570 ? 2 : 1);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      if ([1440, 390].includes(width)) {
        await page.locator('#team').screenshot({ path: `${output}/team-${width}.png` });
        await page.locator('.team-member').nth(1).screenshot({ path: `${output}/mark-${width}.png` });
      }
      console.log(`PASS ${width}px: team order, roles, portraits, LinkedIn links, ${columns}-column layout, no overlap`);
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
