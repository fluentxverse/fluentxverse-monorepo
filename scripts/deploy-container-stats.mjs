import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloudHost, cloudTarget, quote, ssh, sshOptions } from './lib/cloud-ssh.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const release=join(root,'output/release/container-stats-20261023');
const manifest=JSON.parse(readFileSync(join(release,'source-manifest.json')));
const configPath='/opt/fluentxverse/releases/20261023/compose.private.json';
const stage='/opt/fluentxverse/releases/container-stats-20261023';
const image='fluentxverse-cloud/api:container-stats-20261023';
const previousImage='fluentxverse-cloud/api:server-health-20261023';
const run=(command,args,options={})=>execFileSync(command,args,{encoding:'utf8',maxBuffer:8*1024*1024,...options});
const rootSSH=command=>run('ssh',[...sshOptions,`root@${cloudHost}`,command]);
const upload=(from,to)=>run('scp',[...sshOptions,from,`${cloudTarget}:${to}`]);

if(process.argv.includes('--cloud')){
  const actual=JSON.parse(ssh("docker inspect fluentxverse-server --format '{{json .Image}}'"));
  const index=ssh('docker exec fluentxverse-server cat /app/src/index.ts');
  if(actual!==manifest.apiBaselineImage||createHash('sha256').update(index).digest('hex')!==manifest.apiBaselineIndexHash)throw Error('Cloud API changed since preparation.');
  if(JSON.parse(ssh(`docker image inspect ${previousImage} --format '{{json .Id}}'`))!==actual)throw Error('Base image changed.');
  const config=JSON.parse(ssh(`cat ${quote(configPath)}`)),before=JSON.stringify(config);
  if(config.services?.api?.image!==previousImage)throw Error('Unexpected live configuration.');
  const volume={type:'bind',source:'/var/lib/fluentxverse-container-metrics',target:'/run/fluentxverse-container-metrics',read_only:true,bind:{create_host_path:false,selinux:'z'}};
  if(config.services.api.volumes.some(v=>v.target===volume.target))throw Error('Metrics already mounted.');
  config.services.api.image=image;config.services.api.volumes.push(volume);
  const reverted=structuredClone(config);reverted.services.api.image=previousImage;reverted.services.api.volumes.pop();
  if(JSON.stringify(reverted)!==before)throw Error('Unrelated configuration mutation.');
  const privateDir=join(homedir(),'.local/state/fluentxverse/cloud-container-stats-20261023');mkdirSync(privateDir,{recursive:true,mode:0o700});
  const privateFile=join(privateDir,'compose.private.json');writeFileSync(privateFile,JSON.stringify(config,null,2),{mode:0o600});
  run('go',['test','./...'],{cwd:join(root,'infra/container-metrics')});
  run('go',['build','-trimpath','-ldflags=-s -w','-o',join(release,'container-metrics'),'.'],{cwd:join(root,'infra/container-metrics'),env:{...process.env,CGO_ENABLED:'0',GOOS:'linux',GOARCH:'amd64'}});
  run('tar',['-czf',join(release,'api-overlay.tar.gz'),'-C',join(release,'api'),'.']);
  ssh(`mkdir -p ${stage}`);
  upload(join(release,'container-metrics'),`${stage}/container-metrics`);
  upload(join(root,'infra/cloud/fluentxverse-container-metrics.service'),`${stage}/fluentxverse-container-metrics.service`);
  upload(join(release,'api-overlay.tar.gz'),`${stage}/api-overlay.tar.gz`);
  ssh(`tar -xzf ${stage}/api-overlay.tar.gz -C ${stage}`);
  console.log(ssh(`docker build --network=none --pull=false -t ${image} ${stage}`));
  console.log(ssh(`docker run --rm --network none -e NODE_ENV=test --entrypoint bun ${image} test tests/containerStats.test.ts tests/serverHealth.test.ts`));
  rootSSH('id fluentxverse-container-metrics >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin fluentxverse-container-metrics');
  rootSSH(`install -m 0755 ${stage}/container-metrics /usr/local/bin/fluentxverse-container-metrics`);
  rootSSH('restorecon /usr/local/bin/fluentxverse-container-metrics');
  rootSSH(`install -m 0644 ${stage}/fluentxverse-container-metrics.service /etc/systemd/system/fluentxverse-container-metrics.service`);
  rootSSH('systemctl daemon-reload');rootSSH('systemctl enable --now fluentxverse-container-metrics.service');
  let sample;
  for(let attempt=0;attempt<15;attempt++){
    await new Promise(resolve=>setTimeout(resolve,2000));
    try{sample=JSON.parse(ssh('cat /var/lib/fluentxverse-container-metrics/container-metrics.json'));}catch{continue;}
    if(sample.containers?.length&&sample.containers.every(c=>c.state!=='running'||c.metrics?.cpuPercent!=null)&&Date.now()-Date.parse(sample.sampledAt)<30000)break;
  }
  if(!sample?.containers?.length||!sample.containers.every(c=>c.state!=='running'||c.metrics?.cpuPercent!=null)||Date.now()-Date.parse(sample.sampledAt)>30000)throw Error('Collector did not produce complete, fresh readings.');
  const activeCheck="import {db,closePool} from './src/db/postgres';try{const r=await db`SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'`;if(r[0].n>0)throw Error('Active classroom connections; defer release');console.log(JSON.stringify({activeClassroomConnections:r[0].n}));}finally{await closePool();}";
  console.log(ssh(`docker exec fluentxverse-server bun -e ${quote(activeCheck)}`));
  const backup=configPath+'.pre-container-stats-'+Date.now();ssh(`cp -p ${quote(configPath)} ${quote(backup)}`);
  upload(privateFile,configPath+'.stats-next');ssh(`chmod 600 ${quote(configPath+'.stats-next')}`);ssh(`mv ${quote(configPath+'.stats-next')} ${quote(configPath)}`);
  try{
    console.log(ssh(`docker compose -f ${quote(configPath)} up -d --no-deps --wait --wait-timeout 120 api`,{timeout:180000}));
    const verify="import {readContainerStats} from './src/services/admin.services/containerStats.service';const r=await readContainerStats();if(r.status!=='live'||!r.snapshot.containers.length)throw Error('Container metrics not live');console.log(JSON.stringify({status:r.status,containers:r.snapshot.containers.length}));";
    console.log(ssh(`docker exec fluentxverse-server bun -e ${quote(verify)}`));
    const response=await fetch('https://api.fluentxverse.com/admin/container-stats',{signal:AbortSignal.timeout(15000)});
    if(response.status!==401||response.headers.get('cache-control')!=='private, no-store')throw Error(`Public stats auth/cache failed (${response.status}, ${response.headers.get('cache-control')}).`);
  }catch(error){ssh(`cp -p ${quote(backup)} ${quote(configPath)}`);ssh(`docker compose -f ${quote(configPath)} up -d --no-deps --wait --wait-timeout 120 api`,{timeout:180000});throw error;}
  writeFileSync(join(release,'api-deployment.json'),JSON.stringify({image,previousImage:actual,deployedAt:new Date().toISOString(),host:cloudHost},null,2));
  console.log('PASS container collector and protected stats API deployed. API has no Docker socket.');
}else if(process.argv.includes('--dashboard')){
  JSON.parse(readFileSync(join(release,'api-deployment.json')));
  const cwd=join(release,'frontend/fluentxverse-dashboard');
  const wrangler=args=>{const result=spawnSync('npx',['--yes','wrangler',...args,'--config','wrangler.jsonc'],{cwd,encoding:'utf8',maxBuffer:8*1024*1024,env:{...process.env,CI:'1'}});if(result.status!==0)throw Error((result.stderr||result.stdout).slice(-2000));return result.stdout;};
  const versions=[...wrangler(['deployments','list']).matchAll(/Version\(s\):\s+\(100%\)\s+([a-f0-9-]{36})/g)];
  if(versions.at(-1)?.[1]!==manifest.previousDashboard)throw Error('Dashboard deployment changed; review.');
  run('bun',['run','build'],{cwd});const output=wrangler(['deploy']);console.log(output);
  const version=output.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];if(!version)throw Error('Inspect deployed version.');
  writeFileSync(join(release,'dashboard-deployment.json'),JSON.stringify({version,previous:manifest.previousDashboard,deployedAt:new Date().toISOString(),url:'https://dashboard.fluentxverse.com/stats'},null,2));
}else throw Error('Use --cloud or --dashboard after tests and visual review.');
