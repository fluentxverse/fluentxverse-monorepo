import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, realpathSync, symlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const root = process.cwd(), id = 'admin-operations-workspace-20261029', release = join(root, 'output/release', id);
const app = 'fluentxverse-dashboard', baseline = join(root, 'output/release/admin-analytics-layout-20261029/dashboard/frontend');
const cwd = join(release, 'dashboard/frontend', app), previous = 'c5415d3b-4648-4c14-aa5d-85e3317bc250';
const files = ['src/pages/LessonOperationsPage.tsx', 'src/pages/LessonOperationsWorkspace.css', 'src/components/OperationsWorkspace.tsx', 'tests/browser/operationsWorkspace.cjs'];
const env = { ...process.env, CI: '1' };
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', env, maxBuffer: 8e6, ...options });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const write = (file, text) => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text); };
const wrangler = args => run('bunx', ['--bun', 'wrangler@4.152.0', ...args, '--config', 'wrangler.jsonc'], { cwd });
const guard = () => {
  const versions = JSON.parse(wrangler(['deployments', 'list', '--json'])).sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0].versions;
  if (versions.length !== 1 || versions[0].version_id !== previous || versions[0].percentage !== 100) throw Error('Live dashboard baseline changed');
};

// Keep the unrelated, unreleased outcome-proof workflow in the working tree only.
function scopePage(source) {
  let imports = 0, blocks = 0;
  const tree = ts.createSourceFile('LessonOperationsPage.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const transformed = ts.transform(tree, [context => {
    const visit = node => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)
        && /\/(LessonOutcomeAssessment|lessonOutcome)$/.test(node.moduleSpecifier.text)) { imports++; return undefined; }
      if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some(attribute => ts.isJsxAttribute(attribute)
        && attribute.name.getText(tree) === 'className' && attribute.initializer && ts.isStringLiteral(attribute.initializer)
        && attribute.initializer.text === 'ops-workspace-outcome')) { blocks++; return ts.factory.createJsxExpression(undefined, ts.factory.createNull()); }
      return ts.visitEachChild(node, visit, context);
    };
    return node => ts.visitNode(node, visit);
  }]);
  try {
    if (imports !== 2 || blocks !== 1) throw Error('Unreleased workflow boundary changed');
    return ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(transformed.transformed[0]);
  } finally { transformed.dispose(); }
}
const published = async url => {
  let failure;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (response.status < 500) return response;
      await response.body?.cancel(); failure = Error('Server returned ' + response.status);
    } catch (error) { failure = error; }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw failure;
};
if (process.argv.includes('--prepare')) {
  if (existsSync(join(release, 'manifest.json')) && !process.argv.includes('--refresh')) throw Error('Release already prepared');
  cpSync(baseline, join(release, 'dashboard/frontend'), { recursive: true, verbatimSymlinks: true,
    filter: path => !['node_modules', 'dist', '.wrangler'].includes(path.split('/').at(-1)) && !path.split('/').at(-1).startsWith('.env') });
  if (!existsSync(join(cwd, 'node_modules'))) symlinkSync(realpathSync(join(baseline, app, 'node_modules')), join(cwd, 'node_modules'), 'dir');
  guard();
  const sources = {};
  for (const file of files) {
    const target = join(cwd, file); mkdirSync(dirname(target), { recursive: true });
    if (file === 'src/pages/LessonOperationsPage.tsx') write(target, scopePage(readFileSync(join(root, app, file), 'utf8')));
    else cpSync(join(root, app, file), target);
    sources[file] = hash(readFileSync(target));
  }
  console.log(run('bun', ['run', 'build'], { cwd }));
  write(join(release, 'manifest.json'), JSON.stringify({ id, previous, sources, htmlHash: hash(readFileSync(join(cwd, 'dist/index.html'))), apiUnchanged: true, unrelatedOutcomeWorkflowExcluded: true }, null, 2));
} else if (process.argv.includes('--verify')) {
  const preview = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '5279', '--strictPort'], { cwd, env, stdio: 'ignore', detached: true });
  try {
    let ready = false;
    for (let i = 0; i < 80; i++) {
      try { if ((await fetch('http://127.0.0.1:5279/lesson-operations')).ok) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!ready) throw Error('Preview unavailable');
    for (const test of ['operationsWorkspace.cjs', 'analyticsLayout.cjs', 'sessionPagination.cjs', 'bookingSettings.cjs']) console.log(run('node', ['tests/browser/' + test], { cwd, env: { ...env, DASHBOARD_TEST_URL: 'http://127.0.0.1:5279' } }));
    write(join(release, 'verification.json'), JSON.stringify({ passed: true, htmlHash: hash(readFileSync(join(cwd, 'dist/index.html'))), verifiedAt: new Date().toISOString() }, null, 2));
  } finally { try { process.kill(-preview.pid, 'SIGTERM'); } catch {} }
} else if (process.argv.includes('--activate')) {
  const manifest = JSON.parse(readFileSync(join(release, 'manifest.json'))), verified = JSON.parse(readFileSync(join(release, 'verification.json')));
  if (!verified.passed || verified.htmlHash !== manifest.htmlHash || hash(readFileSync(join(cwd, 'dist/index.html'))) !== manifest.htmlHash) throw Error('Verify exact build first');
  for (const [file, expected] of Object.entries(manifest.sources)) if (hash(readFileSync(join(cwd, file))) !== expected) throw Error('Verified source changed');
  guard(); let version;
  try {
    const deployed = wrangler(['deploy']); console.log(deployed);
    version = deployed.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1]; if (!version) throw Error('Missing worker version');
    const dist = join(cwd, 'dist'), refs = text => [...text.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(m => m[1]).sort();
    for (const domain of ['dashboard.fluentxverse.com', 'dashboard.fluentxverse.xyz']) {
      const response = await published(`https://${domain}/lesson-operations`), html = await response.text();
      if (!response.ok || JSON.stringify(refs(html)) !== JSON.stringify(refs(readFileSync(join(dist, 'index.html'), 'utf8')))) throw Error('Live HTML mismatch: ' + domain);
      for (const file of readdirSync(join(dist, 'assets')).filter(file => /\.(js|css)$/.test(file))) {
        const asset = await published(`https://${domain}/assets/${file}`);
        if (!asset.ok || hash(Buffer.from(await asset.arrayBuffer())) !== hash(readFileSync(join(dist, 'assets', file)))) throw Error('Live asset mismatch: ' + file);
      }
    }
    console.log(run('node', ['tests/browser/operationsWorkspace.cjs'], { cwd, env: { ...env, DASHBOARD_TEST_URL: 'https://dashboard.fluentxverse.com' } }));
    write(join(release, 'deployment.json'), JSON.stringify({ version, previous, apiUnchanged: true, publicAssetsVerified: true, deployedAt: new Date().toISOString() }, null, 2));
    console.log('PASS: Lesson Operations workspace deployed.');
  } catch (error) { if (version) console.log(wrangler(['rollback', previous, '--yes'])); throw error; }
} else throw Error('Use --prepare, --verify or --activate');
