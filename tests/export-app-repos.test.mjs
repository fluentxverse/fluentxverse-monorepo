import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applications, excluded } from '../scripts/export-app-repos.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = args => execFileSync(process.execPath, [join(root, 'scripts/export-app-repos.mjs'), ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

test('all seven application/service directories have plain, unique repository names', () => {
  assert.equal(applications.length, 7);
  assert.equal(new Set(applications.map(app => app.name)).size, applications.length);
  assert.ok(applications.every(app => /^fluentxverse-[a-z-]+$/.test(app.name)));
});

test('exclude credentials, local state, runtime data, and generated proof artifacts', () => {
  for (const path of ['app/.env', 'app/.env.production', 'app/config/lesson.env', 'app/private.key', 'app/identity.pem', 'app/recordings/a.mp4', 'app/uploads/a.png', 'app/backups/a.json', 'app/circuits/build/a.json', 'app/proof.zkey', 'app/witness.wtns', 'app/local.properties', 'app/node_modules/a.js', 'app/.wrangler/state.json', 'app/androidApp/build/a.apk']) {
    assert.equal(excluded(path), true, path);
  }
});

test('preserve source, examples, lockfiles, artwork, and executable mobile wrapper', () => {
  for (const path of ['app/.env.example', 'app/config/screening.env.example', 'app/src/App.tsx', 'app/package-lock.json', 'app/circuit.circom', 'app/public/logo.webp', 'app/gradlew', 'app/gradle/wrapper/gradle-wrapper.jar', 'shared/interviewCall.ts']) {
    assert.equal(excluded(path), false, path);
  }
});

test('dashboard includes its compensation contract and mobile includes its API contract', () => {
  assert.equal(applications.find(app => app.name === 'fluentxverse-server').shared, true);
  assert.equal(excluded('app/.dev/index.js'), true);
  assert.ok(applications.find(app => app.name === 'fluentxverse-dashboard').contracts.includes('fluentxverse-server/src/shared/tutorCompensation.ts'));
  assert.ok(applications.find(app => app.name === 'fluentxverse-mobile').contracts.includes('fluentxverse-server/MOBILE_API.md'));
});

test('repository READMEs use no emojis and describe limitations', () => {
  for (const app of applications) {
    const text = readFileSync(join(root, 'docs/app-repositories', `${app.name}.md`), 'utf8');
    assert.equal(/\p{Extended_Pictographic}/u.test(text), false, app.name);
    assert.match(text, /^# FluentXVerse/m);
    assert.match(text, /## (Local Development|Android Development)/);
  }
});

test('listing is read-only and invalid destinations are rejected', () => {
  assert.equal(JSON.parse(cli(['--list'])).length, 7);
  assert.throws(() => cli(['--destination', 'relative-path']), /absolute\/path/);
  assert.throws(() => cli(['--destination', root]), /outside the monorepo/);
});

test('export uses committed source and refuses to overwrite an existing repository', () => {
  const destination = mkdtempSync(join(tmpdir(), 'fxv-export-test-'));
  try {
    const result = JSON.parse(cli(['--app', 'fluentxverse-site', '--destination', destination]));
    const target = join(destination, 'fluentxverse-site');
    const source = JSON.parse(readFileSync(join(target, 'SOURCE.json'), 'utf8'));
    assert.equal(source.commit, result.commit);
    assert.match(source.commit, /^[a-f0-9]{40}$/);
    assert.ok(source.includedFiles.includes('fluentxverse-site/package.json'));
    assert.equal(source.includedFiles.some(excluded), false);
    const packageJson = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8'));
    assert.equal(packageJson.scripts.build, 'npm --prefix fluentxverse-site run build');
    const marker = join(target, 'preserve.txt');
    writeFileSync(marker, 'do not overwrite');
    assert.throws(() => cli(['--app', 'fluentxverse-site', '--destination', destination]), /Refusing to overwrite/);
    assert.equal(readFileSync(marker, 'utf8'), 'do not overwrite');
  } finally {
    rmSync(destination, { recursive: true, force: true });
  }
});
