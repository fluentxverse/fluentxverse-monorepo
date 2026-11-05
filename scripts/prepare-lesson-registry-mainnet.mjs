import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, symlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const release = 'output/release/lesson-registry-mainnet-20261104', source = join(release, 'engine-source');
const pin = JSON.parse(readFileSync('shared/lessonRegistryDeployment.json'));
mkdirSync(release, { recursive: true });
cpSync('output/release/lesson-registry-20261104/engine-source', source, {
  recursive: true, verbatimSymlinks: true, filter: p => !['node_modules', '.git'].includes(p.split('/').at(-1)),
});
if (!existsSync(join(source, 'node_modules'))) symlinkSync('/home/paulanthonyarriola/Desktop/budol/gmr-engine/node_modules', join(source, 'node_modules'), 'dir');
const edit = (file, before, after) => {
  const p = join(source, file), s = readFileSync(p, 'utf8');
  if (s.includes(after)) return;
  if (s.split(before).length !== 2) throw Error('Ambiguous mainnet anchor: ' + file);
  writeFileSync(p, s.replace(before, after));
};
const artifact = readFileSync(join(source, 'internal/contracts/lesson_registry/artifact.json'));
if (createHash('sha256').update(artifact).digest('hex') !== pin.artifactSHA256) throw Error('Tested registry artifact changed');
const production = `c.Mode == "production" && c.ChainID == 42161 && c.ProjectID == "${pin.projectId}" && strings.ToLower(c.Contract) == "${pin.contract}" && c.PolicyHash == "${pin.policyHash}" && c.FeedURL == "${pin.feedUrl}" && c.Epoch == "${pin.epoch}" && c.Reconciler != ""`;
edit('internal/disputes/protocol.go', 'if c.Mode == "production" && (c.ProjectID', 'if c.Mode == "production" && !c.LessonRegistry && (c.ProjectID');
edit('internal/disputes/protocol.go', `if c.ChainID != 421614 || (c.Mode != "pilot" && c.Mode != "observe") || !strings.HasPrefix(c.Epoch, "registry-") {\n\t\t\treturn errors.New("registry writes are testnet-only with a separate epoch")\n\t\t}`, `if c.ChainID == 42161 {\n if !(${production}) { return errors.New("explicit pinned registry production binding required") }\n } else if c.ChainID != 421614 || (c.Mode != "pilot" && c.Mode != "observe") || !strings.HasPrefix(c.Epoch, "registry-") {\n return errors.New("registry writes are testnet-only unless production binding is pinned")\n }`);
writeFileSync(join(source, 'scripts/lesson-registry-deployment.json'), JSON.stringify(pin));
edit('scripts/lesson-registry-sync.ts', 'const c=request.config;', `const c=request.config;\n const production=c?.lessonRegistry&&c.chainId===42161&&c.mode==="production"&&c.projectId==="${pin.projectId}"&&c.contract?.toLowerCase()==="${pin.contract}"&&c.policyHash==="${pin.policyHash}"&&c.feedUrl==="${pin.feedUrl}"&&c.epoch==="${pin.epoch}"&&c.reconciler&&c.reconciler.toLowerCase()!==c.operator?.toLowerCase();`);
edit('scripts/lesson-registry-sync.ts', 'if(!c?.lessonRegistry||c.chainId!==421614||!["pilot","observe"].includes(c.mode)||!c.epoch?.startsWith("registry-"))', 'if(!production&&(!c?.lessonRegistry||c.chainId!==421614||!["pilot","observe"].includes(c.mode)||!c.epoch?.startsWith("registry-")))');
edit('scripts/lesson-registry-sync.ts', 'c.mode!=="pilot")', 'c.mode!=="pilot"&&!production)');
// Shared legacy signing/journaling retains its original v1 binding, and separately admits only pinned v2.
const tsProduction = `config.lessonRegistry===true && config.mode==="production" && config.chainId===42161 && config.projectId==="${pin.projectId}" && config.contract.toLowerCase()==="${pin.contract}" && config.policyHash==="${pin.policyHash}" && config.feedUrl==="${pin.feedUrl}" && config.epoch==="${pin.epoch}" && config.reconciler && config.reconciler.toLowerCase()!==config.operator.toLowerCase()`;
edit('scripts/dispute-sync.ts', 'const production = config.mode', 'const production = !config.lessonRegistry && config.mode');
edit('scripts/dispute-sync.ts', '&& !production)\n', `&& !production && !(${tsProduction}))\n`);
for (const file of ['main.go', 'replay.go']) {
  let s = readFileSync(join(source, 'cmd/dispute-mainnet', file), 'utf8')
    .replaceAll('contracts.LessonDisputesArtifact()', 'contracts.LessonRegistryArtifact()')
    .replaceAll('scripts/dispute-mainnet.ts', 'scripts/lesson-registry-mainnet.ts')
    .replaceAll('lesson-dispute-mainnet-activation:', 'lesson-registry-mainnet-activation:')
    .replaceAll('0x90153ced2a37eeba68c68f945653c7959ba0f627', pin.contract)
    .replace('|| *operation == "deploy" || *operation == "replay"', '|| *operation == "replay" || *operation == "fund-reconciler"');
  if (file === 'main.go') {
    s = s.replace('if j.Project != *project ||', `if !strings.EqualFold(j.Contract,"${pin.contract}") || j.Project != *project ||`);
    const start = s.indexOf('\tif j.Reconciler == "" {'), end = s.indexOf('\n\tsignerAddress, ref :=', start);
    if (start < 0 || end < 0) throw Error('Reconciler bootstrap anchor missing');
    s = s.slice(0, start) + '\tif j.Reconciler == "" || !vaultclient.IsReference(j.ReconcilerRef) {return errors.New("existing independent Vault reconciler must be configured privately")}\n' + s.slice(end);
  }
  mkdirSync(join(source, 'cmd/lesson-registry-mainnet'), { recursive: true });
  writeFileSync(join(source, 'cmd/lesson-registry-mainnet', file), s);
}
cpSync('integrations/lesson-registry/engine/mainnet-bootstrap.ts', join(source, 'scripts/lesson-registry-mainnet.ts'));
cpSync('integrations/lesson-registry/engine/production.e2e.ts', join(source, 'scripts/registry-production.e2e.ts'));
cpSync('integrations/lesson-registry/mainnet-verification.ts', join(source, 'scripts/registry-mainnet-verification.ts'));
cpSync('integrations/lesson-registry/engine/production_test.go', join(source, 'internal/disputes/registry_production_test.go'));
const run = (cmd, args) => execFileSync(cmd, args, { cwd: source, stdio: 'inherit', env: { ...process.env, CGO_ENABLED: '0', GOCACHE: '/tmp/fxv-engine-go-cache' } });
run('gofmt', ['-w', 'internal/disputes', 'cmd/lesson-registry-mainnet']);
run('go', ['test', './internal/disputes', './internal/store', './internal/contracts', './cmd/api', './cmd/lesson-registry-mainnet']);
run('bunx', ['tsc', '--noEmit', '--target', 'esnext', '--module', 'esnext', '--moduleResolution', 'bundler', '--resolveJsonModule', '--esModuleInterop', '--skipLibCheck', '--strict', '--types', 'bun', 'scripts/lesson-registry-sync.ts', 'scripts/lesson-registry-mainnet.ts', 'scripts/registry-mainnet-verification.ts']);
run('bun', ['--no-env-file', 'scripts/lesson-registry.e2e.ts']);
run('bun', ['--no-env-file', 'scripts/registry-production.e2e.ts']);
mkdirSync(join(release, 'engine/scripts'), { recursive: true });
for (const name of ['api', 'lesson-registry-mainnet']) run('go', ['build', '-buildvcs=false', '-trimpath', '-ldflags=-s -w', '-o', resolve(release, 'engine', name === 'api' ? 'gmr-engine' : name), './cmd/' + name]);
for (const file of ['dispute-sync.ts', 'lesson-registry-sync.ts', 'lesson-registry-mainnet.ts', 'lesson-registry-deployment.json', 'vault-account.ts']) cpSync(join(source, 'scripts', file), join(release, 'engine/scripts', file));
writeFileSync(join(release, 'engine/Dockerfile'), 'FROM fluentxverse-cloud/gmr-engine:dispute-mainnet-20261103\nCOPY gmr-engine lesson-registry-mainnet /usr/local/bin/\nCOPY scripts/ /app/scripts/\n');
execFileSync('tar', ['-czf', join(release, 'engine.tar.gz'), '-C', join(release, 'engine'), '.']);
writeFileSync(join(release, 'prepared.json'), JSON.stringify({ image: 'fluentxverse-cloud/gmr-engine:lesson-registry-mainnet-20261104', baseline: 'fluentxverse-cloud/gmr-engine:dispute-mainnet-20261103', ...pin }));
