const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

// Live public app configuration and OAuth initiation only. Never authenticate,
// register, exchange a session, send a transaction, or print OAuth credentials.
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    let authenticationRequests = 0;
    page.on('request', request => { if (request.url().includes('/oauth/authenticate') || request.url().includes('/student/auth/')) authenticationRequests++; });
    await page.goto(`${process.env.PROTOTYPE_URL || 'http://127.0.0.1:5176/compatibility'}/?mode=live`);
    const appId = await page.getByLabel('Privy app ID').inputValue();
    assert.ok(appId, 'Configure VITE_PRIVY_APP_ID for this optional live test.');
    await page.getByRole('button', { name: 'Initialize SDK', exact: true }).click();
    await page.locator('.state-panel').getByText('Initialized', { exact: true }).waitFor({ timeout: 45000 });
    const results = await page.evaluate(async appId => {
      const { createIdentity } = await import('/src/identity.ts');
      const identity = await createIdentity(appId);
      await identity.initialize();
      const providers = {};
      for (const provider of ['google', 'twitter', 'apple']) {
        try {
          const url = new URL(await identity.start(provider));
          providers[provider] = { generated: url.protocol === 'https:', authorizationHost: url.hostname };
        } catch (error) { providers[provider] = { generated: false, errorCode: error.code || error.name }; }
      }
      let tamperedCallbackRejected = false;
      try { await identity.complete(new URL(`${location.origin}/?privy_oauth_code=invalid-test-code&privy_oauth_state=incorrect-test-state&privy_oauth_provider=google`)); }
      catch { tamperedCallbackRejected = true; }
      return { initializedWithoutReact: true, providers, tamperedCallbackRejected, completedSignIn: false };
    }, appId);
    assert.equal(results.tamperedCallbackRejected, true);
    assert.equal(authenticationRequests, 0, 'Tampered callback reached an authentication endpoint.');
    await fs.mkdir('test-results', { recursive: true });
    await fs.writeFile('test-results/live-sdk-results.json', JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
