import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ssh, sshOptions, cloudTarget, quote } from './lib/cloud-ssh.mjs';

const release = join(process.cwd(), 'output/release', process.argv.includes('--shared-roles') ? 'lesson-disputes-shared-roles-20261102' : 'lesson-disputes-engine-20261102');
const prepared = JSON.parse(readFileSync(join(release, 'prepared.json')));
const stage = '/opt/fluentxverse/releases/' + prepared.id;
const compose = '/opt/fluentxverse/releases/20261023/compose.private.json';
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 8e6, ...options });
const guard = () => {
  if (ssh("docker inspect budol-gmr-engine-1 --format '{{.Config.Image}}'").trim() !== prepared.baselineEngine) throw Error('Engine baseline changed');
};
const wrangler = args => run('bun', ['/home/paulanthonyarriola/Desktop/budol/node_modules/wrangler/bin/wrangler.js', ...args, '--config', 'wrangler.json'], { cwd: join(release, 'frontend'), env: { ...process.env, CI: '1' } });
const latestWorker = () => JSON.parse(wrangler(['deployments', 'list', '--json'])).sort((a,b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0];
const save = (name, value) => writeFileSync(join(release, name), JSON.stringify(value, null, 2));

if (process.argv.includes('--upload')) {
  guard();
  const digest = createHash('sha256').update(readFileSync(join(release, 'engine/gmr-engine'))).digest('hex');
  if (digest !== prepared.binarySHA256) throw Error('Prepared binary changed');
  save('previous-worker.json', latestWorker());
  ssh(`mkdir -p ${stage}/engine`);
  run('scp', [...sshOptions, join(release, 'engine.tar.gz'), `${cloudTarget}:${stage}/engine.tar.gz`]);
  console.log(ssh(`tar -xzf ${stage}/engine.tar.gz -C ${stage}/engine && docker build --pull=false --network=none -t ${prepared.image} ${stage}/engine`, { timeout: 180000 }));
  save('uploaded.json', { image: prepared.image, uploadedAt: new Date().toISOString(), binarySHA256: digest });
} else if (process.argv.includes('--activate')) {
  guard();
  const uploaded = JSON.parse(readFileSync(join(release, 'uploaded.json')));
  if (uploaded.image !== prepared.image || uploaded.binarySHA256 !== prepared.binarySHA256) throw Error('Upload mismatch');
  // Inspect authoritative pending work without exporting credentials or records.
  const check = `import json,subprocess
c=json.loads(subprocess.check_output(['docker','inspect','budol-gmr-engine-1']))[0]
e=dict(x.split('=',1) for x in c['Config']['Env'])
api=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-server']))[0]['Config']['Image']
payload={k:e.get('GMR_ENGINE_MEMGRAPH_'+k,e.get('ENGINE_MEMGRAPH_'+k,'')) for k in ['URI','USER','PASSWORD']}
if not payload['URI']: raise RuntimeError('No explicit Engine database configured')
source="""import neo4j from 'neo4j-driver';const p=await Bun.stdin.json();const d=neo4j.driver(p.URI,p.USER?neo4j.auth.basic(p.USER,p.PASSWORD):undefined),s=d.session();try{const r=await s.run(\"MATCH(n) WHERE (n:EngineTransaction OR n:ZKProofSubmission OR any(label IN labels(n) WHERE label ENDS WITH 'Deployment')) AND n.status IN ['queued','signing','deploying','processing','pending','submitting','submitted'] RETURN labels(n)[0] AS kind,n.status AS status,coalesce(n.transactionResult,'') AS result\");let historical=0;for(const row of r.records){let result={};try{result=JSON.parse(row.get('result'));}catch{}if(row.get('kind')==='ZKProofSubmission'&&result.status==='finalized'){historical++;continue;}throw Error('Unsettled Engine operation; defer restart');}console.log(JSON.stringify({unsettledOperations:0,historicalFinalizedProofs:historical}));}finally{await s.close();await d.close();}"""
subprocess.run(['docker','run','--rm','-i','--network','container:budol-gmr-engine-1','--entrypoint','bun',api,'--no-env-file','-e',source],input=json.dumps(payload),text=True,check=True)`;
  console.log(ssh('python3 -c ' + quote(check), { timeout: 60000 }));
  const configure = `import json,os
p=${JSON.stringify(compose)};c=json.load(open(p))
if c['services']['gmr-engine']['image']!=${JSON.stringify(prepared.baselineEngine)}: raise RuntimeError('Compose baseline changed')
backup=${JSON.stringify(stage + '/rollback.private.json')}
if os.path.exists(backup): raise RuntimeError('Rollback record already exists')
fd=os.open(backup,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f: json.dump(c,f)
c['services']['gmr-engine']['image']=${JSON.stringify(prepared.image)}
fd=os.open(p+'.next',os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
with os.fdopen(fd,'w') as f: json.dump(c,f)
os.replace(p+'.next',p)
print('Updated Engine image only; runtime configuration and other services unchanged.')`;
  console.log(ssh('python3 -c ' + quote(configure)));
  try {
    console.log(ssh(`docker compose -f ${compose} up -d --no-deps --wait --wait-timeout 180 gmr-engine`, { timeout: 240000 }));
    console.log(ssh('docker exec budol-gmr-engine-1 wget -qO- http://127.0.0.1:8090/healthz'));
    save('api-deployment.json', { image: prepared.image, deployedAt: new Date().toISOString(), contractDeploymentSubmitted: false });
  } catch (error) {
    const rollback = `import json,os
p=${JSON.stringify(compose)};c=json.load(open(p))
if c['services']['gmr-engine']['image']!=${JSON.stringify(prepared.image)}: raise RuntimeError('Concurrent image change; do not overwrite')
c['services']['gmr-engine']['image']=${JSON.stringify(prepared.baselineEngine)}
fd=os.open(p+'.next',os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
with os.fdopen(fd,'w') as f: json.dump(c,f)
os.replace(p+'.next',p)`;
    ssh('python3 -c ' + quote(rollback));
    ssh(`docker compose -f ${compose} up -d --no-deps --wait --wait-timeout 180 gmr-engine`, { timeout: 240000 });
    throw error;
  }
} else if (process.argv.includes('--publish')) {
  const deployment = JSON.parse(readFileSync(join(release, 'api-deployment.json')));
  if (ssh("docker inspect budol-gmr-engine-1 --format '{{.Config.Image}} {{.State.Health.Status}}'").trim() !== deployment.image + ' healthy') throw Error('New Engine API is not healthy');
  const previous = JSON.parse(readFileSync(join(release, 'previous-worker.json')));
  if (JSON.stringify(latestWorker().versions) !== JSON.stringify(previous.versions)) throw Error('Cloudflare baseline changed');
  console.log(wrangler(['deploy']));
  save('frontend-deployment.json', { deployedAt: new Date().toISOString(), previousVersions: previous.versions, currentVersions: latestWorker().versions });
} else throw Error('Use --upload, --activate, or --publish');
