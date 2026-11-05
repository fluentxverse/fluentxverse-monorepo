const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5340';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try { for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } }), page = await context.newPage();
    let claims = [], attempts = 0, paused = false, empty = false; const bodies = [], errors = [];
    const token = '0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec', wallet = '0x1111111111111111111111111111111111111111';
    const quote = { id: 'synthetic-quote', token, symbol: 'NVDA', amountUsd: '12000000', expectedAmountOut: '100000000000000000', minAmountOut: '99000000000000000', deadline: Math.floor(Date.now() / 1000) + 90, status: 'quoted', createdAt: new Date().toISOString(), transactionHash: null };
    page.on('pageerror', e => errors.push(e.message)); await context.routeWebSocket('**/*', ws => ws.close());
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin === base) return route.continue();
      let json = { success: true, data: [] };
      if (url.pathname === '/tutor/me') json.user = { userId: 'reward-fixture', firstName: 'Test', role: 'tutor', email: 'test@example.invalid' };
      if (url.pathname === '/notifications') json.data = { notifications: [], unreadCount: 0 };
      if (url.pathname === '/tutor/rewards') json.data = { wallet, availableUsd: empty ? '0' : '12000000', claimsOpen: !paused, assets: [{ token, symbol: 'NVDA', decimals: 18 }], claims, explorer: 'https://explorer.robinhood.com', chainId: 4663 };
      if (url.pathname === '/tutor/rewards/quote') { assert.deepEqual(request.postDataJSON(), { token, amountUsd: '12.000000' }); json.data = quote; }
      if (url.pathname === '/tutor/rewards/claim') {
        bodies.push(request.postDataJSON()); attempts++;
        if (attempts === 1) return route.fulfill({ status: 503, json: { success: false, error: 'Uncertain response. Retry the same claim.' } });
        claims = [{ ...quote, status: 'confirming', transactionHash: '0x' + '2'.repeat(64) }]; json.data = claims[0];
      }
      return route.fulfill({ json });
    });
    await page.goto(base + '/rewards');
    await expect(page.getByRole('heading', { name: 'Tutor Rewards', exact: true })).toBeVisible();
    await expect(page.getByText('$12', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Review claim', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Confirm reward claim' }); await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Sponsored', { exact: true })).toBeVisible(); await expect(dialog.getByText('0.099', { exact: true })).toBeVisible();
    await expect(dialog.getByText(wallet, { exact: true })).toBeVisible();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `/tmp/tutor-rewards-confirm-${width}.png`, fullPage: true });
    await dialog.getByRole('button', { name: 'Confirm claim', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('Uncertain');
    await dialog.getByRole('button', { name: 'Confirm claim', exact: true }).click();
    await expect(dialog).toHaveCount(0); assert.deepEqual(bodies, [{ quoteId: quote.id }, { quoteId: quote.id }]);
    await expect(page.getByRole('cell', { name: 'confirming', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Review claim', exact: true })).toBeDisabled();
    claims = [{ ...claims[0], status: 'finalized' }]; await page.getByRole('button', { name: 'Refresh rewards' }).click();
    await expect(page.getByRole('cell', { name: 'Completed', exact: true })).toBeVisible();
    paused = true; await page.getByRole('button', { name: 'Refresh rewards' }).click();
    await expect(page.getByText('Claims not open yet')).toBeVisible(); await expect(page.getByRole('button', { name: 'Review claim', exact: true })).toBeDisabled();
    paused = false; empty = true; await page.getByRole('button', { name: 'Refresh rewards' }).click();
    await expect(page.getByText('$0', { exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Review claim', exact: true })).toBeDisabled();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `/tmp/tutor-rewards-${width}.png`, fullPage: true });
    assert.deepEqual(errors, []); console.log(`PASS ${width}: quote binding, same-ID retry, pending/finalized history, paused/zero balance and overflow`);
    await context.close();
  } } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
