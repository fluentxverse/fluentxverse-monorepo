import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, isAbsolute } from 'node:path';
import { applications } from './export-app-repos.mjs';

const args = process.argv.slice(2);
const index = args.indexOf('--source');
const source = index >= 0 ? args[index + 1] : undefined;
if (!source || !isAbsolute(source)) throw new Error('Use --source /absolute/path/to/validated/app-repositories');
const base = resolve(source);
const run = (command, arguments_, cwd) => execFileSync(command, arguments_, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 4 * 1024 * 1024 });
const login = run('gh', ['api', 'user', '--jq', '.login']).trim();
if (login !== 'fluentxverse') throw new Error(`Sign in to GitHub CLI as fluentxverse first; current login is ${login}. Do not share tokens in chat.`);

// Preflight every prepared repository before creating any remote repository.
for (const app of applications) {
  const cwd = join(base, app.name);
  const provenance = JSON.parse(readFileSync(join(cwd, 'SOURCE.json'), 'utf8'));
  if (provenance.monorepo !== 'https://github.com/fluentxverse/fluentxverse-monorepo' || provenance.app !== app.directory) throw new Error(`Unexpected provenance in ${app.name}`);
  if (!existsSync(join(cwd, '.git'))) throw new Error(`Initialize, validate, scan, and commit ${app.name} before publishing.`);
  if (run('git', ['status', '--porcelain'], cwd).trim()) throw new Error(`Uncommitted changes in ${app.name}; review them before publishing.`);
  if (run('git', ['branch', '--show-current'], cwd).trim() !== 'main') throw new Error(`${app.name} must use main.`);
}

for (const app of applications) {
  const cwd = join(base, app.name);
  const url = `https://github.com/fluentxverse/${app.name}.git`;
  const remotes = run('git', ['remote'], cwd).trim().split('\n');
  if (remotes.includes('origin')) {
    const origin = run('git', ['remote', 'get-url', 'origin'], cwd).trim();
    if (origin !== url && origin !== `git@github.com:fluentxverse/${app.name}.git`) throw new Error(`Unexpected origin for ${app.name}: ${origin}`);
    // Allow retrying an interrupted initial push, but never overwrite divergent work.
    run('git', ['push', '-u', 'origin', 'main'], cwd);
  } else {
    const create = ['repo', 'create', `fluentxverse/${app.name}`, '--private', '--description', app.description, '--source', cwd, '--remote', 'origin', '--push'];
    if (app.homepage) create.push('--homepage', app.homepage);
    run('gh', create, cwd);
  }
  const metadata = JSON.parse(run('gh', ['repo', 'view', `fluentxverse/${app.name}`, '--json', 'url,visibility,defaultBranchRef'], cwd));
  if (metadata.visibility !== 'PRIVATE' || metadata.defaultBranchRef?.name !== 'main') throw new Error(`Verify visibility/default branch for ${app.name}`);
  const local = run('git', ['rev-parse', 'HEAD'], cwd).trim();
  const remote = run('git', ['ls-remote', 'origin', 'refs/heads/main'], cwd).trim().split(/\s+/)[0];
  if (local !== remote) throw new Error(`Remote revision mismatch for ${app.name}`);
  console.log(`${metadata.url} (${metadata.visibility.toLowerCase()}, main ${local.slice(0, 12)})`);
}
