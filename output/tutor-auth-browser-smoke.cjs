const { chromium } = require('/home/paulanthonyarriola/.local/lib/python3.14/site-packages/playwright/driver/package');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');

async function mockBooking(context) {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
  await context.route('https://api.fluentxverse.xyz/schedule/week*', route => route.fulfill({ json: {
    success: true,
    data: { weekStart: date, weekEnd: date, slots: ['09:00', '15:00', '20:00'].map(time => ({
      date, time, status: 'booked', bookingId: 'auth-smoke-booking', studentId: 'auth-smoke-student', studentName: 'Auth Smoke Student',
    })) },
  } }));
  await context.route('https://api.fluentxverse.xyz/schedule/tutor-lesson/auth-smoke-booking', route => route.fulfill({ json: {
    success: true, data: { bookingId: 'auth-smoke-booking', studentId: 'auth-smoke-student', studentName: 'Auth Smoke Student', slotDate: date, slotTime: '8:00 PM', durationMinutes: 25 },
  } }));
  await context.route('https://api.fluentxverse.xyz/tutor/student/auth-smoke-student', route => route.fulfill({ json: {
    success: true, data: { id: 'auth-smoke-student', fullName: 'Auth Smoke Student' },
  } }));
}

async function main() {
  const token = execFileSync('docker', ['exec', 'fluentxverse-server', 'bun', '-e',
    'import { signAuthToken } from "./src/utils/jwt"; console.log(await signAuthToken({userId:"auth-browser-smoke",email:"paulanthonyarriola@gmail.com",firstName:"Auth",lastName:"Smoke",tier:1,role:"tutor"},300))'
  ], { encoding: 'utf8' }).trim();
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
  try {
    const duplicateContext = await browser.newContext();
    await mockBooking(duplicateContext);
    await duplicateContext.addCookies([
      { name: 'tutorAuth', value: 'stale-legacy-session', domain: '.fluentxverse.xyz', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
      { name: 'tutorAuth', value: token, url: 'https://api.fluentxverse.xyz/', httpOnly: true, secure: true, sameSite: 'Lax' }
    ]);
    const duplicatePage = await duplicateContext.newPage();
    const duplicateMe = duplicatePage.waitForResponse(r => new URL(r.url()).pathname === '/tutor/me');
    await duplicatePage.goto('https://tutor.fluentxverse.xyz/lesson/auth-smoke-booking');
    const duplicateMeResponse = await duplicateMe;
    assert.equal(duplicateMeResponse.status(), 200);
    await duplicatePage.waitForSelector('.profile-name');
    assert.equal(await duplicatePage.locator('.session-expired-modal').count(), 0);
    assert.equal((await duplicateContext.cookies()).filter(c => c.name === 'tutorAuth').length, 1);
    console.log('PASS: stale domain cookie is migrated and lesson tab remains authenticated');
    await duplicateContext.close();
    const context = await browser.newContext();
    await mockBooking(context);
    await context.addCookies([{ name: 'tutorAuth', value: token, url: 'https://api.fluentxverse.xyz/', httpOnly: true, secure: true, sameSite: 'Lax' }]);
    const page = await context.newPage();
    const responses = [];
    const failures = [];
    context.on('response', r => {
      if (r.url().includes('api.fluentxverse.xyz') && (r.status() >= 400 || /\/tutor\/(me|logout)/.test(r.url()))) {
        responses.push({ path: new URL(r.url()).pathname, status: r.status() });
      }
    });
    context.on('requestfailed', r => failures.push({ path: new URL(r.url()).pathname, error: r.failure()?.errorText }));
    await page.goto('https://tutor.fluentxverse.xyz/schedule');
    await page.waitForSelector('.sidebar', { timeout: 20000 });
    const popup = context.waitForEvent('page');
    await page.getByRole('button', { name: 'Open lesson with Auth Smoke Student', exact: true }).first().click();
    const lesson = await popup;
    await lesson.waitForSelector('.profile-name', { timeout: 20000 });
    assert.equal(await lesson.locator('.profile-name').textContent(), 'Auth Smoke Student');
    assert.equal(await lesson.locator('.session-expired-modal').count(), 0);
    await lesson.screenshot({ path: 'output/tutor-auth-lesson.png' });
    console.log('PASS: booked lesson opens in a new tab with its profile and no expiration modal');

    const logoutPattern = '**/tutor/logout?*';
    await page.route(logoutPattern, route => route.fulfill({ status: 503, json: { success: false } }));
    await page.locator('.sidebar a[title="Settings"]').click();
    await page.locator('.settings-action-btn.logout-btn').click();
    await page.getByText('Unable to sign out. Please try again.', { exact: true }).waitFor();
    assert.ok(page.url().endsWith('/schedule'));
    assert.equal((await context.cookies()).filter(c => c.name === 'tutorAuth').length, 1);
    await page.unroute(logoutPattern);
    console.log('PASS: failed logout shows an error and does not redirect');
    await page.route('**/tutor/logout?*', async route => {
      await new Promise(resolve => setTimeout(resolve, 1200));
      await route.continue().catch(() => {});
    });
    const logoutResponse = page.waitForResponse(r => new URL(r.url()).pathname === '/tutor/logout' && r.status() === 200);
    await page.locator('.settings-action-btn.logout-btn').click();
    await page.waitForTimeout(300);
    assert.ok(page.url().endsWith('/schedule'));
    assert.equal(await page.locator('.settings-action-btn.logout-btn').isDisabled(), true);
    await logoutResponse;
    await page.waitForURL('https://tutor.fluentxverse.xyz/');
    await lesson.waitForURL('https://tutor.fluentxverse.xyz/');
    await page.waitForTimeout(1000);
    assert.equal((await context.cookies()).filter(c => c.name === 'tutorAuth').length, 0);
    assert.equal(await page.locator('.sidebar').count(), 0);
    assert.equal(await lesson.locator('.session-expired-modal').count(), 0);
    await page.reload();
    await page.waitForTimeout(1000);
    assert.equal(page.url(), 'https://tutor.fluentxverse.xyz/');
    console.log('PASS: delayed desktop logout completes, signs out lesson tab, and stays signed out after reload');

    await context.addCookies([{ name: 'tutorAuth', value: token, url: 'https://api.fluentxverse.xyz/', httpOnly: true, secure: true, sameSite: 'Lax' }]);
    const mobile = await context.newPage();
    await mobile.setViewportSize({ width: 375, height: 812 });
    await mobile.goto('https://tutor.fluentxverse.xyz/home');
    await mobile.getByRole('button', { name: 'Open menu', exact: true }).click();
    await mobile.route(logoutPattern, route => route.fulfill({ status: 503, json: { success: false } }));
    await mobile.locator('.mobile-menu-panel .logout-btn').click();
    await mobile.locator('.mobile-logout-error').waitFor();
    assert.ok(mobile.url().endsWith('/home'));
    await mobile.unroute(logoutPattern);
    console.log('PASS: failed mobile logout keeps the menu open with a visible error');
    await mobile.locator('.mobile-menu-panel .logout-btn').click();
    await mobile.waitForURL('https://tutor.fluentxverse.xyz/');
    await mobile.waitForTimeout(1000);
    assert.equal((await context.cookies()).filter(c => c.name === 'tutorAuth').length, 0);
    console.log('PASS: mobile-menu logout stays signed out');

    await context.addCookies([{ name: 'tutorAuth', value: token, url: 'https://api.fluentxverse.xyz/', httpOnly: true, secure: true, sameSite: 'Lax' }]);
    const unauthorized = await context.newPage();
    await unauthorized.route('https://api.fluentxverse.xyz/exam/status', route => route.fulfill({ status: 401, json: { success: false } }));
    await unauthorized.goto('https://tutor.fluentxverse.xyz/home');
    await unauthorized.waitForSelector('.sidebar');
    await unauthorized.waitForTimeout(1500);
    assert.equal(await unauthorized.locator('.session-expired-modal').count(), 0);
    assert.ok(unauthorized.url().endsWith('/home'));
    console.log('PASS: a denied feature request does not expire a valid login');
    await context.clearCookies();
    await unauthorized.locator('.sidebar a[title="Settings"]').click();
    await unauthorized.getByRole('button', { name: 'Update My Personal Information', exact: true }).click();
    await unauthorized.locator('.session-expired-modal').waitFor();
    console.log('PASS: a genuinely missing session shows the expiration message without a reload loop');
    console.log(JSON.stringify({ responses, failures }));
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
