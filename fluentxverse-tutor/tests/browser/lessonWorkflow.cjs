// API fixtures never write to the real database.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const id = 'workflow-browser-test';
const startsAt = new Date(Date.now() - 3600000).toISOString();
const feedback = 'Hello! You expressed your ideas clearly today. Keep practicing the new vocabulary and pronunciation before your next lesson.';
const studentBase = process.env.STUDENT_TEST_URL || 'http://localhost:5174';
const tutorBase = process.env.TUTOR_TEST_URL || 'http://localhost:5173';
const adminBase = process.env.ADMIN_TEST_URL || 'http://localhost:5175';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  await fs.mkdir('../output/screenshots', { recursive: true });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1566, 375]) {
      const errors = [];
      let submitted = false, dirty = false, phase = 'upcoming', requestValue = null;
      let summary = { studentComment: 'Hello!', tutorMemo: 'PRIVATE HANDOFF', englishLevelAssessment: null, updatedAt: new Date().toISOString() };
      let transientSubmitFailure = false, submitAttempts = 0;
      let published = '';
      let received = false;
      let tutorReport = null, tutorReportWindow = false;
      let report = { id: 'report-one', bookingId: id, source: 'student', duration: 'over_ten', reason: 'tutor', tutorIssue: 'late_join', tutorIssueLabel: 'Tutor joined late', details: 'Tutor arrived late.', createdAt: startsAt, status: 'submitted', resolution: '', ticketTransactionId: null };
      let archives = [{ id: 'archive-one', previousStatus: 'present', status: 'absent', actorId: 'tutor-test', actorRole: 'tutor', reason: 'Incorrect attendance marking', createdAt: startsAt, canRestore: true }];
      const material = { id: 'article', sessionId: id, materialType: 'daily-dispatch', materialId: 'article', materialTitle: 'Science today', courseId: 'daily-dispatch', articleId: 'article', isUsed: true, completionStatus: 'completed', stoppedAt: null, stoppedAtLabel: null, progressDetails: '', vocabularyItems: [], grammarItems: [], pronunciationItems: [], studentComment: '', tutorMemo: '', updatedAt: startsAt, createdAt: startsAt };
      const workflow = () => ({ startsAt, endsAt: new Date(Date.parse(startsAt) + 1500000).toISOString(), editableUntil: new Date(Date.now() + 47 * 3600000).toISOString(), serverNow: new Date().toISOString(), canEdit: true, closed: false,
        studentAttendance: 'present', attendanceVerified: submitted, outcome: submitted ? 'attended' : 'awaiting_verification', notesStatus: submitted ? dirty ? 'changes_pending' : 'submitted' : 'draft', submittedAt: submitted ? new Date().toISOString() : null });
      const contexts = [];
      for (const role of ['student', 'tutor', 'admin']) {
        const context = await browser.newContext({ viewport: { width, height: 900 } }); contexts.push(context);
        await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })), theme);
        await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):8765|https:\/\/api\.fluentxverse\.(?:com|xyz))\//, async route => {
          const req = route.request(), path = new URL(req.url()).pathname;
          const reply = data => route.fulfill({ json: data });
          const ok = data => reply({ success: true, data });
          if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
          const user = { userId: `${role}-test`, id: `${role}-test`, username: 'Admin Test', role, firstName: 'Test', email: 'paulanthonyarriola@gmail.com' };
          if (['/student/me', '/tutor/me', '/admin/me'].includes(path)) return reply({ success: true, user });
          if (path.endsWith('socket-token')) return reply({ success: true, token: 'test-token' });
          if (path === '/notifications' || path === '/notifications/') return ok({ notifications: submitted ? [{ id: 'notes-one', title: 'Lesson feedback ready', message: 'Your tutor has submitted your lesson notes.', isRead: false, timestamp: startsAt, data: { link: `/lesson/${id}` } }] : [], unreadCount: submitted ? 1 : 0 });
          if (path.endsWith('/read')) return ok({});
          if (path === `/schedule/lesson/${id}`) return ok({ bookingId: id, tutorId: 'tutor-test', tutorName: 'Test Tutor', startsAt: phase === 'upcoming' ? new Date(Date.now() + 3600000).toISOString() : startsAt, durationMinutes: 25, status: phase === 'upcoming' ? 'confirmed' : 'completed', bookedAt: startsAt });
          if (path === `/schedule/tutor-lesson/${id}`) return ok({ bookingId: id, sessionId: id, studentId: 'student-test', slotDate: '2026-10-07', slotTime: '2:00 PM', durationMinutes: 25, status: 'completed' });
          if (path === '/tutor/student/student-test') return ok({ id: 'student-test', givenName: 'Test', familyName: 'Student', country: 'Japan', joinDate: '2026-04-03', hobbies: [] });
          if (path === '/tutor/student/student-test/lesson-request') return ok(requestValue);
          if (path.includes('/issue-report')) return ok({ startsAt, closesAt: new Date(Date.now() + 3600000).toISOString(), serverNow: new Date().toISOString(), reason: null, report, eligible: false });
          if (path.endsWith('/trouble-report')) {
            if (req.method() === 'POST') {
              tutorReport = { id: 'tutor-report-one', bookingId: id, source: 'tutor', ...req.postDataJSON(), studentIssueLabel: 'Student asked to cancel', status: 'submitted', createdAt: startsAt, details: '' };
              return ok(tutorReport);
            }
            return ok({ startsAt: tutorReportWindow ? new Date(Date.now() - 60000).toISOString() : startsAt, endsAt: tutorReportWindow ? new Date(Date.now() + 1200000).toISOString() : workflow().endsAt, serverNow: new Date().toISOString(), report: tutorReport, studentReport: received ? report : null });
          }
          if (path.includes('/lesson-recap/')) return ok({ startsAt, studentAttendance: 'present', workflow: workflow(), materials: submitted ? [material] : [], studentComment: published, englishLevelAssessment: null, previousLessonId: null, nextLessonId: null });
          if (path.includes('/lesson-material-request/')) {
            if (req.method() === 'PUT') { const body = req.postDataJSON(); requestValue = { courseId: body.courseId, lessonId: body.materialId, title: 'Workplace introductions', level: 3, chapter: 1 }; return ok(requestValue); }
            return ok({ canRequestMaterial: phase === 'upcoming', materialRequest: requestValue });
          }
          if (path.endsWith('/continuations')) return ok([{ materialType: 'business-english', materialId: 'unfinished', materialTitle: 'Workplace introductions', stoppedAt: 'practice.steps.0', stoppedAtLabel: 'Part 4 - Practice - Step A', progressDetails: 'Question 2', previousLessonId: 'previous' }]);
          if (path === '/lesson-workflow/tutor/pending') return ok([{ ...workflow(), bookingId: id, studentName: 'Test Student' }]);
          if (path === `/lesson-workflow/tutor/${id}`) return ok(workflow());
          if (path.endsWith('/submit')) {
            submitAttempts++;
            if (summary.studentComment.trim().length < 100) return route.fulfill({ status: 400, json: { success: false, error: 'Student feedback must contain at least 100 characters.', validation: { field: 'studentFeedback' } } });
            if (transientSubmitFailure) { transientSubmitFailure = false; return route.fulfill({ status: 500, json: { success: false, error: 'Could not submit notes. Please try again.' } }); }
            submitted = true; dirty = false; published = summary.studentComment; return ok(workflow());
          }
          if (path === `/tutor/lesson-notes-edit-window/${id}`) return ok({ ...workflow(), reason: null });
          if (path === `/tutor/classroom-lesson-notes/${id}`) {
            if (req.method() === 'PUT') { summary = { ...summary, ...req.postDataJSON(), updatedAt: new Date().toISOString() }; dirty = true; return ok({}); }
            return ok({ ...summary, studentAttendance: 'present', materials: [material] });
          }
          if (path === `/tutor/classroom-notes/${id}`) { Object.assign(material, req.postDataJSON(), { updatedAt: new Date().toISOString() }); dirty = true; return ok(material); }
          if (path === `/tutor/lesson-notes/${id}`) return ok([{ sessionId: id, startsAt, tutorName: 'Test Tutor', notes: [material], ...summary, workflow: workflow() }]);
          if (path === '/lesson-workflow/admin/reports') return ok(tutorReport ? [report, tutorReport] : [report]);
          if (path.startsWith('/lesson-workflow/admin/reports/')) { report = { ...report, ...req.postDataJSON() }; return ok(report); }
          if (path.includes('/lesson-workflow/admin/attendance/')) {
            if (path.includes('/restore/')) { archives.push({ id: 'restored', previousStatus: 'absent', status: 'present', actorId: 'admin-test', actorRole: 'admin', reason: req.postDataJSON().reason, createdAt: new Date().toISOString(), canRestore: false }); return ok({}); }
            return ok(archives);
          }
          if (path === '/schedule/week') return ok({ slots: [] });
          return reply({ success: true, data: [], user, profile: {}, lessons: [] });
        });
      }
      const student = await contexts[0].newPage(), tutor = await contexts[1].newPage(), admin = await contexts[2].newPage();
      for (const page of [student, tutor, admin]) page.on('pageerror', err => errors.push(err.message));
      await student.goto(`${studentBase}/lesson/${id}`, { waitUntil: 'domcontentloaded' });
      await student.getByRole('button', { name: 'Continue previous material', exact: true }).click();
      await student.getByText('Workplace introductions', { exact: true }).first().waitFor();
      assert.equal(requestValue.lessonId, 'unfinished');
      phase = 'ended';
      await student.reload({ waitUntil: 'domcontentloaded' });
      await student.getByText('Attendance verification pending', { exact: false }).waitFor();
      assert.equal(await student.getByText(feedback, { exact: true }).count(), 0, 'Draft feedback is not shown');
      await tutor.goto(`${tutorBase}/lesson/${id}`, { waitUntil: 'domcontentloaded' });
      const enterClassroom = tutor.getByRole('button', { name: 'Enter Classroom', exact: true });
      await enterClassroom.waitFor();
      assert(await enterClassroom.isDisabled(), 'Ended lessons cannot enter the classroom');
      const disabledStyle = await enterClassroom.evaluate(el => {
        const style = getComputedStyle(el);
        return { background: style.backgroundColor, shadow: style.boxShadow, cursor: style.cursor, text: getComputedStyle(el.querySelector('span')).color };
      });
      assert.equal(disabledStyle.background, theme === 'dark' ? 'rgb(48, 48, 48)' : 'rgb(233, 237, 243)');
      assert.equal(disabledStyle.shadow, 'none');
      assert.equal(disabledStyle.cursor, 'not-allowed');
      assert.equal(disabledStyle.text, theme === 'dark' ? 'rgb(152, 152, 152)' : 'rgb(116, 128, 145)');
      await enterClassroom.screenshot({ path: `../output/screenshots/disabled-classroom-entry-${theme}-${width}.png` });
      await tutor.getByRole('button', { name: 'Report Issue', exact: true }).waitFor();
      received = true;
      await tutor.evaluate(() => window.dispatchEvent(new Event('focus')));
      const receivedButton = tutor.getByRole('button', { name: 'Report Received', exact: true });
      await receivedButton.waitFor();
      assert.equal(await receivedButton.isEnabled(), true, 'Received reports remain viewable after the reporting window');
      await tutor.waitForFunction(expected => {
        const button = document.querySelector('.lesson-issue-report-btn.report-received');
        return button && getComputedStyle(button).color === expected;
      }, theme === 'dark' ? 'rgb(253, 164, 175)' : 'rgb(190, 18, 60)');
      assert.equal(await receivedButton.evaluate(el => getComputedStyle(el).color), theme === 'dark' ? 'rgb(253, 164, 175)' : 'rgb(190, 18, 60)');
      await receivedButton.click();
      await tutor.getByRole('heading', { name: 'Student report received', exact: true }).waitFor();
      await tutor.locator('#student-lesson-report').getByText('Tutor joined late', { exact: true }).waitFor();
      await tutor.screenshot({ path: `../output/screenshots/report-received-${theme}-${width}.png`, animations: 'disabled' });
      await tutor.getByRole('button', { name: 'Submit notes & confirm attendance' }).click();
      const validationEditor = tutor.getByRole('dialog');
      await validationEditor.waitFor();
      const validation = validationEditor.locator('.lne-validation-summary');
      await validation.waitFor();
      assert.equal(submitted, false);
      assert.equal(await validation.getByRole('button', { name: 'Retry' }).count(), 0, 'Invalid notes must be edited, not retried');
      const feedbackField = validationEditor.getByRole('textbox', { name: 'Student feedback', exact: true });
      await tutor.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Student feedback');
      await feedbackField.evaluate(el => { if (document.activeElement !== el) throw new Error('Invalid feedback must receive focus'); });
      assert(await feedbackField.evaluate(el => { const field = el.getBoundingClientRect(), body = el.closest('.lne-body').getBoundingClientRect(); return field.top >= body.top && field.bottom <= body.bottom; }), 'Invalid field is scrolled into view');
      assert(await validation.evaluate(el => el.getBoundingClientRect().bottom <= el.nextElementSibling.getBoundingClientRect().top + 1), 'Error summary stays above the scrolling body');
      await tutor.screenshot({ path: `../output/screenshots/workflow-validation-${theme}-${width}.png`, animations: 'disabled' });
      await validationEditor.getByRole('textbox', { name: 'Student feedback', exact: true }).fill(feedback);
      assert.equal(await validationEditor.locator('.lne-validation-summary').count(), 0, 'Corrected feedback clears the summary');
      await validationEditor.getByRole('button', { name: 'Save changes', exact: true }).click();
      await validationEditor.getByText('Draft notes', { exact: true }).waitFor();
      await validationEditor.getByRole('button', { name: 'Close editor' }).click();
      transientSubmitFailure = true;
      await tutor.getByRole('button', { name: 'Submit notes & confirm attendance' }).click();
      const retry = tutor.getByRole('alert').filter({ hasText: 'Could not submit notes. Please try again.' }).getByRole('button', { name: 'Retry' });
      await retry.click();
      await tutor.getByText('Notes submitted', { exact: true }).waitFor();
      assert.equal(submitAttempts, 3, 'Retry must resend the submission rather than only reload status');
      await student.reload({ waitUntil: 'domcontentloaded' });
      await student.getByText(feedback, { exact: true }).waitFor();
      assert.equal(await student.getByText('PRIVATE HANDOFF', { exact: true }).count(), 0);
      await student.getByRole('button', { name: /Notifications/ }).click();
      await student.getByRole('dialog').getByText('Lesson feedback ready', { exact: true }).waitFor();
      await student.getByRole('button', { name: 'Close notifications' }).click();
      await tutor.getByRole('button', { name: 'Edit notes', exact: true }).click();
      const editor = tutor.getByRole('dialog');
      await editor.getByRole('textbox', { name: 'Student feedback', exact: true }).fill(`${feedback} Continue practicing!`);
      assert(await editor.getByRole('button', { name: 'Submit notes & confirm attendance' }).count() === 0 || await editor.getByRole('button', { name: 'Submit notes & confirm attendance' }).isDisabled());
      await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
      await editor.getByText('Unsubmitted updates', { exact: true }).waitFor();
      await editor.getByRole('button', { name: 'Submit notes & confirm attendance' }).click();
      await editor.getByText('Notes submitted', { exact: true }).waitFor();
      await editor.getByRole('button', { name: 'Close editor' }).click();
      await tutor.screenshot({ path: `../output/screenshots/workflow-tutor-${theme}-${width}.png`, fullPage: true });
      received = false; tutorReportWindow = true;
      await tutor.evaluate(() => window.dispatchEvent(new Event('focus')));
      const tutorIssueButton = tutor.getByRole('button', { name: 'Report Issue', exact: true });
      await tutorIssueButton.waitFor();
      await tutorIssueButton.click();
      const issueDialog = tutor.getByRole('dialog');
      await issueDialog.getByRole('button', { name: '10 minutes or less', exact: true }).click();
      await issueDialog.getByRole('button', { name: 'Student-related issue', exact: true }).click();
      await issueDialog.getByRole('button', { name: 'Next', exact: true }).click();
      assert(await issueDialog.getByRole('button', { name: 'Submit Report', exact: true }).isDisabled());
      await issueDialog.getByRole('button', { name: 'Student asked to cancel', exact: true }).click();
      await issueDialog.getByRole('button', { name: 'Submit Report', exact: true }).click();
      await issueDialog.waitFor({ state: 'detached' });
      assert.equal(tutorReport.studentIssue, 'asked_to_cancel');
      await tutor.locator('.lesson-report-outcome').getByText('Student asked to cancel', { exact: true }).waitFor();
      await admin.goto(`${adminBase}/lesson-operations`, { waitUntil: 'domcontentloaded' });
      await admin.getByRole('button', { name: 'Review', exact: true }).first().click();
      const review = admin.getByRole('dialog');
      await review.getByText('Tutor joined late', { exact: true }).waitFor();
      await review.getByLabel('Review status').selectOption('resolved');
      await review.getByLabel('Outcome visible to the reporter').fill('Connection issue reviewed. No ticket adjustment required.');
      await review.getByRole('button', { name: 'Confirm changes' }).click();
      await admin.getByText('Changes saved.', { exact: true }).waitFor();
      await student.reload({ waitUntil: 'domcontentloaded' });
      await student.getByText('Issue resolved', { exact: true }).waitFor();
      await student.getByText('Connection issue reviewed. No ticket adjustment required.', { exact: true }).waitFor();
      await student.screenshot({ path: `../output/screenshots/workflow-student-${theme}-${width}.png`, fullPage: true });
      await admin.getByRole('button', { name: 'Attendance history', exact: true }).first().click();
      await admin.getByRole('button', { name: 'Recover archived notes' }).click();
      const recovery = admin.getByRole('dialog');
      await recovery.getByLabel('Reason (required)').fill('Attendance error confirmed.');
      const box = await recovery.boundingBox();
      assert(Math.abs(box.x + box.width / 2 - width / 2) < 2, 'Recovery modal is centered');
      await recovery.getByRole('button', { name: 'Confirm changes' }).click();
      await admin.getByText('Attendance error confirmed.', { exact: true }).waitFor();
      await admin.screenshot({ path: `../output/screenshots/workflow-admin-${theme}-${width}.png`, fullPage: true });
      await admin.getByRole('heading', { name: 'Issue reports', exact: true }).scrollIntoViewIfNeeded();
      await admin.getByText('Student asked to cancel', { exact: true }).waitFor();
      await admin.getByRole('button', { name: 'Review', exact: true }).last().click();
      await admin.getByRole('dialog').getByText('Student asked to cancel', { exact: true }).waitFor();
      for (const page of [student, tutor, admin]) assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow');
      assert.deepEqual(errors, []);
      for (const context of contexts) await context.close();
      console.log(`PASS ${theme} ${width}: continuation request, private drafts, submission, verification, notification, editing, report resolution, archive recovery, and responsive layout`);
    }
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exit(1); });
