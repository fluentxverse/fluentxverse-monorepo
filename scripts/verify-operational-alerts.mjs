import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { ssh, quote } from './lib/cloud-ssh.mjs';
const monitor = 'https://fluentxverse-alerts.paulanthonyarriola.workers.dev';
const secret = readFileSync(homedir() + '/.local/state/fluentxverse/operational-alerts-20261024/monitor-key', 'utf8').trim();
const probe = `import neo4j from 'neo4j-driver';import{signAuthToken}from'./src/utils/jwt';import{adminCapabilities}from'./src/utils/adminOperations';
const d=neo4j.driver(process.env.MEMGRAPH_URI,neo4j.auth.basic(process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD)),s=d.session();
try{const r=(await s.run("MATCH(a:Admin) WHERE a.role IN ['admin','superadmin'] RETURN a")).records;
const a=r.map(r=>r.get('a').properties).find(a=>adminCapabilities(a).includes('operations'));if(!a)throw Error('No operations admin');
const payload={userId:a.id,email:a.email||'',role:a.role},checks=[];
for(const[label,cookie,status]of[['anonymous','',401],['invalid','adminAuth=invalid',401],['wrong role','adminAuth='+await signAuthToken({...payload,role:'tutor'},60),403],['operations','adminAuth='+await signAuthToken(payload,60),200]]){
const r=await fetch('https://api.fluentxverse.com/admin/alerts',{headers:{cookie,origin:'https://dashboard.fluentxverse.com'},signal:AbortSignal.timeout(15000)});if(r.status!==status||r.headers.get('cache-control')!=='private, no-store')throw Error('Alerts auth/cache failure: '+label);const body=await r.json();if(status===200&&(!body.success||body.data.version!==1))throw Error('Monitor snapshot missing');checks.push({label,status:r.status});}
const telemetry=await fetch('https://api.fluentxverse.com/internal/operational-alerts/telemetry',{signal:AbortSignal.timeout(15000)});if(telemetry.status!==401)throw Error('Telemetry is not protected');
console.log(JSON.stringify({checks,telemetryAnonymous:telemetry.status}));}finally{await s.close();await d.close();}`;
const authorization = JSON.parse(ssh(`docker exec fluentxverse-server bun --no-env-file -e ${quote(probe)}`));
for (const path of ['/snapshot','/check','/acknowledge']) {
  const r = await fetch(monitor + path, { method: path === '/snapshot' ? 'GET' : 'POST' }); assert.equal(r.status, 401);
}
let snapshot;
for (let attempt = 0; attempt < 4; attempt++) {
  const check = await fetch(monitor + '/check', { method: 'POST', headers: { authorization: 'Bearer ' + secret }, signal: AbortSignal.timeout(40000) });
  assert.equal(check.status, 200); snapshot = await check.json();
  if (snapshot.apiAvailable && !snapshot.incidents.some(i => i.key === 'api' && !i.resolvedAt)) break;
  if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 50000));
}
assert.equal(snapshot.version, 1); assert(snapshot.checkedAt && Date.now() - Date.parse(snapshot.checkedAt) < 180000);
assert.equal(snapshot.apiAvailable, true, 'External watchdog does not see a healthy API');
assert(!snapshot.incidents.some(i => i.key === 'api' && !i.resolvedAt), 'API recovery has not passed consecutive healthy observations');
const availability = await fetch(monitor + '/availability', { headers: { origin: 'https://dashboard.fluentxverse.com' } });
assert.equal(availability.headers.get('access-control-allow-origin'), 'https://dashboard.fluentxverse.com');
const publicData = await availability.json(); assert(!publicData.incidents && !publicData.rules && !publicData.restarts);
const metric = JSON.parse(ssh('cat /var/lib/fluentxverse-container-metrics/container-metrics.json'));
const raw = ssh("docker inspect $(docker ps -q) --format '{{.Name}} {{.RestartCount}}'").trim().split('\n');
for (const line of raw) { const [name,count] = line.trim().split(/\s+/); const row = metric.containers.find(c => c.name === name.slice(1)); assert(row); assert.equal(row.restartCount, Number(count)); }
const report = { verifiedAt: new Date().toISOString(), ...authorization, externalAPIHealthy: snapshot.apiAvailable,
  watchdogCheckedAt: snapshot.checkedAt, incidents: snapshot.incidents.map(i => ({ id: i.id, category: i.category, severity: i.severity, resolved: !!i.resolvedAt })),
  containerRestartCountersCompared: raw.length, workerPrivateEndpointsProtected: true, browserOnlyDelivery: true,
  outageRulesSimulatedInTests: true, realProductionOutageInduced: false };
writeFileSync('output/release/operational-alerts-20261024/verification.json', JSON.stringify(report, null, 2), { mode: 0o600 });
console.log(JSON.stringify(report));
