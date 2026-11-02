const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5281';
const output = path.resolve('fluentxverse-tutor-solid-prototype/public/assets/img/first-lesson');

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  fs.mkdirSync(output, { recursive: true });
  try {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce', timezoneId: 'Asia/Manila' });
      await context.addInitScript(theme => localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 })), theme);
      let opened = false;
      await context.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin === base) return route.continue();
        if (url.hostname === 'flagcdn.com') return route.continue();
        assert(['GET', 'OPTIONS'].includes(request.method()), 'Capture must never change real schedule data');
        const user = { userId: 'guide-screenshot-tutor', role: 'tutor', firstName: 'Alex', email: 'alex@example.test' };
        let data = [];
        if (url.pathname.replace(/\/$/, '') === '/tutor/email-verification') data = { verified: true };
        if (url.pathname === '/notifications') data = { notifications: [], unreadCount: 0 };
        if (url.pathname === '/proof/tutor-certification/me') data = { snapshot: { writtenPassed: true, speakingPassed: true, interviewPassed: true, profileApproved: true, missingRequirements: [] } };
        if (url.pathname === '/schedule/week') data = {weekStart:'2026-10-26',weekEnd:'2026-11-01',slots:[{date:'2026-10-29',time:'10:00',slotId:'example-slot',status:'booked',studentId:'sample-student',studentName:'Sample Student',bookingId:'guide-classroom-example',attendanceMarked:'present'}]};
        if (url.pathname === '/tutor/performance') data = { slots: { bookable: opened ? 1 : 0 }, lessons: { attended: 0 } };
        if(url.pathname==='/schedule/tutor-lesson/guide-classroom-example')data={bookingId:'guide-classroom-example',sessionId:'guide-classroom-example',studentId:'sample-student',slotDate:'2026-10-29',slotTime:'10:00 AM',durationMinutes:25,status:'confirmed'};
        if(url.pathname==='/tutor/student/sample-student')data={id:'sample-student',givenName:'Sample',familyName:'Student',country:'Japan',joinDate:'2026-09-01',totalLessons:0,hobbies:[]};
        if(url.pathname.endsWith('/trouble-report'))data={startsAt:'2026-10-29T02:00:00Z',endsAt:'2026-10-29T02:25:00Z',serverNow:'2026-10-29T01:56:00Z',canReport:false};
        if(url.pathname.startsWith('/lesson-workflow/tutor/'))data={startsAt:'2026-10-29T02:00:00Z',endsAt:'2026-10-29T02:25:00Z',editableUntil:'2026-10-31T02:25:00Z',serverNow:'2026-10-29T01:56:00Z',canEdit:false,notesStatus:'draft',studentAttendance:'present'};
        if(url.pathname==='/tutor/lesson-notes-edit-window/guide-classroom-example')data={canEdit:false,startsAt:'2026-10-29T02:00:00Z',editableUntil:'2026-10-31T02:25:00Z',serverNow:'2026-10-29T01:56:00Z'};
        return route.fulfill({ json: { success: true, user, data } });
      });
      const page = await context.newPage();
      await page.clock.install({ time: new Date('2026-10-29T01:56:00Z') });
      const clearMarks = () => page.evaluate(() => document.querySelectorAll('[data-guide-callout]').forEach(el => el.remove()));
      const mark = async (locator, number) => {
        await locator.evaluate((el, number) => {
          const r = el.getBoundingClientRect(), box = document.createElement('div');
          box.dataset.guideCallout = 'true';
          const parent = el.closest('dialog');
          Object.assign(box.style, { position: parent ? 'fixed' : 'absolute', pointerEvents: 'none', zIndex: '2147483647', left: `${r.left + (parent ? 0 : scrollX) - 3}px`, top: `${r.top + (parent ? 0 : scrollY) - 3}px`, width: `${r.width + 6}px`, height: `${r.height + 6}px`, border: '3px solid #dc2626', borderRadius: '7px', boxSizing: 'border-box' });
          const badge = document.createElement('span'); badge.textContent = String(number);
          Object.assign(badge.style, { position: 'absolute', top: '-14px', left: '-14px', display: 'grid', placeItems: 'center', width: '26px', height: '26px', borderRadius: '50%', background: '#dc2626', color: '#fff', font: '700 15px Arial', border: '2px solid #fff' });
          box.appendChild(badge); (parent || document.body).appendChild(box);
        }, number);
      };
      const calendarShot = async name => {
        await page.evaluate(() => scrollTo(0, 0));
        const periods = await page.locator('.schedule-periods').boundingBox(), grid = await page.locator('.schedule-scrollable').boundingBox(), actions = await page.locator('.schedule-actions').boundingBox();
        const clip = { x: Math.max(0, grid.x - 14), y: periods.y - 14, width: grid.width + 28, height: actions.y + actions.height - periods.y + 28 };
        await page.screenshot({ path: path.join(output, `${name}-${theme}.png`), clip }); await clearMarks();
      };
      const dialogShot = async name => {
        const box = await page.getByRole('dialog').boundingBox();
        await page.screenshot({ path: path.join(output, `${name}-${theme}.png`), clip: { x: box.x - 16, y: box.y - 16, width: box.width + 32, height: box.height + 32 } }); await clearMarks();
      };
      await page.goto(base + '/schedule', { waitUntil: 'networkidle' });
      await expect.poll(() => page.locator('img[alt="PH"]').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);

      const reminder=page.getByRole('button',{name:'Remind me in 2 minutes',exact:true});if(await reminder.isVisible())await reminder.click();
      const booked=page.getByRole('button',{name:'Open lesson with Sample Student',exact:true});
      await expect(booked).toBeVisible();await mark(booked,1);
      const grid=await page.locator('.schedule-scrollable').boundingBox();
      await page.screenshot({path:path.join(output,`open-booked-lesson-${theme}.png`),clip:{x:grid.x-12,y:Math.max(0,grid.y-12),width:grid.width+24,height:Math.min(grid.height+24,900)}});await clearMarks();
      await page.goto(base+'/lesson/guide-classroom-example',{waitUntil:'networkidle'});
      const enter=page.getByRole('button',{name:'Enter Classroom',exact:true});await expect(enter).toBeEnabled();await enter.scrollIntoViewIfNeeded();await mark(enter,1);
      const card=page.locator('.profile-header-card');await expect(card).toBeVisible();
      const bounds=await card.boundingBox();await page.screenshot({path:path.join(output,`enter-classroom-${theme}.png`),clip:{x:bounds.x-12,y:Math.max(0,bounds.y-12),width:bounds.width+24,height:bounds.height+24}});
      console.log('Captured booked lesson and classroom entry: '+theme);await context.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
