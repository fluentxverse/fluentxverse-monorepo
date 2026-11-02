const { chromium, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5296';
const fixture = JSON.parse(execFileSync('node', [path.join(root, 'fluentxverse-server/tests/fixtures/anonymousReviewProof.mjs')], { encoding: 'utf8', timeout: 120000 }));
const output = path.join(root, 'output/screenshots/per-lesson-reviews'); fs.mkdirSync(output, { recursive: true });
const artifact = extension => createHash('sha256').update(fs.readFileSync(path.join(root, `fluentxverse-student-solid-prototype/public/anonymous-reviews/semaphore.${extension}`))).digest('hex');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const width of [1440, 375]) for (const theme of ['light', 'dark']) {
      const account = 'per-lesson-browser-student', submissions = [], errors = [];
      const enrollments = fixture.identities.map((identity, i) => ({ enrollmentPolicy: 'per_lesson', entitlementId: `private-entitlement-${i}`,
        bookingId: `private-booking-${i}`, lessonStartsAt: `2026-10-25T0${i + 1}:00:00Z`, groupId: fixture.groupId, tutorId: 'review-tutor',
        period: '2026-10', opensAt: new Date(Date.now() - 3600000).toISOString(), closesAt: new Date(Date.now() + 86400000).toISOString(),
        enrolled: true, canEnroll: false, commitment: identity.commitment }));
      const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: 'reduce' });
      await context.addInitScript(({ account, enrollments, identities, theme }) => {
        if (!/^https?:$/.test(location.protocol)) return;
        localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 }));
        enrollments.forEach((enrollment, i) => localStorage.setItem(`fxv:anonymous-review:${account}:${enrollment.entitlementId}`, identities[i].privateKey));
      }, { account, enrollments, identities: fixture.identities, theme });
      await context.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin === base) return route.continue();
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
        let json = { success: true, data: [] };
        if (url.pathname === '/student/me') json = { success: true, user: { userId: account, role: 'student', givenName: 'Student' } };
        if (url.pathname === '/anonymous-reviews/me') json.data = enrollments;
        if (url.pathname.startsWith('/anonymous-reviews/public/group/')) {
          assert.equal(request.headers().cookie, undefined);
          json.data = { id: fixture.groupId, tutorId: 'review-tutor', period: '2026-10', opensAt: enrollments[0].opensAt, closesAt: enrollments[0].closesAt,
            root: fixture.proof.merkleTreeRoot, scope: fixture.proof.scope, members: fixture.members, depth: 8, state: 'open', chainId: 2651420, contract: fixture.contract,
            artifacts: { wasmUrl: '/anonymous-reviews/semaphore.wasm', zkeyUrl: '/anonymous-reviews/semaphore.zkey', wasmSha256: artifact('wasm'), zkeySha256: artifact('zkey') } };
        }
        if (url.pathname === '/anonymous-reviews/public/submit') {
          assert.equal(request.headers().cookie, undefined); assert.equal(request.headers().authorization, undefined); assert.equal(request.headers().referer, undefined);
          const data = request.postDataJSON(); assert.deepEqual(Object.keys(data).sort(), ['content', 'groupId', 'proof']);
          const serialized = JSON.stringify(data);
          for (const hidden of [account, ...enrollments.flatMap(e => [e.bookingId, e.entitlementId]), ...fixture.identities.map(i => i.privateKey)]) assert(!serialized.includes(hidden));
          const verified = execFileSync('node', [path.join(root, 'fluentxverse-server/src/services/anonymousReviews/verify.mjs')], { encoding: 'utf8', input: JSON.stringify(data.proof), timeout: 30000 }).trim();
          assert.equal(verified, 'true'); submissions.push(data);
          json.data = { id: `0x${String(submissions.length).repeat(64)}`, status: 'queued', verified: false };
        }
        return route.fulfill({ json });
      });
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/reviews', { waitUntil: 'domcontentloaded' });
      const items = page.locator('.anonymous-review-item'); await expect(items).toHaveCount(2);
      const first = items.nth(0), second = items.nth(1);
      await first.getByRole('radio', { name: '5 stars - Very satisfied', exact: true }).check();
      await first.getByRole('button', { name: 'Submit feedback', exact: true }).click();
      await expect(first).toContainText('Feedback received; verification pending', { timeout: 60000 });
      await expect(second.getByRole('button', { name: 'Submit feedback', exact: true })).toBeDisabled();
      await second.getByRole('radio', { name: '1 star - Very dissatisfied', exact: true }).check();
      await second.getByRole('button', { name: 'Submit feedback', exact: true }).click();
      await expect(second).toContainText('Feedback received; verification pending', { timeout: 60000 });
      assert.equal(submissions.length, 2); assert.equal(submissions[0].groupId, submissions[1].groupId);
      assert.notEqual(submissions[0].proof.nullifier, submissions[1].proof.nullifier);
      assert.equal(submissions[0].content.rating, 5); assert.equal(submissions[1].content.rating, 1);
      const saved = await page.evaluate(account => ({ first: !!localStorage.getItem(`fxv:review-result:${account}:private-entitlement-0`),
        second: !!localStorage.getItem(`fxv:review-result:${account}:private-entitlement-1`) }), account);
      assert.deepEqual(saved, { first: true, second: true });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(items.nth(0)).toContainText('Feedback received; verification pending');
      await expect(items.nth(1)).toContainText('Feedback received; verification pending');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: path.join(output, `${theme}-${width}.png`), fullPage: true });
      assert.deepEqual(errors, []); await context.close();
      console.log(`PASS ${theme} ${width}: two real proofs for two lessons, same tutor group, distinct nullifiers, isolated caches and identifier-free submissions`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
