import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join, isAbsolute, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const applications = [
  { name: 'fluentxverse-student', directory: 'fluentxverse-student-solid-prototype', kind: 'web', lock: true, shared: true, homepage: 'https://student.fluentxverse.com', description: 'SolidJS student app for tutor discovery, lesson booking, live classrooms, and private learning workflows.' },
  { name: 'fluentxverse-tutor', directory: 'fluentxverse-tutor-solid-prototype', kind: 'web', lock: true, shared: true, homepage: 'https://tutor.fluentxverse.com', description: 'SolidJS tutor app for applications, screening, schedules, live lessons, and teaching operations.' },
  { name: 'fluentxverse-dashboard', directory: 'fluentxverse-dashboard', kind: 'web', shared: true, contracts: ['fluentxverse-server/src/shared/tutorCompensation.ts'], homepage: 'https://dashboard.fluentxverse.com', description: 'Administration dashboard for tutor screening, interviews, lesson operations, compensation, and release acceptance.' },
  { name: 'fluentxverse-site', directory: 'fluentxverse-site', kind: 'web', homepage: 'https://fluentxverse.com', description: 'Public FluentXVerse website describing the tutoring platform, ecosystem, and privacy technology.' },
  { name: 'fluentxverse-server', directory: 'fluentxverse-server', kind: 'server', support: ['contracts/', 'zk/review-tally/'], description: 'Bun and Elysia application API for tutoring, scheduling, screening evidence, recordings, and compensation.' },
  { name: 'fluentxverse-mobile', directory: 'fluentxverse-mobile', kind: 'mobile', contracts: ['fluentxverse-server/MOBILE_API.md'], description: 'Kotlin Multiplatform student client with Android Compose, iOS SwiftUI, mobile authentication, and an offline demo.' },
  { name: 'fluentxverse-go-server', directory: 'fluentxverse-go-server', kind: 'go', description: 'Go Fiber backend migration workstream; not a replacement for the active Bun API by default.' },
];

export function excluded(path) {
  const parts = path.split('/');
  const name = parts.at(-1);
  if (parts.some(part => ['node_modules', '.git', '.wrangler', '.gradle', '.kotlin', 'dist', 'build', 'target', 'backups', 'uploads', 'recordings', 'coverage', 'xcuserdata', 'test-results'].includes(part))) return true;
  if (/^\.env(?:\.|$)/.test(name) && !name.endsWith('.example')) return true;
  if (/\.env$/.test(name) || /\.(?:pem|key|p12|pfx|jks|keystore|sqlite|sqlite3|db|log|ptau|zkey|wtns|r1cs|sym|wasm|apk|ipa)$/.test(name)) return true;
  return ['local.properties', '.DS_Store'].includes(name);
}

function git(args, options = {}) {
  return execFileSync('git', args, { cwd: root, maxBuffer: 128 * 1024 * 1024, ...options });
}

function rootPackage(app) {
  const prefix = `npm --prefix ${app.directory}`;
  const scripts = {
    setup: app.lock ? `${prefix} ci --workspaces=false` : `cd ${app.directory} && bun install`,
    dev: `${prefix} run dev`,
  };
  if (app.kind === 'web') {
    scripts.build = `${prefix} run build`;
    scripts.preview = `${prefix} run preview`;
  } else {
    scripts.start = `${prefix} run start`;
    scripts.typecheck = `cd ${app.directory} && bunx tsc --noEmit --project tsconfig.standalone.json`;
  }
  if (app.name === 'fluentxverse-student') scripts.test = `cd ${app.directory} && bun test tests/unit.test.ts tests/productionEndpoints.test.ts tests/lessonPassVault.test.ts`;
  if (app.name === 'fluentxverse-tutor') scripts.test = `cd ${app.directory} && bun test tests/unit.test.ts tests/attendanceReminder.test.ts tests/classroomSessionRefresh.test.ts tests/classroomMedia.test.ts tests/conversationalExerciseMarks.test.ts tests/dispatchLibrary.test.ts tests/lessonMaterialPosition.test.ts tests/lessonNotesIcons.test.ts tests/lessonVocabulary.test.ts tests/mediaUrl.test.ts tests/notificationLink.test.ts tests/productionEndpoints.test.ts tests/schedulePeriod.test.ts`;
  return { name: `${app.name}-source`, private: true, description: app.description, scripts };
}

function workflow(app) {
  const check = app.kind === 'web' ? 'npm run build' : 'npm run typecheck';
  const tests = ['fluentxverse-student', 'fluentxverse-tutor'].includes(app.name) ? '\n      - run: npm test' : '';
  return `name: Source Checks
on: [push, pull_request, workflow_dispatch]
permissions:
  contents: read
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: '1.3.3'
      - run: npm run setup
      - run: ${check}${tests}
`;
}

const ignore = `node_modules/
dist/
build/
target/
.wrangler/
.gradle/
.kotlin/
.env
.env.*
!.env.example
!*.env.example
*.local
*.log
*.pem
*.key
*.p12
*.jks
*.keystore
*.ptau
*.zkey
*.wtns
*.sqlite*
uploads/
recordings/
coverage/
local.properties
test-results/
.DS_Store
`;

