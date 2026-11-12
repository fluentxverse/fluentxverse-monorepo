const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const { readFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '../..');
const styles = [
  'fluentxverse-dashboard/src/pages/ConversationalSkillsPreview.css',
  'fluentxverse-tutor-solid-prototype/tutor/pages/ConversationalSkillsLessonPage.css',
  'fluentxverse-student-solid-prototype/student/pages/ConversationalSkillsLessonPage.css',
];
const roles = ['dashboard', 'tutor', 'student'];
const release = process.env.TIP_ALIGNMENT_RELEASE;

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const output = resolve(root, 'output/verification/conversation-tip-alignment');
  mkdirSync(output, { recursive: true });
  try {
    for (const [index, file] of styles.entries()) {
      let css = readFileSync(resolve(root, file), 'utf8');
      if (release) {
        const manifest = JSON.parse(readFileSync(resolve(release, 'manifest.json'), 'utf8'));
        const app = manifest.apps.find(app => app.role === roles[index]);
        const cssFile = app.tipCss;
        if (process.env.TIP_ALIGNMENT_LIVE === '1') {
          const response = await fetch(`https://${app.role}.fluentxverse.com/assets/${cssFile}`);
          assert(response.ok, 'Live stylesheet unavailable');
          css = await response.text();
        } else css = readFileSync(resolve(release, app.role, 'frontend', app.name, 'dist/assets', cssFile), 'utf8');
      }
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 700 });
        for (const dark of [false, true]) {
          await page.setContent(`<style>${css}</style><style>
            body { margin: 0; font-family: Arial, sans-serif; }
            .fixture { box-sizing: border-box; width: ${width === 390 ? 300 : 340}px; margin: 24px; padding: 16px; }
          </style><div class="csp-fullpage ${dark ? 'csp-dark' : ''}"><div class="fixture csp-guide-step">
            <div class="csp-guide-content">
              <p class="csp-apply-tip"><span class="csp-tip-icon">◆</span><span>Only the tutor can see this.</span></p>
              <p class="csp-apply-tip"><span class="csp-tip-icon">◆</span><span>Ask the student if it was clear, and repeat the script if necessary.</span></p>
              <p class="csp-apply-tip"><span class="csp-tip-icon">◆</span><span>Do Challenge 2 if there is still time.</span></p>
            </div>
          </div></div>`);
          const measurements = await page.locator('.csp-apply-tip').evaluateAll(tips => tips.map(tip => {
            const icon = tip.querySelector('.csp-tip-icon');
            const text = tip.lastElementChild;
            const range = document.createRange();
            range.setStart(text.firstChild, 0);
            range.setEnd(text.firstChild, 1);
            const firstLine = range.getBoundingClientRect();
            const marker = icon.getBoundingClientRect();
            return {
              offset: Math.abs(marker.y + marker.height / 2 - firstLine.y - firstLine.height / 2),
              markerLeft: marker.left, markerRight: marker.right, textLeft: text.getBoundingClientRect().left,
              wraps: text.getBoundingClientRect().height > parseFloat(getComputedStyle(tip).lineHeight) * 1.5,
            };
          }));
          await page.locator('.fixture').screenshot({ path: resolve(output, `${index}-${width}-${dark ? 'dark' : 'light'}.png`) });
          assert(measurements.every(m => m.offset <= 1.5), `${file} ${width} ${dark ? 'dark' : 'light'}: marker off first-line center ${JSON.stringify(measurements)}`);
          assert(measurements.every(m => m.markerRight < m.textLeft), 'Marker overlaps text');
          assert(measurements[1].wraps, 'Multiline case must wrap');
        }
      }
    }
    console.log('PASS: tip diamonds align with first text lines in all three renderers, desktop/mobile, light/dark.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
