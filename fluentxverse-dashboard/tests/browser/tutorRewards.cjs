const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.DASHBOARD_TEST_URL || 'http://127.0.0.1:5322';
const output = path.resolve(__dirname, '../../../output/screenshots/tutor-rewards');
const contract = '0x90153ced2a37eeba68c68f945653c7959ba0f627';
const operator = '0xc67f2499aef7ce2b2e8c2f0cf3f5f0d1583757f1';
const summary = { chainId: 4663, network: 'Robinhood Chain', explorer: 'https://robinhoodchain.blockscout.com', contract,
  settlementToken: '0x5fc5360d0400a0fd4f2af552add042d716f1d168', settlementSymbol: 'USDG', operator,
  deployed: true, finalized: true, engineConfigured: true, operatorGasWei: '180000000000000',
  treasuryUsd: '1000000000', reservedUsd: '125000000', surplusUsd: '875000000', claimsPaused: true, allocationsPaused: false,
  maxQuoteAgeSeconds: 300, blockers: ['No reward assets have been enabled.'], periods: [], assets: [], operations: [], checkedAt: '2026-11-04T09:00:00Z' };
const preview = { month: '2026-10', period: { month: '2026-10', periodId: 202610, exists: true, minimumLessons: 60,
  rewardPerLessonUsd: '200000', releaseAt: '2026-11-07T01:00:00Z', finalized: false, totalUsd: '0' },
  rows: [{ tutorId: 'tutor-fixture', publicId: '0x' + '1'.repeat(64), name: 'Maria Santos', wallet: operator,
    completedLessons: 65, heldLessons: 0, excludedLessons: 2, amountUsd: '13000000', registered: true,
    stagedLessons: 0, stagedAmountUsd: '0', availableUsd: '12000000' }], totalUsd: '13000000', heldLessons: 0,
  snapshotDigest: 'synthetic-digest', canStage: true, canFinalize: false, blockers: [] };

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const width of [1440, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 1050 }, reducedMotion: 'reduce' });
      let role = 'superadmin', caps = ['finance'], failWrite = false, failRead = false, finalized = true, largeRoster = false;
      const writes = [], errors = [];
      await context.route('**/*', async route => {
        const req = route.request(), u = new URL(req.url());
        if (u.origin === base) return route.continue();
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
        let data = { success: true, data: [] };
        if (u.pathname === '/admin/me') data.user = { userId: 'admin-fixture', username: 'Finance', role };
        if (u.pathname === '/admin/operations/access') data.data = { id: 'admin-fixture', role, permissions: caps };
        if (u.pathname === '/admin/operations/payments') data.data = { review: [], rows: [] };
        if (u.pathname === '/admin/notifications') data.data = { notifications: [], unreadCount: 0 };
        if (u.pathname === '/admin/tutor-rewards') {
          if (failRead) return route.fulfill({ status: 503, json: { success: false, error: 'Rewards RPC unavailable.' } });
          data.data = { ...summary, finalized };
        }
        if (u.pathname === '/admin/tutor-rewards/preview') data.data = largeRoster ? { ...preview, month: u.searchParams.get('month'),
          period: { ...preview.period, finalized: true, releaseAt: '2020-01-01T00:00:00Z' }, canStage: false,
          rows: Array.from({ length: 129 }, (_, i) => ({ ...preview.rows[0], tutorId: `synthetic-${i}`, name: `Synthetic Tutor ${i}` }))
        } : { ...preview, month: u.searchParams.get('month') };
        if (u.pathname === '/admin/tutor-rewards/commands') {
          const body = req.postDataJSON(); writes.push(body);
          if (failWrite) return route.fulfill({ status: 503, json: { success: false, error: 'Engine response is uncertain. Retry the same request.' } });
          data.data = { id: body.requestId, status: 'queued' };
        }
        assert(['GET', 'OPTIONS'].includes(req.method()) || u.pathname === '/admin/tutor-rewards/commands', 'No unmocked financial writes');
        return route.fulfill({ json: data });
      });
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + '/payments', { waitUntil: 'networkidle' });
      const panel = page.getByRole('region', { name: 'Tutor rewards', exact: true });
      await expect(panel.getByText('$1,000.00', { exact: true })).toBeVisible();
      await expect(panel.getByRole('link', { name: 'USDG' })).toHaveAttribute('href', `${summary.explorer}/address/${summary.settlementToken}`);
      await page.screenshot({ path: path.join(output, `treasury-${width}.png`), fullPage: true });
      await panel.getByRole('tab', { name: 'Monthly totals' }).click();
      await expect(panel.getByText('Maria Santos')).toBeVisible();
      await expect(panel.getByRole('button', { name: 'Finalize rewards' })).toBeDisabled();
      await panel.getByRole('button', { name: 'Stage lesson totals' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Submit to Engine' })).toBeDisabled();
      await dialog.getByLabel('Audit reason').fill('Synthetic monthly reconciliation approved.');
      await dialog.getByRole('button', { name: 'Submit to Engine' }).click();
      await expect(dialog).toHaveCount(0);
      assert.equal(writes[0].action, 'stage_counts');
      assert.equal(writes[0].params.snapshotDigest, 'synthetic-digest');
      assert(!('completedLessons' in writes[0].params));
      await panel.getByRole('button', { name: 'New period' }).click();
      await dialog.getByLabel('Reward month', { exact: true }).fill('2026-12');
      await dialog.getByLabel('USD per completed lesson').fill('0.25');
      await dialog.getByLabel('Release date and time (PHT)').fill('2027-01-07T09:00');
      await dialog.getByLabel('Audit reason').fill('Synthetic future rate approved.');
      await page.screenshot({ path: path.join(output, `period-dialog-${width}.png`), fullPage: true });
      failWrite = true;
      await dialog.getByRole('button', { name: 'Submit to Engine' }).click();
      await expect(dialog.getByRole('alert')).toContainText('Engine response is uncertain');
      const firstTry = writes.at(-1);
      failWrite = false;
      await dialog.getByRole('button', { name: 'Submit to Engine' }).click();
      await expect(dialog).toHaveCount(0);
      assert.equal(writes.at(-1).requestId, firstTry.requestId);
      assert.equal(writes.at(-1).params.releaseAt, '2027-01-07T01:00:00.000Z');
      assert.equal(writes.at(-1).params.minimumLessons, 60);
      assert(!('title' in writes.at(-1)));
      largeRoster = true;
      await panel.getByRole('button', { name: 'Refresh tutor rewards' }).click();
      await expect(panel.getByText('Synthetic Tutor 128', { exact: true })).toBeVisible();
      await panel.getByRole('button', { name: 'Unlock released rewards' }).click();
      await dialog.getByLabel('Tutor batch').selectOption('128');
      await dialog.getByLabel('Audit reason').fill('Synthetic second reward batch.');
      await dialog.getByRole('button', { name: 'Submit to Engine' }).click();
      await expect(dialog).toHaveCount(0);
      assert.equal(writes.at(-1).action, 'unlock_rewards');
      assert.equal(writes.at(-1).params.offset, 128);
      await panel.getByRole('tab', { name: 'Reward assets' }).click();
      await expect(panel).toContainText('SPCX');
      await expect(panel).not.toContainText('ARB');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      finalized = false;
      await panel.getByRole('button', { name: 'Refresh tutor rewards' }).click();
      await expect(panel.getByRole('button', { name: 'Add asset' })).toBeDisabled();
      finalized = true; failRead = true;
      await panel.getByRole('button', { name: 'Refresh tutor rewards' }).click();
      await expect(panel.getByRole('alert')).toContainText('Rewards RPC unavailable');
      failRead = false; role = 'admin';
      await page.reload({ waitUntil: 'networkidle' });
      await expect(panel).toBeVisible();
      await expect(panel.getByRole('button', { name: 'Fund treasury' })).toHaveCount(0);
      caps = [];
      await page.reload({ waitUntil: 'networkidle' });
      await expect(panel).toHaveCount(0);
      assert.deepEqual(errors, []);
      console.log(`PASS rewards ${width}: layout, future settings, exact inputs, retry ID, read-only roles and finality gates`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
