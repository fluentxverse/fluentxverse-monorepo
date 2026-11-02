import { ssh, quote } from './lib/cloud-ssh.mjs';

const compose = '/opt/fluentxverse/releases/20261023/compose.private.json';
const backup = '/opt/fluentxverse/releases/dashboard-auth-20261027/compose.rollback.private.json';
const previous = 'fluentxverse-cloud/api:workplace-communication-20261027';
const image = 'fluentxverse-cloud/api:dashboard-auth-20261027';
if (ssh("docker inspect fluentxverse-server --format '{{.Config.Image}}'").trim() !== previous) throw Error('API baseline changed');
const active = "import{db,closePool}from'./src/db/postgres';try{const r=await db`SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'`;if(r[0].n>0)throw Error('Active classrooms; defer release');console.log(JSON.stringify({activeClassrooms:r[0].n}));}finally{await closePool();}";
console.log(ssh(`docker exec fluentxverse-server bun --no-env-file -e ${quote(active)}`));
const update = `import json,os,shutil
p=${JSON.stringify(compose)}
c=json.load(open(p))
if c['services']['api']['image']!=${JSON.stringify(previous)}: raise RuntimeError('Compose baseline changed')
shutil.copy2(p,${JSON.stringify(backup)})
c['services']['api']['image']=${JSON.stringify(image)}
fd=os.open(p+'.next',os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
with os.fdopen(fd,'w') as f: json.dump(c,f)
os.replace(p+'.next',p)`;
ssh(`python3 -c ${quote(update)}`);
try {
  console.log(ssh(`docker compose -f ${quote(compose)} up -d --no-deps --wait --wait-timeout 120 api`, { timeout: 180000 }));
  const paths = ['/lesson-materials/public/business-english-L3-C1-1-listening-1772772288728', '/lesson-materials/published/business-english', '/young-learners/public/test', '/young-learners/published'];
  for (const path of paths) {
    const response = await fetch(`https://api.fluentxverse.com${path}`, { signal: AbortSignal.timeout(15000) });
    if (response.status !== 401 || !response.headers.get('cache-control')?.includes('no-store')) throw Error(`Unexpected anonymous response for ${path}: ${response.status}`);
  }
  console.log('Anonymous material requests rejected.');
} catch (error) {
  ssh(`cp -p ${quote(backup)} ${quote(compose)} && docker compose -f ${quote(compose)} up -d --no-deps --wait --wait-timeout 120 api`, { timeout: 180000 });
  throw error;
}
