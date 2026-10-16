const { chromium } = require('@playwright/test');
const { privateKeyToAccount } = require('viem/accounts');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const path = require('node:path');
const base = process.env.PROTOTYPE_URL || 'http://127.0.0.1:5176/compatibility';

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const results = [];
  try {
    await fs.mkdir(path.resolve('test-results'), { recursive: true });
    for (const width of [1440, 768, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = []; const requests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => requests.push(request.url()));
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Google', exact: true }).click();
      await page.getByText('Welcome back, Shet').waitFor();
      await page.getByRole('button', { name: 'Sign out', exact: true }).click();
      for (const [scenario, expected] of [['new', 'Registration is required. No account was created.'], ['rejected-cookie', 'No active student session.'], ['wrong-role', 'The API did not confirm the expected student session.'], ['offline', 'Simulated network failure.']]) {
        await page.getByLabel('Scenario').selectOption(scenario);
        await page.getByRole('button', { name: 'Google', exact: true }).click();
        await page.getByText(expected, { exact: true }).waitFor();
      }
      await page.getByLabel('Scenario').selectOption('expired');
      await page.getByRole('button', { name: 'Restore session', exact: true }).click();
      await page.getByText('Welcome back, Shet').waitFor();
      await page.getByRole('button', { name: 'Sign out', exact: true }).click();
      await page.getByRole('button', { name: 'Wallet', exact: true }).click();
      await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'No browser wallet detected' }).waitFor();
      await page.screenshot({ path: `test-results/${width}.png`, fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow at ${width}`);
      assert.equal(await page.locator('.page-heading img').evaluate(image => image.complete && image.naturalWidth > 0), true);
      assert.equal(requests.some(url => url.includes('/student/') || url.includes('privy.io')), false, 'Simulation leaked a live auth request');
      assert.deepEqual(errors, []);
      results.push({ width, simulatedAuth: 'passed', responsiveLayout: 'passed', productionRequests: 0 });
      await page.close();
    }
    const page = await browser.newPage();
    const account = privateKeyToAccount(`0x${'1'.repeat(64)}`);
    const walletMethods = [];
    await page.exposeFunction('testWalletRpc', async ({ method, params }) => {
      walletMethods.push(method);
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [account.address];
      if (method === 'wallet_switchEthereumChain') return null;
      if (method === 'eth_chainId') return '0x14a34';
      if (method === 'personal_sign') return account.signMessage({ message: { raw: params[0] } });
      throw new Error(`Unexpected method: ${method}`);
    });
    await page.addInitScript(() => {
      const listeners = {};
      window.ethereum = { request: args => window.testWalletRpc(args), on: (event, cb) => { listeners[event] = cb; }, removeListener: event => { delete listeners[event]; } };
      window.testWalletChange = () => listeners.accountsChanged?.();
    });
    await page.goto(base);
    await page.getByRole('button', { name: 'Wallet', exact: true }).click();
    await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
    await page.getByText(account.address, { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Test signature', exact: true }).click();
    await page.getByText('Signature verified', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Wallet sign-in', exact: true }).click();
    await page.getByRole('button', { name: 'Login & session', exact: true }).click();
    await page.getByText('Welcome back, Shet').waitFor();
    await page.getByRole('button', { name: 'Wallet', exact: true }).click();
    await page.evaluate(() => window.testWalletChange());
    await page.getByText('Wallet changed; reconnect required').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Test signature', exact: true }).isDisabled(), true);
    assert.equal(walletMethods.some(method => method.includes('sendTransaction')), false);
    results.push({ wallet: 'passed', cryptographicSignature: 'verified', provider: 'mock EIP-1193', productionLogin: 'not tested' });
    console.log(JSON.stringify(results, null, 2));
    await fs.writeFile('test-results/browser-results.json', JSON.stringify(results, null, 2));
    await page.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
