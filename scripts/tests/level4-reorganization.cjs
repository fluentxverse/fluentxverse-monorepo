const { spawn } = require('node:child_process');
const { readFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const root = resolve(__dirname, '../..');
const snapshot = JSON.parse(readFileSync(resolve(root, 'output/level4-reorganization/lessons.json'), 'utf8'));
const output = resolve(root, 'output/level4-reorganization/screenshots');
mkdirSync(output, { recursive: true });

(async () => {
  const server = spawn('bun', ['run', 'vite', 'preview', '--host', '127.0.0.1', '--port', '5366', '--strictPort'], { cwd: resolve(root, 'fluentxverse-dashboard'), stdio: 'ignore' });
  let browser;
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      if (server.exitCode !== null) throw Error('Local preview failed to start.');
      try { if ((await fetch('http://127.0.0.1:5366')).ok) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    if (!ready) throw Error('Local preview is unavailable.');
    browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/https:\/\/api\.fluentxverse\.(com|xyz)\//, route => route.fulfill({
      status: route.request().method() === 'GET' ? 200 : 403,
      json: { success: true, user: { userId: 'fixture', username: 'fixture', role: 'superadmin' }, lessons: snapshot.lessons, ...snapshot.metadata, assignments: {}, data: [] },
    }));
    await page.goto('http://127.0.0.1:5366/conversational-skills-editor');
    for (const [number, count] of [[3, 5], [4, 5], [1, 1]]) {
      const level = page.locator('.cse-level').filter({ has: page.locator('.cse-level-name', { hasText: new RegExp(`^Level ${number}$`) }) });
      await level.locator('.cse-level-header').click();
      await expect(level.locator('.cse-chapter')).toHaveCount(count);
      if (number === 3) await expect(level).not.toContainText('After the Truth');
      if (number === 4) {
        await expect(level.locator('.cse-chapter-name')).toHaveText(['After the Truth', 'New Paths, Unexpected Feelings', 'A Little Closer']);
        await expect(level.locator('.cse-chapter-count')).toHaveText(['8/10', '8/10', '8/10', '0/10', '0/10']);
        await page.screenshot({ path: resolve(output, 'level4-five-chapters.png') });
      }
      await level.locator('.cse-level-header').click();
      console.log(`PASS editor Level ${number}: ${count} chapters`);
    }
    await page.locator('.cse-create-btn').click();
    const selects = page.locator('.cse-modal select');
    for (const number of [3, 4]) {
      await selects.nth(0).selectOption(String(number));
      await expect(selects.nth(1).locator('option')).toHaveText(['Chapter 1', 'Chapter 2', 'Chapter 3', 'Chapter 4', 'Chapter 5']);
      console.log(`PASS create modal Level ${number}: five chapter options`);
    }
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    if (server.exitCode === null) {
      const closed = new Promise(resolve => server.once('close', resolve));
      server.kill('SIGTERM');
      await closed;
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
