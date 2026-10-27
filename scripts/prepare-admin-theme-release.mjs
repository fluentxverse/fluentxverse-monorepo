import { cpSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baseline = join(root, 'output/release/dashboard-mail-header-20261022');
const release = join(root, 'output/release/dashboard-admin-theme-20261022');
const previous = JSON.parse(readFileSync(join(baseline, 'dashboard-deployment.json'))).version;
if (previous !== 'a2c27179-eae0-42ce-9d6b-33ef6783f150') throw Error('Review changed dashboard baseline.');
mkdirSync(release, {recursive:true});
if (!existsSync(join(release, 'frontend'))) cpSync(join(baseline, 'frontend'), join(release, 'frontend'), {
  recursive:true, dereference:false, verbatimSymlinks:true,
  filter: source => !['dist', '.wrangler'].includes(source.split('/').at(-1)),
});
const {files:styles} = createRequire(import.meta.url)('./tokenize-admin-colors.cjs');
const files = ['index.html', ...styles.map(path => `src/${path}`),
  'src/App.tsx', 'src/main.tsx', 'src/context/ThemeContext.tsx', 'src/theme/adminTheme.ts', 'src/styles/admin-theme.css',
  'src/components/Header.tsx', 'src/pages/SettingsPage.tsx', 'src/pages/DashboardPage.tsx', 'src/pages/AnalyticsPage.tsx',
  'tests/adminTheme.test.ts', 'tests/browser/adminTheme.cjs', 'tests/browser/adminDesign.cjs', 'tests/browser/email.cjs',
];
const manifest = { previousDashboard:previous, createdAt:new Date().toISOString(), files:{} };
for(const path of files) {
  const from=join(root,'fluentxverse-dashboard',path), to=join(release,'frontend/fluentxverse-dashboard',path);
  mkdirSync(dirname(to),{recursive:true}); copyFileSync(from,to);
  manifest.files[path]=createHash('sha256').update(readFileSync(from)).digest('hex');
}
writeFileSync(join(release,'source-manifest.json'),JSON.stringify(manifest,null,2));
console.log(`Prepared scoped admin theme frontend: ${files.length} files. No API, mailbox configuration, or unrelated worktree changes included.`);
