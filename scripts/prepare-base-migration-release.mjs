import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, copyFileSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { quote, ssh } from './lib/cloud-ssh.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const engine = resolve(root, '../budol/gmr-engine');
const release = join(root, 'output/release/base-migration-20261024');
const sha = value => createHash('sha256').update(value).digest('hex');
if (sha(readFileSync(join(release, 'previous-engine'))) !== sha(readFileSync(join(release, 'baseline-engine')))) throw Error('Engine baseline was not reproduced.');
const manifest = { createdAt: new Date().toISOString(), apiImage: JSON.parse(ssh("docker inspect fluentxverse-server --format '{{json .Config.Image}}'")), engineImage: JSON.parse(ssh("docker inspect budol-gmr-engine-1 --format '{{json .Config.Image}}'")), baselineFiles: {}, files: {} };
const source = join(release, 'engine-source'); cpSync(join(release, 'engine-baseline'), source, { recursive: true });
mkdirSync(join(release, 'engine-overlay'), { recursive: true });
if (!existsSync(join(source, 'node_modules'))) symlinkSync(join(engine, 'node_modules'), join(source, 'node_modules'), 'dir');
for (const file of ['internal/config/config.go','internal/config/config_test.go','internal/httpapi/dashboard_insights.go','internal/httpapi/zkverify_policy.go','internal/httpapi/zkverify_receipt.go','internal/httpapi/zkverify_receipt_test.go','internal/deployer/deployer.go']) copyFileSync(join(engine,file),join(source,file));
cpSync(join(engine,'cmd/base-migration'),join(source,'cmd/base-migration'),{recursive:true});
execFileSync('go', ['test', './internal/config', './internal/httpapi', './internal/deployer'], { cwd: source, stdio: 'inherit', env: { ...process.env, GOTOOLCHAIN: 'go1.25.14', CGO_ENABLED: '0' } });
execFileSync('go', ['build','-buildvcs=false','-trimpath','-ldflags=-s -w','-o',join(release,'engine-overlay/gmr-engine'),'./cmd/api'], { cwd: source, stdio:'inherit', env:{ ...process.env,GOTOOLCHAIN:'go1.25.14',CGO_ENABLED:'0',GOOS:'linux',GOARCH:'amd64',GOAMD64:'v1' } });
execFileSync('go', ['build','-buildvcs=false','-trimpath','-ldflags=-s -w','-o',join(release,'engine-overlay/gmr-base-migration'),'./cmd/base-migration'], { cwd: source, stdio:'inherit', env:{ ...process.env,GOTOOLCHAIN:'go1.25.14',CGO_ENABLED:'0',GOOS:'linux',GOARCH:'amd64',GOAMD64:'v1' } });
const eoverlay=join(release,'engine-overlay');
for(const file of ['horizen-receipt.ts','zkverify.ts','screening-bridge-prover.ts']){
  const live=ssh(`docker exec budol-gmr-engine-1 cat /app/scripts/${file}`);
  if(sha(live)!==sha(readFileSync(join(release,'scripts-baseline',file))))throw Error('Engine worker baseline changed: '+file);
  manifest.baselineFiles['engine/scripts/'+file]=sha(live);
  mkdirSync(join(eoverlay,'scripts'),{recursive:true});copyFileSync(join(engine,'scripts',file),join(eoverlay,'scripts',file));
}
for(const file of ['horizen-receipt.test.ts','screening-bridge-prover.test.ts'])copyFileSync(join(engine,'scripts',file),join(eoverlay,'scripts',file));
copyFileSync(join(engine,'scripts/horizen-withdrawal.ts'),join(eoverlay,'scripts/horizen-withdrawal.ts'));
const payout=ssh('docker exec budol-gmr-engine-1 cat /app/scripts/payout-authorization.mjs');
if(payout.split('[26514, 2651420].includes(chainId)').length!==2)throw Error('Payout prototype chain baseline changed');
manifest.baselineFiles['engine/scripts/payout-authorization.mjs']=sha(payout);
writeFileSync(join(eoverlay,'scripts/payout-authorization.mjs'),payout.replace('[26514, 2651420].includes(chainId)','[8453, 84532, 26514, 2651420].includes(chainId)'));
writeFileSync(join(eoverlay,'Dockerfile'),`FROM ${manifest.engineImage}\nCOPY --chmod=755 gmr-engine /usr/local/bin/gmr-engine\nCOPY --chmod=755 gmr-base-migration /usr/local/bin/gmr-base-migration\nCOPY scripts/ /app/scripts/\n`);
const aoverlay=join(release,'api-overlay');mkdirSync(aoverlay,{recursive:true});
function patch(file, operations) {
  let live=ssh(`docker exec fluentxverse-server cat ${quote('/app/'+file)}`);manifest.baselineFiles['api/'+file]=sha(live);
  for(const [before,after]of operations){if(live.split(before).length!==2)throw Error('API baseline differs: '+file+' / '+before.slice(0,60));live=live.replace(before,after);}
  const target=join(aoverlay,file);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,live);manifest.files[file]=sha(live);
}
patch('src/services/proof.services/horizenReceipt.ts',[
  ["export function horizenVerificationNetwork", "export const BASE_MAINNET_BRIDGE = '0xCb47A3C3B9Eb2E549a3F2EA4729De28CafbB2b69' as Address;\nexport const BASE_SEPOLIA_BRIDGE = '0x0807C544D38aE7729f8798388d89Be6502A1e8A8' as Address;\nexport function horizenVerificationNetwork"],
  ["if (chainId === 26514)","if (chainId === 8453 || chainId === 26514)"], ["if (chainId === 2651420)","if (chainId === 84532 || chainId === 2651420)"],
  ["if (!(mainnet || testnet)","const base = config.chainId === 8453 && config.domainId === 2 && config.bridge.toLowerCase() === BASE_MAINNET_BRIDGE.toLowerCase();\n  const baseTestnet = config.chainId === 84532 && config.domainId === 2 && config.bridge.toLowerCase() === BASE_SEPOLIA_BRIDGE.toLowerCase();\n  if (!(mainnet || testnet || base || baseTestnet)"],
]);
patch('src/services/screening/chain.ts',[["process.env.SCREENING_CHAIN_ID || '2651420'","process.env.SCREENING_CHAIN_ID || '8453'"],["Existing Horizen zkVerify receipt bridge; issuer-managed credentials and revocation","Official zkVerify receipt bridge on the configured chain; issuer-managed credentials and revocation"]]);
patch('src/services/screening/prover.ts',[["process.env.SCREENING_CHAIN_ID || '2651420'","process.env.SCREENING_CHAIN_ID || '8453'"]]);
patch('src/services/anonymousReviews/policy.ts',[
  ["if (Number(process.env.ANONYMOUS_REVIEWS_CHAIN_ID || '2651420') === 26514) {\n    return keccak256(toHex(JSON.stringify({ protocol, tutorId, period, chainId: 26514 })));","const chainId = Number(process.env.ANONYMOUS_REVIEWS_CHAIN_ID || '8453');\n  if (chainId !== 2651420) {\n    return keccak256(toHex(JSON.stringify({ protocol, tutorId, period, chainId })));"],
  ["const chainId = Number(process.env.ANONYMOUS_REVIEWS_CHAIN_ID || '2651420');","const chainId = Number(process.env.ANONYMOUS_REVIEWS_CHAIN_ID || '8453');"],
]);
patch('src/config/ticketChain.ts',[
  ["import { arbitrumSepolia, baseSepolia }", "import { arbitrumSepolia, base, baseSepolia }"],
  ["process.env.TICKET_CHAIN_ID || baseSepolia.id","process.env.TICKET_CHAIN_ID || base.id"],
  ["[baseSepolia, arbitrumSepolia]", "[base, baseSepolia, arbitrumSepolia]"],
]);
mkdirSync(join(aoverlay,'tests'),{recursive:true});copyFileSync(join(root,'fluentxverse-server/tests/baseMigration.test.ts'),join(aoverlay,'tests/baseMigration.test.ts'));
writeFileSync(join(aoverlay,'Dockerfile'),`FROM ${manifest.apiImage}\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\n`);
writeFileSync(join(release,'source-manifest.json'),JSON.stringify(manifest,null,2));
console.log('Prepared scoped Base migration overlays; no live configuration or wallet transaction changed.');
