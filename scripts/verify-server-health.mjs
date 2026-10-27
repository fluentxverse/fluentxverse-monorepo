import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ssh, quote } from './lib/cloud-ssh.mjs';

// Create only a short-lived in-memory test session inside the API container.
// Existing accounts/permissions are read, never changed; tokens are never logged.
const probe = `
import neo4j from 'neo4j-driver';
import { signAuthToken } from './src/utils/jwt';
import { adminCapabilities } from './src/utils/adminOperations';
import { validateHostSnapshot } from './src/services/admin.services/serverHealth.service';
const driver = neo4j.driver(process.env.MEMGRAPH_URI,neo4j.auth.basic(process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD)), session = driver.session();
try {
  const records = (await session.run("MATCH (a:Admin) WHERE a.role IN ['admin','superadmin'] RETURN a")).records;
  const account = records.map(r=>r.get('a').properties).find(a=>adminCapabilities(a).includes('operations'));
  if (!account) throw Error('No authorized operations account to test.');
  const base = {userId:account.id,email:account.email||'',role:account.role};
  const checks = [];
  for (const [label,cookie,status] of [
    ['anonymous','',401],
    ['invalid','adminAuth=invalid',401],
    ['wrong role','adminAuth='+await signAuthToken({...base,role:'tutor'},60),403],
    ['operations','adminAuth='+await signAuthToken(base,60),200],
  ]) {
    const response = await fetch('https://api.fluentxverse.com/admin/server-health',{headers:{cookie,origin:'https://dashboard.fluentxverse.com'},signal:AbortSignal.timeout(15000)});
    if(response.status!==status || response.headers.get('cache-control')!=='private, no-store') throw Error('Metrics authorization/cache check failed: '+label);
    if(response.headers.get('access-control-allow-origin')!=='https://dashboard.fluentxverse.com' || response.headers.get('access-control-allow-credentials')!=='true') throw Error('Dashboard metrics CORS check failed.');
    const body = await response.json();
    if(status===200) {
      if(!body.success || body.data.status!=='live')throw Error('Metrics not live.');
      const result=validateHostSnapshot(body.data.snapshot);
      if(result.snapshot.memory.totalBytes<7*1024**3 || result.snapshot.cpu.cores!==1 || result.snapshot.network.interface!=='ens3')throw Error('Not host measurements.');
    } else if(body.data) throw Error('Unauthorized snapshot disclosure.');
    checks.push({label,status:response.status});
  }
  console.log(JSON.stringify({checks,liveHostMetrics:true,providerBillingConnected:false}));
} finally {await session.close();await driver.close();}
`;

const report = JSON.parse(ssh(`docker exec fluentxverse-server bun --no-env-file -e ${quote(probe)}`));
const mounts = JSON.parse(ssh("docker inspect fluentxverse-server --format '{{json .Mounts}}'"));
const mount = mounts.find(m=>m.Destination==='/run/fluentxverse-metrics');
assert(mount && mount.RW===false && mount.Source==='/var/lib/fluentxverse-metrics','Metrics directory must be read-only.');
assert.equal(ssh('systemctl is-active fluentxverse-metrics.service').trim(),'active');
assert.equal(ssh('systemctl is-enabled fluentxverse-metrics.service').trim(),'enabled');
const first = JSON.parse(ssh('cat /var/lib/fluentxverse-metrics/host-metrics.json'));
await new Promise(resolve=>setTimeout(resolve,6500));
const second = JSON.parse(ssh('cat /var/lib/fluentxverse-metrics/host-metrics.json'));
assert(Date.parse(second.sampledAt)>Date.parse(first.sampledAt),'Collector must continue publishing after Docker SELinux relabel.');
const output = resolve(dirname(fileURLToPath(import.meta.url)),'../output/release/server-health-20261023');
mkdirSync(output,{recursive:true});
writeFileSync(join(output,'verification.json'),JSON.stringify({...report,verifiedAt:new Date().toISOString(),readOnlyHostMount:true,collectorContinuesPublishing:true},null,2));
console.log(JSON.stringify({...report,readOnlyHostMount:true,collectorContinuesPublishing:true}));
