const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1566, 1024, 768, 375, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: 'reduce' });
      await context.addInitScript(theme => { if (location.protocol === 'http:' || location.protocol === 'https:') localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })); }, theme);
      let balanceFails = theme === 'light' && width === 320, purchaseAttempts = 0;
      const purchases = [], errors = [], wallet = '0x' + 'a'.repeat(40);
      await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780)|https:\/\/api\.fluentxverse\.(?:com|xyz))\//, route => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/lesson-passes/mode') return route.fulfill({ json: { success: true, data: { mode: 'legacy_erc1155' } } });
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
        if (path === '/student/me') return route.fulfill({ json: { success: true, user: { userId: 'tickets-fixture', role: 'student', givenName: 'Mika', walletAddress: wallet } } });
        if (path.startsWith('/tickets/balance/')) return balanceFails ? route.fulfill({ status: 503, json: { success: false, error: 'Unavailable' } }) : route.fulfill({ json: { success: true, data: { basic: purchaseAttempts > 1 ? 8 : 5, premium: 14, trial: 1 } } });
        if (path === '/tickets/purchase') {
          purchases.push(route.request().postDataJSON()); purchaseAttempts++;
          return route.fulfill({ json: purchaseAttempts === 1 ? { success: false, error: 'Test purchase rejected' } : { success: true } });
        }
        return route.fulfill({ json: { success: true, data: [], profile: {}, lessons: [] } });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/tickets', { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'My tickets', exact: true }).waitFor();
      await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
      if (balanceFails) {
        await page.getByRole('alert').waitFor();
        assert.equal(await page.locator('.tickets-balance-item').count(), 0, 'Failed balances do not show false zero');
        balanceFails = false;
        await page.getByRole('button', { name: 'Try again', exact: true }).click();
      }
      await page.waitForFunction(() => document.querySelector('.tickets-balance-item strong')?.textContent === '5');
      assert.equal(await page.locator('.package-card').count(), 4);
      assert.deepEqual(await page.locator('.price-main strong').allTextContents(), ['$6', '$150', '$9', '$225']);
      assert.equal(await page.getByRole('link', { name: 'Book a Lesson', exact: true }).getAttribute('href'), '/browse-tutors');
      assert.equal(await page.getByRole('link', { name: /Purchase history/ }).getAttribute('href'), '/purchase-history');
      await page.locator('.tickets-art,.tickets-section-art').evaluateAll(images => Promise.all(images.map(img => img.decode())));
      const layout = async state => {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.ok(await page.evaluate(() => [...document.querySelectorAll('.package-card,.tickets-button,[role="dialog"],.quantity-confirm-btn')].every(el => el.scrollWidth <= el.clientWidth)));
        assert.ok(await page.evaluate(() => document.querySelector('.tickets-heading').getBoundingClientRect().top >= document.querySelector('.app-header-shell').getBoundingClientRect().bottom));
        await page.screenshot({ path: '../output/screenshots/tickets-' + theme + '-' + width + '-' + state + '.png', fullPage: true });
      };
      await layout('overview');
      await page.getByRole('button', { name: 'Basic', exact: true }).click();
      assert.equal(await page.locator('.package-card').count(), 2);
      assert.equal(await page.locator('.premium-tier').count(), 0);
      await page.getByRole('button', { name: 'Premium', exact: true }).click();
      assert.equal(await page.locator('.package-card').count(), 2);
      await page.getByRole('button', { name: 'Buy Premium 30-Pack', exact: true }).click();
      const quantity = page.getByRole('dialog', { name: 'Select quantity', exact: true });
      await quantity.waitFor();
      assert.ok(await page.getByRole('button', { name: 'Decrease quantity' }).isDisabled());
      await page.getByRole('button', { name: 'Increase quantity' }).click();
      assert.equal(await page.getByRole('spinbutton', { name: 'Package quantity' }).inputValue(), '2');
      assert.equal(await quantity.locator('.total-tickets .summary-value').textContent(), '60');
      assert.equal(await quantity.locator('.total-price .summary-value').textContent(), '$450.00');
      await page.getByRole('spinbutton', { name: 'Package quantity' }).fill('101');
      await page.getByRole('spinbutton', { name: 'Package quantity' }).press('Tab');
      assert.equal(await page.getByRole('spinbutton', { name: 'Package quantity' }).inputValue(), '100');
      assert.ok(await page.getByRole('button', { name: 'Increase quantity' }).isDisabled());
      await page.getByRole('spinbutton', { name: 'Package quantity' }).fill('2');
      await page.getByRole('spinbutton', { name: 'Package quantity' }).press('Tab');
      await layout('quantity');
      await page.getByRole('button', { name: 'Continue - $450.00', exact: true }).click();
      const checkout = page.getByRole('dialog', { name: 'Complete your purchase', exact: true });
      await checkout.waitFor();
      assert.equal(await checkout.locator('.mock-checkout-desc').textContent(), '60 premium tickets');
      await page.getByRole('button', { name: 'Crypto', exact: true }).click();
      await page.getByText('Connected Wallet', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Credit Card', exact: true }).click();
      await layout('checkout');
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('dialog').count(), 0);
      if (theme === 'light' && width === 1566) {
        await page.getByRole('button', { name: 'Basic', exact: true }).click();
        await page.getByRole('button', { name: 'Buy Basic Single', exact: true }).click();
        await page.getByRole('button', { name: 'Increase quantity' }).click();
        await page.getByRole('button', { name: 'Increase quantity' }).click();
        await page.getByRole('button', { name: 'Continue - $18.00', exact: true }).click();
        await page.getByRole('button', { name: 'Pay $18.00', exact: true }).click();
        await page.getByRole('heading', { name: 'Purchase Not Completed' }).waitFor();
        await page.getByRole('button', { name: 'Try Again', exact: true }).click();
        await page.getByRole('button', { name: 'Pay $18.00', exact: true }).click();
        await page.getByRole('heading', { name: 'Payment Successful!' }).waitFor();
        await page.waitForFunction(() => document.querySelector('.tickets-balance-item strong')?.textContent === '8');
        assert.equal(purchases.length, 2);
        for (const purchase of purchases) { assert.equal(purchase.tier, 'basic'); assert.equal(purchase.quantity, 3); assert.equal(purchase.buyerWallet, wallet); }
      } else assert.equal(purchases.length, 0);
      assert.deepEqual(errors, []);
      console.log('PASS Tickets ' + theme + ' ' + width + ': art, balance, filters, quantity, checkout, layout');
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
