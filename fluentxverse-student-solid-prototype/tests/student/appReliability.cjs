const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176';
const now = Date.parse('2026-10-17T06:00:00Z');
(async () => {
    const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
    await fs.mkdir('../output/screenshots/reliability', { recursive: true });
    try {
        for (const theme of ['light', 'dark']) for (const width of [1440, 375, 320]) {
            const context = await browser.newContext({ viewport: { width, height: width < 600 ? 740 : 900 }, reducedMotion: 'reduce' });
            await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })), theme);
            let reads = 0, failSubmit = true, report = null;
            const writes = [], errors = [];
            await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780))\//, route => {
                const request = route.request(), path = new URL(request.url()).pathname;
                const ok = data => route.fulfill({ json: { success: true, data } });
                if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
                if (path === '/student/me') return route.fulfill({ json: { success: true, user: { userId: 'reliable-student', role: 'student', givenName: 'Mika' } } });
                if (path === '/schedule/lesson/reliable-lesson') {
                    if (++reads === 1) return route.fulfill({ status: 503, json: { success: false } });
                    return ok({ bookingId: 'reliable-lesson', tutorId: 'tutor', tutorName: 'Alex Teacher', startsAt: new Date(now - 3600000).toISOString(), slotDate: '2026-10-17', slotTime: '13:00', status: 'completed', durationMinutes: 25, bookedAt: new Date(now - 86400000).toISOString() });
                }
                if (path.endsWith('/issue-report')) {
                    if (request.method() === 'POST') {
                        writes.push(request.postDataJSON());
                        if (failSubmit) return route.fulfill({ status: 503, json: { success: false, error: 'Fixture: submit temporarily unavailable.' } });
                        report = { ...request.postDataJSON(), id: 'report', createdAt: new Date(now).toISOString(), status: 'submitted' }; return ok(report);
                    }
                    return ok({ eligible: !report, reason: null, startsAt: new Date(now - 3600000).toISOString(), lessonEndsAt: new Date(now - 2100000).toISOString(), closesAt: new Date(now + 86400000).toISOString(), serverNow: new Date(now).toISOString(), report });
                }
                if (path.includes('lesson-recap')) return ok({ startsAt: new Date(now - 3600000).toISOString(), studentAttendance: 'present', materials: [], studentComment: '', workflow: { notesStatus: 'draft', attendanceVerified: false }, previousLessonId: null, nextLessonId: null });
                if (path.includes('lesson-material-request')) return ok({ canRequestMaterial: false, materialRequest: null });
                if (path.endsWith('/survey')) return ok({ eligible: false, survey: null, topics: [] });
                if (path.startsWith('/notifications')) return ok({ notifications: [], unreadCount: 0 });
                return ok([]);
            });
            const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
            await page.clock.install({ time: new Date(now) });
            await page.goto(base + '/lesson/reliable-lesson');
            await expect(page.locator('.lesson-detail-card').first()).toBeVisible();
            assert.equal(reads, 2, 'One transient GET failure recovers automatically');
            await expect(page.getByRole('navigation', { name: 'Lesson progress' }).locator('[aria-current="step"]')).toHaveText('4Feedback');
            await context.setOffline(true);
            await expect(page.locator('.fxv-connection.is-offline')).toContainText('You are offline');
            await context.setOffline(false);
            await expect(page.locator('.fxv-connection.is-online')).toContainText('Connection restored');
            await page.getByRole('button', { name: 'Dismiss connection notice' }).click();
            await page.getByRole('button', { name: 'Report issue', exact: true }).click();
            let dialog = page.getByRole('dialog', { name: 'Report a lesson issue', exact: true });
            await dialog.getByRole('button', { name: 'More than 10 minutes' }).click();
            await dialog.getByRole('radio', { name: 'Other lesson issue', exact: true }).check();
            await dialog.getByRole('textbox').fill('The connection failed, but this report draft must not disappear.');
            await dialog.getByRole('button', { name: 'Submit report', exact: true }).click();
            await expect(dialog.getByRole('alert')).toContainText('submit temporarily unavailable');
            assert.equal(writes.length, 1, 'A failed report mutation is never automatically replayed');
            await page.keyboard.press('Escape');
            await expect(dialog).toHaveCount(0);
            assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
            await page.reload();
            await page.getByRole('button', { name: 'Report issue', exact: true }).click();
            dialog = page.getByRole('dialog', { name: 'Report a lesson issue', exact: true });
            await expect(dialog.getByRole('textbox')).toHaveValue('The connection failed, but this report draft must not disappear.');
            await expect(dialog.getByRole('status')).toContainText('restored');
            assert.equal(await dialog.evaluate(element => element.matches(':modal')), true);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            await page.screenshot({ path: `../output/screenshots/reliability/${theme}-${width}.png` });
            failSubmit = false;
            await dialog.getByRole('button', { name: 'Submit report', exact: true }).click();
            await expect(dialog).toHaveCount(0);
            await expect(page.getByRole('button', { name: 'Issue reported' })).toBeVisible();
            assert.equal(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('fxv:form-draft:v1:')).length), 0);
            assert.equal(writes.length, 2); assert.deepEqual(errors, []);
            await context.close(); console.log(`PASS student reliability ${theme} ${width}: GET recovery, progress, offline, native dialog, draft restore and one-shot submission`);
        }
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
