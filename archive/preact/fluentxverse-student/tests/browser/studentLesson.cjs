// API fixtures never write to the real database.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const studentBase = process.env.STUDENT_TEST_URL || 'http://localhost:5174';
const tutorBase = process.env.TUTOR_TEST_URL || 'http://localhost:5173';
const id = 'student-lesson-recap-test';
const studentId = 'student-recap-test';
const titles = { 'conversational-skills': 'Lesson 4: Introducing yourself', 'business-english': 'Lesson 4: Workplace introductions', 'daily-dispatch': 'Space exploration today' };
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1566, 375]) {
      let selected = null, phase = 'upcoming', failSave = false, failRecap = true, report = null, failReport = false, expired = false, reportGate = null;
      const writes = [], errors = [];
      const start = () => new Date(Date.now() + (phase === 'upcoming' ? 3600000 : -3600000)).toISOString();
      const material = (type, index) => ({ materialId: `${type}-material`, materialType: type, courseId: type,
        materialTitle: titles[type], materialLevel: type === 'daily-dispatch' ? null : 3, materialChapter: type === 'daily-dispatch' ? null : 2,
        completionStatus: type === 'daily-dispatch' ? 'completed' : 'in_progress', stoppedAtLabel: 'Part 3 - Step A', progressDetails: 'Question 2',
        vocabularyItems: [{ word: index ? 'implications' : 'frontier', definitions: [{ meaning: index ? 'Possible effects or results' : 'A new area of knowledge', partOfSpeech: 'noun', japaneseNative: 'フロンティア', japaneseRomanized: 'furontia' }], selectedDefinitionIndex: 0 }],
        grammarItems: [{ youSaid: 'I want to ate', correct: 'I want to eat' }], pronunciationItems: [{ word: 'lasagna', phonetic: 'luh-ZAHN-yuh' }],
      });
      const contexts = [];
      for (const role of ['student', 'tutor']) {
        const context = await browser.newContext({ viewport: { width, height: 900 } }); contexts.push(context);
        await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })), theme);
        await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):8765|https:\/\/api\.fluentxverse\.(?:com|xyz))\//, async route => {
          const req = route.request(), url = new URL(req.url()), path = url.pathname;
          const reply = json => route.fulfill({ json });
          if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
          const user = { userId: role === 'tutor' ? 'tutor-recap-test' : studentId, role, firstName: 'Test', email: 'paulanthonyarriola@gmail.com' };
          if (path === '/student/me' || path === '/tutor/me') return reply({ success: true, user });
          if (path.endsWith('/issue-report')) {
            if (req.method() === 'POST') {
              if (failReport) { failReport = false; return route.fulfill({ status: 503, json: { success: false, error: 'Your report could not be submitted.' } }); }
              report = { id: 'test-report', ...req.postDataJSON(), tutorIssueLabel: req.postDataJSON().tutorIssue === 'other' ? 'Other tutor-related issue' : null, createdAt: new Date().toISOString() };
              return reply({ success: true, data: report });
            }
            const reportStart = reportGate ? new Date(Date.now() - (reportGate === 'waiting_for_tutor' ? 2 : 4) * 60000).toISOString() : start();
            return reply({ success: true, data: { startsAt: reportStart, lessonEndsAt: new Date(Date.parse(reportStart) + 25 * 60000).toISOString(),
              closesAt: new Date(Date.now() + (expired ? -1000 : 48 * 3600000)).toISOString(), serverNow: new Date().toISOString(), report,
              eligible: phase !== 'upcoming' && !report && !expired && (!reportGate || reportGate === 'missing_tutor'), reason: expired ? 'expired' : phase === 'upcoming' ? 'not_started' : reportGate === 'missing_tutor' ? null : reportGate } });
          }
          if (path.endsWith('/survey')) return reply({ success: true, data: { eligible: false, reason: phase === 'absent' ? 'absent' : 'closed', closesAt: new Date(Date.now() - 1000).toISOString(), survey: null, topics: [] } });
          if (path.startsWith('/schedule/lesson/')) return reply({ success: true, data: { bookingId: id, sessionId: id, tutorId: 'tutor-recap-test', tutorName: 'Test Tutor', tutorBio: 'Conversation and business English', startsAt: start(), slotDate: '2026-10-07', slotTime: '2:00 PM', durationMinutes: 25, status: phase === 'upcoming' ? 'confirmed' : 'completed', bookedAt: '2026-10-01T00:00:00Z' } });
          if (path.startsWith('/schedule/lesson-recap/')) {
            if (failRecap) { failRecap = false; return route.fulfill({ status: 503, json: { success: false } }); }
            return reply({ success: true, data: { startsAt: start(), canRequestMaterial: phase === 'upcoming', materialRequest: selected, studentAttendance: phase === 'absent' ? 'absent' : 'present',
              materials: phase === 'completed' ? [material('conversational-skills', 0), material('daily-dispatch', 1)] : [],
              studentComment: phase === 'completed' ? 'Hello! Keep practicing.\nYou expressed your ideas clearly.' : '', englishLevelAssessment: phase === 'completed' ? 4 : null,
              previousLessonId: 'previous-test', nextLessonId: 'next-test' } });
          }
          if (path.startsWith('/schedule/lesson-material-request/')) {
            if (req.method() === 'GET') return reply({ success: true, data: { canRequestMaterial: phase === 'upcoming', materialRequest: selected } });
            writes.push(req.postDataJSON());
            if (failSave) { failSave = false; return route.fulfill({ status: 503, json: { success: false, error: 'Your material request could not be saved.' } }); }
            const { courseId, materialId } = req.postDataJSON();
            selected = courseId ? { courseId, lessonId: materialId, title: titles[courseId], lessonNumber: 4, level: courseId === 'daily-dispatch' ? null : 3, chapter: courseId === 'daily-dispatch' ? null : 2, goal: 'Express your ideas clearly' } : null;
            return reply({ success: true, data: selected });
          }
          if (path.startsWith('/lesson-materials/published/')) return reply({ success: true, lessons: [{ id: `${path.split('/').pop()}-material`, lessonName: path.endsWith('business-english') ? 'Workplace introductions' : 'Introducing yourself', lessonNumber: 4, level: 3, chapter: 2, goalTextEn: 'Express your ideas clearly' }] });
          if (path === '/dispatch/classroom-library') return reply({ success: true, articles: [{ id: 'daily-dispatch-material', title: titles['daily-dispatch'], status: 'published', postedDate: '2026-01-01', createdAt: '2026-01-01T00:00:00Z', category: 'Science' }] });
          if (path === `/schedule/tutor-lesson/${id}`) return reply({ success: true, data: { bookingId: id, sessionId: id, studentId, slotDate: '2026-10-07', slotTime: '2:00 PM', durationMinutes: 25, status: 'confirmed' } });
          if (path === `/tutor/student/${studentId}`) return reply({ success: true, data: { id: studentId, givenName: 'Test', familyName: 'Student', country: 'Japan', joinDate: '2026-04-03', hobbies: [] } });
          if (path === `/tutor/student/${studentId}/lesson-request`) { assert.equal(url.searchParams.get('sessionId'), id); return reply({ success: true, data: selected }); }
          if (path.startsWith('/tutor/lesson-notes-edit-window/')) return reply({ success: true, data: { canEdit: false, reason: 'not_started', studentAttendance: null, editableUntil: new Date(Date.now() + 172800000).toISOString() } });
          if (path.startsWith('/tutor/lesson-notes/')) return reply({ success: true, data: [] });
          if (path === '/schedule/week') return reply({ success: true, data: { slots: [] } });
          if (path === '/notifications') return reply({ success: true, data: { notifications: [], unreadCount: 0 } });
          return reply({ success: true, data: [], user, profile: {}, lessons: [] });
        });
      }
      const page = await contexts[0].newPage(); page.on('pageerror', error => errors.push(error.message));
      const tutor = await contexts[1].newPage(); tutor.on('pageerror', error => errors.push(error.message));
      await page.goto(`${studentBase}/lesson/${id}`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Material request', exact: true }).waitFor();
      await page.getByRole('alert').filter({ hasText: 'Could not load your lesson recap.' }).waitFor();
      await page.getByRole('button', { name: 'Choose material', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Try again', exact: true }).click();
      await page.getByRole('heading', { name: 'Lesson recap', exact: true }).waitFor();
      assert(await page.getByRole('heading', { name: 'Material request', exact: true }).evaluate(element => Boolean(element.closest('.classroom-card'))), 'Material request is inside the Classroom card');
      assert.equal(await page.locator('.classroom-card .student-lesson-request').evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)', 'Material request shares the Classroom card surface in both themes');
      if (width > 600) assert((await page.getByRole('heading', { name: 'Material request', exact: true }).boundingBox()).y < 900, 'Material request is visible in the first desktop viewport');
      assert(await page.getByRole('button', { name: 'Report issue', exact: true }).isDisabled(), 'Reporting does not open before the lesson starts');
      const debugEntry = page.getByRole('button', { name: 'Debug Enter Classroom', exact: true });
      assert.equal(await debugEntry.count(), 0, 'Debug entry cannot bypass the five-minute classroom window');
      assert.equal(await page.getByRole('button', { name: 'Enter Classroom', exact: true }).count(), 0, 'Upcoming lessons cannot be entered too early');
      await page.getByText('The classroom will be available 5 minutes before your scheduled lesson time.', { exact: true }).waitFor();
      await page.locator('.classroom-card').screenshot({ path: `/tmp/student-classroom-request-${theme}-${width}.png` });
      const closedCardHeight = (await page.locator('.classroom-card').boundingBox()).height;
      await page.getByRole('button', { name: 'Choose material', exact: true }).click();
      const materialDialog = page.getByRole('dialog', { name: 'Select lesson material', exact: true });
      await materialDialog.waitFor();
      assert(Math.abs((await page.locator('.classroom-card').boundingBox()).height - closedCardHeight) < 1, 'Opening the library does not stretch the Classroom card');
      const libraryBounds = await materialDialog.boundingBox();
      assert(Math.abs(libraryBounds.x + libraryBounds.width / 2 - width / 2) < 2, 'Material library is centered horizontally');
      assert(Math.abs(libraryBounds.y + libraryBounds.height / 2 - 450) < 2, 'Material library is centered vertically');
      await page.keyboard.press('Escape');
      await materialDialog.waitFor({ state: 'hidden' });
      assert.equal(writes.length, 0, 'Closing the library does not save a request');
      await page.getByRole('button', { name: 'Choose material', exact: true }).click();
      await page.getByRole('combobox', { name: 'Level', exact: true }).selectOption('3');
      await page.getByRole('combobox', { name: 'Chapter', exact: true }).selectOption('2');
      await page.getByRole('combobox', { name: 'Lesson', exact: true }).selectOption('4');
      await materialDialog.screenshot({ path: `/tmp/student-material-library-${theme}-${width}.png` });
      assert(await materialDialog.evaluate(element => element.scrollWidth <= element.clientWidth), 'Library dialog does not overflow horizontally');
      const assertRequestButtonFits = async name => {
        const button = page.getByRole('button', { name, exact: true });
        await button.waitFor();
        assert(await button.evaluate(element => {
          const bounds = element.getBoundingClientRect();
          const icon = element.querySelector('i').getBoundingClientRect();
          const label = element.querySelector('span').getBoundingClientRect();
          return element.scrollWidth <= element.clientWidth && icon.left >= bounds.left + 10
            && label.right <= bounds.right - 10 && label.left >= icon.right + 6;
        }), 'Request label and icon fit within the button with balanced padding');
      };
      await assertRequestButtonFits(`Request lesson: ${titles['conversational-skills']}`);
      await page.locator('.student-request-library').screenshot({ path: `/tmp/student-request-library-${theme}-${width}.png` });
      failSave = true;
      await page.getByRole('button', { name: `Request lesson: ${titles['conversational-skills']}`, exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'could not be saved' }).waitFor(); assert.equal(selected, null);
      await page.getByRole('button', { name: `Request lesson: ${titles['conversational-skills']}`, exact: true }).click();
      await page.getByText('Material request saved for your tutor.', { exact: true }).waitFor();
      await page.reload({ waitUntil: 'domcontentloaded' });
      try { await page.locator('.student-request-selected strong').waitFor(); }
      catch (error) {
        await page.screenshot({ path: '/tmp/student-lesson-failure.png', fullPage: true });
        console.error({ selected, url: page.url(), errors, body: (await page.locator('body').textContent()).slice(0, 2000) });
        throw error;
      }
      assert.equal(await page.locator('.student-request-selected strong').textContent(), titles['conversational-skills']);
      await tutor.goto(`${tutorBase}/lesson/${id}`, { waitUntil: 'domcontentloaded' });
      await tutor.locator('.lesson-advance-material-request strong').waitFor();
      assert.equal(await tutor.locator('.lesson-advance-material-request strong').textContent(), titles['conversational-skills']);
      assert.match(await tutor.locator('.lesson-advance-material-request').textContent(), /Level 3.*Chapter 2/);
      for (const course of ['business-english', 'daily-dispatch']) {
        await page.getByRole('button', { name: 'Change material', exact: true }).click();
        await page.getByRole('combobox', { name: 'Course', exact: true }).selectOption(course);
        await assertRequestButtonFits(`${course === 'daily-dispatch' ? 'Request article' : 'Request lesson'}: ${titles[course]}`);
        await page.getByRole('button', { name: `${course === 'daily-dispatch' ? 'Request article' : 'Request lesson'}: ${titles[course]}`, exact: true }).click();
        await page.getByText('Material request saved for your tutor.', { exact: true }).waitFor();
        await tutor.getByRole('button', { name: 'Refresh material request', exact: true }).click();
        await tutor.getByText(titles[course], { exact: true }).waitFor();
      }
      await page.getByRole('button', { name: 'Clear material request', exact: true }).click();
      await page.getByText('Material request cleared.', { exact: true }).waitFor(); assert.equal(selected, null);
      phase = 'completed'; await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.getByText('Hello! Keep practicing.', { exact: false }).waitFor();
      assert.equal(await page.locator('.student-material-recap').count(), 2);
      assert.equal(await page.locator('.student-note-card').count(), 4, 'Each material, the assessment, and student feedback have separate cards');
      assert.equal(await page.locator('.student-note-card .student-note-card').count(), 0, 'Note cards are not nested');
      assert(await page.locator('.student-material-recap').first().evaluate(element => {
        const style = getComputedStyle(element);
        return style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.borderTopWidth === '1px' && style.borderRadius === '8px';
      }), 'Material notes have a distinct card surface and border');
      assert(await page.locator('.student-note-card').evaluateAll(elements => elements.every(element => getComputedStyle(element).backgroundColor === getComputedStyle(elements[0]).backgroundColor)), 'All note cards use the same themed surface');
      assert(await page.locator('.student-material-recap .student-recap-section').evaluateAll(elements => elements.every(element => getComputedStyle(element).backgroundColor === 'rgba(0, 0, 0, 0)')), 'Sections inside a material are unframed');
      const firstMaterialBounds = await page.locator('.student-material-recap').nth(0).boundingBox();
      const secondMaterialBounds = await page.locator('.student-material-recap').nth(1).boundingBox();
      assert(secondMaterialBounds.y - (firstMaterialBounds.y + firstMaterialBounds.height) >= 19, 'Materials have a visible gap between their note cards');
      const vocabularyBounds = await page.locator('.student-material-vocabulary-group').first().boundingBox();
      const practiceBounds = await page.locator('.student-material-practice-group').first().boundingBox();
      if (width > 900) assert(practiceBounds.x >= vocabularyBounds.x + vocabularyBounds.width + 20, 'Learning sections use separate desktop columns');
      else assert(practiceBounds.y >= vocabularyBounds.y + vocabularyBounds.height + 20, 'Learning sections stack on mobile');
      assert.equal(await page.locator('.student-material-recap ol li').first().evaluate(element => getComputedStyle(element).listStyleType), 'decimal');
      await page.locator('.student-material-recap').first().screenshot({ path: `/tmp/student-material-note-card-${theme}-${width}.png` });
      await page.locator('.student-shared-note-grid').screenshot({ path: `/tmp/student-shared-note-cards-${theme}-${width}.png` });
      assert.match(await page.locator('.student-material-recap').first().textContent(), /Part 3 - Step A.*Question 2/);
      assert.match(await page.locator('.student-material-recap').first().textContent(), /furontia/);
      assert.equal(await page.getByRole('heading', { name: 'Vocabulary', exact: true }).count(), 2);
      assert.equal(await page.getByRole('heading', { name: 'Grammar', exact: true }).count(), 2);
      assert.equal(await page.getByRole('heading', { name: 'Pronunciation', exact: true }).count(), 2);
      assert.match(await page.locator('.student-lesson-recap:not(.student-lesson-advance-request)').textContent(), /Level 4 - Short conversations/);
      assert.equal(await page.getByRole('button', { name: 'Choose material', exact: true }).count(), 0);
      const issueButton = page.getByRole('button', { name: 'Report issue', exact: true });
      reportGate = 'waiting_for_tutor';
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.getByText('Reporting opens if the tutor has not joined after three minutes, or has been disconnected for 60 seconds during the lesson.', { exact: true }).waitFor();
      assert(await issueButton.isDisabled(), 'Reporting is disabled in the first three minutes');
      reportGate = 'tutor_joined';
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.getByText('The tutor is in the classroom. Reporting opens if they disconnect for 60 seconds, or after the lesson ends for up to 48 hours.', { exact: true }).waitFor();
      assert(await issueButton.isDisabled(), 'Reporting during a lesson is disabled after the tutor joins');
      reportGate = 'missing_tutor';
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.waitForFunction(() => !document.querySelector('.student-report-issue-button')?.disabled);
      await issueButton.click();
      const ongoingDialog = page.getByRole('dialog', { name: 'Report a lesson issue', exact: true });
      await ongoingDialog.getByRole('button', { name: '10 minutes or less', exact: true }).click();
      await ongoingDialog.getByRole('radio', { name: 'Tutor-related issue', exact: true }).check();
      await ongoingDialog.getByRole('button', { name: 'Next', exact: true }).click();
      assert.equal(await ongoingDialog.getByRole('radio').count(), 1, 'Only the missing-tutor subtype is offered during the lesson');
      await ongoingDialog.getByRole('radio', { name: 'Tutor did not join the classroom', exact: true }).check();
      assert(await ongoingDialog.getByRole('button', { name: 'Submit report', exact: true }).isEnabled());
      reportGate = 'tutor_joined';
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await ongoingDialog.getByRole('alert').filter({ hasText: 'The tutor is in the classroom.' }).waitFor();
      assert(await ongoingDialog.getByRole('button', { name: 'Submit report', exact: true }).isDisabled(), 'Tutor arrival disables an already-open report');
      await ongoingDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.equal(report, null);
      reportGate = null;
      await page.waitForFunction(() => !document.querySelector('.student-report-issue-button')?.disabled, {}, { timeout: 15000 });
      await issueButton.click();
      const reportDialog = page.getByRole('dialog', { name: 'Report a lesson issue', exact: true });
      await reportDialog.getByRole('button', { name: '10 minutes or less', exact: true }).click();
      assert(await reportDialog.getByRole('button', { name: 'Submit report', exact: true }).isDisabled());
      await reportDialog.getByRole('radio', { name: 'Audio or microphone problem', exact: true }).check();
      await reportDialog.getByRole('textbox', { name: 'Additional details (optional)', exact: true }).fill('Audio cut out during practice.');
      failReport = true; await reportDialog.getByRole('button', { name: 'Submit report', exact: true }).click();
      await reportDialog.getByRole('alert').filter({ hasText: 'could not be submitted' }).waitFor();
      assert.equal(await reportDialog.getByRole('textbox').inputValue(), 'Audio cut out during practice.');
      const dialogBounds = await reportDialog.boundingBox();
      assert(Math.abs(dialogBounds.x + dialogBounds.width / 2 - width / 2) < 2, 'Report modal is centered horizontally');
      assert(Math.abs(dialogBounds.y + dialogBounds.height / 2 - 450) < 2, 'Report modal is centered vertically');
      assert(await reportDialog.evaluate(element => element.scrollWidth <= element.clientWidth));
      const submitBounds = await reportDialog.getByRole('button', { name: 'Submit report', exact: true }).boundingBox();
      assert(submitBounds.y >= dialogBounds.y && submitBounds.y + submitBounds.height <= dialogBounds.y + dialogBounds.height, 'Submit stays visible without scrolling the dialog');
      await reportDialog.screenshot({ path: `/tmp/student-issue-report-${theme}-${width}.png` });
      await reportDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.equal(report, null, 'Cancel does not submit an issue report');
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: `/tmp/student-lesson-recap-${theme}-${width}.png`, fullPage: true });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'No horizontal page overflow');
      if (width === 375) assert((await page.locator('.student-lesson-recap:not(.student-lesson-advance-request)').boundingBox()).width >= 300, 'Mobile recap uses the available page width');
      await page.getByRole('link', { name: 'Previous lesson', exact: true }).click(); await page.waitForURL('**/lesson/previous-test', { waitUntil: 'domcontentloaded' });
      await page.goBack({ waitUntil: 'domcontentloaded' }); await page.waitForURL(`**/lesson/${id}`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Lesson recap', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Debug Enter Classroom', exact: true }).count(), 0, 'Finished lessons have no debug entry');
      await page.getByRole('button', { name: 'Report issue', exact: true }).click();
      await reportDialog.getByRole('button', { name: 'More than 10 minutes', exact: true }).click();
      await reportDialog.getByRole('radio', { name: 'Tutor-related issue', exact: true }).check();
      assert.equal(await reportDialog.getByRole('button', { name: 'Submit report', exact: true }).count(), 0, 'Tutor reports cannot skip the third step');
      await reportDialog.getByRole('button', { name: 'Next', exact: true }).click();
      await reportDialog.getByText('Step 3 of 3', { exact: true }).waitFor();
      assert.equal(await reportDialog.getByRole('radio').count(), 9, 'All tutor issue choices are offered after the lesson');
      assert(await reportDialog.getByRole('button', { name: 'Submit report', exact: true }).isDisabled());
      await reportDialog.getByRole('radio', { name: 'Other tutor-related issue', exact: true }).check();
      const tutorDetails = reportDialog.getByRole('textbox', { name: 'Additional details (required)', exact: true });
      await tutorDetails.fill('   ');
      assert(await reportDialog.getByRole('button', { name: 'Submit report', exact: true }).isDisabled(), 'Other requires a non-whitespace explanation');
      await tutorDetails.fill('The tutor-related issue needs further review.');
      await reportDialog.getByRole('button', { name: 'Back', exact: true }).click();
      assert(await reportDialog.getByRole('radio', { name: 'Tutor-related issue', exact: true }).isChecked(), 'Back retains the category');
      await reportDialog.getByRole('button', { name: 'Next', exact: true }).click();
      assert(await reportDialog.getByRole('radio', { name: 'Other tutor-related issue', exact: true }).isChecked(), 'Back retains the subtype');
      assert.equal(await tutorDetails.inputValue(), 'The tutor-related issue needs further review.');
      assert.equal(report, null, 'Next never submits a report, even when the third-step fields are already valid');
      await reportDialog.getByRole('radio', { name: 'Tutor joined late', exact: true }).check();
      assert(await reportDialog.getByRole('textbox', { name: 'Additional details (optional)', exact: true }).isVisible());
      await reportDialog.getByRole('radio', { name: 'Other tutor-related issue', exact: true }).check();
      assert(await reportDialog.evaluate(element => element.scrollWidth <= element.clientWidth), 'Third step has no horizontal overflow');
      await reportDialog.screenshot({ path: `/tmp/student-tutor-issue-${theme}-${width}.png` });
      await reportDialog.getByRole('button', { name: 'Submit report', exact: true }).click();
      await page.getByText('Your issue report has been submitted.', { exact: true }).waitFor();
      assert.equal(report.tutorIssue, 'other');
      await page.getByText('Other tutor-related issue', { exact: true }).waitFor();
      assert(await page.getByRole('button', { name: 'Issue reported', exact: true }).isDisabled());
      await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByText('Your issue report has been submitted.', { exact: true }).waitFor();
      failRecap = true; await page.getByRole('button', { name: 'Refresh lesson recap', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Could not load your lesson recap.' }).waitFor();
      assert.equal(await page.locator('.student-material-recap').count(), 2, 'Refresh failure retains the recap');
      await page.getByRole('button', { name: 'Try again', exact: true }).click();
      phase = 'pending'; await page.getByRole('button', { name: 'Refresh lesson recap', exact: true }).click();
      await page.getByText('Your tutor is preparing your lesson feedback.', { exact: true }).waitFor();
      assert.equal(await page.locator('.student-note-card').count(), 1, 'A pending lesson shows only its feedback card');
      phase = 'absent'; await page.getByRole('button', { name: 'Refresh lesson recap', exact: true }).click();
      await page.getByText('You were marked absent. No lesson notes are required.', { exact: true }).waitFor();
      report = null; expired = true; await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.getByText('The 48-hour reporting window has closed.', { exact: true }).waitFor();
      assert(await page.getByRole('button', { name: 'Report issue', exact: true }).isDisabled());
      assert.equal(await page.locator('.student-material-recap').count(), 0);
      assert.equal(await page.locator('.student-note-card').count(), 0, 'Absent lessons do not show stale note cards');
      assert.equal(await page.getByRole('heading', { name: 'Student feedback', exact: true }).count(), 0);
      assert.deepEqual(errors, []); assert.equal(writes.length, 5);
      console.log(`PASS ${theme} ${width}: advance requests, tutor visibility, filters, retry, persistence, recap, private-field exclusion, absence, and navigation`);
      for (const context of contexts) await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
