// One-time, idempotent migration of workspace colors. Lesson documents are deliberately excluded.
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const values = require('postcss-value-parser');
const root = path.resolve(__dirname, '../fluentxverse-dashboard');
const files = [
  'styles/global.css', 'styles/admin-workspace.css',
  'pages/LessonMaterialMakerPage.css',
  ...['Header', 'Sidebar', 'ActivityTimestamp', 'OperationsAccountModal', 'TutorCompensation', 'PrivateDisputeEvidence'].map(name => `components/${name}.css`),
  ...['SimpleChart', 'InterviewResultModal', 'InterviewFeedback', 'Toast/Toast', 'Common/OfflineBanner', 'Common/SessionExpiredModal'].map(name => `Components/${name}.css`),
  ...['DashboardPage', 'TutorsPage', 'StudentsPage', 'ApplicationsPage', 'SessionsPage', 'RecordingsPage', 'AnalyticsPage', 'InboxPage', 'TicketsPage', 'AdminTasksPage', 'TestingPage', 'LessonOperationsPage', 'SettingsPage', 'AdminsPage', 'LoginPage', 'InterviewSchedulePage', 'PlatformOverviewPage', 'CeoOrientationPage', 'EmailPage', 'ConversationalSkillsEditorPage', 'BusinessEnglishEditorPage', 'YoungLearnersEditorPage', 'DailyDispatchEditorPage'].map(name => `pages/${name}.css`),
];
const custom = { '--mail-blue': 'accent', '--mail-line': 'border', '--mail-muted': 'muted', '--mail-ink': 'text' };
function rgb(word) {
  if (word === 'white') return [255, 255, 255];
  if (word === 'black') return [0, 0, 0];
  if (!/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(word)) return null;
  const hex = word.slice(1).length === 3 ? word.slice(1).split('').map(c => c + c).join('') : word.slice(1);
  return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
}
function palette(channels) {
  const [r, g, b] = channels.map(n => n / 255);
  const hi = Math.max(r, g, b), lo = Math.min(r, g, b), delta = hi - lo, light = (hi + lo) / 2;
  let hue = delta === 0 ? 0 : hi === r ? ((g - b) / delta) % 6 : hi === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;
  const neutral = delta < .09 || delta / (1 - Math.abs(2 * light - 1) || 1) < .23;
  const family = neutral ? 'neutral' : hue < 15 || hue >= 335 ? 'danger' : hue < 75 ? 'warning' : hue < 165 ? 'success' : hue < 195 ? 'cyan' : hue < 265 ? 'accent' : 'purple';
  return { light, delta, family };
}
function token(word, kind) {
  const channels = rgb(word);
  if (!channels) return null;
  const { light, delta, family } = palette(channels);
  if (kind === 'foreground') {
    if (light > .86 && delta < .12) return null; // White text belongs to solid action backgrounds.
    if (family === 'neutral' || (delta < .3 && light < .65)) return light < .34 ? 'text' : 'muted';
    return family;
  }
  if (kind === 'border') return family === 'neutral' || delta < .18 ? 'border' : `border-${family}`;
  if (light < .72) return null; // Keep saturated buttons, dark code surfaces, and overlays intact.
  if (family !== 'neutral' && delta > .09) return `bg-${family}`;
  return light > .975 ? 'surface' : light > .94 ? 'surface-soft' : 'surface-muted';
}
function migrate() {
let changes = 0;
for (const relative of files) {
  const file = path.join(root, 'src', relative);
  if (!fs.existsSync(file)) throw new Error(`Missing curated stylesheet: ${relative}`);
  const css = postcss.parse(fs.readFileSync(file, 'utf8'));
  css.walkDecls(decl => {
    if (relative === 'pages/LessonMaterialMakerPage.css') {
      // Only the course/template management screen, never the authored lesson canvas.
      if (decl.source.start.line > 2270 || !/\.(?:lm-(?:course|level|chapter|lesson|template|stat|tab|page|header|filter|search|empty)|lmm-(?:container|tabs?|template|lesson|header|title|subtitle|empty|page-header))/.test(decl.parent.selector || '')) return;
    }
    if (decl.parent.selector?.includes(':root') || /shadow/.test(decl.prop)) return;
    let kind = /^(?:color|fill|stroke|text-decoration-color)$/.test(decl.prop) ? 'foreground'
      : /^(?:background|background-color|background-image)$/.test(decl.prop) ? 'background'
      : /^(?:border|outline)/.test(decl.prop) ? 'border' : null;
    if (custom[decl.prop]) {
      if (!decl.value.startsWith('var(--admin-')) decl.value = `var(--admin-${custom[decl.prop]}, ${decl.value})`;
      return;
    }
    if (!kind) return;
    const parsed = values(decl.value);
    parsed.walk(node => {
      if (node.type === 'function' && node.value === 'var') {
        const name = node.nodes[0]?.value;
        if (kind === 'foreground' && /^--(?:primary(?:-light|-dark)?|success|warning|error|info)$/.test(name)) {
          const family = name.startsWith('--primary') || name === '--info' ? 'accent' : name === '--error' ? 'danger' : name.slice(2);
          const original = values.stringify(node);
          node.type = 'word';
          node.value = `var(--admin-${family}, ${original})`;
          delete node.nodes;
        }
        return false;
      }
      if (node.type === 'function' && node.value === 'url') return false;
      if (kind === 'background' && node.type === 'function' && node.value === 'rgba') {
        const parts = node.nodes.filter(part => part.type === 'word').map(part => Number(part.value));
        if (parts.length === 4 && parts.every(Number.isFinite) && parts[3] >= .45) {
          const [r, g, b] = parts;
          const name = token('#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join(''), kind);
          if (name) {
            const original = values.stringify(node);
            node.type = 'word'; node.value = `var(--admin-${name}, ${original})`; delete node.nodes;
            changes++;
          }
        }
        return false;
      }
      if (node.type === 'word') {
        const name = token(node.value, kind);
        if (name) { node.value = `var(--admin-${name}, ${node.value})`; changes++; }
      }
    });
    decl.value = parsed.toString();
  });
  fs.writeFileSync(file, css.toString());
}
console.log(`Tokenized ${changes} workspace color literals across ${files.length} stylesheets.`);
}
module.exports = { files, migrate };
if (require.main === module) migrate();
