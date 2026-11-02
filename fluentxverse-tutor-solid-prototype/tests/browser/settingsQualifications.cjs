const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  fs.mkdirSync('/tmp/fluentxverse-settings-qualifications', { recursive: true });
  try {
    for (const width of [1440, 537, 390, 320]) for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width, height: 850 }, colorScheme: theme });
      const profile = { firstName: 'Test', profileStatus: 'approved', schoolAttended: 'Abada College', major: 'English', educationalAttainment: "Bachelor's degree", teachingExperience: '1 to 3 years', teachingQualifications: ['TEFL/TESL Certified'], education: [], interests: [] };
      let proposed;
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin === base) return route.continue();
        let json = { success: true, data: [] };
        if (url.pathname === '/tutor/me') json.user = { userId: 'settings-qualification-fixture', firstName: 'Test', role: 'tutor', email: 'fixture@example.invalid' };
        if (url.pathname === '/tutor/profile') {
          if (route.request().method() === 'PATCH') { proposed = route.request().postDataJSON(); json.hasPendingChanges = true; }
          else json.data = profile;
        }
        if (url.pathname === '/tutor/user/personal-info') json.data = { ...profile, country: 'Philippines' };
        if (url.pathname === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        return route.fulfill({ json });
      });
      await page.goto(`${base}/application/profile`, { waitUntil: 'networkidle' });
      await page.locator('.profile-tabs').getByRole('button', { name: 'Settings', exact: true }).click().catch(async error => { console.error(await page.locator('body').innerText(), errors); throw error; });
      await page.getByRole('button', { name: /Account Settings/ }).click();
      const dialog = page.getByRole('dialog', { name: 'Account settings', exact: true });
      await dialog.getByRole('button', { name: 'Update My Personal Information', exact: true }).click();
      const school = dialog.getByRole('combobox', { name: 'School attended', exact: true });
      await expect(school).toContainText('Abada College');
      await school.scrollIntoViewIfNeeded(); await school.focus();
      const checkGeometry = async () => {
        const geometry = await dialog.evaluate(el => {
          const header = el.querySelector('.settings-dialog-header').getBoundingClientRect();
          const content = el.querySelector('.settings-dialog-content').getBoundingClientRect();
          const control = el.querySelector('.qualification-school-trigger').getBoundingClientRect();
          const back = el.querySelector('.settings-modal-back').getBoundingClientRect();
          const close = el.querySelector('.settings-modal-close').getBoundingClientRect();
          const focused = document.activeElement.getBoundingClientRect();
          const scroller = el.querySelector('.settings-dialog-content');
          return { overlap: content.top < header.bottom - 1, controlsInHeader: back.top >= header.top && back.bottom <= header.bottom && close.bottom <= header.bottom,
            focusClipped: focused.left < content.left + 4 || focused.right > content.right - 4,
            schoolClipped: control.left < content.left + 4 || control.right > content.right - 4,
            overflow: el.scrollWidth > el.clientWidth + 1 || scroller.scrollWidth > scroller.clientWidth + 1 };
        });
        assert.deepEqual(geometry, { overlap: false, controlsInHeader: true, focusClipped: false, schoolClipped: false, overflow: false });
      };
      await checkGeometry();
      await school.click();
      await dialog.getByRole('textbox', { name: 'Search schools', exact: true }).fill('Ateneo de Manila');
      await dialog.getByRole('option', { name: 'Ateneo de Manila University', exact: true }).click();
      await dialog.getByLabel('Degree or field of study', { exact: true }).fill('Applied Linguistics');
      await dialog.getByLabel('Teaching experience', { exact: true }).selectOption('3 to 5 years');
      await dialog.getByLabel('Professionally trained', { exact: true }).check();
      await dialog.getByLabel('Teaching experience', { exact: true }).focus();
      await checkGeometry();
      await page.screenshot({ path: `/tmp/fluentxverse-settings-qualifications/${width}-${theme}.png`, fullPage: true });
      await dialog.getByRole('button', { name: 'Update', exact: true }).click();
      await expect(dialog.getByText('Personal information saved. Qualification changes submitted for review.', { exact: true })).toBeVisible();
      assert.equal(proposed.schoolAttended, 'Ateneo de Manila University');
      assert.equal(proposed.major, 'Applied Linguistics');
      assert.equal(proposed.teachingExperience, '3 to 5 years');
      assert.deepEqual(proposed.teachingQualifications, ['TEFL/TESL Certified', 'Professionally trained']);
      Object.assign(profile, proposed); // Simulated admin approval, fixture only.
      await dialog.getByRole('button', { name: 'Close settings', exact: true }).click();
      await page.locator('.profile-tabs').getByRole('button', { name: 'About', exact: true }).click();
      await expect(page.locator('.profile-education-section')).toContainText('Applied Linguistics');
      await page.getByRole('button', { name: 'Edit education', exact: true }).click();
      const editor = page.getByRole('dialog', { name: 'Edit profile', exact: true });
      await expect(editor.getByRole('combobox', { name: 'School attended', exact: true })).toContainText('Ateneo de Manila University');
      await expect(editor.getByLabel('Teaching experience', { exact: true })).toHaveValue('3 to 5 years');
      await expect(editor.getByLabel('Professionally trained', { exact: true })).toBeChecked();
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px ${theme}: header separation, focus clearance, shared searchable schools and qualification persistence`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
