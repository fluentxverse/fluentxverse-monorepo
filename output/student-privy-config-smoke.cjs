const { chromium } = require('/home/paulanthonyarriola/.local/lib/python3.14/site-packages/playwright/driver/package');

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const privyResponses = [];
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.hostname.includes('privy.io')) privyResponses.push({ path: url.pathname, status: response.status() });
    });
    await page.goto('https://student.fluentxverse.xyz/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('header .login-btn').click();
    await page.locator('.social-login-modal').waitFor();
    await page.waitForTimeout(4000);
    const providers = await page.locator('.social-btn').allTextContents();
    await page.screenshot({ path: 'output/student-privy-config-desktop.png' });
    if ((await page.locator('body').innerText()).includes('Social sign-in is not configured')) {
      throw new Error('Missing Privy configuration remains visible');
    }
    const initResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/oauth/init'), { timeout: 45000 });
    await page.locator('.google-btn').click();
    const response = await initResponse;
    if (!response.ok()) throw new Error(`OAuth initialization failed: ${response.status()}`);
    await page.waitForURL(url => url.hostname === 'accounts.google.com', { timeout: 45000 });
    console.log(JSON.stringify({ providers, oauthInitStatus: response.status(), redirectHost: new URL(page.url()).hostname, privyResponses }));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
