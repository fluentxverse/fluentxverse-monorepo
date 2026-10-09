// Run against the tutor app on port 5173. API fixtures never write to the real database.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.TUTOR_TEST_URL || 'http://localhost:5173';
const sessionId = 'multi-material-notes-test';
const validFeedback = text => text.padEnd(100, '.');
const sectionIcons = {
  'Words and phrases learned in this lesson': 'fi fi-sr-book-alt',
  'Vocabulary': 'fi fi-sr-book-alt',
  'Grammar': 'fi fi-sr-text',
  'Pronunciation': 'fi fi-sr-microphone',
  'Student feedback': 'fas fa-comment-dots',
  'Tutor handoff': 'fas fa-sticky-note',
};
const materials = [
  { id: 'dispatch-one', courseId: 'daily-dispatch', title: 'Exploring space', category: 'Science' },
  { id: 'dispatch-two', courseId: 'daily-dispatch', title: 'Ocean discovery', category: 'Science' },
  { id: 'conversation-one', courseId: 'conversational-skills', title: 'Introducing yourself', level: 3, chapter: 1, lessonNumber: 1 },
];

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  try {
    for (const theme of (process.env.NOTES_TEST_THEMES?.split(',') || ['light', 'dark'])) for (const width of (process.env.NOTES_TEST_WIDTHS?.split(',').map(Number) || [1566, 375])) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, permissions: ['camera', 'microphone'] });
      await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme }, version: 2 })), theme);
      const legacy = { id: 'business-existing', sessionId, tutorId: 'tutor-notes-test', materialId: 'business-existing', materialType: 'business-english', materialTitle: 'Workplace introductions', courseId: 'business-english', lessonId: 'business-existing', vocabularyItems: [{ word: 'colleague', definitions: [], selectedDefinitionIndex: 0 }], grammarItems: [], pronunciationItems: [], isUsed: true, completionStatus: 'in_progress', stoppedAt: 'feedback', stoppedAtLabel: 'Part 6 - Wrap-up', progressDetails: 'Old stopping point', studentComment: 'Legacy feedback', tutorMemo: 'Legacy handoff', createdAt: '2026-10-06T05:00:00Z', updatedAt: '2026-10-06T05:01:00Z' };
      const saved = new Map([['business-english:business-existing', legacy]]);
      const materialMetadata = note => note.materialType === 'conversational-skills'
        ? { ...note, materialLevel: 3, materialChapter: 1 } : note;
      await context.addInitScript(({ sessionId, legacy }) => {
        const key = `fxv-tutor-classroom-notes:${sessionId}:business-english:business-existing`;
        if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ ...legacy, studentComment: 'Recovered local feedback', updatedAt: Date.now() }));
      }, { sessionId, legacy });
      let summary = { studentComment: '', tutorMemo: '', englishLevelAssessment: null, updatedAt: null };
      let failSummarySave = false;
      let summarySaveFailed = false;
      let definitionStarted;
      const definitionRequested = new Promise(resolve => { definitionStarted = resolve; });
      const requests = [];
      let editingClosed = false;
      let studentAttendance = 'present';
      let failAttendanceSave = false;
      await context.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(localhost|127\.0\.0\.1):8765)\//, async route => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname;
        const reply = json => route.fulfill({ json });
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
        const user = { userId: 'tutor-notes-test', role: 'tutor', firstName: 'Test', email: 'paulanthonyarriola@gmail.com' };
        if (path.endsWith('/socket-token')) return reply({ success: true, token: 'test-token' });
        if (path === '/tutor/me') return reply({ success: true, user });
        if (path === '/notifications') return reply({ success: true, data: { notifications: [], unreadCount: 0 } });
        if (path === '/notifications/unread-count') return reply({ success: true, data: { unreadCount: 0 } });
        if (path === '/schedule/week') return reply({ success: true, data: { slots: [], weekStart: '2026-10-05', weekEnd: '2026-10-11' } });
        if (path.endsWith('/continuations')) return reply({ success: true, data: [] });
        if (path === `/lesson-workflow/tutor/${sessionId}`) return reply({ success: true, data: {
          studentAttendance, attendanceVerified: studentAttendance === 'present', outcome: studentAttendance === 'absent' ? 'student_absent' : 'attended', notesStatus: studentAttendance === 'absent' ? 'not_required' : 'draft',
          startsAt: new Date(Date.now() - 60 * 60_000).toISOString(), endsAt: new Date(Date.now() - 35 * 60_000).toISOString(),
          editableUntil: new Date(Date.now() + (editingClosed ? -1000 : 47 * 60 * 60_000)).toISOString(), serverNow: new Date().toISOString(), canEdit: !editingClosed, closed: editingClosed,
        } });
        if (path === `/tutor/lesson-notes-edit-window/${sessionId}`) return reply({ success: true, data: {
          studentAttendance,
          startsAt: new Date(Date.now() - 60 * 60_000).toISOString(), endsAt: new Date(Date.now() - 35 * 60_000).toISOString(),
          editableUntil: new Date(Date.now() + (editingClosed ? -1000 : 47 * 60 * 60_000)).toISOString(), serverNow: new Date().toISOString(), canEdit: !editingClosed, reason: editingClosed ? 'expired' : null,
        } });
        if (path === `/tutor/lesson-student-attendance/${sessionId}`) {
          const body = request.postDataJSON();
          requests.push({ kind: 'attendance', body });
          if (failAttendanceSave) {
            failAttendanceSave = false;
            return route.fulfill({ status: 503, json: { success: false, error: 'Attendance could not be saved. No notes were deleted.' } });
          }
          studentAttendance = body.status;
          if (body.status === 'absent') {
            saved.clear();
            summary = { studentComment: '', tutorMemo: '', englishLevelAssessment: null, updatedAt: null };
          }
          return reply({ success: true });
        }
        if (path === `/tutor/classroom-material-progress/${sessionId}`) {
          const conversational = url.searchParams.get('materialType') === 'conversational-skills';
          return reply({ success: true, data: { sections: conversational ? [
            { id: 'learn', label: 'Part 2 - Learn' },
            { id: 'exerciseData.stepA', label: 'Part 4 - Exercise - Step A' },
            { id: 'exerciseData.stepB', label: 'Part 4 - Exercise - Step B' },
          ] : [{ id: 'practice.steps.0', label: 'Part 4 - Drill - Step A' }, { id: 'challenge', label: 'Part 5 - Simulation' }],
          previous: conversational ? { sessionId: 'previous-lesson', startsAt: '2026-10-05T05:00:00Z', completionStatus: 'in_progress', stoppedAt: 'exerciseData.stepA', stoppedAtLabel: 'Part 4 - Exercise - Step A', progressDetails: 'Question 2' } : null } });
        }
        if (path === `/tutor/classroom-lesson-notes/${sessionId}`) {
          if (request.method() === 'PUT') {
            const body = request.postDataJSON();
            requests.push({ kind: 'summary', body });
            if (failSummarySave) {
              failSummarySave = false;
              summarySaveFailed = true;
              return route.fulfill({ status: 503, json: { success: false } });
            }
            summary = { ...summary, studentComment: body.studentComment, tutorMemo: body.tutorMemo,
              ...(body.englishLevelAssessment !== undefined ? { englishLevelAssessment: body.englishLevelAssessment } : {}), updatedAt: new Date().toISOString() };
            return reply({ success: true });
          }
          return reply({ success: true, data: { ...summary, studentAttendance, materials: [...saved.values()].filter(note => note.isUsed).map(materialMetadata) } });
        }
        if (path === `/tutor/classroom-notes/${sessionId}`) {
          if (request.method() === 'PUT') {
            const body = request.postDataJSON();
            requests.push({ kind: 'material', body });
            assert.equal(body.studentComment, undefined, 'Material saves do not duplicate lesson feedback');
            assert.equal(body.tutorMemo, undefined, 'Material saves do not duplicate the handoff');
            const key = `${body.materialType}:${body.materialId}`;
            await new Promise(resolve => setTimeout(resolve, 80));
            const isUsed = Boolean(body.isUsed || saved.get(key)?.isUsed || body.vocabularyItems.some(item => item.word.trim()) || body.grammarItems.some(item => item.youSaid.trim() || item.correct.trim()) || body.pronunciationItems.some(item => item.word.trim() || item.phonetic.trim()));
            const note = { ...body, stoppedAtLabel: body.stoppedAt === 'exerciseData.stepB' ? 'Part 4 - Exercise - Step B' : null, id: key, sessionId, tutorId: user.userId, isUsed, studentComment: '', tutorMemo: '', createdAt: saved.get(key)?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
            saved.set(key, note);
            return reply({ success: true, data: note });
          }
          return reply({ success: true, data: saved.get(`${url.searchParams.get('materialType')}:${url.searchParams.get('materialId')}`) || null });
        }
        if (path === '/ai/vocabulary-definition') {
          definitionStarted();
          await new Promise(resolve => setTimeout(resolve, 1200));
          return reply({ definitions: [{ meaning: 'Definition belonging to the first material', partOfSpeech: 'noun' }] });
        }
        if (path === '/ai/grammar-check') return reply({ corrected: 'I live in Tokyo', simpleExplanation: 'Use the present simple.', technicalExplanation: 'The verb agrees with the subject.' });
        if (path === '/ai/pronunciation') return reply({ phonetic: 'GREE-ting' });
        if (path === '/dispatch/classroom-library') return reply({ success: true, articles: [{ id: 'dispatch-extra', title: 'A third article', status: 'published' }] });
        if (path === `/tutor/lesson-notes/${sessionId}`) return reply({ success: true, data: [{ sessionId, studentAttendance, startsAt: '2026-10-06T05:00:00Z', tutorName: 'Test Tutor', notes: [...saved.values()].filter(note => note.isUsed).map(materialMetadata), ...summary }] });
        if (path === `/schedule/tutor-lesson/${sessionId}`) return reply({ success: true, data: { bookingId: sessionId, sessionId, studentId: 'student-notes-test', slotDate: '2026-10-06', slotTime: '1:00 PM', durationMinutes: 25, status: 'completed' } });
        if (path === '/tutor/student/student-notes-test') return reply({ success: true, data: { id: 'student-notes-test', givenName: 'Test', familyName: 'Student', country: 'Japan', joinDate: '2026-04-03', totalLessons: 4, hobbies: [] } });
        if (path.endsWith('/trouble-report')) return reply({ success: true, data: { serverNow: new Date().toISOString(), startsAt: '2026-10-06T05:00:00Z', endsAt: '2026-10-06T05:25:00Z', report: null } });
        return reply({ success: true, data: [], user, profile: {}, lessons: [], articles: [], archives: [] });
      });
      await context.route('**/materials/**', route => route.request().resourceType() === 'document'
        ? route.fulfill({ contentType: 'text/html', body: '<!doctype html><body style="background:#242424;color:#fff">Test material</body>' }) : route.continue());
      await context.routeWebSocket('**/socket.io/**', ws => {
        ws.onMessage(message => {
          const raw = String(message);
          if (raw.startsWith('40')) return ws.send('40{"sid":"notes-socket"}');
          const match = raw.match(/^42(\d*)(\[.*\])$/);
          if (!match) return;
          const [event] = JSON.parse(match[2]);
          if (event === 'session:join') {
            ws.send('42' + JSON.stringify(['session:state', { sessionId, status: 'waiting', participants: { tutorId: 'tutor-notes-test' } }]));
            ws.send('42' + JSON.stringify(['chat:history', materials.map(material => ({ id: material.id, sessionId, senderId: 'student-notes-test', senderType: 'student', text: '', timestamp: new Date().toISOString(), material }))]));
          }
          if (event === 'webrtc:ice-config' && match[1]) ws.send(`43${match[1]}[{"iceServers":[]}]`);
        });
        ws.send('0{"sid":"notes-engine","upgrades":[],"pingInterval":9000000,"pingTimeout":9000000,"maxPayload":1000000}');
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && message.text().includes('Error')) console.log(message.text()); });
      page.setDefaultTimeout(10000);
      const openMaterial = async index => {
        const reopen = width < 640 && await page.locator('.dispatch-notes-widget').count() > 0;
        if (reopen) await page.locator('.dispatch-notes-close').click();
        const message = page.locator('.chat-material-share').filter({ hasText: materials[index].title });
        await message.getByRole('button', { name: 'Open Material', exact: true }).click();
        if (reopen) await page.getByTitle('Lesson notes', { exact: true }).click();
      };
      await page.goto(`${base}/classroom/${sessionId}`);
      await openMaterial(0);
      await page.getByTitle('Lesson notes', { exact: true }).click();
      const widget = page.locator('.dispatch-notes-widget');
      for (const [label, icon] of Object.entries(sectionIcons)) {
        if (label === 'Vocabulary') continue;
        assert.equal(await widget.locator('.dispatch-notes-label').filter({ hasText: label }).locator('i').first().getAttribute('class'), icon, `${label} uses the shared widget icon`);
      }
      const word = widget.locator('.vocabulary-word-input').first();
      await word.waitFor();
      await page.waitForFunction(() => !document.querySelector('.lesson-material-note-fields')?.disabled);
      assert.equal(await widget.locator('.lesson-material-completed').textContent(), 'Completed');
      assert.equal(await widget.locator('#material-stopped-at').count(), 0, 'Daily Dispatch has no stopping-point controls');
      assert.equal(await widget.getByPlaceholder('Feedback the student can review after this lesson...').inputValue(), 'Recovered local feedback', 'Legacy local feedback is migrated without losing it');
      await word.fill('frontier');
      await widget.getByTitle('Get definition', { exact: true }).click();
      await definitionRequested;
      await openMaterial(1);
      await page.waitForFunction(() => document.querySelector('#notes-material')?.value === 'daily-dispatch:dispatch-two' && !document.querySelector('.lesson-material-note-fields')?.disabled);
      assert.equal(await word.inputValue(), '');
      await widget.getByRole('button', { name: 'Use in lesson', exact: true }).click();
      await widget.getByRole('button', { name: 'Used in this lesson', exact: true }).waitFor();
      await page.waitForTimeout(1300);
      assert.equal(await widget.locator('.vocabulary-meaning').count(), 0, 'An AI response from a previous material cannot populate this material');
      await openMaterial(2);
      await page.waitForFunction(() => document.querySelector('#notes-material')?.value === 'conversational-skills:conversation-one' && !document.querySelector('.lesson-material-note-fields')?.disabled);
      assert.equal(await widget.locator('#material-stopped-at').inputValue(), 'exerciseData.stepA', 'New lessons inherit the previous stopping point without copying learning notes');
      assert.equal(await widget.locator('#material-progress-details').inputValue(), 'Question 2');
      assert.equal(await word.inputValue(), '');
      await widget.locator('#material-stopped-at').selectOption('exerciseData.stepB');
      await widget.locator('#material-progress-details').fill('Stopped after question 4');
      const stoppingPointColors = await widget.locator('#material-stopped-at').evaluate(el => ({ bg: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color }));
      assert.equal(stoppingPointColors.bg, theme === 'dark' ? 'rgb(48, 48, 48)' : 'rgb(255, 255, 255)');
      await word.fill('greeting');
      const feedback = widget.getByPlaceholder('Feedback the student can review after this lesson...');
      const handoff = widget.getByPlaceholder('Notes for the next tutor (not shared with the student)...');
      const summaryWrites = requests.filter(request => request.kind === 'summary').length;
      await feedback.fill('a'.repeat(99));
      await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      await page.waitForTimeout(900);
      assert.equal(requests.filter(request => request.kind === 'summary').length, summaryWrites, 'Short feedback remains a local draft, including exit flushes');
      assert.equal(await page.evaluate(sessionId => JSON.parse(localStorage.getItem(`fxv-tutor-classroom-summary:${sessionId}`)).studentComment.length, sessionId), 99);
      await handoff.fill('b'.repeat(151));
      assert.equal((await handoff.inputValue()).length, 150, 'Handoff input is capped at 150 characters');
      failSummarySave = true;
      await feedback.fill(validFeedback('Good progress across both topics.'));
      await handoff.fill('Continue with introductions next time.');
      await widget.locator('#notes-material').selectOption('daily-dispatch:dispatch-one');
      await page.waitForFunction(() => !document.querySelector('.lesson-material-note-fields')?.disabled);
      assert.equal(await word.inputValue(), 'frontier');
      assert.equal(await feedback.inputValue(), validFeedback('Good progress across both topics.'));
      assert.equal(await handoff.inputValue(), 'Continue with introductions next time.');
      assert.match(await page.locator('.material-tab-label').last().textContent(), /Introducing yourself/);
      await word.fill('frontier revised');
      await widget.locator('#notes-material').selectOption('conversational-skills:conversation-one');
      await page.waitForFunction(() => !document.querySelector('.lesson-material-note-fields')?.disabled);
      assert.equal(await word.inputValue(), 'greeting', 'Rapid switching keeps per-material edits independent');
      await page.waitForTimeout(1000);
      assert.equal(saved.get('daily-dispatch:dispatch-one').vocabularyItems[0].word, 'frontier revised');
      assert.equal(saved.get('conversational-skills:conversation-one').vocabularyItems[0].word, 'greeting');
      assert.equal(saved.get('conversational-skills:conversation-one').completionStatus, 'in_progress');
      assert.equal(saved.get('conversational-skills:conversation-one').stoppedAt, 'exerciseData.stepB');
      assert.equal(saved.get('conversational-skills:conversation-one').progressDetails, 'Stopped after question 4');
      assert.equal([...saved.values()].filter(note => note.isUsed).length, 4);
      assert(summarySaveFailed, 'The fixture exercises a failed summary save');
      await widget.getByRole('button', { name: 'Retry saving lesson feedback', exact: true }).click();
      await page.waitForTimeout(1000);
      assert.equal(summary.studentComment, validFeedback('Good progress across both topics.'));
      await widget.locator('#notes-material').selectOption('business-english:business-existing');
      await page.waitForFunction(() => !document.querySelector('.lesson-material-note-fields')?.disabled);
      assert.equal(await word.inputValue(), 'colleague');
      assert.equal(await widget.locator('#material-stopped-at').inputValue(), '', 'A legacy Wrap-up selection is not restored');
      assert.doesNotMatch(await widget.locator('#material-stopped-at').textContent(), /Open talk|Wrap-up/i);
      assert.match(await widget.locator('#material-stopped-at').textContent(), /Simulation/);
      await widget.locator('#material-stopped-at').selectOption('practice.steps.0');
      await widget.locator('#material-progress-details').fill('Finished the first drill');
      await widget.getByRole('button', { name: 'Completed', exact: true }).click();
      assert.equal(await widget.locator('#material-stopped-at').count(), 0, 'Completing a material removes resume fields');
      await widget.screenshot({ path: `/tmp/multi-material-business-widget-${theme}-${width}.png` });
      assert(await widget.evaluate(el => el.scrollWidth <= el.clientWidth));
      await widget.locator('#notes-material').selectOption('conversational-skills:conversation-one');
      await page.waitForFunction(() => !document.querySelector('.lesson-material-note-fields')?.disabled);
      await page.reload();
      await page.getByTitle('Lesson notes', { exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('.lesson-material-note-fields')?.disabled);
      assert.equal(await widget.locator('#notes-material option').count(), 4);
      assert.equal(await widget.locator('#material-stopped-at').inputValue(), 'exerciseData.stepB');
      assert.equal(await widget.locator('#material-progress-details').inputValue(), 'Stopped after question 4');
      assert.equal(saved.get('business-english:business-existing').completionStatus, 'completed');
      assert.equal(saved.get('business-english:business-existing').stoppedAt, null);
      assert.equal(saved.get('business-english:business-existing').progressDetails, '');
      const oldProgress = { ...saved.get('conversational-skills:conversation-one'), stoppedAt: 'missionData', stoppedAtLabel: 'Part 5 - Mission', progressDetails: 'Old stopping point' };
      saved.set('conversational-skills:conversation-one', oldProgress);
      await page.addInitScript(({ sessionId, note }) => localStorage.setItem(`fxv-tutor-classroom-notes:${sessionId}:conversational-skills:conversation-one`, JSON.stringify({ ...note, updatedAt: Date.now() + 1000 })), { sessionId, note: oldProgress });
      await page.reload();
      await page.getByTitle('Lesson notes', { exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('.lesson-material-note-fields')?.disabled);
      assert.equal(await widget.locator('#material-stopped-at').inputValue(), '', 'A legacy Part 5 selection is not restored');
      assert.doesNotMatch(await widget.locator('#material-stopped-at').textContent(), /Part [56]\b/, 'Neither fresh nor retained options offer Parts 5 and 6');
      await widget.locator('#material-stopped-at').selectOption('exerciseData.stepB');
      await widget.locator('#material-progress-details').fill('Stopped after question 4');
      assert.equal(await feedback.inputValue(), validFeedback('Good progress across both topics.'));
      await widget.screenshot({ path: `/tmp/multi-material-widget-${theme}-${width}.png` });
      assert(await widget.evaluate(el => el.scrollWidth <= el.clientWidth), 'Widget has no horizontal overflow');
      await word.fill('greeting final');
      await feedback.fill(validFeedback('Good progress across all materials.'));
      await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      await page.waitForTimeout(200);
      assert.equal(saved.get('conversational-skills:conversation-one').vocabularyItems[0].word, 'greeting final', 'Exit flush saves edits before the debounce');
      assert.equal(summary.studentComment, validFeedback('Good progress across all materials.'));
      await page.goto(`${base}/lesson/${sessionId}`);
      const card = page.locator('.lesson-notes-card');
      try { await card.locator('.lesson-material-notes').first().waitFor(); } catch (error) {
        console.log({ url: page.url(), text: (await page.locator('body').textContent()).slice(-2500), errors });
        await page.screenshot({ path: '/tmp/multi-material-failure.png' });
        throw error;
      }
      assert.equal(await card.locator('.lesson-material-notes').count(), 4);
      assert.equal(await card.locator('.lesson-materials-used li').count(), 4);
      assert.equal(await card.getByRole('heading', { name: 'Student feedback', exact: true }).count(), 1);
      assert.equal(await card.getByRole('heading', { name: 'Tutor handoff', exact: true }).count(), 1);
      assert.equal(await card.getByText(validFeedback('Good progress across all materials.'), { exact: true }).count(), 1);
      assert.equal(await card.getByText('No learning notes recorded for this material yet.', { exact: true }).count(), 1);
      assert.match(await card.textContent(), /frontier revised/);
      assert.match(await card.textContent(), /greeting/);
      const conversationNotes = card.locator('.lesson-material-notes').filter({ hasText: 'Introducing yourself' });
      assert.match(await conversationNotes.textContent(), /In progress/);
      assert.match(await conversationNotes.locator('.lesson-notes-material').textContent(), /Level 3.*Chapter 1/);
      assert.match(await card.locator('.lesson-materials-used li').filter({ hasText: 'Introducing yourself' }).textContent(), /Level 3.*Chapter 1/);
      assert.match(await conversationNotes.textContent(), /Part 4 - Exercise - Step B/);
      assert.match(await conversationNotes.textContent(), /Stopped after question 4/);
      const businessNotes = card.locator('.lesson-material-notes').filter({ hasText: 'Workplace introductions' });
      assert.match(await businessNotes.textContent(), /Completed/);
      assert.doesNotMatch(await businessNotes.textContent(), /Stopped at/);
      for (const tab of ['Recent Lessons', 'My Notes', 'First Two Entries', 'This Lesson']) {
        await card.getByRole('tab', { name: tab, exact: true }).click();
        await conversationNotes.waitFor();
        assert.match(await conversationNotes.textContent(), /Part 4 - Exercise - Step B/);
        assert.match(await conversationNotes.locator('.lesson-notes-material').textContent(), /Level 3.*Chapter 1/, `${tab} includes curriculum position`);
        for (const [label, icon] of Object.entries(sectionIcons)) {
          const headings = card.getByRole('heading', { name: label, exact: true });
          for (const heading of await headings.all()) assert.equal(await heading.locator('i').getAttribute('class'), icon, `${label} matches the widget in ${tab}`);
        }
      }
      await card.scrollIntoViewIfNeeded();
      await card.screenshot({ path: `/tmp/multi-material-lesson-${theme}-${width}.png` });
      assert(await card.evaluate(el => el.scrollWidth <= el.clientWidth));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await card.getByRole('button', { name: 'Edit notes', exact: true }).click();
      const editor = page.getByRole('dialog', { name: 'Edit lesson notes' });
      await editor.getByLabel('Material used', { exact: true }).waitFor();
      await page.waitForTimeout(200);
      assert.match(await editor.getByRole('note').textContent(), /Hello!.*Never include the student's name or other personal information/);
      for (const material of ['business-english:business-existing', 'daily-dispatch:dispatch-one', 'conversational-skills:conversation-one']) {
        await editor.getByLabel('Material used', { exact: true }).selectOption(material);
        assert.equal(await editor.locator('.dispatch-notes-header').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(2, 69, 174)', 'The lesson editor header stays blue for every curriculum');
        assert.equal(await editor.locator('.dispatch-notes-label').first().evaluate(el => getComputedStyle(el).color), theme === 'dark' ? 'rgb(147, 197, 253)' : 'rgb(2, 69, 174)', 'Lesson editor headings stay blue when switching materials');
        assert.equal(await editor.locator('.lne-save').evaluate(el => getComputedStyle(el).backgroundColor), theme === 'dark' ? 'rgb(37, 99, 235)' : 'rgb(2, 69, 174)', 'Save uses the lesson blue theme');
      }
      assert.equal(await editor.getByRole('radio').count(), 11, 'Ten levels plus an optional unassessed state');
      await editor.getByLabel('Material used', { exact: true }).selectOption('conversational-skills:conversation-one');
      await editor.locator('#material-stopped-at').selectOption('');
      await editor.getByLabel('Student feedback', { exact: true }).fill('   ');
      await editor.getByLabel('Material used', { exact: true }).selectOption('daily-dispatch:dispatch-one');
      const writesBeforeInvalid = requests.length;
      await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
      await editor.locator('.lne-validation-summary').waitFor();
      assert.match(await editor.locator('.lne-validation-summary').textContent(), /Introducing yourself/);
      assert.match(await editor.locator('.lne-validation-summary').textContent(), /Student feedback must contain at least 100 characters/);
      assert.equal(requests.length, writesBeforeInvalid, 'Invalid notes do not write any material or summary');
      assert.equal(await editor.getByLabel('Material used', { exact: true }).inputValue(), 'conversational-skills:conversation-one', 'Validation reveals the invalid inactive material');
      assert.equal(await editor.locator('#material-stopped-at').getAttribute('aria-invalid'), 'true');
      assert(await editor.locator('#material-stopped-at').evaluate(el => document.activeElement === el), 'The invalid stopping point receives focus');
      await editor.locator('.lne-validation-summary').getByRole('button', { name: 'Student feedback must contain at least 100 characters.' }).click();
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Student feedback');
      assert(await editor.getByLabel('Student feedback', { exact: true }).evaluate(el => document.activeElement === el), 'Summary links jump to the other invalid fields');
      await editor.locator('.lne-validation-summary button').first().click();
      await page.waitForFunction(() => document.activeElement?.id === 'material-stopped-at');
      assert(await editor.locator('#lesson-stopping-point-error').isVisible(), 'The stopping-point warning is visible beside the field');
      assert.equal(await editor.locator('.lne-validation-summary button').first().evaluate(el => getComputedStyle(el).color), theme === 'dark' ? 'rgb(253, 164, 175)' : 'rgb(190, 18, 60)', 'Save warnings retain their error color');
      await editor.screenshot({ path: `/tmp/lesson-notes-validation-${theme}-${width}.png` });
      await editor.locator('#material-stopped-at').selectOption('exerciseData.stepB');
      await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
      assert.equal(await editor.getByLabel('Student feedback', { exact: true }).getAttribute('aria-invalid'), 'true');
      assert.equal(requests.length, writesBeforeInvalid, 'Missing feedback still prevents every write');
      await editor.getByLabel('Student feedback', { exact: true }).fill('a'.repeat(99));
      await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
      assert.equal(requests.length, writesBeforeInvalid, '99 characters still prevents every write');
      await editor.getByLabel('Student feedback', { exact: true }).fill(validFeedback('Good progress across all materials.'));
      await editor.getByLabel('Tutor handoff', { exact: true }).fill('');
      await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.lesson-notes-editor footer span[role="status"]')?.textContent === 'No unsaved changes');
      assert.equal(summary.tutorMemo, '', 'Tutor handoff is optional');
      assert.equal(summary.englishLevelAssessment, null, 'Assessment is optional');
      await editor.getByRole('radio', { name: /^Level 4 - Short conversations/ }).check();
      assert.equal(await editor.locator('.lesson-assessment-option strong').first().evaluate(el => getComputedStyle(el).color), theme === 'dark' ? 'rgb(241, 241, 241)' : 'rgb(32, 32, 32)', 'Assessment options keep readable primary text');
      await editor.locator('.lesson-level-assessment').screenshot({ path: `/tmp/lesson-assessment-${theme}-${width}.png` });
      assert(await editor.locator('.lesson-level-assessment').evaluate(el => el.scrollWidth <= el.clientWidth));
      // Native selects can preview an option before emitting change on commit.
      const materialSelect = editor.getByLabel('Material used', { exact: true });
      await materialSelect.evaluate(select => { select.value = 'daily-dispatch:dispatch-one'; });
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.waitForTimeout(2200);
      assert.equal(await materialSelect.inputValue(), 'daily-dispatch:dispatch-one', 'Clock updates must not reset a pending material selection');
      await materialSelect.evaluate(select => select.dispatchEvent(new Event('change', { bubbles: true })));
      await editor.getByLabel('Material used', { exact: true }).selectOption('daily-dispatch:dispatch-one');
      await editor.getByLabel('Word or phrase 1', { exact: true }).fill('Late definition request');
      await editor.getByTitle('Get definition', { exact: true }).first().click();
      await editor.getByLabel('Material used', { exact: true }).selectOption('conversational-skills:conversation-one');
      await page.waitForTimeout(1300);
      assert.equal(await editor.getByLabel('Word or phrase 1', { exact: true }).inputValue(), saved.get('conversational-skills:conversation-one').vocabularyItems[0].word, 'An editor AI response cannot update another material');
      await editor.getByLabel('Word or phrase 1', { exact: true }).fill('greeting corrected');
      assert.equal(await editor.getByTitle('Send to chat', { exact: true }).count(), 0, 'The post-lesson editor has no live chat actions');
      await editor.getByTitle('Get definition', { exact: true }).first().click();
      assert(await editor.getByRole('button', { name: 'Save changes', exact: true }).isDisabled(), 'Wait for generation before saving');
      await editor.locator('.vocabulary-meaning').first().waitFor();
      await editor.getByText('Edit meanings and translations', { exact: true }).first().click();
      await editor.getByLabel('Definition 1.1', { exact: true }).fill('Words used to welcome someone');
      await editor.getByLabel('Japanese', { exact: true }).fill('Greeting in Japanese');
      await editor.getByLabel('Romanized Japanese', { exact: true }).fill('aisatsu');
      await editor.getByLabel('You said 1', { exact: true }).fill('I am live in Tokyo');
      await editor.getByTitle('Check grammar', { exact: true }).first().click();
      await page.waitForFunction(() => document.querySelector('.lesson-notes-editor .grammar-input-correct')?.value === 'I live in Tokyo');
      await editor.getByLabel('Correct 1', { exact: true }).fill('I live in Tokyo');
      await editor.getByLabel('Pronunciation word 1', { exact: true }).fill('greeting');
      await editor.getByTitle('Get pronunciation', { exact: true }).first().click();
      await editor.locator('.pronunciation-phonetic-display').first().waitFor();
      await editor.getByLabel('Phonetic 1', { exact: true }).fill('GREE-ting');
      await editor.getByLabel('Student feedback', { exact: true }).fill(validFeedback('Edited after the lesson.'));
      await editor.getByLabel('Tutor handoff', { exact: true }).fill('Continue with the next exercise.');
      await editor.getByLabel('Material used', { exact: true }).selectOption('daily-dispatch:dispatch-one');
      await editor.getByLabel('Word or phrase 1', { exact: true }).fill('frontier edited');
      await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.lesson-notes-editor footer span')?.textContent === 'No unsaved changes');
      assert.equal(saved.get('conversational-skills:conversation-one').vocabularyItems[0].word, 'greeting corrected');
      assert.equal(saved.get('conversational-skills:conversation-one').vocabularyItems[0].definitions[0].japaneseRomanized, 'aisatsu');
      assert.equal(saved.get('conversational-skills:conversation-one').grammarItems[0].correct, 'I live in Tokyo');
      assert.equal(saved.get('conversational-skills:conversation-one').pronunciationItems[0].phonetic, 'GREE-ting');
      assert.equal(summary.studentComment, validFeedback('Edited after the lesson.'));
      assert.equal(summary.englishLevelAssessment, 4, 'Assessment saves with the lesson summary');
      await editor.getByRole('radio', { name: 'Not assessed', exact: true }).check();
      await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.lesson-notes-editor footer span[role="status"]')?.textContent === 'No unsaved changes');
      assert.equal(summary.englishLevelAssessment, null, 'Assessment-only edits can clear a previous choice');
      await editor.getByRole('radio', { name: /^Level 4 - Short conversations/ }).check();
      await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.lesson-notes-editor footer span[role="status"]')?.textContent === 'No unsaved changes');
      assert.equal(summary.englishLevelAssessment, 4);
      await editor.getByRole('button', { name: 'Add material', exact: true }).click();
      await editor.getByLabel('Add material selection', { exact: true }).selectOption('dispatch-extra');
      await editor.getByRole('button', { name: 'Use material', exact: true }).click();
      await editor.getByRole('button', { name: 'Add word or phrase', exact: true }).click();
      await editor.getByLabel('Word or phrase 1', { exact: true }).fill('discovery');
      failSummarySave = true;
      await editor.getByLabel('Student feedback', { exact: true }).fill(validFeedback('Feedback with a new material.'));
      await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
      await editor.getByRole('alert').waitFor();
      assert.equal(saved.get('daily-dispatch:dispatch-extra').vocabularyItems[0].word, 'discovery', 'A successful material save is retained when the feedback save fails');
      await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.lesson-notes-editor footer span')?.textContent === 'No unsaved changes');
      assert.equal(summary.studentComment, validFeedback('Feedback with a new material.'));
      await editor.getByLabel('Student feedback', { exact: true }).fill('Unsaved editor draft');
      await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      page.once('dialog', dialog => dialog.accept());
      await page.reload();
      await card.getByRole('button', { name: 'Edit notes', exact: true }).click();
      await editor.getByLabel('Student feedback', { exact: true }).waitFor();
      assert.equal(await editor.getByLabel('Student feedback', { exact: true }).inputValue(), 'Unsaved editor draft');
      await editor.screenshot({ path: `/tmp/lesson-notes-editor-${theme}-${width}.png`, animations: 'disabled' });
      assert(await editor.evaluate(el => el.scrollWidth <= el.clientWidth), 'Editor has no horizontal overflow');
      if (theme === 'dark') {
        assert.equal(await editor.locator('.dispatch-notes-label').first().evaluate(el => getComputedStyle(el).color), 'rgb(147, 197, 253)', 'Editor headings stay blue and readable in dark mode');
        assert.equal(await editor.locator('.vocabulary-word-input').first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(48, 48, 48)', 'The editor uses neutral dark form surfaces');
      }
      await editor.getByLabel('Material used', { exact: true }).selectOption('daily-dispatch:dispatch-one');
      if (theme === 'dark') await page.waitForFunction(() => getComputedStyle(document.querySelector('.lesson-notes-editor .lne-save')).backgroundColor === 'rgb(37, 99, 235)');
      await editor.getByLabel('Student feedback', { exact: true }).fill(validFeedback('Unsaved editor draft'));
      await editor.screenshot({ path: `/tmp/lesson-notes-editor-dispatch-${theme}-${width}.png`, animations: 'disabled' });
      await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.lesson-notes-editor footer span')?.textContent === 'No unsaved changes');
      editingClosed = true;
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await editor.getByText('Editing is unavailable. These notes are read-only; unsaved changes remain on this device.', { exact: true }).waitFor();
      assert(await editor.getByRole('button', { name: 'Save changes', exact: true }).isDisabled(), 'Memoized editor still becomes read-only when its editing window closes');
      assert(await editor.getByLabel('Word or phrase 1', { exact: true }).isDisabled());
      await editor.getByRole('button', { name: 'Close editor', exact: true }).click();
      assert.match(await card.textContent(), /Unsaved editor draft/);
      assert.match(await card.locator('.lesson-assessment-section').textContent(), /Level 4 - Short conversations/);
      for (const tab of ['Recent Lessons', 'My Notes', 'First Two Entries', 'This Lesson']) {
        await card.getByRole('tab', { name: tab, exact: true }).click();
        await card.getByText('Level 4 - Short conversations', { exact: true }).waitFor();
        assert.equal(await card.getByRole('checkbox', { name: 'Mark student absent', exact: true }).count(), tab === 'This Lesson' ? 1 : 0, 'Attendance controls belong only to This Lesson');
      }
      for (const [label, icon] of Object.entries(sectionIcons)) {
        const headings = card.getByRole('heading', { name: label, exact: true });
        assert(await headings.count() > 0, `Saved ${label} is shown`);
        for (const heading of await headings.all()) assert.equal(await heading.locator('i').getAttribute('class'), icon, `Saved ${label} matches the widget`);
      }
      await card.getByRole('button', { name: 'Refresh lesson notes', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.lesson-notes-edit-window')?.textContent.includes('window closed'));
      assert(await card.getByRole('button', { name: 'Edit notes', exact: true }).isDisabled());
      assert(await card.getByRole('checkbox', { name: 'Mark student absent', exact: true }).isDisabled(), 'Closed lessons cannot change student attendance');
      editingClosed = false;
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.waitForFunction(() => !document.querySelector('.lesson-notes-edit')?.disabled);
      await card.getByRole('button', { name: 'Edit notes', exact: true }).click();
      await editor.getByLabel('Student feedback', { exact: true }).fill('Draft to discard only after confirmation.');
      const absenceCheckbox = editor.getByRole('checkbox', { name: 'Mark student absent', exact: true });
      const confirm = page.getByRole('dialog', { name: 'Mark student absent?', exact: true });
      const attendanceWrites = requests.filter(request => request.kind === 'attendance').length;
      await absenceCheckbox.click();
      await confirm.waitFor();
      const bounds = await confirm.boundingBox();
      const viewport = page.viewportSize();
      assert(Math.abs(bounds.x + bounds.width / 2 - viewport.width / 2) < 2, 'Absence confirmation is horizontally centered');
      assert(Math.abs(bounds.y + bounds.height / 2 - viewport.height / 2) < 2, 'Absence confirmation is vertically centered');
      assert.match(await confirm.textContent(), /remove all lesson notes from student and tutor views/);
      assert.match(await confirm.textContent(), /admin-only recovery archive/);
      assert.match(await confirm.textContent(), /will not restore deleted notes/);
      await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.equal(studentAttendance, 'present');
      assert(saved.size > 0);
      assert.equal(await absenceCheckbox.isChecked(), false);
      assert.equal(requests.filter(request => request.kind === 'attendance').length, attendanceWrites, 'Cancel never sends an attendance request');
      assert.equal(await editor.getByLabel('Student feedback', { exact: true }).inputValue(), 'Draft to discard only after confirmation.');
      failAttendanceSave = true;
      await absenceCheckbox.click();
      await confirm.getByRole('button', { name: 'Mark absent and delete notes', exact: true }).click();
      await confirm.getByRole('alert').waitFor();
      assert(saved.size > 0, 'Failed attendance requests retain saved notes');
      assert.equal(studentAttendance, 'present');
      await confirm.screenshot({ path: `/tmp/lesson-absence-confirmation-${theme}-${width}.png` });
      assert(await confirm.evaluate(el => el.scrollWidth <= el.clientWidth));
      await confirm.getByRole('button', { name: 'Mark absent and delete notes', exact: true }).click();
      await editor.getByText('Student marked absent. No lesson notes are required.', { exact: true }).waitFor();
      assert.equal(saved.size, 0);
      assert.equal(summary.studentComment, '');
      assert.equal(summary.tutorMemo, '');
      assert.equal(summary.englishLevelAssessment, null);
      assert.equal(await editor.getByLabel('Student feedback', { exact: true }).count(), 0, 'Absent students need no notes form');
      assert(await editor.getByRole('button', { name: 'Save changes', exact: true }).isDisabled());
      assert.equal(await page.evaluate(sessionId => Object.keys(localStorage).filter(key => key === `fxv-tutor-lesson-notes-editor:${sessionId}` || key === `fxv-tutor-classroom-summary:${sessionId}` || key.startsWith(`fxv-tutor-classroom-notes:${sessionId}:`)).length, sessionId), 0, 'Confirmed absence clears all drafts for this lesson');
      await editor.getByRole('button', { name: 'Close editor', exact: true }).click();
      for (const tab of ['This Lesson', 'Recent Lessons', 'My Notes', 'First Two Entries']) {
        await card.getByRole('tab', { name: tab, exact: true }).click();
        await card.getByText('Student marked absent. No lesson notes are required.', { exact: true }).waitFor();
        assert.equal(await card.locator('.lesson-material-notes').count(), 0);
        assert.equal(await card.getByText('Pending tutor notes', { exact: true }).count(), 0);
      }
      await page.reload();
      await card.getByRole('checkbox', { name: 'Mark student absent', exact: true }).waitFor();
      await page.waitForFunction(() => document.querySelector('.lesson-student-attendance input')?.checked);
      await card.getByRole('checkbox', { name: 'Mark student absent', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.lesson-student-attendance .lesson-attendance-status')?.textContent === 'Present');
      await card.getByRole('button', { name: 'Edit notes', exact: true }).click();
      await editor.getByLabel('Student feedback', { exact: true }).waitFor();
      assert.equal(await editor.getByLabel('Student feedback', { exact: true }).inputValue(), '', 'Returning to present does not restore deleted feedback');
      assert.equal(await editor.getByLabel('Material used', { exact: true }).locator('option').count(), 1, 'Deleted materials do not return');
      await editor.getByRole('button', { name: 'Close editor', exact: true }).click();
      assert.deepEqual(errors, []);
      assert(requests.some(request => request.kind === 'summary'));
      console.log(`PASS ${theme} ${width}: classroom notes, lesson editor, multi-material edits, definitions, draft recovery, retry, history tabs, 48-hour read-only state`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
