const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176';
const root = path.resolve(__dirname, '../..');
const fixture = JSON.parse(execFileSync('node', [path.join(root, 'contracts/anonymous-reviews/fixture.mjs')], { encoding: 'utf8', timeout: 120_000 }));
const protocol = 'fluentxverse.anonymous-reviews.v1';

(async () => {
  const asset = async name => createHash('sha256').update(await fs.readFile(path.join(root, `fluentxverse-student-solid-prototype/public/anonymous-reviews/semaphore.${name}`))).digest('hex');
  const artifacts = { wasmUrl: '/anonymous-reviews/semaphore.wasm', zkeyUrl: '/anonymous-reviews/semaphore.zkey', wasmSha256: await asset('wasm'), zkeySha256: await asset('zkey') };
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  await fs.mkdir(path.join(root, 'output/screenshots'), { recursive: true });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1440, 375]) {
      const account = 'anonymous-review-browser-student', resultKey = `fxv:review-result:${account}:${fixture.groupId}`;
      const context = await browser.newContext({ viewport: { width, height: width < 600 ? 812 : 1000 } });
      await context.addInitScript(theme => {
        if (/^https?:$/.test(location.protocol)) localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 }));
      }, theme);
      await context.addCookies([{ name: 'studentAuth', value: 'test-account-cookie', url: 'http://127.0.0.1:8780' }]);
      let state = 'open', failSubmit = true, submissions = [], badPin = true;
      const errors = [];
      await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780)|https:\/\/api\.fluentxverse\.(?:com|xyz))\//, async route => {
        const req = route.request(), url = new URL(req.url()), user = { userId: account, id: account, role: 'student', givenName: 'Test', email: 'reviews@example.test' };
        const opensAt = new Date(Date.now() - 3600_000).toISOString(), closesAt = new Date(Date.now() + 86400_000).toISOString();
        if (url.pathname === '/student/me') return route.fulfill({ json: { success: true, user } });
        if (url.pathname.includes('/anonymous-reviews/public/group/')) {
          assert.equal(req.headers().cookie, undefined); assert.equal(req.headers().referer, undefined);
          return route.fulfill({ json: { success: true, data: { id: fixture.groupId, tutorId: 'review-tutor', period: '2026-10', opensAt, closesAt,
            root: fixture.proof.merkleTreeRoot, scope: fixture.proof.scope, members: fixture.members, depth: 8, state,
            chainId: 2651420, contract: fixture.contract, artifacts: { ...artifacts, wasmSha256: badPin ? '0'.repeat(64) : artifacts.wasmSha256 } } } });
        }
        if (url.pathname === '/anonymous-reviews/public/submit') {
          assert.equal(req.headers().cookie, undefined); assert.equal(req.headers().authorization, undefined); assert.equal(req.headers().referer, undefined);
          const data = req.postDataJSON(); assert.deepEqual(Object.keys(data).sort(), ['content', 'groupId', 'proof']);
          assert(!JSON.stringify(data).includes(account)); assert(!JSON.stringify(data).includes(fixture.privateKey));
          const valid = execFileSync('node', [path.join(root, 'fluentxverse-server/src/services/anonymousReviews/verify.mjs')],
            { input: JSON.stringify(data.proof), encoding: 'utf8', timeout: 30_000 }).trim();
          assert.equal(valid, 'true', 'Browser worker must generate a real verifiable Semaphore proof');
          submissions.push(data);
          if (failSubmit) { failSubmit = false; return route.fulfill({ status: 503, json: { success: false, error: 'Relay temporarily unavailable' } }); }
          return route.fulfill({ json: { success: true, data: { id: `0x${'c'.repeat(64)}`, status: 'queued', verified: false } } });
        }
        if (url.pathname === '/anonymous-reviews/public/status') {
          assert.equal(req.headers().cookie, undefined); assert.equal(req.headers().authorization, undefined);
          return route.fulfill({ json: { success: true, data: { id: `0x${'c'.repeat(64)}`, status: 'verified', verified: true } } });
        }
        return route.fulfill({ json: { success: true, data: [], user, profile: {}, notifications: [] } });
      });
      // Compute only the public commitment in Node; the browser gets its key via explicit recovery.
      const commitment = execFileSync('node', ['--input-type=module', '-e', `import { Identity } from '@semaphore-protocol/identity'; console.log(Identity.import(${JSON.stringify(fixture.privateKey)}).commitment.toString())`], { cwd: root, encoding: 'utf8' }).trim();
      // Override enrollment response with the exact public commitment of this fixture key.
      await context.route('**/anonymous-reviews/me', route => route.fulfill({ json: { success: true, data: [{ groupId: fixture.groupId,
        tutorId: 'review-tutor', period: '2026-10', opensAt: new Date(Date.now() - 3600_000).toISOString(), closesAt: new Date(Date.now() + 86400_000).toISOString(),
        enrolled: true, canEnroll: false, commitment }] } }));
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/reviews`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'My feedback', exact: true }).waitFor();
      await page.getByRole('radio', { name: '5 stars - Very satisfied', exact: true }).check();
      await page.getByRole('button', { name: 'Submit feedback', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Restore its backup' }).waitFor();
      const backup = { protocol, groupId: fixture.groupId, privateKey: fixture.privateKey };
      await page.locator('.anonymous-review-tools input[type=file]').setInputFiles({ name: 'review-key.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
      await page.waitForTimeout(100);
      await page.getByRole('button', { name: 'Submit feedback', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'integrity check' }).waitFor(); assert.equal(submissions.length, 0);
      badPin = false;
      await page.getByRole('button', { name: 'Refresh review status', exact: true }).click();
      await page.waitForTimeout(150);
      await page.getByRole('group', { name: 'What went well?', exact: true }).getByRole('checkbox', { name: 'End-of-lesson feedback', exact: true }).check();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
      const headingBounds = await page.getByRole('heading', { name: 'My feedback', exact: true }).boundingBox();
      const headerBounds = await page.locator('header.app-header-shell').boundingBox();
      assert(headingBounds.y >= headerBounds.y + headerBounds.height, 'Heading must not be occluded by the fixed header');
      await page.screenshot({ path: path.join(root, `output/screenshots/anonymous-reviews-${theme}-${width}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Submit feedback', exact: true }).click();
      await page.getByRole('alert').waitFor({ timeout: 60_000 });
      assert.match(await page.getByRole('alert').innerText(), /Relay temporarily unavailable/);
      await page.getByRole('button', { name: 'Submit feedback', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'verification pending' }).waitFor({ timeout: 30_000 });
      assert.equal(submissions.length, 2); assert.deepEqual(submissions[0], submissions[1], 'A failed request retries the exact proof/content, not a new salt');
      await page.getByRole('button', { name: 'Refresh review status', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Feedback verified' }).waitFor();
      await page.screenshot({ path: path.join(root, `output/screenshots/anonymous-reviews-verified-${theme}-${width}.png`), fullPage: true });
      await page.evaluate(key => { localStorage.removeItem(key); localStorage.removeItem(`${key}:pending`); }, resultKey);
      state = 'closed'; await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('status').filter({ hasText: 'Feedback window closed' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Submit feedback', exact: true }).count(), 0);
      assert.deepEqual(errors, []); await context.close();
    }
    console.log('PASS: desktop/mobile layout, lost-key recovery, artifact integrity, real worker proofs, cookie/referrer-free submission, exact retries, pending/verified and closed states. API receipts mocked.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
