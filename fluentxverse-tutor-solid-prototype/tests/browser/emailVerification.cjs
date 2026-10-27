const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5234';
const output = '../output/screenshots/tutor-email-confirmation';
async function fixture(browser, width, signedIn = true) {
  const context = await browser.newContext({ viewport: { width, height: 950 } });
  const state = { signedIn, verified: false, deliveryStatus: 'not_sent', resendAvailableAt: 0, expired: false }, requests = [], errors = [];
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace(/\/$/, '');
    if (url.origin === base) return route.continue();
    requests.push({ path, method: request.method(), body: request.method() === 'POST' ? request.postData() : undefined });
    const headers = { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET,POST,PUT,OPTIONS', 'access-control-allow-headers': 'content-type,cache-control,pragma' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    let json = { success: true, data: [] }, status = 200;
    const user = { userId: 'email-ui-test', email: 'applicant.with.a.long.email.address.to.check.mobile.layout@example.test', firstName: 'Tutor', lastName: 'Applicant', role: 'tutor' };
    if (path === '/tutor/me') { if (state.signedIn) json.user = user; else { status = 401; json = { user: null }; } }
    if (path === '/tutor/register') { state.signedIn = true; json = { success: true, user, emailConfirmationRequired: true }; }
    if (path === '/tutor/email-verification') json.data = { ...state, email: user.email, sender: 'tutor@fluentxverse.com', assessmentComplete: false };
    if (path === '/tutor/email-verification/send') { state.deliveryStatus = 'accepted'; state.resendAvailableAt = Date.now() + 60000; json.data = { sent: true, verified: false }; }
    if (path === '/tutor/email-verification/confirm') {
      assert.equal(JSON.parse(request.postData()).token, 'a'.repeat(43));
      if (state.expired) { status = 400; json = { success: false, error: 'This confirmation link is invalid or expired. Request a new link.' }; }
      else { state.verified = true; json.data = { verified: true }; }
    }
    if (path === '/exam/status' || path === '/exam/speaking/status') json.status = { passed: false, attemptsThisMonth: 0, maxAttemptsPerMonth: 2 };
    return route.fulfill({ status, headers, json });
  });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  return { context, page, state, requests, errors };
}
(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const width of [1440, 390, 320]) {
      const f = await fixture(browser, width), { page, state, requests } = f;
      await page.goto(base + '/exam/written');
      await expect(page).toHaveURL(/\/confirm-email$/);
      await expect(page.getByRole('heading', { name: 'Confirm your email', exact: true })).toBeVisible();
      await expect(page.locator('.tutor-confirm-sender')).toContainText('tutor@fluentxverse.com');
      assert(!requests.some(r => r.path.startsWith('/exam/')));
      await page.getByRole('button', { name: 'Send confirmation email', exact: true }).click();
      await expect(page.getByRole('status')).toContainText('Confirmation email sent');
      await expect(page.getByRole('button', { name: /Resend in/ })).toBeDisabled();
      await page.screenshot({ path: `${output}/${width}-pending.png` });
      const overflow = await page.evaluate(() => ({ page: document.documentElement.scrollWidth > innerWidth + 1,
        fields: [...document.querySelectorAll('.tutor-confirm-content p,.tutor-confirm-content h1,.tutor-confirm-actions button')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent) }));
      assert.equal(overflow.page, false); assert.deepEqual(overflow.fields, []);
      state.verified = true;
      await page.getByRole('button', { name: 'I have confirmed my email', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Email confirmed', exact: true })).toBeVisible();
      await page.getByRole('link', { name: 'Continue application', exact: true }).click();
      await expect(page).toHaveURL(/\/home$/);
      assert.deepEqual(f.errors, []); await f.context.close();

      const g = await fixture(browser, width, false);
      await g.page.goto(base + '/confirm-email#token=' + 'a'.repeat(43));
      await expect(g.page).toHaveURL(base + '/confirm-email');
      await g.page.getByRole('button', { name: 'Confirm email', exact: true }).click();
      await expect(g.page.getByRole('heading', { name: 'Email confirmed', exact: true })).toBeVisible();
      await expect(g.page.getByRole('link', { name: 'Sign in to continue', exact: true })).toBeVisible();
      assert.deepEqual(g.errors, []); await g.context.close();
      console.log(`PASS email confirmation ${width}: exam gate, sender, resend cooldown, mobile email wrapping, cross-tab recheck, signed-out explicit confirmation and token fragment cleanup`);
    }
    const r = await fixture(browser, 1440, false);
    await r.page.goto(base + '/register');
    for (const [placeholder, value] of [['First Name','Synthetic'],['Middle Name','Email'],['Last Name','Applicant'],['09xxxxxxxxx','09123456789'],['example: juandelacruz@gmail.com','applicant@example.test'],['Create your password (Min. 6 characters)','SyntheticPassword2026!']])
      await r.page.getByPlaceholder(placeholder, { exact: true }).fill(value);
    await r.page.locator('input[type=date]').fill('1995-01-02');
    await r.page.getByRole('button', { name: 'Submit Application', exact: true }).click();
    await expect(r.page).toHaveURL(/\/confirm-email$/);
    assert.equal(r.requests.filter(x => x.path === '/tutor/register').length, 1);
    assert.deepEqual(r.errors, []); await r.context.close();
    const expired = await fixture(browser, 390, false); expired.state.expired = true;
    await expired.page.goto(base + '/confirm-email#token=' + 'a'.repeat(43));
    await expired.page.getByRole('button', { name: 'Confirm email', exact: true }).click();
    await expect(expired.page.getByRole('alert')).toContainText('invalid or expired');
    await expect(expired.page.getByRole('heading', { name: 'Confirm your email', exact: true })).toBeVisible();
    await expired.context.close();
    console.log('PASS registration redirects to confirmation, not exams; expired-link recovery remains available. Fixture APIs only.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
