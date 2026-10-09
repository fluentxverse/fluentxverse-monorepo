const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.STUDENT_TEST_URL || 'http://localhost:5174';
const topics = [
  ['connection', 'Audio and connection quality', true], ['feedback', 'End-of-lesson feedback', true],
  ['corrections', 'Corrections and explanations', true], ['pace', "Tutor's speaking pace", true],
  ['difficulty', 'Lesson difficulty for my English level', true], ['environment', 'Quiet learning environment', false],
  ['start_time', 'Starting the lesson on time', false], ['end_time', 'Finishing the lesson on time', false],
  ['engagement', 'Tutor focus and engagement', false], ['request', 'Following my lesson request', false], ['other', 'Other', true],
].map(([id, label, positive]) => ({ id, label, positive }));
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  await fs.mkdir('../output/screenshots', { recursive: true });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1566, 375]) {
      let survey = null, failLoad = true, failSave = false, phase = 'ended', writes = [];
      const errors = [];
      const height = width < 650 ? 667 : 950;
      const context = await browser.newContext({ viewport: { width, height } });
      await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })), theme);
      await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):8765|https:\/\/api\.fluentxverse\.(?:com|xyz))\//, async route => {
        const req = route.request(), path = new URL(req.url()).pathname;
        const start = new Date(Date.now() + (phase === 'future' ? 3600000 : phase === 'early' ? -5 * 60000 : -3600000)).toISOString();
        const user = { userId: 'survey-student', id: 'survey-student', role: 'student', givenName: 'Test', email: 'survey@example.test' };
        if (path === '/student/me') return route.fulfill({ json: { success: true, user } });
        if (path.endsWith('/survey')) {
          if (req.method() === 'POST') {
            writes.push(req.postDataJSON());
            if (failSave) { failSave = false; return route.fulfill({ status: 503, json: { success: false, error: 'Could not save your feedback. Please try again.' } }); }
            await new Promise(resolve => setTimeout(resolve, 100));
            survey = { ...req.postDataJSON(), submittedAt: new Date().toISOString() };
            return route.fulfill({ json: { success: true, data: survey } });
          }
          if (failLoad) { failLoad = false; return route.fulfill({ status: 503, json: { success: false } }); }
          return route.fulfill({ json: { success: true, data: { eligible: ['ended', 'early'].includes(phase), reason: ['ended', 'early'].includes(phase) ? null : phase === 'expired' ? 'closed' : phase === 'absent' ? 'absent' : 'not_ended',
            endsAt: new Date(Date.parse(start) + 25 * 60000).toISOString(), closesAt: new Date(Date.now() + (phase === 'expired' ? -1000 : 47 * 3600000)).toISOString(), survey, topics } } });
        }
        if (path.endsWith('/issue-report')) return route.fulfill({ json: { success: true, data: { eligible: false, reason: 'expired', report: null } } });
        if (path.startsWith('/schedule/lesson/')) return route.fulfill({ json: { success: true, data: { bookingId: 'survey-test', tutorId: 'survey-tutor', tutorName: 'Test Tutor', startsAt: start, surveyReadyAt: phase === 'early' ? new Date().toISOString() : null, slotDate: '2026-10-08', slotTime: '4:00 PM', durationMinutes: 25, status: phase === 'cancelled' ? 'cancelled' : 'confirmed', bookedAt: start } } });
        if (path.startsWith('/schedule/lesson-recap/')) return route.fulfill({ json: { success: true, data: { startsAt: start, studentAttendance: phase === 'absent' ? 'absent' : 'present', materials: [], studentComment: '', englishLevelAssessment: null } } });
        if (path.startsWith('/schedule/lesson-material-request/')) return route.fulfill({ json: { success: true, data: { canRequestMaterial: phase === 'future', materialRequest: null } } });
        return route.fulfill({ json: { success: true, data: [], user, profile: {}, notifications: [] } });
      });
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/lesson/survey-test`, { waitUntil: 'domcontentloaded' });
      const trigger = page.locator('.classroom-card').getByRole('button', { name: 'Lesson feedback', exact: true });
      const card = page.getByRole('dialog', { name: 'Lesson feedback', exact: true });
      await trigger.waitFor();
      await page.waitForFunction(() => !document.querySelector('.lesson-classroom-feedback button')?.disabled);
      assert.equal(await card.count(), 0, 'The lesson page does not auto-open the survey');
      assert.equal(await page.locator('.lesson-page .student-lesson-survey').count(), 0, 'No standalone survey card');
      assert.equal(await trigger.getAttribute('aria-haspopup'), 'dialog');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal page overflow');
      await page.screenshot({ path: `../output/screenshots/lesson-feedback-button-${theme}-${width}.png`, fullPage: true });
      failLoad = true;
      await trigger.click();
      await card.getByRole('alert').waitFor();
      await card.getByRole('button', { name: 'Try again', exact: true }).click();
      await card.getByLabel('Step 1 of 3', { exact: true }).waitFor();
      const bounds = await card.boundingBox();
      assert(bounds.width <= 580 && bounds.height <= 580, 'The modal remains compact');
      assert(Math.abs(bounds.x + bounds.width / 2 - width / 2) < 2 && Math.abs(bounds.y + bounds.height / 2 - height / 2) < 2, 'Modal centered');
      await card.getByRole('button', { name: 'Next', exact: true }).click();
      await card.getByText('Choose an overall lesson rating before submitting.', { exact: true }).waitFor();
      assert.equal(writes.length, 0);
      await page.waitForFunction(() => document.querySelector('.classroom-survey-dialog .lesson-survey-error') === document.activeElement);
      await card.getByRole('radio', { name: '4 stars - Satisfied', exact: true }).check();
      await card.getByRole('button', { name: 'Maybe later', exact: true }).click();
      await card.waitFor({ state: 'hidden' });
      await trigger.click();
      assert(await card.getByRole('radio', { name: '4 stars - Satisfied', exact: true }).isChecked(), 'Dismissal preserves draft answers');
      await card.getByRole('button', { name: 'Next', exact: true }).click();
      await card.getByLabel('Step 2 of 3', { exact: true }).waitFor();
      const good = card.getByRole('group', { name: 'What went well?', exact: true });
      const improve = card.getByRole('group', { name: 'What could be better?', exact: true });
      assert.equal(await good.getByRole('checkbox').count(), 6); assert.equal(await improve.getByRole('checkbox').count(), 11);
      await good.getByRole('checkbox', { name: 'Audio and connection quality', exact: true }).check();
      await improve.getByRole('checkbox', { name: 'Audio and connection quality', exact: true }).check();
      assert.equal(await good.getByRole('checkbox', { name: 'Audio and connection quality', exact: true }).isChecked(), false);
      await good.getByRole('checkbox', { name: "Tutor's speaking pace", exact: true }).check();
      await improve.getByRole('checkbox', { name: 'Starting the lesson on time', exact: true }).check();
      await card.getByRole('button', { name: 'Next', exact: true }).click();
      await card.getByLabel('Step 3 of 3', { exact: true }).waitFor();
      const comment = card.locator('textarea');
      assert.equal(await comment.getAttribute('maxlength'), '500');
      await comment.fill('The pace was comfortable. Please improve the audio quality.');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal page overflow');
      assert.equal(await card.evaluate(el => getComputedStyle(el).borderRadius), '8px');
      await card.screenshot({ path: `../output/screenshots/lesson-feedback-modal-${theme}-${width}.png` });
      failSave = true;
      await card.getByRole('button', { name: 'Submit feedback', exact: true }).click();
      await card.getByRole('alert').filter({ hasText: 'Could not save your feedback.' }).waitFor();
      assert.equal(await comment.inputValue(), 'The pace was comfortable. Please improve the audio quality.');
      await card.getByRole('button', { name: 'Submit feedback', exact: true }).click();
      await card.getByRole('heading', { name: 'Thank you for your feedback', exact: true }).waitFor();
      assert.deepEqual(writes[1].positive, ['pace']);
      assert.deepEqual(writes[1].improvement, ['connection', 'start_time']);
      assert.equal(writes.length, 2);
      await card.getByRole('button', { name: 'Done', exact: true }).click();
      await card.waitFor({ state: 'hidden' });
      await page.reload({ waitUntil: 'domcontentloaded' });
      const view = page.locator('.classroom-card').getByRole('button', { name: 'View lesson feedback', exact: true });
      await view.click();
      await card.getByRole('heading', { name: 'Thank you for your feedback', exact: true }).waitFor();
      assert.equal(await card.getByRole('button', { name: 'Submit feedback', exact: true }).count(), 0);
      survey = null; phase = 'expired'; await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !document.querySelector('.lesson-classroom-feedback'));
      for (const state of ['absent', 'future', 'cancelled']) {
        phase = state; await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: 'Lesson recap', exact: true }).waitFor();
        await card.waitFor({ state: 'hidden' });
        assert.equal(await trigger.count(), 0, 'No feedback button for ineligible lessons');
      }
      phase = 'early'; await page.reload({ waitUntil: 'domcontentloaded' });
      await trigger.click();
      await card.getByRole('radio', { name: '4 stars - Satisfied', exact: true }).waitFor();
      assert.equal(await card.getByRole('button', { name: 'Next', exact: true }).count(), 1);
      assert.deepEqual(errors, []);
      await context.close(); console.log(`PASS lesson feedback ${theme} ${width}: compact classroom button and modal, validation, drafts, retry, persistence and eligibility`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
