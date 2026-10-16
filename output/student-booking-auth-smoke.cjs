const { chromium } = require('/home/paulanthonyarriola/.local/lib/python3.14/site-packages/playwright/driver/package');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');

(async () => {
  const token = execFileSync('docker', ['exec', 'fluentxverse-server', 'bun', '-e',
    'import {signAuthToken} from "./src/utils/jwt"; console.log(await signAuthToken({userId:"auth-student-smoke",email:"student-smoke@example.invalid",givenName:"Auth",familyName:"Smoke",role:"student",walletAddress:"0x1111111111111111111111111111111111111111"},300))',
  ], { encoding: 'utf8' }).trim();
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addCookies([
      { name: 'studentAuth', value: 'stale-legacy', domain: '.fluentxverse.xyz', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
      { name: 'studentAuth', value: token, url: 'https://api.fluentxverse.xyz/', httpOnly: true, secure: true, sameSite: 'Lax' },
    ]);
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(Date.now() + 86400000));
    const counts = { reserve: 0, consume: 0, book: 0, me: 0 };
    context.on('response', response => {
      if (new URL(response.url()).pathname === '/student/me') counts.me++;
    });
    await context.route('https://api.fluentxverse.xyz/tutor/auth-smoke-tutor', route => route.fulfill({ json: {
      success: true, data: { userId: 'auth-smoke-tutor', firstName: 'Test', lastName: 'Tutor', displayName: 'Auth Test Tutor', tier: 1, rating: 5, totalReviews: 0, languages: [], specializations: [] },
    } }));
    await context.route('https://api.fluentxverse.xyz/tutor/auth-smoke-tutor/availability', route => route.fulfill({ json: { success: true, data: [] } }));
    await context.route('https://api.fluentxverse.xyz/schedule/available/auth-smoke-tutor*', route => route.fulfill({ json: {
      success: true, data: [{ slotId: 'auth-smoke-slot', tutorId: 'auth-smoke-tutor', date, time: '20:00', durationMinutes: 25 }],
    } }));
    await context.route('https://api.fluentxverse.xyz/tickets/balance/*', route => route.fulfill({ json: {
      success: true, data: { basic: 2, premium: 0, trial: 0, basicTokenId: 'mock-basic', premiumTokenId: null, trialTokenId: null },
    } }));
    // All booking mutations stay mocked; this test never spends a real ticket.
    await context.route('https://api.fluentxverse.xyz/schedule/reserve', route => {
      counts.reserve++;
      return route.fulfill(counts.reserve === 1
        ? { status: 401, json: { success: false, error: 'Not authenticated' } }
        : { json: { success: true, data: { reservationId: 'auth-smoke-reservation', expiresAt: new Date(Date.now() + 120000).toISOString(), bookBy: new Date(Date.now() + 120000).toISOString() } } });
    });
    await context.route('https://api.fluentxverse.xyz/tickets/consume', route => {
      counts.consume++;
      return route.fulfill({ json: { success: true, data: { transactionHash: 'auth-smoke-transfer' } } });
    });
    await context.route('https://api.fluentxverse.xyz/schedule/book', route => {
      counts.book++;
      return route.fulfill({ json: { success: true, data: { bookingId: 'auth-smoke-booking' } } });
    });
    const page = await context.newPage();
    await page.goto('https://student.fluentxverse.xyz/tutor/auth-smoke-tutor', { timeout: 60000 });
    await page.locator('.sidebar').waitFor();
    assert.equal((await context.cookies()).filter(cookie => cookie.name === 'studentAuth').length, 1);
    console.log('PASS: duplicate cookies migrate to one usable student session');
    await page.locator('.profile-booking-card .btn-book-trial').click();
    await page.locator('.booking-modal-time-slot').first().click();
    await page.locator('.booking-modal-confirm').click();
    await page.getByText('Booking Confirmed!', { exact: true }).waitFor();
    assert.equal(await page.locator('.session-expired-modal').count(), 0);
    assert.equal(counts.reserve, 2);
    assert.equal(counts.consume, 1);
    assert.equal(counts.book, 1);
    await page.screenshot({ path: 'output/student-booking-auth-success.png' });
    console.log('PASS: reservation 401 is verified and replayed without refresh or duplicate ticket consumption');
    const lessonTab = await context.newPage();
    await lessonTab.goto('https://student.fluentxverse.xyz/tutor/auth-smoke-tutor', { timeout: 60000 });
    await lessonTab.locator('.sidebar').waitFor();
    assert.equal(await lessonTab.locator('.session-expired-modal').count(), 0);
    console.log('PASS: new tab restores the same student API session');
    await context.clearCookies();
    await lessonTab.locator('.profile-booking-card .btn-book-trial').click();
    await lessonTab.locator('.session-expired-modal').waitFor();
    assert.equal(counts.consume, 1);
    console.log('PASS: genuinely missing session is reported before a ticket is consumed');
    console.log(JSON.stringify(counts));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
