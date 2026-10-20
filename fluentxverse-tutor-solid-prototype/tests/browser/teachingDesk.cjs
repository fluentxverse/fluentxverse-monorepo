const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';
const api = /^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780|8782))\//;
const now = Date.parse('2026-10-17T06:00:00Z');
const user = { userId: 'teaching-desk-fixture', role: 'tutor', firstName: 'Alex', email: 'desk@example.test' };
(async () => {
    const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
    await fs.mkdir('../output/screenshots/teaching-desk', { recursive: true });
    try {
        for (const theme of ['light', 'dark']) for (const width of [1440, 375, 320]) {
            const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
            await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })), theme);
            let failNotes = false, failAll = false, attempts = 0;
            const errors = [], writes = [];
            await context.route(api, async route => {
                const request = route.request(), url = new URL(request.url()), path = url.pathname;
                const ok = data => route.fulfill({ json: { success: true, data } });
                if (!['GET', 'OPTIONS'].includes(request.method())) { writes.push(path); return route.fulfill({ json: { success: false } }); }
                if (path === '/tutor/me') return route.fulfill({ json: { success: true, user } });
                if (path.startsWith('/exam/')) { await new Promise(resolve => setTimeout(resolve, 120)); return route.fulfill({ json: { success: true, status: { passed: true, percentage: 95, attemptsThisMonth: 1, maxAttemptsPerMonth: 2 } } }); }
                if (path === '/schedule/week') {
                    if (failAll) return route.fulfill({ status: 503, json: { success: false } });
                    return ok({ weekStart: '2026-10-12', weekEnd: '2026-10-18', schedulingBlock: { active: true, expiresAt: new Date(now + 3600000).toISOString() }, slots: url.searchParams.get('weekOffset') === '1' ? [
                        { date: '2026-10-19', time: '10:00', status: 'booked', bookingId: 'later-lesson', studentName: 'Later Learner' },
                    ] : [
                        { date: '2026-10-17', time: '14:25', status: 'booked', bookingId: 'next-lesson', studentName: 'Next Learner' },
                        { date: '2026-10-17', time: '12:00', status: 'booked', bookingId: 'past-lesson', studentName: 'Past Learner' },
                    ] });
                }
                if (path === '/lesson-workflow/tutor/pending') {
                    attempts++;
                    if (failNotes || failAll) return route.fulfill({ status: 503, json: { success: false } });
                    return ok([{ bookingId: 'notes-lesson', studentName: 'Notes Learner', notesStatus: 'draft', startsAt: new Date(now - 3600000).toISOString(), endsAt: new Date(now - 2100000).toISOString(), canEdit: true, closed: false, editableUntil: new Date(now + 3600000).toISOString() }]);
                }
                if (path === '/tutor/lesson-issues') {
                    if (failAll) return route.fulfill({ status: 503, json: { success: false } });
                    const direction = url.searchParams.get('direction');
                    const status = direction === 'sent' ? 'submitted' : 'under_review';
                    return ok({ direction, summary: { sent: 1, received: 1 }, statusCounts: { submitted: direction === 'sent' ? 1 : 0, under_review: direction === 'received' ? 1 : 0, resolved: 0 },
                        items: url.searchParams.get('status') === status ? [{ id: direction, bookingId: direction + '-lesson', studentName: 'PRIVATE ISSUE NAME', direction, reasonLabel: 'Connection problem', status, createdAt: new Date(now - 10000).toISOString() }] : [], total: 1, page: 1, totalPages: 1 });
                }
                if (path.startsWith('/notifications')) return ok({ notifications: [], unreadCount: 0 });
                return route.fulfill({ json: { success: true, user, data: [], status: { passed: true, percentage: 95 } } });
            });
            const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
            await page.clock.install({ time: new Date(now) });
            await page.goto(base + '/home', { waitUntil: 'domcontentloaded' });
            const desk = page.getByRole('region', { name: 'Teaching Desk' });
            await expect(desk).toBeVisible();
            await expect(desk).toHaveAttribute('aria-busy', 'false');
            await expect(desk.getByRole('button', { name: 'Upcoming lessons 2' })).toHaveAttribute('aria-pressed', 'true');
            await expect(desk.getByText('Opening new slots is temporarily restricted')).toBeVisible();
            await expect(desk.getByText('Next Learner')).toBeVisible();
            await expect(desk.getByText('Past Learner')).toHaveCount(0);
            await expect(desk.getByRole('link', { name: /Review attendance/ })).toBeVisible();
            const reminder = page.getByRole('button', { name: 'Remind me in 2 minutes', exact: true });
            if (await reminder.isVisible()) await reminder.click();
            if (width < 600) assert.ok((await desk.locator('.teaching-desk-block > div').boundingBox()).width >= width - 145, 'Restriction text uses the mobile row instead of a cramped column');
            await desk.getByRole('button', { name: 'Lesson notes 1' }).click();
            await expect(desk.getByText('Needs submission')).toBeVisible();
            failNotes = true;
            await desk.getByRole('button', { name: 'Refresh teaching tasks' }).click();
            await expect(desk.getByRole('alert').filter({ hasText: 'Could not refresh lesson notes' })).toBeVisible();
            await expect(desk.getByText('Notes Learner')).toBeVisible();
            failNotes = false;
            await desk.getByRole('button', { name: 'Try again' }).click();
            await expect(desk.getByRole('alert').filter({ hasText: 'Could not refresh' })).toHaveCount(0);
            await desk.getByRole('button', { name: 'Lesson issues 2' }).click();
            await expect(desk.getByText('PRIVATE ISSUE NAME')).toHaveCount(0);
            await expect(desk.getByText('Under review', { exact: true })).toBeVisible();
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            await page.screenshot({ path: `../output/screenshots/teaching-desk/${theme}-${width}.png`, fullPage: true });
            failAll = true;
            await page.reload({ waitUntil: 'domcontentloaded' });
            await expect(desk.getByRole('alert')).toContainText('Could not refresh');
            await expect(desk.getByText('No booked lessons in the next seven days')).toHaveCount(0);
            failAll = false;
            await desk.getByRole('button', { name: 'Try again' }).click();
            await expect(desk.getByText('Next Learner')).toBeVisible();
            assert.ok(attempts >= 5, 'Temporary reads were retried and explicit refresh recovered');
            assert.deepEqual(errors, []); assert.deepEqual(writes, []);
            await context.close();
            console.log(`PASS teaching desk ${theme} ${width}: reactive progress, tasks, restrictions, privacy, failed refresh and recovery`);
        }
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