function main() {
  const args = process.argv.slice(2);
  const option = key => {
    const index = args.indexOf(key);
    if (index === -1) return undefined;
    if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Missing value for ${key}`);
    return args[index + 1];
  };
  if (args.includes('--list')) {
    console.log(JSON.stringify(applications, null, 2));
    return;
  }
  const destination = option('--destination');
  if (!destination || !isAbsolute(destination)) throw new Error('Use --destination /absolute/path outside the monorepo. Existing repository directories are never overwritten.');
  const dest = resolve(destination);
  const rel = relative(root, dest);
  if (!rel || (!rel.startsWith('..') && !isAbsolute(rel))) throw new Error('Destination must be outside the monorepo.');
  const requested = option('--app');
  const selected = requested ? applications.filter(app => app.name === requested) : applications;
  if (!selected.length) throw new Error(`Unknown app: ${requested}`);
  const commit = git(['rev-parse', '--verify', `${option('--ref') || 'HEAD'}^{commit}`], { encoding: 'utf8' }).trim();
  const tree = git(['ls-tree', '-r', '-z', commit], { encoding: 'utf8' }).split('\0').filter(Boolean).map(entry => {
    const [metadata, path] = entry.split('\t');
    const [mode, type, oid] = metadata.split(' ');
    return { mode, type, oid, path };
  });
  const generated = [];
  for (const app of selected) {
    const target = join(dest, app.name);
    if (existsSync(target)) throw new Error(`Refusing to overwrite ${target}`);
    const entries = tree.filter(entry => entry.path.startsWith(`${app.directory}/`) || (app.shared && entry.path.startsWith('shared/')) || app.contracts?.includes(entry.path) || app.support?.some(prefix => entry.path.startsWith(prefix)));
    const files = entries.filter(entry => !excluded(entry.path));
    if (!files.some(entry => entry.path.startsWith(`${app.directory}/`))) throw new Error(`No source found for ${app.name}`);
    if (files.some(entry => entry.type !== 'blob' || entry.mode === '120000')) throw new Error(`Submodules and symlinks require manual review in ${app.name}`);
    mkdirSync(target, { recursive: true });
    for (const entry of files) {
      const output = join(target, entry.path);
      mkdirSync(dirname(output), { recursive: true });
      writeFileSync(output, git(['cat-file', 'blob', entry.oid]), { mode: entry.mode === '100755' ? 0o755 : 0o644 });
    }
    const template = readFileSync(join(root, 'docs', 'app-repositories', `${app.name}.md`), 'utf8');
    const footer = `\n## Repository Provenance\n\nThis repository is an app-focused export of [the FluentXVerse monorepo](https://github.com/fluentxverse/fluentxverse-monorepo). The monorepo remains the source of truth; submit cross-application changes there. Existing directory names are retained so shared imports remain valid. The historical student/tutor folder suffix does not indicate a Preact app: both active web clients use SolidJS.\n\nExported source commit: [\`${commit.slice(0, 12)}\`](https://github.com/fluentxverse/fluentxverse-monorepo/tree/${commit}). See [SOURCE.json](SOURCE.json) for the exact scope. Local uncommitted edits, environment files, runtime data, curriculum backups, and generated proving artifacts are not published. Original Git history is not copied.\n\nCross-app parity tests and full deployment orchestration remain in the monorepo. The checks in this repository do not establish production acceptance, security audit completion, or proof-system review. No production deployment is triggered by this export.\n\n## Security and Licensing\n\nNever commit API tokens, seed phrases, private keys, student records, recordings, or real assessment evidence. Use synthetic fixtures in tests. Report security issues privately to hello@fluentxverse.com rather than opening an issue containing sensitive data.\n\nNo root license file was present in the source revision. Public source availability, if enabled, is not itself a license grant. Contact FluentXVerse for licensing terms; third-party dependencies retain their own licenses.\n`;
    writeFileSync(join(target, 'README.md'), template + footer);
    writeFileSync(join(target, '.gitignore'), ignore);
    writeFileSync(join(target, 'SOURCE.json'), JSON.stringify({ monorepo: 'https://github.com/fluentxverse/fluentxverse-monorepo', commit, app: app.directory, includedFiles: files.map(entry => entry.path), excludedFiles: entries.filter(entry => excluded(entry.path)).map(entry => entry.path) }, null, 2) + '\n');
    if (['web', 'server'].includes(app.kind)) {
      writeFileSync(join(target, 'package.json'), JSON.stringify(rootPackage(app), null, 2) + '\n');
      mkdirSync(join(target, '.github', 'workflows'), { recursive: true });
      writeFileSync(join(target, '.github', 'workflows', 'checks.yml'), workflow(app));
    }
    if (app.kind === 'server') {
      writeFileSync(join(target, app.directory, 'tsconfig.standalone.json'), JSON.stringify({ extends: './tsconfig.json', include: ['src/**/*.ts'], exclude: ['node_modules', 'tests', 'scripts', 'circuits'] }, null, 2) + '\n');
    }
    if (app.kind === 'web') {
      const env = app.name === 'fluentxverse-student' ? 'VITE_PRIVY_APP_ID=\nVITE_STUDENT_API_URL=http://localhost:8765\nVITE_STUDENT_SOCKET_URL=http://localhost:8767\nVITE_TICKET_CHAIN_ID=84532\nVITE_TICKET_RPC_URL=https://sepolia.base.org\n' : app.name === 'fluentxverse-tutor' ? 'VITE_TUTOR_API_URL=http://localhost:8765\nVITE_TUTOR_SOCKET_URL=http://localhost:8767\nVITE_ENABLE_NOTIFICATION_SOCKET=true\n' : app.name === 'fluentxverse-dashboard' ? 'VITE_API_URL=http://localhost:8765\nVITE_SOCKET_URL=http://localhost:8767\n' : '# Static public site; no credentials required.\n';
      writeFileSync(join(target, app.directory, '.env.example'), env);
    }
    generated.push({ name: app.name, target, files: files.length, omitted: entries.length - files.length });
  }
  console.log(JSON.stringify({ commit, repositories: generated }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
