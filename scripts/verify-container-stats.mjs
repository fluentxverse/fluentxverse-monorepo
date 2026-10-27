import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ssh, quote } from './lib/cloud-ssh.mjs';

// Tokens stay in the container and expire in 60 seconds. Accounts are read, never modified.
const probe=`
import neo4j from 'neo4j-driver';
import {signAuthToken} from './src/utils/jwt';
import {adminCapabilities} from './src/utils/adminOperations';
import {validateContainerSnapshot} from './src/services/admin.services/containerStats.service';
const driver=neo4j.driver(process.env.MEMGRAPH_URI,neo4j.auth.basic(process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD)),session=driver.session();
try{
  const records=(await session.run("MATCH (a:Admin) WHERE a.role IN ['admin','superadmin'] RETURN a")).records;
  const account=records.map(r=>r.get('a').properties).find(a=>adminCapabilities(a).includes('operations'));
  if(!account)throw Error('No operations account to test.');
  const base={userId:account.id,email:account.email||'',role:account.role},checks=[];
  for(const [label,cookie,status]of[
    ['anonymous','',401],['invalid','adminAuth=invalid',401],
    ['wrong role','adminAuth='+await signAuthToken({...base,role:'tutor'},60),403],
    ['operations','adminAuth='+await signAuthToken(base,60),200],
  ]){
    const response=await fetch('https://api.fluentxverse.com/admin/container-stats',{headers:{cookie,origin:'https://dashboard.fluentxverse.com'},signal:AbortSignal.timeout(15000)});
    if(response.status!==status||response.headers.get('cache-control')!=='private, no-store')throw Error('Container authorization/cache check failed: '+label);
    if(response.headers.get('access-control-allow-origin')!=='https://dashboard.fluentxverse.com'||response.headers.get('access-control-allow-credentials')!=='true')throw Error('Stats CORS check failed.');
    const body=await response.json();
    if(status===200){if(!body.success||validateContainerSnapshot(body.data.snapshot).status!=='live'||!body.data.snapshot.containers.length)throw Error('Live metrics missing.');}
    else if(body.data)throw Error('Unauthorized data disclosure.');
    checks.push({label,status:response.status});
  }
  console.log(JSON.stringify({checks,liveContainerMetrics:true}));
}finally{await session.close();await driver.close();}
`;
const report=JSON.parse(ssh(`docker exec fluentxverse-server bun --no-env-file -e ${quote(probe)}`));
const mounts=JSON.parse(ssh("docker inspect fluentxverse-server --format '{{json .Mounts}}'"));
const mount=mounts.find(m=>m.Destination==='/run/fluentxverse-container-metrics');
assert(mount&&mount.RW===false&&mount.Source==='/var/lib/fluentxverse-container-metrics','Read-only snapshot directory required.');
assert(!mounts.some(m=>m.Source.includes('docker.sock')||m.Destination.includes('docker.sock')),'API must not have Docker socket.');
assert.equal(ssh('systemctl is-active fluentxverse-container-metrics.service').trim(),'active');
assert.equal(ssh('systemctl is-enabled fluentxverse-container-metrics.service').trim(),'enabled');
const read=()=>JSON.parse(ssh('cat /var/lib/fluentxverse-container-metrics/container-metrics.json'));
const first=read();let second;
for(let attempt=0;attempt<8;attempt++){
  await new Promise(resolve=>setTimeout(resolve,2000));second=read();
  if(Date.parse(second.sampledAt)>Date.parse(first.sampledAt))break;
}
assert(Date.parse(second.sampledAt)>Date.parse(first.sampledAt),'Collector stopped after SELinux bind relabel.');
const cli=ssh("docker stats --no-stream --format '{{json .}}'").trim().split('\n').filter(Boolean).map(value=>JSON.parse(value));
function bytes(value){const match=/^([\d.]+)\s*(B|kB|MB|GB|TB|KiB|MiB|GiB|TiB)$/.exec(value.trim());assert(match,'Unknown Docker memory unit');const scale={B:1,kB:1e3,MB:1e6,GB:1e9,TB:1e12,KiB:1024,MiB:1024**2,GiB:1024**3,TiB:1024**4};return Number(match[1])*scale[match[2]];}
second=read();
for(const reference of cli){
  const row=second.containers.find(c=>c.id.startsWith(reference.ID));
  assert(row?.metrics,`Missing metrics for ${reference.Name}`);assert.equal(row.name,reference.Name);
  const [used,limit]=reference.MemUsage.split('/').map(bytes);
  assert(Math.abs(row.metrics.memoryLimitBytes-limit)<Math.max(1024**2,limit*.01),'Memory limit disagrees with Docker.');
  assert(Math.abs(row.metrics.memoryBytes-used)<Math.max(10*1024**2,used*.1),'Memory working set disagrees with Docker.');
  assert(row.metrics.cpuPercent!==null&&row.metrics.cpuPercent>=0,'CPU interval not measured.');
}
const output=resolve(dirname(fileURLToPath(import.meta.url)),'../output/release/container-stats-20261023');mkdirSync(output,{recursive:true});
const result={...report,verifiedAt:new Date().toISOString(),readOnlyHostMount:true,apiHasNoDockerSocket:true,collectorContinuesPublishing:true,dockerCLIContainersCompared:cli.length};
writeFileSync(join(output,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
