const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';
(async () => {
    const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
    try {
        for (const width of [1440, 375]) {
            const context = await browser.newContext({ viewport: { width, height: 900 } });
            const errors = [], writes = []; let proofFailed = false, documents = 0;
            const user = { userId: 'recovery-tutor', firstName: 'Alex', role: 'tutor', email: 'recovery@example.test' };
            await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, route => {
                const path = new URL(route.request().url()).pathname;
                if (!['GET', 'OPTIONS'].includes(route.request().method())) { writes.push(path); return route.fulfill({ json: { success: false } }); }
                const json = { success: true, user, data: [], lessons: [], status: { passed: true }, booking: null };
                if (path === '/proof/tutor-certification/me') {
                    if (proofFailed) return route.fulfill({ status: 503, json: { success: false } });
                    json.data = { snapshot: { missingRequirements: [] }, credential: { status: 'verified' } };
                }
                if (path === '/schedule/week') json.data = { slots: [], weekStart: '2026-10-12', weekEnd: '2026-10-18' };
                if (path.startsWith('/notifications')) json.data = { notifications: [], unreadCount: 0 };
                return route.fulfill({ json });
            });
            const page = await context.newPage();
            page.on('pageerror', error => errors.push(error.message));
            page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
            await page.goto(base + '/materials', { waitUntil: 'domcontentloaded' });
            await expect(page.getByRole('heading', { name: 'Learning Materials', exact: true })).toBeVisible();
            await context.route(/\/assets\/ContactUsPage-[^/]+\.js(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/javascript', body: `export default function Page(){if(!window.__recoveryFixture){window.__recoveryFixture=true;throw new Error('Fixture render failure')}const h=document.createElement('h1');h.textContent='Recovered destination';return h}` }));
            const visit = async href => page.evaluate(href => { const a = document.createElement('a'); a.href = href; document.body.append(a); a.click(); a.remove(); }, href);
            await visit('/contact');
            await expect(page.getByRole('region', { name: 'Page unavailable' })).toBeVisible();
            await page.getByRole('button', { name: 'Try again', exact: true }).click();
            await expect(page.getByRole('heading', { name: 'Recovered destination' })).toBeVisible();
            await page.goBack();
            await expect(page.getByRole('heading', { name: 'Learning Materials', exact: true })).toBeVisible();
            proofFailed = true;
            await visit('/schedule');
            await expect(page.getByRole('alert')).toContainText('Could not verify certification');
            assert.ok(page.url().endsWith('/schedule'), 'Temporary certification failure does not redirect or log out');
            proofFailed = false;
            await page.getByRole('button', { name: 'Try again', exact: true }).click();
            await expect(page.getByRole('heading', { name: /Lesson Schedule/ })).toBeVisible();
            await page.goBack();
            await expect(page.getByRole('heading', { name: 'Learning Materials', exact: true })).toBeVisible();
            assert.equal(documents, 1, 'Recovery retains the original router and document');
            assert.deepEqual(errors, []); assert.deepEqual(writes, []);
            await context.close(); console.log(`PASS tutor route recovery ${width}: retry, Back, certification outage and session preservation`);
        }
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
