const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const out = require('node:path').resolve(__dirname, '../../output/screenshots/tutor-identity');
(async () => {
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=','base64');
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const app of ['tutor', 'admin']) for (const width of [1440, 390, 320]) {
      const base = (app === 'tutor' ? process.env.IDENTITY_TUTOR_URL : process.env.IDENTITY_DASHBOARD_URL) || `http://127.0.0.1:${app === 'tutor' ? 5192 : 5191}`;
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      if(process.env.IDENTITY_THEME)await context.addInitScript(theme=>localStorage.setItem('fxv_admin_theme',theme),process.env.IDENTITY_THEME);
      let record = null, actions = [];
      const pending = { id: 'cb17722c-bc58-4f42-9bfe-0c5702439f3b', tutorId: 'identity-test', name: 'Test Applicant', idType: 'national', status: 'pending_review', createdAt: new Date().toISOString() };
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname;
        if (url.origin === base) return route.continue();
        const headers = { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,cache-control,pragma' };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        const json = { success: true, data: [] };
        if (path === '/admin/me') json.user = { userId: 'reviewer', username: 'Reviewer', role: 'superadmin' };
        if (path === '/tutor/me') json.user = { userId: 'identity-test', firstName: 'Test', email: 'test@example.invalid', role: 'tutor' };
        if (path === '/tutor/email-verification') json.data = { verified: true };
        if (path === '/interview/my-booking') json.data = null;
        if (path.includes('/unread-count')) json.data = { unreadCount: 0 };
        if (path.includes('/notifications')) json.data = { notifications: [], unreadCount: 0 };
        if (path === '/tutor-identity/status') json.data = { enabled: true, record };
        if (path === '/tutor-identity/submit') { record = pending; json.data = { enabled: true, record }; }
        if (path === '/tutor-identity/admin') json.data = [record || pending];
        if (path.endsWith('/review')) { actions.push(request.postDataJSON()); record = { ...pending, status: 'accepted' }; }
        return route.fulfill({ headers, json });
      });
      await context.routeWebSocket('**/*', ws => ws.close());
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${base}/${app === 'tutor' ? 'interview' : 'identity-reviews'}`);
      if(process.env.IDENTITY_THEME) await page.evaluate(theme=>document.documentElement.setAttribute('data-theme',theme),process.env.IDENTITY_THEME);
      if (app === 'tutor') {
        await expect(page.getByRole('heading', { name: 'Identity verification' })).toBeVisible();
        await expect(page.getByLabel('ID type').locator('option')).toHaveCount(16);
        await page.getByLabel('Date of birth').fill('2000-01-01');
        await page.getByLabel('ID image', { exact: true }).setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') });
        await expect(page.getByRole('alert')).toContainText('Choose a JPEG, PNG or WebP');
        await page.getByLabel('ID image', { exact: true }).setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: png });
        await expect(page.getByAltText('Selected ID preview')).toBeVisible();
        assert.equal(await page.getByAltText('Selected ID preview').evaluate(img=>img.complete&&img.naturalWidth>0),true);
        await page.getByRole('button',{name:'Remove image',exact:true}).click();
        await expect(page.getByAltText('Selected ID preview')).toHaveCount(0);
        await page.getByLabel('ID image', { exact: true }).setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: png });
        await page.getByRole('checkbox').check();
        await page.evaluate(()=>window.scrollTo(0,0));
        await page.screenshot({ path: `${out}/tutor-${width}-form.png`, fullPage: true });
        await page.getByRole('button', { name: 'Submit ID for review' }).click();
        await expect(page.getByText('Awaiting ID review', { exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'We are reviewing your ID' })).toBeVisible();
        await expect(page.getByText('24–48 hours', { exact: true })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Prepare for your interview' })).toHaveAttribute('href', '/interview-guide');
        await expect(page.getByRole('button', { name: 'Check status', exact: true })).toBeVisible();
        record = { ...pending, status: 'resubmit', reason: 'Blurry image', deleteAt: new Date(Date.now() + 3600000).toISOString() };
        await page.getByRole('button', { name: 'Check status', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Submit ID for review' })).toBeVisible();
        await expect(page.getByText('Your previous ID is awaiting deletion.', { exact: false })).toHaveCount(0);
        await page.getByLabel('Date of birth').fill('2000-01-01');
        await page.getByLabel('ID image', { exact: true }).setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: png });
        await page.getByRole('checkbox').check();
        await page.getByRole('button', { name: 'Submit ID for review' }).click();
        await expect(page.getByRole('heading', { name: 'We are reviewing your ID' })).toBeVisible();
      } else {
        await expect(page.getByRole('heading',{name:'Identity reviews',exact:true})).toBeVisible();
        await page.getByRole('textbox',{name:'Search applicants',exact:true}).fill('no matching applicant');
        await expect(page.getByText('No matching applicants.',{exact:true})).toBeVisible();
        await page.getByRole('textbox',{name:'Search applicants',exact:true}).fill('Test');
        await page.getByLabel('Filter identity status').selectOption('verified');
        await expect(page.getByText('No matching applicants.',{exact:true})).toBeVisible();
        await page.getByLabel('Filter identity status').selectOption('all');
        await page.getByRole('button', { name: /Test Applicant/ }).click();
        await expect(page.getByRole('heading', { name: 'Philippine National ID (PhilID / ePhilID)' })).toBeVisible();
        await expect(page.getByText('Issuer tools are supporting evidence', { exact: false })).toHaveCount(0);
        await page.screenshot({ path: `${out}/admin-${width}-review.png`, fullPage: true });
        await expect(page.getByRole('button', { name: 'Accept ID', exact: true })).toBeDisabled();
        await page.getByLabel('Review reason').fill('Readable document and adult age checked.');
        await page.getByRole('checkbox').check();
        await page.getByRole('button', { name: 'Accept ID', exact: true }).click();
        await expect(page.locator('.identity-section strong').filter({ hasText: /^accepted$/ })).toBeVisible();
        assert.equal(actions[0].action, 'accept'); assert.equal(actions[0].adultConfirmed, true);
        record = { ...pending, status: 'verified' };
        await page.getByRole('button',{name:'Refresh',exact:true}).click();
        await expect(page.locator('.identity-section strong').filter({hasText:/^verified$/})).toBeVisible();
        await expect(page.getByRole('button',{name:'Revoke verification',exact:true})).toHaveCount(0);
        await page.getByLabel('Review reason').fill('Confirmed fraud finding for synthetic test');
        const ban=page.getByRole('button',{name:'Confirmed fraud: ban account',exact:true});
        await ban.click();const modal=page.getByRole('dialog',{name:'Ban this applicant for confirmed fraud?'});
        await expect(modal).toBeVisible();assert.equal(actions.length,1);
        assert.equal(await modal.evaluate(el=>{const r=el.getBoundingClientRect();return Math.abs((r.left+r.right)/2-innerWidth/2)<2&&Math.abs((r.top+r.bottom)/2-innerHeight/2)<2;}),true,'confirmation modal centered');
        await page.screenshot({path:`${out}/admin-${width}-fraud-confirm.png`,fullPage:true});
        await modal.getByRole('button',{name:'Cancel',exact:true}).click();await expect(modal).toHaveCount(0);assert.equal(actions.length,1);
        await ban.click();await expect(modal).toBeVisible();await page.keyboard.press('Escape');await expect(modal).toHaveCount(0);assert.equal(actions.length,1);
        await ban.click();await expect(modal).toBeVisible();await modal.getByRole('button',{name:'Yes, ban account',exact:true}).click();
        await expect(modal).toHaveCount(0);assert.equal(actions.length,2);assert.equal(actions[1].action,'fraud');
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${app}/${width} overflow`);
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.screenshot({ path: `${out}/${app}-${width}.png`, fullPage: true });
      assert.deepEqual(errors, []);
      await context.close(); console.log(`PASS ${app}/${width}`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
