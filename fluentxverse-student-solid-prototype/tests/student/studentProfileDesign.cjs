const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1566, 1024, 768, 375, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 950 }, timezoneId: 'Pacific/Auckland', reducedMotion: 'reduce' });
      await context.addInitScript(theme => {
        if (/^https?:$/.test(location.protocol)) localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 }));
        if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Test permission denied', 'NotAllowedError'); };
      }, theme);
      let failAbout = false, failHistory = false;
      const writes = [];
      const fixture = { id: 'student-fixture', givenName: 'Mika', familyName: 'Tanaka', fullName: 'Mika Tanaka', initials: 'MT', email: 'mika@example.test', totalLessons: 7, upcomingLessons: 2, joinDate: '2026-04-03', purpose: 'Travel', occupation: 'Student', hobbies: ['Reading'], bio: 'Learning English for new conversations.', lessonPreferences: { preferCameraOn: true, errorCorrection: 'tutor_choice', otherRequests: 'Please explain new vocabulary.' }, levelAssessment: width === 320 ? null : { studentLevel: 'Level 4', curriculum: 'Conversational Skills', dateAssessed: '2026-10-01', assessedBy: 'Alex', scores: { comprehension: 2, pronunciation: 3, grammar: 2, maxScore: 3 }, remarks: ['Keep practicing conversations.'] } };
      await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780)|https:\/\/api\.fluentxverse\.(?:com|xyz))\//, route => {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
        const path = new URL(route.request().url()).pathname;
        if (route.request().method() === 'PUT') { writes.push({ path, data: route.request().postDataJSON() }); return route.fulfill({ json: { success: !(path === '/student/about-me' && failAbout), error: failAbout ? 'Please try saving again.' : undefined } }); }
        if (path === '/student/profile') return route.fulfill({ json: { success: true, data: fixture } });
        if (path === '/student/last-viewed-lesson') return route.fulfill({ json: { success: true, data: { courseId: 'conversational-skills', lessonId: 'lesson-one', title: 'Introductions', lessonNumber: 1, goal: 'Introduce yourself' } } });
        if (path === '/schedule/student-bookings') return failHistory ? route.fulfill({ status: 500, json: { error: 'Unavailable' } }) : route.fulfill({ json: { success: true, data: [{ bookingId: 'past-real-lesson', tutorName: 'Alex Rivera', slotDate: '2026-01-01', slotTime: '11:30 PM', durationMinutes: 25, status: 'completed' }] } });
        if (path.startsWith('/lesson-materials/published/')) return route.fulfill({ json: { success: true, lessons: [{ id: 'lesson-one', level: 3, chapter: 1, lessonNumber: 1, lessonTitle: 'Lesson 1: Introductions', goalTextEn: 'Introduce yourself' }] } });
        return route.fulfill({ json: path === '/student/me' ? { success: true, user: { userId: 'profile-fixture', role: 'student', givenName: 'Mika', walletAddress: '0x' + 'a'.repeat(40) } } : { success: true, data: [], profile: {}, lessons: [] } });
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/profile', { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'My Profile', exact: true }).waitFor();
      await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
      const layout = async state => {
        await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
        const result = await page.evaluate(async () => {
          await Promise.all([...document.querySelectorAll('.profile-art')].map(img => img.decode()));
          return { overflow: document.documentElement.scrollWidth > innerWidth, fits: [...document.querySelectorAll('.content-card,.course-select-card,[role="dialog"],.tab-button')].every(el => el.scrollWidth <= el.clientWidth), header: document.querySelector('.profile-page-header').getBoundingClientRect().top >= document.querySelector('.app-header-shell').getBoundingClientRect().bottom };
        });
        assert.equal(result.overflow, false); assert.ok(result.fits && result.header, JSON.stringify(result));
        await page.screenshot({ path: '../output/screenshots/profile-' + theme + '-' + width + '-' + state + '.png', fullPage: true });
      };
      assert.equal(await page.locator('.content-card').count(), 3);
      assert.equal(await page.getByRole('button', { name: 'Book a Lesson', exact: true }).evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(2, 69, 174)');
      assert.equal(await page.locator('.student-profile-main i').count(), 0);
      await layout('overview');
      await page.getByRole('button', { name: 'Edit about me', exact: true }).click();
      let dialog = page.getByRole('dialog', { name: 'Edit About Me', exact: true });
      await dialog.getByLabel('Bio', { exact: true }).fill('I enjoy learning new languages.');
      await dialog.getByLabel('Purpose for learning English', { exact: true }).selectOption('Career Advancement');
      await dialog.getByLabel('Music', { exact: true }).check();
      await layout('about-editor');
      failAbout = true;
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      await dialog.getByText('Please try saving again.', { exact: true }).waitFor();
      assert.equal(await dialog.count(), 1);
      failAbout = false;
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      assert.ok(writes.some(item => item.path === '/student/about-me' && item.data.purpose === 'Career Advancement' && item.data.hobbies.includes('Music')));
      assert.equal(await page.getByRole('button', { name: 'Edit about me', exact: true }).evaluate(el => el === document.activeElement), true);
      await page.getByRole('button', { name: 'Edit lesson preferences', exact: true }).click();
      dialog = page.getByRole('dialog', { name: 'Edit Lesson Preferences', exact: true });
      await dialog.getByRole('checkbox', { name: 'Prefer camera on', exact: true }).uncheck();
      await dialog.getByRole('radio', { name: /Proactively/ }).check();
      await dialog.getByLabel('Other requests', { exact: true }).fill('x'.repeat(180));
      assert.equal((await dialog.getByLabel('Other requests', { exact: true }).inputValue()).length, 150);
      await layout('preferences-editor');
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      assert.ok(writes.some(item => item.path === '/student/preferences' && item.data.preferCameraOn === false && item.data.errorCorrection === 'proactively' && item.data.otherRequests.length === 150));
      await page.getByRole('button', { name: 'Test Headset', exact: true }).click();
      dialog = page.getByRole('dialog', { name: 'Device & Media Test', exact: true });
      await dialog.getByText(/Microphone access denied/).waitFor();
      assert.equal(await dialog.getByRole('button', { name: 'Close device test' }).evaluate(el => {
        const button = el.getBoundingClientRect(), header = el.closest('.headset-modal-header').getBoundingClientRect();
        return button.top >= header.top && button.bottom <= header.bottom;
      }), true);
      await layout('device-test');
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      failHistory = true;
      await page.getByRole('button', { name: 'History & Notes', exact: true }).click();
      await page.getByText('Could not load your lesson history.', { exact: true }).waitFor();
      failHistory = false;
      await page.getByRole('button', { name: 'Try again', exact: true }).click();
      await page.locator('.profile-history-item').waitFor();
      assert.equal(await page.locator('.profile-history-item').getAttribute('href'), '/lesson/past-real-lesson');
      assert.match(await page.locator('.profile-history-item p').textContent(), /Jan 2, 2026.*12:30 AM JST/);
      assert.equal(await page.getByText('Job Interviews', { exact: true }).count(), 0);
      await layout('history');
      await page.getByRole('button', { name: 'Materials', exact: true }).click();
      await layout('materials');
      assert.equal(await page.locator('.course-select-card').count(), 3);
      await page.getByRole('button', { name: /Conversational Skills Conversation/ }).click();
      await page.getByRole('button', { name: /Level 3/ }).waitFor();
      await page.getByRole('button', { name: /Level 3/ }).click();
      await page.getByRole('button', { name: /Chapter 1/ }).click();
      await layout('lesson-selector');
      await page.getByRole('button', { name: 'Choose Lesson', exact: true }).click();
      await page.getByText(/selected for your next booking/).waitFor();
      assert.ok(writes.some(item => item.path === '/student/last-viewed-lesson' && item.data.lessonId === 'lesson-one'));
      assert.deepEqual(errors, []);
      console.log('PASS Profile ' + theme + ' ' + width + ': overview, editors, save/retry, history/JST, materials, device test, layout');
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
