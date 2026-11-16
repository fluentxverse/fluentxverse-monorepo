const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const { readFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const root = resolve(__dirname, '../..');
const level = Number(process.argv.find(arg => arg.startsWith('--level='))?.slice('--level='.length) || 4);
const chapter = Number(process.argv.find(arg => arg.startsWith('--chapter='))?.slice('--chapter='.length) || 2);
const settings = level === 8 && chapter === 5 ? {
  directory: 'the-courage-to-speak', title: 'The Courage to Speak', englishOnly: true,
  label: 'TOEIC 785–940',
  reading: { 3: 'Forum summary: a shared channel for different concerns', 8: 'Season closing: lessons beyond the microphone' },
  mission: { 3: 'Forum handover: agreement and open questions', 8: 'After recording: reflection note' },
  privateLine: 'Emi, you examined the company’s rationale without treating the representative as an enemy.',
} : level === 8 && chapter === 3 ? {
  directory: 'the-price-of-belonging', title: 'The Price of Belonging', englishOnly: true,
  label: 'TOEIC 785–940',
  reading: { 3: 'Housing research: a concern is not an individual assessment', 8: 'Confidential review: more than one pressure' },
  mission: { 3: 'Housing research: fairness review', 8: 'Private café review: next-step limits' },
  privateLine: 'Emi, Yuna is thirty and works full-time at a supermarket, yet she struggles to make ends meet.',
} : level === 8 && chapter === 2 ? {
  directory: 'behind-closed-doors', title: 'Behind Closed Doors', englishOnly: true,
  label: 'TOEIC 785–940',
  reading: { 3: 'Private conversation review: risk before a decision', 8: 'Editorial review: an important topic is not permission' },
  mission: { 3: 'Jun conversation: participation review', 8: 'Family-pressure episode: planning brief' },
  privateLine: 'Emi, Yuko is forty-two and divorced three years ago.',
} : level === 8 && chapter === 1 ? {
  directory: 'behind-the-smiles', title: 'Behind the Smiles', englishOnly: true,
  label: 'TOEIC 785–940',
  reading: { 3: 'Interview notes: familiar streets, fewer conversations', 8: 'Sayuri interview: respect without the same life plan' },
  mission: { 3: 'Gathering invitation follow-up', 8: 'Sayuri interview: editorial note' },
  privateLine: 'Emi, Ayaka’s account challenges the idea that a public image tells us how someone’s whole life feels.',
} : level === 7 && chapter === 5 ? {
  directory: 'one-last-encore', title: 'One Last Encore', englishOnly: true,
  reading: { 3: 'Venue visit: thirteen people listening', 8: 'Festival report: an acoustic opening and a short encore' },
  mission: { 3: 'Venue visit follow-up', 8: 'After-set debrief' },
  privateLine: 'Kai, you made a convincing case for Quiet Streets.',
} : level === 7 && chapter === 4 ? {
  directory: 'the-price-of-fame', title: 'The Price of Fame', englishOnly: true,
  reading: { 3: 'Quiet Streets: writing, timing and image', 8: 'Schedule review: promotion with room to prepare' },
  mission: { 3: 'Quiet Streets discussion note', 8: 'Revised schedule handover' },
  privateLine: 'Kai, you politely declined a photograph because you were exhausted after recording.',
} : level === 7 && chapter === 3 ? {
  directory: 'behind-the-contract', title: 'Behind the Contract', englishOnly: true,
  reading: { 3: 'Producer meeting: audience and identity', 8: 'Negotiation summary: a smaller first partnership' },
  mission: { 3: 'Creative priorities note', 8: 'Counterproposal follow-up note' },
  privateLine: 'Kai, look closely at these clauses.',
} : level === 7 && chapter === 2 ? {
  directory: 'the-algorithm-never-sleeps', title: 'The Algorithm Never Sleeps', englishOnly: true,
  reading: { 3: 'Community update: support without a request', 8: 'Showcase update: invitation restored' },
  mission: { 3: 'Community response note', 8: 'Showcase preparation note' },
  privateLine: 'Kai, we received the venue’s permission and shared the full recording with a short statement.',
} : level === 7 && chapter === 1 ? {
  directory: 'before-the-spotlight', title: 'Before the Spotlight', englishOnly: true,
  reading: { 3: 'Campaign meeting: a modest first plan', 8: 'Morning update: the performance clip' },
  mission: { 3: 'Campaign focus note', 8: 'Clip comparison note' },
  privateLine: 'Kai, the melody of Paper Skyline is memorable.',
} : level === 6 && chapter === 5 ? {
  directory: 'what-we-leave-behind', title: 'What We Leave Behind', englishOnly: true,
  reading: { 3: 'Workshop history: Mrs. Takeda’s account', 8: 'Autumn exhibition: the last full-time demonstration' },
  mission: { 3: 'Caption planning note', 8: 'After the demonstration: visitor response' },
  privateLine: 'Haru, we should weigh up the options:',
} : level === 6 && chapter === 3 ? {
  directory: 'the-taste-of-tradition', title: 'The Taste of Tradition', englishOnly: true,
  reading: { 3: 'Monday: Kyoto pickle shop', 8: 'Event day: an alternative accepted' },
  mission: { 3: 'Pickle-shop research note', 8: 'Visitor information: learning from cooks' },
  privateLine: 'Daniel, these small dishes let us enjoy variety',
} : level === 6 && chapter === 2 ? {
  directory: 'beyond-the-workshop', title: 'Beyond the Workshop', englishOnly: true,
  reading: { 3: 'Yui’s interview at the paper workshop', 8: 'Kanazawa: early edit review' },
  mission: { 3: 'Yui interview: editing note', 8: 'Documentary revision checklist' },
  privateLine: 'First, watch the plant fibres in the water.',
} : level === 6 && chapter === 1 ? {
  directory: 'keeping-traditions-alive', title: 'Keeping Traditions Alive', englishOnly: true,
  reading: { 3: 'Wednesday: the host’s introduction', 8: 'Festival morning: team update' },
  mission: { 3: 'Guest note from Ms. Nakamura', 8: 'Indoor workshop handover' },
  privateLine: 'Before you begin, watch how I hold the brush.',
} : level === 5 && chapter === 5 ? {
  directory: 'the-price-of-truth', title: 'The Price of Truth',
  reading: { 3: 'Wednesday: financial review findings', 8: 'Company update: two weeks later' },
  mission: { 3: 'Forecast correction note', 8: 'Next steps handover' },
  privateLine: 'Kuroda says he approved the outside review because time was short.',
} : level === 5 && chapter === 4 ? {
  directory: 'difficult-choices', title: 'Difficult Choices',
  reading: { 3: 'Tuesday: proposal meeting', 8: 'Friday: a difficult conversation' },
  mission: { 3: 'Proposal work note', 8: 'Private discussion note' },
  privateLine: 'Mika, I compared two reports.',
} : level === 5 && chapter === 3 ? {
  directory: 'the-missing-proposal', title: 'The Missing Proposal',
  reading: { 3: 'Private meeting record', 8: 'Friday: emergency meeting' },
  mission: { 3: 'Email check note', 8: 'Friday response tasks' },
  privateLine: 'Please do not delete or change project files.',
} : level === 5 && chapter === 1 ? {
  directory: 'first-impressions', title: 'First Impressions',
  reading: { 3: 'Younger travellers use social media', 8: 'Mika hears part of an argument' },
  mission: { 3: 'Review note', 8: 'Work note from Soo-jin' },
  privateLine: 'We have not won the job yet.',
} : level === 4 ? {
  1: {
    directory: 'after-the-truth', title: 'After the Truth',
    reading: { 3: "Claire's view", 8: "Emma's letter to Leo" },
    mission: { 3: 'before six', 8: 'does not mean we are getting back together' },
    privateLine: 'I have posted the handover notes in the team channel.',
  },
  2: {
    directory: 'new-paths', title: 'New Paths, Unexpected Feelings',
    reading: { 3: 'Exhibition design - team feedback', 8: "Leo's confirmation after the call" },
    mission: { 3: 'address below the map', 8: 'not rented a shop or set an opening date' },
    privateLine: 'Hold the camera still with both hands.',
  },
  3: {
    directory: 'a-little-closer', title: 'A Little Closer',
    reading: { 3: 'Nao stopped outside the cafe.', 8: 'While Leo and Ren carried the last frame' },
    mission: { 3: 'leave by 4:25', 8: 'checking the photo order, not avoiding you' },
    privateLine: 'If my train is delayed, I will message you before our meeting time.',
  },
  4: {
    directory: 'dreams-in-motion', title: 'Dreams in Motion',
    reading: { 3: 'Confirmed event fund: ¥40,000', 8: 'Sunday, 9:40 a.m. - Rain Update' },
    mission: { 3: 'Total: ¥35,000. Reserve: ¥5,000', 8: 'Photo prints are now on the back wall' },
    privateLine: "Ren, please prepare the online poster using Emma's approved logo.",
  },
  5: {
    directory: 'where-we-belong', title: 'Where We Belong',
    reading: { 3: 'Client decision - Seoul project', 8: 'Notes for the farewell album' },
    mission: { 3: 'Written assignment terms - updated offer', 8: "Farewell dinner - Claire's new note" },
    privateLine: 'We found an adapter you can borrow free of charge.',
  },
}[chapter] : undefined;
if (!settings) throw Error('Supported render checks: Level 4 Chapters 1-5, Level 5 Chapters 1, 3, 4 and 5, Level 6 Chapters 1-3 and 5, Level 7 Chapters 1-5, and Level 8 Chapters 1-3 and 5.');
const numbers = [1, 2, 3, 4, 6, 7, 8, 9];
const onlyLesson = Number(process.argv.find(arg => arg.startsWith('--lesson='))?.slice('--lesson='.length) || 0);
const lessons = numbers.map(n => JSON.parse(readFileSync(resolve(root, `output/${settings.directory}/lesson-${n}.json`), 'utf8')));
assert(lessons.every(lesson => lesson.level === level && lesson.chapter === chapter), 'Fixtures must use the requested curriculum placement.');
const output = resolve(root, `output/${settings.directory}/screenshots`);
mkdirSync(output, { recursive: true });
const configs = [
  ['dashboard', 1440, 'light', numbers], ['tutor', 1440, 'dark', numbers], ['student', 390, 'dark', numbers],
  ['dashboard', 390, 'dark', [2, 3, 8]], ['tutor', 390, 'light', [2, 3, 8]], ['student', 1440, 'light', [2, 3, 8]],
];
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const [role, width, theme, selected] of configs) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme });
      await context.addInitScript(({ lessons, theme }) => {
        localStorage.setItem('csve-theme', theme);
        localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 }));
        for (const lesson of lessons) sessionStorage.setItem(`preview-${lesson.id}`, JSON.stringify(lesson));
      }, { lessons, theme });
      let lesson;
      await context.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(?:localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, route => {
        const request = route.request(), path = new URL(request.url()).pathname;
        if (request.method() !== 'GET') return route.fulfill({ status: 403, json: { error: 'No test writes' } });
        const user = { userId: 'new-paths-' + role, id: 'new-paths-' + role, role: role === 'dashboard' ? 'superadmin' : role, firstName: 'Test', givenName: 'Test' };
        const json = { success: true, lesson, user, data: [], lessons: [] };
        if (path === '/proof/tutor-certification/me') json.data = { snapshot: { writtenPassed: true, speakingPassed: true, profileApproved: true, interviewPassed: true, missingRequirements: [] } };
        if (path === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        return route.fulfill({ json });
      });
      for (const number of selected) {
        if (onlyLesson && number !== onlyLesson) continue;
        lesson = lessons.find(l => l.lessonNumber === number);
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const path = role === 'dashboard' ? '/conversational-skills-preview/' : '/materials/conversational-skills/';
        await page.goto(`https://${role}.fluentxverse.com${path}${lesson.id}?theme=${theme}`, { waitUntil: 'domcontentloaded' });
        const full = page.locator('.csp-fullpage');
        await expect(full).toContainText(lesson.lessonName);
        await expect(full).toContainText(settings.title);
        if (settings.label) await expect(page.locator('.csp-fullpage').first()).toContainText(settings.label);
        if (settings.englishOnly) {
          assert(!/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(await full.innerText()), 'English-only material must not render Japanese');
          await expect(page.locator('.csp-expr-item')).toHaveCount(4);
          await expect(page.locator('.csp-vocab-card')).toHaveCount(0);
          await expect(full).toContainText('STEP A: EXPRESSIONS');
          await expect(page.locator('.csp-pronunciation-part')).toHaveCount(0);
          await expect(full).not.toContainText(/reading cues|\bIPA\b|comfortable accent|consistent accent|forced accents/i);
          await expect(full).not.toContainText('Part III');
          const pronunciation = page.locator('section.csp-stepb-section');
          await expect(pronunciation).toContainText('STEP B: PRONUNCIATION');
          await expect(pronunciation.locator('.csp-phrases-row')).toHaveCount(2);
          for (const [i, item] of lesson.stepBData.pronunciation.phrases.entries()) {
            const row = pronunciation.locator('.csp-phrases-row').nth(i);
            await expect(row).toContainText(item.phrase);
            await expect(row).toContainText(item.pronunciationGuide);
            const bold = row.locator('.csp-phrases-col-example strong');
            assert(await bold.count() >= 1, 'Sentence examples must bold the stressed parts');
            assert((await row.locator('.csp-phrases-col-example').innerText()).trim().length > (await bold.allTextContents()).join('').length, 'Only stressed parts, not the whole sentence, should be bold');
          }
          await expect(page.locator('.csp-expr-definition strong')).toHaveCount(4);
          await expect(page.locator('.csp-expr-example')).toHaveCount(4);
          for (const example of await page.locator('.csp-expr-example').all()) assert(await example.locator('strong').count() >= 1, 'Each example highlights the expression');
          for (const expression of lesson.learnData.steps[0].expressionItems) await expect(full).toContainText(expression.definitionLine.replace(/<[^>]*>/g, ''));
        } else await expect(full).toContainText(lesson.goalTextJp);
        await expect(page.locator('.csp-apply-activity-title')).toHaveText(lesson.skill.toUpperCase());
        await expect(full).not.toContainText(/\bkiss(?:ed|es|ing)?\b|invented adult character|No personal or romantic/i);
        await expect(page.locator('.csp-intro-image img, .csp-apply-image img, .csp-mission-image img')).toHaveCount(0);
        const mission = page.locator('.csp-mission-section').first();
        await expect(mission).toContainText(lesson.missionData.situation.match(/^You are \w+/)[0]);
        await expect(mission.locator('.csp-grammar-tip-items li')).toHaveCount(lesson.missionData.grammarTipItems.length);
        await expect(page.locator('.csp-mission-topic-card')).toHaveCount(3);
        if (lesson.skill === 'speaking') {
          await expect(page.locator('.csp-dialogue-line')).toHaveCount(10);
          await expect(page.locator('.csp-mission-reading-passage')).toHaveCount(0);
        } else if (lesson.skill === 'reading') {
          await expect(page.locator('.csp-reading-text-content')).toContainText(settings.reading[number]);
          await expect(mission.locator('.csp-mission-reading-passage')).toContainText(settings.mission[number]);
        } else {
          await expect(page.locator('.csp-dialogue-line')).toHaveCount(0);
          if (role === 'student') await expect(full).not.toContainText(settings.privateLine);
          else await expect(full).toContainText(settings.privateLine);
        }
        if (role === 'student') await expect(page.locator('.csp-guide-step:visible')).toHaveCount(0);
        else {
          await expect(page.locator('.csp-apply-layout .csp-guide-step')).toHaveCount(2);
          await expect(mission.locator('.csp-guide-step')).toHaveCount(lesson.skill === 'speaking' ? 3 : 4);
          await expect(page.locator('.csp-feedback-layout .csp-guide-step')).toHaveCount(6);
        }
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Lesson ${number} ${role}: overflow`);
        assert.deepEqual(errors, []);
        await page.locator('.csp-apply-section').evaluate(el => el.scrollIntoView({ block: 'start' }));
        await page.screenshot({ path: resolve(output, `lesson${number}-${role}-${width}-${theme}-apply.png`) });
        if (settings.englishOnly) {
          await page.locator('section.csp-stepb-section').evaluate(el => el.scrollIntoView({ block: 'start' }));
          await page.screenshot({ path: resolve(output, `lesson${number}-${role}-${width}-${theme}-pronunciation.png`) });
        }
        if (settings.englishOnly && number === 1) {
          const rows = page.locator('.csp-expr-item');
          for (const i of [0, 3]) {
            await rows.nth(i).evaluate(el => el.scrollIntoView({ block: 'center' }));
            await expect(rows.nth(i).locator('.csp-expr-definition')).toBeVisible();
            await expect(rows.nth(i).locator('.csp-expr-example')).toBeVisible();
            await page.screenshot({ path: resolve(output, `lesson${number}-${role}-${width}-${theme}-expression${i + 1}.png`) });
          }
        }
        if (lesson.skill === 'reading') await mission.locator('.csp-mission-reading-passage').screenshot({ path: resolve(output, `lesson${number}-${role}-${width}-${theme}-mission.png`) });
        await page.close();
        console.log(`PASS Level ${level} Chapter ${chapter} Lesson ${number}: ${role} ${width} ${theme}`);
      }
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
