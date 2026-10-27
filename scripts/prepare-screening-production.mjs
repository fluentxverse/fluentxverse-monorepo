import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), engine = resolve(root, '../budol/gmr-engine');
const state = join(homedir(), '.local/state/fluentxverse/screening-production-20261022');
mkdirSync(state, { recursive: true, mode: 0o700 }); chmodSync(state, 0o700);
const save = (name, value) => writeFileSync(join(state, name), JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
const docker = args => execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const inspect = name => JSON.parse(docker(['inspect', name]))[0];
const env = c => Object.fromEntries(c.Config.Env.map(value => { const i = value.indexOf('='); return [value.slice(0, i), value.slice(i + 1)]; }));
const liveEngine = inspect('budol-gmr-engine-1'), liveAPI = inspect('fluentxverse-server');
const engineEnv = env(liveEngine), apiEnv = env(liveAPI);
async function admin(path, body) {
  const response = await fetch('http://127.0.0.1:8090/admin' + path, {
    method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json',
      'X-GMR-Engine-Admin-Key': engineEnv.GMR_ENGINE_ADMIN_API_KEY || engineEnv.ENGINE_ADMIN_API_KEY },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000), redirect: 'error',
  });
  if (!response.ok) throw Error(`Engine administration failed: ${response.status}`);
  return response.json();
}
if (!existsSync(join(state, 'runtime-backup.json'))) save('runtime-backup.json', { engine: liveEngine, api: liveAPI });
let identity;
if (existsSync(join(state, 'identity.json'))) identity = JSON.parse(readFileSync(join(state, 'identity.json')));
else {
  const name = 'FluentXVerse Screening Mainnet';
  const apps = await admin('/apps');
  const app = apps.apps.find(app => app.name === name) || (await admin('/apps', { name, environment: 'production', allowedChains: [26514],
    gasFreeEnabled: false, rateLimitPerMinute: 30 })).app;
  const result = await admin(`/apps/${app.id}/api-keys`, { name: 'Screening server only', scopes: ['contracts:read', 'contracts:write', 'transactions:read'] });
  identity = { projectId: app.id, apiKey: result.plaintext, issuerSeed: randomBytes(32).toString('hex'),
    parentProjectId: '2a798002-7ed3-4e98-853e-62306479b9da' };
  save('identity.json', identity);
}
// Derive only public issuer pins. The seed is sent on stdin, never command arguments.
const publicPins = JSON.parse(execFileSync('bun', ['--no-env-file', '-e', `
import {buildEddsa,buildPoseidon} from 'circomlibjs';
import {policyHash,schemaHash} from './src/services/screening/policy';
const seed=Buffer.from(await Bun.stdin.text(),'hex'),e=await buildEddsa(),p=await buildPoseidon();
const [issuerAx,issuerAy]=e.prv2pub(seed).map(x=>e.F.toObject(x).toString());
console.log(JSON.stringify({issuerAx,issuerAy,issuerHash:p.F.toObject(p([BigInt(issuerAx),BigInt(issuerAy)])).toString(),policyHash,schemaHash}));seed.fill(0);process.exit(0);
`], { cwd: join(root, 'fluentxverse-server'), input: identity.issuerSeed, encoding: 'utf8', timeout: 30000 }));
const selfPhaseOne = process.argv.includes('--self-phase-one');
const ptau = join(engine, selfPhaseOne ? 'zk/screening/phase-one/fxv-production-20261022-power13.ptau' : 'zk/screening/phase-one/powersOfTau28_hez_final_13.ptau');
if (selfPhaseOne && !existsSync(ptau)) {
  console.log('Generating fresh production phase-one parameters with private OS entropy.');
  execFileSync('node', [join(engine, 'scripts/screening-setup-worker.mjs')], {
    input: JSON.stringify({ action: 'self-operated-phase-one', power: 13, ptau }), encoding: 'utf8', timeout: 600000,
  });
}
const bytes = readFileSync(ptau);
const publishedHash = '58efc8bf2834d04768a3d7ffcd8e1e23d461561729beaac4e3e7a47829a1c9066d5320241e124a1a8e8aa6c75be0ba66f65bc8239a0542ed38e11276f6fdb4d9';
if (!selfPhaseOne && createHash('blake2b512').update(bytes).digest('hex') !== publishedHash) throw Error('Public phase-one BLAKE2b digest mismatch');
const output = join(engine, 'zk/screening/releases/self-operated-20261022');
if (selfPhaseOne && existsSync(output) && !existsSync(join(output, 'ceremony.json'))) {
  renameSync(output, output + '-incomplete-public-phase-one');
}
const input = { operator: 'FluentXVerse', ceremonyId: 'fxv-screening-self-20261022',
  buildDirectory: join(engine, 'zk/screening/ceremonies/review-20261020'),
  buildSHA256: '6dda6e2dd5de1b795ced8909bb18fa2e75bd644e7c3321a558e1934088294adc',
  outputDirectory: output, ptauPath: ptau, ptauSHA256: createHash('sha256').update(bytes).digest('hex'),
  phaseOneProvenance: selfPhaseOne ? { sourceURL: 'urn:fluentxverse:self-operated-phase-one:20261022',
    ceremony: 'Fresh production-only BN254 power13, one FluentXVerse-operated random phase-one contribution; not a public multi-party ceremony',
    verificationRecord: 'Generated with OS randomness in short-lived native snarkjs worker; powersOfTau.verify required; entropy destruction operator-asserted' } : { sourceURL: 'https://circom.info/powersOfTau28_hez_final_13.ptau',
    ceremony: 'Hermez powersOfTau28 prepared power 13, 54 contributions and beacon, published in iden3/snarkjs README',
    verificationRecord: `Published BLAKE2b512 checked: ${publishedHash}; snarkjs powersOfTau.verify required during initialization and release verification` },
  config: { ...publicPins, verificationNetwork: 'zkVerify', chainId: 26514, domainId: 3,
    bridge: '0xCb47A3C3B9Eb2E549a3F2EA4729De28CafbB2b69', agentId: '0' } };
if (!existsSync(join(state, selfPhaseOne ? 'self-setup-input.json' : 'setup-input.json'))) save(selfPhaseOne ? 'self-setup-input.json' : 'setup-input.json', input);
if (process.argv.includes('--setup')) {
  console.log('Generating and cryptographically verifying self-operated production screening artifacts.');
  const result = execFileSync('bun', ['--no-env-file', 'scripts/screening-self-operated.ts'], { cwd: engine,
    input: JSON.stringify(input), encoding: 'utf8', maxBuffer: 2 * 1024 * 1024, timeout: 1800000 });
  console.log(result.trim());
}
console.log(JSON.stringify({ state, projectId: identity.projectId, releaseDirectory: output, selfOperated: true, productionEnabled: false }));
