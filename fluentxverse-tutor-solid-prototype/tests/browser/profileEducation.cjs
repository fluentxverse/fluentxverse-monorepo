const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  fs.mkdirSync('/tmp/fluentxverse-profile-education', { recursive: true });
  try {
    for (const width of [1440, 390, 320]) for (const status of ['incomplete', 'pending_review', 'rejected', 'approved']) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const profile = { firstName: 'Test', bio: 'Tutor bio', profilePicture: '/assets/img/logo/logo.png', videoIntroUrl: '', interests: ['Reading'], education: [], profileStatus: status };
      let pending = false, fail = false;
      const mutations = [], errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin === base) return route.continue();
        let json = { success: true, data: [] };
        if (url.pathname === '/tutor/me') json.user = { userId: 'education-fixture', firstName: 'Test', role: 'tutor', email: 'test@example.invalid' };
        if (url.pathname === '/tutor/profile') {
          if (route.request().method() === 'PATCH') {
            const body = route.request().postDataJSON();
            mutations.push(body);
            if (fail) return route.fulfill({ json: { success: false, error: 'Fixture save failed' } });
            pending = status === 'approved';
            if (!pending) Object.assign(profile, body);
            json = { success: true, data: body, hasPendingChanges: pending };
          } else json.data = profile;
        }
        if (url.pathname === '/proof/tutor-certification/me') json.data = { snapshot: { profileApproved: status === 'approved', missingRequirements: ['interview_pass'] }, credential: { status: 'retired' } };
        if (url.pathname === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        return route.fulfill({ json });
      });
      await page.goto(`${base}/application/profile`, { waitUntil: 'networkidle' });
      const education = page.locator('.profile-education-section');
      await expect(education.getByRole('heading', { name: /Education/ })).toBeVisible().catch(async error => { console.error(await page.locator('body').innerText(), errors); throw error; });
      await expect(page.getByText('Screening Credential', { exact: true })).toHaveCount(0);
      await expect(page.getByText('No screening credential issued yet.', { exact: true })).toHaveCount(0);
      await expect(education).toContainText('Add your school');
      await expect(page.locator('.profile-tabs').getByRole('button', { name: 'Settings', exact: true })).toHaveCount(status === 'approved' ? 1 : 0);
      await page.locator('button.missing-item').getByText('Education', { exact: true }).click();
      let editor = page.getByRole('dialog', { name: 'Edit profile', exact: true });
      await expect(editor).toBeVisible();
      await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.equal(mutations.length, 0);
      await education.getByRole('button', { name: 'Edit education', exact: true }).click();
      await editor.getByRole('combobox', { name: 'School attended', exact: true }).click();
      await editor.getByRole('textbox', { name: 'Search schools', exact: true }).fill('Abada');
      await editor.getByRole('option', { name: 'Abada College', exact: true }).click();
      await editor.getByLabel('Degree or field of study', { exact: true }).fill('English Education');
      await editor.getByLabel('Educational attainment', { exact: true }).selectOption("Bachelor's degree");
      await editor.getByLabel('Teaching experience', { exact: true }).selectOption('1 to 3 years');
      await editor.getByLabel('TEFL/TESL Certified', { exact: true }).check();
      fail = true;
      await editor.getByRole('button', { name: 'Save Changes', exact: true }).click();
      await expect(editor).toBeVisible();
      fail = false;
      await editor.getByRole('button', { name: 'Save Changes', exact: true }).click();
      await expect(editor).toHaveCount(0);
      assert.deepEqual(mutations.at(-1), { schoolAttended: 'Abada College', major: 'English Education', educationalAttainment: "Bachelor's degree", teachingExperience: '1 to 3 years', teachingQualifications: ['TEFL/TESL Certified'] });
      if (pending) await expect(education).not.toContainText('Abada College');
      else {
        await expect(education).toContainText('Abada College');
        await expect(education).toContainText('English Education');
        await expect(education).toContainText('1 to 3 years');
        await expect(education).toContainText('TEFL/TESL Certified');
        await expect(page.locator('button.missing-item').filter({ hasText: 'Education' })).toHaveCount(0);
        await page.reload({ waitUntil: 'networkidle' });
        await expect(education).toContainText('Abada College');
        await education.getByRole('button', { name: 'Edit education', exact: true }).click();
        await expect(editor.getByRole('combobox', { name: 'School attended', exact: true })).toContainText('Abada College');
        await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `/tmp/fluentxverse-profile-education/${width}-${status}.png`, fullPage: true });
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px ${status}: visible education, editor, retry, saved values and Settings approval gate`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
