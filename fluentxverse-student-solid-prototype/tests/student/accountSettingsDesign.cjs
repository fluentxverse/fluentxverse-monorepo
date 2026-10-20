const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    const themes = process.env.TEST_THEME ? [process.env.TEST_THEME] : ['light', 'dark'];
    const widths = process.env.TEST_WIDTHS ? process.env.TEST_WIDTHS.split(',').map(Number) : [1566, 1024, 768, 375, 320];
    for (const theme of themes) for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width <= 375 ? 667 : 950 }, reducedMotion: 'reduce' });
      await context.addInitScript(theme => {
        if (!/^https?:$/.test(location.protocol)) return;
        localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 }));
        window.clipboardFails = true;
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => {
          if (window.clipboardFails) throw new Error('Clipboard unavailable');
          window.copiedAddress = text;
        } } });
      }, theme);
      let authEmail = 'alexandra@example.invalid', loggedOut = false, profileFailed = true;
      let passwordFailed = true, emailFailed = true, infoFailed = true, holdPassword = false, releaseSave;
      const writes = [], user = { userId: 'account-fixture', givenName: 'Alexandra', familyName: 'Montgomery', role: 'student', walletAddress: '0x' + 'a'.repeat(40) };
      let profile = { id: user.userId, givenName: user.givenName, familyName: user.familyName, fullName: 'Alexandra Montgomery', email: authEmail, mobileNumber: '+81 90 1234 5678', country: 'Japan', regionName: 'Tokyo', currentProficiency: 'Level 3', learningGoals: ['Conversational fluency'], preferredLearningStyle: 'Mixed approach', availability: ['Weekday evenings'], totalLessons: 0, upcomingLessons: 0, attendance: 0 };
      await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780)|https:\/\/api\.fluentxverse\.(?:com|xyz))\//, async route => {
        const request = route.request(), path = new URL(request.url()).pathname;
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
        const reply = json => route.fulfill({ json });
        if (['POST', 'PUT', 'DELETE'].includes(request.method())) {
          const body = request.postDataJSON();
          if (path === '/schedule/preload') return reply({ success: true, data: {} });
          writes.push({ path, body });
          if (path === '/student/user/password') {
            if (passwordFailed) return route.fulfill({ status: 400, json: { success: false, message: 'Your current password is incorrect.' } });
            if (holdPassword) await new Promise(resolve => { releaseSave = resolve; });
            return reply({ success: true });
          }
          if (path === '/student/user/email') {
            if (emailFailed) return route.fulfill({ status: 400, json: { success: false, message: 'Email update unavailable. Please try again.' } });
            authEmail = body.newEmail; return reply({ success: true });
          }
          if (path === '/student/user/personal-info') {
            if (infoFailed) return reply({ success: false, message: 'Could not save personal information.' });
            profile = { ...profile, ...body, mobileNumber: body.phoneNumber }; return reply({ success: true });
          }
          if (path === '/student/logout') { loggedOut = true; return reply({ success: true }); }
          return route.fulfill({ status: 400, json: { success: false, error: 'Unexpected account write' } });
        }
        if (path === '/student/me') return reply({ success: true, user: loggedOut ? null : { ...user, email: authEmail } });
        if (path === '/student/profile') {
          if (profileFailed) return route.fulfill({ status: 503 });
          return reply({ success: true, data: profile });
        }
        if (path === '/schedule/student-stats') return reply({ success: true, data: { lessonsCompleted: 0, upcomingLessons: 0, totalHours: 0 } });
        if (path.startsWith('/tickets/balance/')) return reply({ success: true, data: { basic: 0, premium: 0, trial: 0 } });
        if (path === '/student/favorites') return reply({ success: true, data: { favorites: [], total: 0, page: 1, totalPages: 0 } });
        return reply({ success: true, data: [], profile: {}, lessons: [] });
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.getByRole('heading', { name: /Welcome back/ }).waitFor();
      await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
      const open = async () => {
        if (width <= 991) {
          await page.getByRole('button', { name: 'Open mobile menu' }).click();
          await page.getByRole('button', { name: 'Account settings', exact: true }).click();
        } else await page.locator('.sidebar a[aria-label="Account settings"]').click();
        await page.getByRole('dialog', { name: 'Account settings' }).waitFor();
      };
      const check = async state => {
        const result = await page.locator('.student-account-dialog').evaluate(el => {
          const bounds = el.getBoundingClientRect(), header = el.querySelector('.account-dialog-header').getBoundingClientRect();
          const close = el.querySelector('.account-close').getBoundingClientRect(), footer = el.querySelector('footer')?.getBoundingClientRect();
          return {
            viewport: bounds.left >= 0 && bounds.right <= innerWidth + 1 && bounds.top >= 0 && bounds.bottom <= innerHeight + 1,
            overflow: el.scrollWidth > el.clientWidth,
            close: close.left >= header.left && close.right <= header.right && close.top >= header.top && close.bottom <= header.bottom,
            footer: !footer || (footer.top >= header.bottom && footer.bottom <= bounds.bottom),
            fields: [...el.querySelectorAll('input:not([type="checkbox"]),select,button')].every(item => item.scrollWidth <= item.clientWidth),
          };
        });
        assert.ok(result.viewport && result.close && result.footer && result.fields && !result.overflow, JSON.stringify(result));
        await page.locator('.account-art').evaluateAll(images => Promise.all(images.map(image => image.decode())));
        await page.screenshot({ path: '../output/screenshots/account-' + theme + '-' + width + '-' + state + '.png' });
      };
      await open();
      await page.getByRole('heading', { name: 'Alexandra Montgomery' }).waitFor();
      assert.equal(await page.locator('.student-account-dialog i').count(), 0);
      await check('overview');
      await page.getByRole('button', { name: 'Copy wallet address', exact: true }).click();
      await page.getByText('Could not copy the wallet address. Please try again.').waitFor();
      await page.evaluate(() => { window.clipboardFails = false; });
      await page.getByRole('button', { name: 'Copy wallet address', exact: true }).click();
      await page.getByText('Wallet address copied.', { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => window.copiedAddress), user.walletAddress);
      await page.getByRole('button', { name: 'Log out', exact: true }).focus();
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('.account-close').evaluate(el => el === document.activeElement), true);
      await page.getByRole('button', { name: 'Password', exact: true }).click();
      await page.getByLabel('Current password', { exact: true }).fill('current-value');
      await page.getByLabel('New password', { exact: true }).fill('short');
      await page.getByLabel('Confirm new password', { exact: true }).fill('short');
      await page.getByRole('button', { name: 'Save password' }).click();
      await page.getByText('Your new password must have at least 8 characters.').waitFor();
      assert.equal(writes.length, 0);
      await page.getByLabel('New password', { exact: true }).fill('new-secure-value');
      await page.getByLabel('Confirm new password', { exact: true }).fill('different-value');
      await page.getByRole('button', { name: 'Save password' }).click();
      await page.getByText('The new passwords do not match.').waitFor();
      assert.equal(await page.getByLabel('Confirm new password', { exact: true }).getAttribute('aria-invalid'), 'true');
      await page.getByLabel('Confirm new password', { exact: true }).fill('new-secure-value');
      assert.equal(await page.locator('.account-error').count(), 0);
      await page.getByRole('button', { name: 'Show new password', exact: true }).click();
      assert.equal(await page.getByLabel('New password', { exact: true }).getAttribute('type'), 'text');
      await check('password');
      await page.getByRole('button', { name: 'Save password' }).click();
      await page.getByText('Your current password is incorrect.').waitFor();
      await check('password-error');
      passwordFailed = false; holdPassword = true;
      await page.getByRole('button', { name: 'Save password' }).click();
      await page.getByRole('button', { name: 'Saving...' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Close settings' }).isDisabled(), true);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.student-account-dialog[open]').count(), 1);
      await page.waitForTimeout(100);
      assert.equal(typeof releaseSave, 'function'); releaseSave();
      await page.getByText('Your password has been updated.').waitFor();
      assert.deepEqual(writes.at(-1).body, { currentPassword: 'current-value', newPassword: 'new-secure-value' });
      assert.equal(await page.getByLabel('New password', { exact: true }).inputValue(), '');
      await page.getByRole('button', { name: 'Back to account', exact: true }).last().click();
      await page.getByRole('button', { name: 'Email address', exact: true }).click();
      await page.getByLabel('New email address').fill('new@example.invalid');
      await page.getByLabel('Confirm new email', { exact: true }).fill('wrong@example.invalid');
      await page.getByLabel('Current password', { exact: true }).fill('current-value');
      await page.getByRole('button', { name: 'Save email' }).click();
      await page.getByText('The email addresses do not match.').waitFor();
      await page.getByLabel('Confirm new email', { exact: true }).fill('NEW@example.invalid');
      assert.equal(await page.locator('.account-error').count(), 0);
      await check('email');
      await page.getByRole('button', { name: 'Save email' }).click();
      await page.getByText('Email update unavailable. Please try again.').waitFor();
      emailFailed = false;
      await page.getByRole('button', { name: 'Save email' }).click();
      await page.getByText('Your email has been updated.').waitFor();
      assert.deepEqual(writes.at(-1).body, { newEmail: 'new@example.invalid', currentPassword: 'current-value' });
      await page.getByRole('button', { name: 'Back to account', exact: true }).last().click();
      await page.locator('.account-identity').getByText('new@example.invalid', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Personal information', exact: true }).click();
      await page.getByRole('button', { name: 'Try again' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Save changes' }).isDisabled(), true);
      await check('personal-load-error');
      profileFailed = false;
      await page.getByRole('button', { name: 'Try again' }).click();
      await page.getByLabel('Phone number').waitFor();
      assert.equal(await page.getByLabel('Prefecture in Japan').inputValue(), 'Tokyo');
      await page.getByLabel('Phone number').fill('wrong');
      await page.getByRole('button', { name: 'Save changes' }).click();
      await page.getByText('Enter a valid phone number.').waitFor();
      await page.getByLabel('Phone number').fill('+81 90 9999 1111');
      assert.equal(await page.getByLabel('Phone number').getAttribute('aria-invalid'), 'false');
      await page.getByLabel('Prefecture in Japan').selectOption('Osaka');
      await page.getByLabel('English speaking level').selectOption('Level 4');
      await check('personal');
      await page.getByRole('checkbox', { name: 'Travel preparation', exact: true }).check();
      await page.getByRole('checkbox', { name: 'Weekday mornings', exact: true }).check();
      await check('personal-preferences');
      await page.getByRole('button', { name: 'Save changes' }).click();
      await page.getByText('Could not save personal information.').waitFor();
      infoFailed = false;
      await page.getByRole('button', { name: 'Save changes' }).click();
      await page.getByText('Your personal information has been updated.').waitFor();
      const info = writes.at(-1).body;
      assert.equal(info.phoneNumber, '+81 90 9999 1111'); assert.equal(info.regionName, 'Osaka'); assert.equal(info.currentProficiency, 'Level 4');
      assert.ok(info.learningGoals.includes('Travel preparation') && info.availability.includes('Weekday mornings'));
      assert.equal('addressLine' in info, false, 'Saving visible fields must not erase unrelated address data');
      await page.getByRole('button', { name: 'Back to account', exact: true }).last().click();
      await page.keyboard.press('Escape');
      await page.locator('.student-account-dialog').waitFor({ state: 'detached' });
      await page.waitForFunction(mobile => document.activeElement === document.querySelector(mobile ? '.mobile-nav-toggler' : '.sidebar a[aria-label="Account settings"]'), width <= 991);
      await open();
      await page.getByRole('button', { name: 'Password', exact: true }).click();
      assert.equal(await page.getByLabel('Current password', { exact: true }).inputValue(), '');
      assert.equal(await page.getByLabel('New password', { exact: true }).inputValue(), '');
      await page.getByRole('button', { name: 'Close settings' }).click();
      assert.deepEqual(errors, []);
      if (theme === 'light' && width === 1566) {
        await open(); await page.getByRole('button', { name: 'Log out', exact: true }).click();
        await page.waitForURL(base + '/', { timeout: 60000 });
        assert.equal(writes.filter(write => write.path === '/student/logout').length, 1);
      }
      console.log('PASS Account ' + theme + ' ' + width + ': clipboard, focus, password/email validation and retry, personal-info load/save, owned fields, mobile entry, layout');
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
