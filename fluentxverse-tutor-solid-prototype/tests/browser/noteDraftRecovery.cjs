const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';
const id = 'draft-recovery-fixture';
(async () => {
    const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
    try {
        for (const width of [1440, 375, 320]) {
            const context = await browser.newContext({ viewport: { width, height: 900 } });
            const errors = [], writes = [];
            const user = { userId: 'draft-tutor', role: 'tutor', firstName: 'Alex', email: 'paulanthonyarriola@gmail.com' };
            const startsAt = new Date(Date.now() - 3600000).toISOString();
            const workflow = { startsAt, endsAt: new Date(Date.now() - 2100000).toISOString(), editableUntil: new Date(Date.now() + 3600000).toISOString(), serverNow: new Date().toISOString(), canEdit: true, closed: false, studentAttendance: 'present', notesStatus: 'submitted', submittedAt: startsAt, attendanceVerified: true, outcome: 'attended' };
            await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, route => {
                const req = route.request(), path = new URL(req.url()).pathname;
                if (!['GET', 'OPTIONS'].includes(req.method())) { writes.push(path); return route.fulfill({ status: 503, json: { success: false } }); }
                const json = { success: true, user, data: [], status: { passed: true } };
                if (path.startsWith('/notifications')) json.data = { notifications: [], unreadCount: 0 };
                if (path === `/schedule/tutor-lesson/${id}`) json.data = { bookingId: id, sessionId: id, studentId: 'draft-student', slotDate: '2026-10-17', slotTime: '2:00 PM', durationMinutes: 25, status: 'completed' };
                if (path === '/tutor/student/draft-student') json.data = { id: 'draft-student', givenName: 'Test', familyName: 'Learner', hobbies: [] };
                if (path === `/lesson-workflow/tutor/${id}` || path === `/tutor/lesson-notes-edit-window/${id}`) json.data = workflow;
                if (path === `/tutor/classroom-lesson-notes/${id}`) json.data = { studentAttendance: 'present', studentComment: 'Previously submitted feedback.', tutorMemo: '', materials: [], updatedAt: startsAt };
                if (path.endsWith('/trouble-report')) json.data = { ...workflow, report: null, studentReport: null };
                return route.fulfill({ json });
            });
            const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
            await page.goto(`${base}/lesson/${id}`, { waitUntil: 'domcontentloaded' });
            await page.getByRole('button', { name: 'Edit notes', exact: true }).click();
            const editor = page.getByRole('dialog').filter({ has: page.getByRole('textbox', { name: 'Student feedback', exact: true }) });
            const text = 'Unsaved feedback that must survive navigation without submitting anything.';
            await editor.getByRole('textbox', { name: 'Student feedback', exact: true }).fill(text);
            const visit = () => page.evaluate(() => { const a = document.createElement('a'); a.href = '/materials'; document.body.append(a); a.click(); a.remove(); });
            await visit();
            const confirmation = page.getByRole('dialog', { name: 'Confirm action', exact: true });
            await expect(confirmation.getByRole('heading', { name: 'Leave with unsaved notes?' })).toBeVisible();
            await confirmation.getByRole('button', { name: 'Keep editing' }).click();
            await expect(editor.getByRole('textbox', { name: 'Student feedback', exact: true })).toHaveValue(text);
            assert.ok(page.url().endsWith(`/lesson/${id}`));
            assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden', 'Closing nested confirmation preserves editor scroll lock');
            await visit();
            await confirmation.getByRole('button', { name: 'Leave page', exact: true }).click();
            await expect(page.getByRole('heading', { name: 'Learning Materials', exact: true })).toBeVisible();
            assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
            await page.goBack();
            await page.getByRole('button', { name: 'Edit notes', exact: true }).click();
            await expect(editor.getByRole('textbox', { name: 'Student feedback', exact: true })).toHaveValue(text);
            await expect(editor.getByText('Unsaved draft restored.', { exact: true })).toBeVisible();
            await editor.getByRole('button', { name: 'Close editor', exact: true }).click();
            await confirmation.getByRole('button', { name: 'Keep editing', exact: true }).click();
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
            assert.deepEqual(errors, []); assert.deepEqual(writes, []);
            await context.close(); console.log(`PASS tutor notes ${width}: nested dialogs, navigation warning, keep editing, leave, Back and draft restoration`);
        }
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
