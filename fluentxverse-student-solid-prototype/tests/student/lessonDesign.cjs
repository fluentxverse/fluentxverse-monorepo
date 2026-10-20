const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176';
const start = '2026-10-10T15:30:00Z', end = '2026-10-10T15:55:00Z';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    const themes = process.env.TEST_THEME ? [process.env.TEST_THEME] : ['light', 'dark'];
    const widths = process.env.TEST_WIDTHS ? process.env.TEST_WIDTHS.split(',').map(Number) : [1566, 1024, 768, 375, 320];
    for (const theme of themes) for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width <= 375 ? 667 : 950 }, timezoneId: 'Pacific/Auckland', reducedMotion: 'reduce' });
      await context.addInitScript(theme => {
        if (/^https?:$/.test(location.protocol)) localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 }));
      }, theme);
      let phase = 'future', request = null, survey = null, report = null;
      let lessonFailed = false, cancelFailed = true, recapFailed = false, requestFailed = false;
      let fixedTime = '2026-10-10T14:00:00Z';
      const writes = [];
      const lesson = { bookingId: 'lesson-fixture', tutorId: 'tutor-fixture', tutorName: 'Christopher Alexandra Montgomery', tutorBio: 'A patient tutor for everyday conversations.', slotDate: '2026-10-10', slotTime: '23:30', durationMinutes: 25, status: 'confirmed', bookedAt: '2026-10-09T15:30:00Z', sessionId: 'call-fixture' };
      const material = { materialId: 'material-fixture', materialType: 'conversational-skills', courseId: 'conversational-skills', materialTitle: 'Introducing myself', materialLevel: 3, materialChapter: 1, completionStatus: 'completed', stoppedAtLabel: null, progressDetails: '', vocabularyItems: [{ word: 'frontier', selectedDefinitionIndex: 0, definitions: [{ meaning: 'A new area of knowledge', japaneseNative: '新分野', japaneseRomanized: 'shinbunya' }] }], grammarItems: [{ youSaid: 'I want to ate.', correct: 'I want to eat.' }], pronunciationItems: [{ word: 'frontier', phonetic: 'frʌnˈtɪr' }] };
      const recap = () => ({ startsAt: start, canRequestMaterial: phase === 'future', materialRequest: request, studentAttendance: 'present', materials: [material], studentComment: 'You expressed your ideas clearly and used the new vocabulary well. Keep practising complete sentences.', englishLevelAssessment: 3, previousLessonId: 'previous', nextLessonId: 'next', workflow: { attendanceVerified: true, notesStatus: 'submitted', closed: false, endsAt: end } });
      const respond = (route, data) => route.fulfill({ json: { success: true, data } });
      await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780)|https:\/\/api\.fluentxverse\.(?:com|xyz))\//, route => {
        const req = route.request(), path = new URL(req.url()).pathname;
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
        if (path === '/student/me') return route.fulfill({ json: { success: true, user: { userId: 'lesson-user', role: 'student', givenName: 'Mika', walletAddress: '0x' + 'a'.repeat(40) } } });
        if (['POST', 'PUT', 'DELETE'].includes(req.method())) {
          const body = req.postDataJSON(); writes.push({ path, body });
          if (path === '/schedule/cancel') {
            if (cancelFailed) return route.fulfill({ status: 503, json: { success: false, error: 'Cancellation unavailable. Please try again.' } });
            phase = 'cancelled';
            return route.fulfill({ json: { success: true, refunded: true, message: 'Lesson cancelled.' } });
          }
          if (path.includes('lesson-material-request')) {
            request = body.courseId ? { courseId: body.courseId, lessonId: body.materialId, title: 'Lesson 1: Introducing myself', level: 3, chapter: 1, lessonNumber: 1, goal: 'Introduce yourself' } : null;
            return respond(route, request);
          }
          if (path.endsWith('/survey')) { survey = { ...body, submittedAt: fixedTime }; return respond(route, survey); }
          if (path.endsWith('/issue-report')) { report = { ...body, id: 'report-fixture', createdAt: fixedTime, status: 'submitted' }; return respond(route, report); }
          return route.fulfill({ status: 400, json: { success: false, error: 'Unexpected write' } });
        }
        if (path === '/schedule/lesson/lesson-fixture') {
          if (lessonFailed) return route.fulfill({ status: 503, json: { success: false, error: 'Lesson temporarily unavailable.' } });
          return respond(route, { ...lesson, status: phase === 'cancelled' ? 'cancelled' : 'confirmed' });
        }
        if (path.includes('lesson-recap')) {
          if (recapFailed) return route.fulfill({ status: 503 });
          return respond(route, recap());
        }
        if (path.includes('lesson-material-request')) {
          if (requestFailed) return route.fulfill({ status: 503 });
          return respond(route, { canRequestMaterial: phase === 'future', materialRequest: request });
        }
        if (path.endsWith('/survey')) return respond(route, { eligible: true, reason: null, endsAt: end, closesAt: '2026-10-12T15:55:00Z', survey, topics: [{ id: 'connection', label: 'Audio and connection quality', positive: true }, { id: 'focus', label: 'Tutor focus and engagement', positive: false }] });
        if (path.endsWith('/issue-report')) return respond(route, { startsAt: start, lessonEndsAt: end, closesAt: '2026-10-12T15:55:00Z', serverNow: fixedTime, eligible: ['ended', 'wrap'].includes(phase), reason: phase === 'cancelled' ? 'cancelled' : phase === 'future' ? 'not_started' : null, report });
        if (path.includes('/lesson-materials/published/')) return route.fulfill({ json: { success: true, lessons: [{ id: 'material-fixture', lessonName: 'Introducing myself', lessonNumber: 1, level: 3, chapter: 1, goalTextEn: 'Introduce yourself' }] } });
        return route.fulfill({ json: { success: true, data: [], profile: {}, lessons: [] } });
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', err => errors.push(err.message));
      await page.clock.install({ time: new Date(fixedTime) });
      const load = async (nextPhase, time) => {
        phase = nextPhase; fixedTime = time;
        await page.clock.setFixedTime(new Date(time));
        await page.goto(base + '/lesson/lesson-fixture', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.locator('.lesson-detail-card').first().waitFor();
        await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
        await page.locator('.lesson-art').evaluateAll(images => Promise.all(images.map(img => img.decode())));
      };
      const check = async state => {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        const result = await page.evaluate(() => {
          const header = document.querySelector('.lesson-page-header').getBoundingClientRect();
          const cards = [...document.querySelectorAll('.lesson-detail-card')].map(el => el.getBoundingClientRect());
          return {
            overflow: document.documentElement.scrollWidth > innerWidth,
            heading: header.top >= document.querySelector('.app-header-shell').getBoundingClientRect().bottom,
            fits: [...document.querySelectorAll('.lesson-detail-card,.lesson-cancel-dialog,.student-note-card,dialog[open]')].every(el => el.scrollWidth <= el.clientWidth),
            equal: cards.length !== 2 || cards[0].top !== cards[1].top || Math.abs(cards[0].height - cards[1].height) < 1,
          };
        });
        assert.equal(result.overflow, false); assert.ok(result.heading && result.fits && result.equal, JSON.stringify(result));
        await page.screenshot({ path: '../output/screenshots/lesson-' + theme + '-' + width + '-' + state + '.png', fullPage: true });
      };
      await load('future', fixedTime);
      assert.match(await page.locator('.lesson-schedule-details').textContent(), /Sunday, October 11, 2026/);
      assert.match(await page.locator('.lesson-schedule-details').textContent(), /12:30 AM JST/);
      assert.equal(await page.getByRole('button', { name: 'Enter Classroom', exact: true }).count(), 0);
      await page.locator('.student-note-card').first().waitFor();
      await check('upcoming');
      await page.getByRole('button', { name: 'Choose material', exact: true }).click();
      await page.getByRole('dialog', { name: 'Select lesson material' }).waitFor();
      await page.getByRole('button', { name: 'Request lesson: Lesson 1: Introducing myself' }).click();
      await page.getByRole('dialog', { name: 'Select lesson material' }).waitFor({ state: 'detached' });
      assert.equal(writes.at(-1).body.materialId, 'material-fixture');
      await page.locator('.lesson-cancel-action').click();
      await page.getByRole('dialog', { name: 'Cancel lesson?' }).waitFor();
      await check('cancel');
      await page.locator('.lesson-danger').click();
      await page.getByText('Cancellation unavailable. Please try again.').waitFor();
      assert.equal(await page.locator('.lesson-detail-card').count(), 2);
      await check('cancel-error');
      await page.keyboard.press('Escape');
      await page.locator('.lesson-cancel-dialog').waitFor({ state: 'detached' });
      await page.waitForFunction(() => document.querySelector('.lesson-cancel-action') === document.activeElement);
      await load('early', '2026-10-10T15:25:00Z');
      assert.equal(await page.locator('.lesson-cancel-action').count(), 0);
      await page.getByRole('button', { name: 'Enter Classroom', exact: true }).waitFor();
      await page.getByText('Settle in now.', { exact: false }).waitFor();
      await check('early');
      await load('live', '2026-10-10T15:40:00Z');
      await page.getByRole('button', { name: 'Enter Classroom', exact: true }).waitFor();
      await check('in-progress');
      await load('wrap', '2026-10-10T15:56:00Z');
      await page.getByRole('heading', { name: 'Lesson wrap-up' }).waitFor();
      await check('wrap-up');
      await load('ended', '2026-10-10T15:58:00Z');
      assert.equal(await page.getByRole('button', { name: 'Enter Classroom', exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Lesson feedback', exact: true }).click();
      await page.getByRole('dialog', { name: 'Lesson feedback' }).waitFor();
      await page.getByRole('radio', { name: '5 stars - Very satisfied' }).check();
      await check('feedback');
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await page.getByRole('group', { name: 'What went well?' }).getByRole('checkbox', { name: 'Audio and connection quality' }).check();
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await page.getByRole('button', { name: 'Submit feedback', exact: true }).click();
      await page.getByRole('heading', { name: 'Thank you for your feedback' }).waitFor();
      assert.deepEqual(survey.positive, ['connection']); assert.equal(survey.rating, 5);
      await page.getByRole('button', { name: 'Close survey' }).click();
      await page.getByRole('button', { name: 'Report issue', exact: true }).click();
      await page.getByRole('dialog', { name: 'Report a lesson issue' }).waitFor();
      await check('report');
      await page.getByRole('button', { name: 'Close report' }).click();
      await check('ended');
      await load('cancelled', fixedTime);
      await page.getByRole('heading', { name: 'Lesson cancelled' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Enter Classroom', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: /Lesson feedback/ }).count(), 0);
      await check('cancelled');
      recapFailed = true; requestFailed = true;
      await load('future', '2026-10-10T14:00:00Z');
      await page.getByText('Could not load your lesson recap.').waitFor();
      await page.getByText('Could not load your material request.').waitFor();
      recapFailed = false; requestFailed = false;
      await page.locator('.student-lesson-advance-request').getByRole('button', { name: 'Try again' }).click();
      await page.locator('.student-lesson-recap').last().getByRole('button', { name: 'Try again' }).click();
      await page.locator('.student-note-card').first().waitFor();
      cancelFailed = false;
      await page.locator('.lesson-cancel-action').click();
      await page.locator('.lesson-danger').click();
      await page.getByRole('heading', { name: 'Lesson cancelled' }).waitFor();
      assert.equal(await page.locator('.lesson-cancel-action').count(), 0);
      await page.getByText('Your ticket has been refunded.', { exact: false }).waitFor();
      lessonFailed = true;
      await page.reload();
      await page.getByRole('heading', { name: 'Unable to load lesson' }).waitFor();
      await check('error');
      lessonFailed = false;
      await page.getByRole('button', { name: 'Try again', exact: true }).click();
      await page.locator('.lesson-detail-card').first().waitFor();
      assert.deepEqual(errors, []);
      console.log('PASS Lesson ' + theme + ' ' + width + ': JST rollover, material request, cancellation retry, entry/cutoff/wrap-up, feedback, report, notes, layout');
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
