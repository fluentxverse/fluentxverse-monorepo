import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { cloudTarget, quote, ssh, sshOptions } from './lib/cloud-ssh.mjs';
const path = '/opt/fluentxverse/releases/20261023/compose.private.json';
const original = ssh(`cat ${quote(path)}`), config = JSON.parse(original);
const service = config.services['gmr-engine'], env = service.environment;
if (service.image !== 'fluentxverse-cloud/gmr-engine:proof-destinations-node-fix-20261025' || env.GMR_ENGINE_ZKVERIFY_NETWORK !== 'zkVerify') throw Error('Unexpected Engine baseline');
for (const key of ['GMR_ENGINE_ZKVERIFY_RPC_URL', 'GMR_ENGINE_ZKVERIFY_WS_URL']) {
  if (env[key] && !['testnet-rpc.zkverify.io', 'zkverify-rpc.zkverify.io'].includes(new URL(env[key]).hostname)) throw Error('Custom RPC override requires review');
}
const check = `const rpc=async(method,params=[])=>{const r=await fetch('https://zkverify-rpc.zkverify.io',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(15000)});const b=await r.json();if(!r.ok||b.error)throw Error('Mainnet RPC unavailable');return b.result;};const p=await rpc('system_properties');if(p.ss58Format!==8741||p.tokenSymbol!=='VFY'||await rpc('chain_getBlockHash',[0])!=='0x060e3dd3fa2904d031206bb913c954687a2bcc350e5a83d33d9e273ad21460f1')throw Error('Mainnet chain identity mismatch');console.log('PASS mainnet properties and genesis verified from VPS');`;
console.log(ssh(`docker exec budol-gmr-engine-1 bun -e ${quote(check)}`, { timeout: 45000 }));
const processes = ssh('docker top budol-gmr-engine-1 -eo pid,comm').trim().split('\n').slice(1).map(v => v.trim().split(/\s+/).at(-1));
if (processes.some(p => !['docker-init', 'gmr-engine', 'wget'].includes(p))) throw Error('Active Engine operation; defer restart');
const classrooms = "import{db,closePool}from'./src/db/postgres';try{const r=await db`SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'`;if(r[0].n>0)throw Error('Active classroom connections');console.log(JSON.stringify({activeClassroomConnections:r[0].n}));}finally{await closePool();}";
console.log(ssh(`docker exec fluentxverse-server bun -e ${quote(classrooms)}`));
Object.assign(env, { GMR_ENGINE_ZKVERIFY_RPC_URL: 'https://zkverify-rpc.zkverify.io', GMR_ENGINE_ZKVERIFY_WS_URL: 'wss://zkverify-rpc.zkverify.io' });
const dir = join(homedir(), '.local/state/fluentxverse/proof-destinations-node-fix-20261025');
mkdirSync(dir, { recursive: true, mode: 0o700 });
const local = join(dir, 'compose-mainnet.private.json'); writeFileSync(local, JSON.stringify(config, null, 2), { mode: 0o600 });
if (ssh(`cat ${quote(path)}`) !== original) throw Error('Compose changed');
const backup = path + '.pre-mainnet-endpoint-fix-' + Date.now();
ssh(`cp -p ${quote(path)} ${quote(backup)}`);
execFileSync('scp', [...sshOptions, local, `${cloudTarget}:${path}.rpc-next`], { stdio: 'ignore' });
try {
  ssh(`chmod 600 ${quote(path + '.rpc-next')}`);
  ssh(`mv ${quote(path + '.rpc-next')} ${quote(path)}`);
  console.log(ssh(`docker compose -f ${quote(path)} up -d --no-deps --wait --wait-timeout 120 gmr-engine`, { timeout: 180000 }));
} catch {
  ssh(`cp -p ${quote(backup)} ${quote(path)}`);
  ssh(`docker compose -f ${quote(path)} up -d --no-deps --wait --wait-timeout 120 gmr-engine`, { timeout: 180000 });
  throw Error('Endpoint configuration activation failed; prior configuration restored');
}
writeFileSync('output/release/proof-destinations-node-fix-20261025/endpoint-fix.json', JSON.stringify({ appliedAt: new Date().toISOString(), verificationNetwork: 'zkVerify', rpcHost: 'zkverify-rpc.zkverify.io', previousCompose: backup, chainIdentityChecked: true, seedChanged: false, paidTransactions: 0 }, null, 2));
console.log('PASS default native RPC and WebSocket now match zkVerify mainnet; seed and project policies unchanged');
