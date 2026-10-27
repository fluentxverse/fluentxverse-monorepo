import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync, symlinkSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const release = join(root, 'output/release/dashboard-email-20261021');
const source = join(release, 'frontend');
const image = join(release, 'api');
const previous = 'fluentxverse-server:zk-security-20261020';
const run = (args, options = {}) => execFileSync(args[0], args.slice(1), { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options });
const old = JSON.parse(run(['docker', 'inspect', 'fluentxverse-server']))[0];
if (old.Config.Image !== previous) throw Error('API base changed; review before preparing the release.');
mkdirSync(source, { recursive: true }); mkdirSync(join(image, 'src'), { recursive: true });
const commit = run(['git', 'rev-parse', 'HEAD']).trim();
const archive = execFileSync('git', ['archive', commit, 'fluentxverse-dashboard', 'shared', 'fluentxverse-server/src/shared'], { cwd: root, maxBuffer: 256 * 1024 * 1024 });
execFileSync('tar', ['-x', '-C', source], { input: archive });
const manifest = { commit, previousImage: previous, baseImageId: old.Image, createdAt: new Date().toISOString(), files: {} };
function overlay(relative, targetRoot, targetRelative = relative) {
  const from = join(root, relative), to = join(targetRoot, targetRelative);
  if (readdirSafe(from)) { for (const child of readdirSync(from)) overlay(`${relative}/${child}`, targetRoot, `${targetRelative}/${child}`); return; }
  mkdirSync(dirname(to), { recursive: true }); copyFileSync(from, to);
  manifest.files[relative] = createHash('sha256').update(readFileSync(to)).digest('hex');
}
function readdirSafe(path) { try { readdirSync(path); return true; } catch (error) { if (error.code !== 'ENOTDIR') throw error; return false; } }
for (const file of ['package.json', 'src/App.tsx', 'src/components/Header.tsx', 'src/components/Sidebar.tsx', 'src/api/mail.api.ts', 'src/components/mail', 'src/pages/EmailPage.tsx', 'src/pages/EmailPage.css', 'tests/browser/email.cjs']) overlay(`fluentxverse-dashboard/${file}`, source);
overlay('shared/mail.ts', source);
// These two worktree changes are already present in the public dashboard's users chunk.
for (const file of ['src/api/admin.api.ts', 'src/pages/TutorsPage.tsx']) overlay(`fluentxverse-dashboard/${file}`, source);
if (!existsSync(join(source, 'node_modules'))) symlinkSync(join(root, 'node_modules'), join(source, 'node_modules'), 'dir');
const liveIndex = run(['docker', 'exec', 'fluentxverse-server', 'cat', '/app/src/index.ts']);
writeFileSync(join(release, 'previous-api-index.ts'), liveIndex);
function once(text, before, after) {
  if (text.split(before).length !== 2) throw Error('Ambiguous API integration anchor: ' + before);
  return text.replace(before, after);
}
let index = once(liveIndex, "import { testingChecklistRoute } from './routes/testingChecklist.route';", "import { testingChecklistRoute } from './routes/testingChecklist.route';\nimport { mailRoute } from './routes/mail.route';\nimport { mailFailure } from './services/mail/mailPolicy';");
index = once(index, '    const requestId = (request as any).requestId;', `    const requestId = (request as any).requestId;
    if (path.startsWith('/admin/mail/')) {
      const response = mailFailure(error, String(code));
      set.status = response.status;
      set.headers['Cache-Control'] = 'private, no-store';
      return response.body;
    }`);
index = once(index, '  .use(testingChecklistRoute)', '  .use(testingChecklistRoute)\n  .use(mailRoute)');
writeFileSync(join(image, 'src/index.ts'), index);
overlay('fluentxverse-server/src/routes/mail.route.ts', image, 'src/routes/mail.route.ts');
overlay('fluentxverse-server/src/services/mail', image, 'src/services/mail');
overlay('fluentxverse-server/tests/mail.test.ts', image, 'tests/mail.test.ts');
mkdirSync(join(image, 'dependencies'), { recursive: true });
writeFileSync(join(image, 'dependencies/package.json'), JSON.stringify({ name: 'fluentxverse-mail-runtime', private: true, type: 'module', dependencies: {
  imapflow: '2.5.9', nodemailer: '10.1.7', mailparser: '3.10.0', 'sanitize-html': '2.18.1', zod: '4.6.5',
} }, null, 2));
writeFileSync(join(image, 'Dockerfile'), `FROM ${previous} AS mail-dependencies
USER root
WORKDIR /mail-dependencies
COPY dependencies/package.json ./package.json
RUN bun install --production --ignore-scripts
FROM ${previous} AS release
COPY --from=mail-dependencies --chown=appuser:appgroup /mail-dependencies/node_modules /app/src/services/mail/node_modules
COPY --chown=appuser:appgroup src/index.ts /app/src/index.ts
COPY --chown=appuser:appgroup src/routes/mail.route.ts /app/src/routes/mail.route.ts
COPY --chown=appuser:appgroup src/services/mail /app/src/services/mail
FROM release AS test
COPY --chown=appuser:appgroup tests/mail.test.ts /app/tests/mail.test.ts
RUN ln -s /app/src/services/mail/node_modules /app/tests/node_modules
`);
writeFileSync(join(release, 'source-manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Prepared email-only frontend and API release:', release);
