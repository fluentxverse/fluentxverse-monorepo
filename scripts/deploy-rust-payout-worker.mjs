import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ssh, quote, sshOptions, cloudTarget } from './lib/cloud-ssh.mjs';

const id='rust-payout-worker-20261029',release=join(process.cwd(),'output/release',id),stage='/opt/fluentxverse/releases/'+id;
const baseline='fluentxverse-cloud/gmr-engine:project-destinations-20261029',image='fluentxverse-cloud/gmr-engine:'+id;
const compose='/opt/fluentxverse/releases/20261023/compose.private.json';
const run=(cmd,args,options={})=>execFileSync(cmd,args,{encoding:'utf8',maxBuffer:8e6,...options});
const upload=(from,to)=>run('scp',[...sshOptions,from,`${cloudTarget}:${to}`]);
const guard=()=>{if(ssh("docker inspect budol-gmr-engine-1 --format '{{.Config.Image}}'").trim()!==baseline)throw Error('Engine baseline changed');};
if(process.argv.includes('--prepare')){
 guard();
 const source=join(release,'engine-source'),env={...process.env,CCACHE_DISABLE:'1',GOCACHE:join(process.cwd(),'output/go-native-cache')};
 run('go',['test','-race','./internal/httpapi','./internal/config'],{cwd:source,env,stdio:'inherit'});
 const build=join(release,'image');mkdirSync(build,{recursive:true});
 run('go',['build','-trimpath','-ldflags=-s -w','-o',join(build,'gmr-engine'),'./cmd/api'],{cwd:source,env:{...env,CGO_ENABLED:'0',GOOS:'linux',GOARCH:'amd64'}});
 cpSync('output/rust-prover-target/release/gmr-groth16-worker',join(build,'gmr-groth16-worker'));
 for(const f of ['payout-private-prover.ts','payout-private-worker.mjs','native-lifecycle.mjs'])cpSync(join(release,f),join(build,f));
 const hash=createHash('sha256').update(readFileSync(join(build,'gmr-groth16-worker'))).digest('hex');
 writeFileSync(join(build,'Dockerfile'),`FROM ${baseline}\nCOPY gmr-engine gmr-groth16-worker /usr/local/bin/\nCOPY payout-private-prover.ts payout-private-worker.mjs /app/scripts/\nCOPY native-lifecycle.mjs /qa/native-lifecycle.mjs\n`);
 ssh(`mkdir -p ${stage}/image`);run('tar',['-czf',join(release,'image.tar.gz'),'-C',build,'.']);upload(join(release,'image.tar.gz'),stage+'/image.tar.gz');
 console.log(ssh(`tar -xzf ${stage}/image.tar.gz -C ${stage}/image && docker build --pull=false --network=none -t ${image} ${stage}/image`,{timeout:180000}));
 const qa=`docker run --rm --name fluentxverse-native-payout-qa --network=none --cpus=1 --cpu-shares=128 --memory=2g --memory-swap=2g --pids-limit=192 --read-only --cap-drop=ALL --security-opt=no-new-privileges --user=1000:1000 --tmpfs=/tmp:rw,nosuid,nodev,size=256m --mount type=bind,src=/opt/fluentxverse/benchmarks/rust-prover-20261029,dst=/artifacts,readonly --entrypoint=node ${image} /qa/native-lifecycle.mjs`;
 let output;
 try{output=ssh(qa,{timeout:300000});console.log(output);}finally{try{ssh('docker rm -f fluentxverse-native-payout-qa');}catch{}}
 writeFileSync(join(release,'verification.json'),JSON.stringify({passed:true,hash,verifiedAt:new Date().toISOString(),checks:output.split('\n').filter(s=>s.startsWith('{')).map(s=>JSON.parse(s))},null,2));
 writeFileSync(join(release,'prepared.json'),JSON.stringify({image,baseline,hash,preparedAt:new Date().toISOString()},null,2));
}else if(process.argv.includes('--activate')){
 guard();const prepared=JSON.parse(readFileSync(join(release,'prepared.json'))),verified=JSON.parse(readFileSync(join(release,'verification.json')));
 if(!verified.passed||verified.hash!==prepared.hash)throw Error('Verify exact release first');
 const idle="import{db,closePool}from'./src/db/postgres';try{const r=await db`SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'`;if(r[0].n)throw Error('Active classrooms; defer restart');console.log('No active classrooms');}finally{await closePool();}";
 console.log(ssh('docker exec fluentxverse-server bun --no-env-file -e '+quote(idle)));
 const configure=`import json,os,subprocess
p=${JSON.stringify(compose)};c=json.load(open(p));e=c['services']['gmr-engine']['environment']
container=json.loads(subprocess.check_output(['docker','inspect','budol-gmr-engine-1']))[0]
mount=next(m['Source'] for m in container['Mounts'] if m['Destination']=='/app/config')
path=mount+e['GMR_ENGINE_PAYOUT_PROVER_PATH'][len('/app/config'):]
releases=json.load(open(path));backup=${JSON.stringify(stage+'/rollback.private.json')}
if os.path.exists(backup): raise RuntimeError('Backup exists')
def save(p,data):
 fd=os.open(p+'.next',os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
 with os.fdopen(fd,'w') as f: json.dump(data,f)
 os.replace(p+'.next',p)
save(backup,{'compose':c,'path':path,'releases':releases})
releases['6360e46f-96c6-4935-8344-b5375155ae3c']['config']['proverBackend']='rust'
e['GMR_ENGINE_PAYOUT_NATIVE_ENABLED']='true';e['GMR_ENGINE_PAYOUT_NATIVE_BIN']='/usr/local/bin/gmr-groth16-worker';e['GMR_ENGINE_PAYOUT_NATIVE_SHA256']=${JSON.stringify(prepared.hash)}
c['services']['gmr-engine']['image']=${JSON.stringify(image)}
save(path,releases);save(p,c)
print('Configured Rust payout pilot only; existing setup/key/custody pins unchanged.')`;
 console.log(ssh(`docker compose -f ${compose} stop gmr-engine`,{timeout:120000}));
 try{
  console.log(ssh('python3 -c '+quote(configure)));
  console.log(ssh(`docker compose -f ${compose} up -d --no-deps --wait --wait-timeout 180 gmr-engine`,{timeout:240000}));
  writeFileSync(join(release,'deployment.json'),JSON.stringify({...prepared,deployedAt:new Date().toISOString(),pilotOnly:true},null,2));
 }catch(error){
  const rollback=`import json,os\nb=json.load(open(${JSON.stringify(stage+'/rollback.private.json')}))\nfor p,data in [(b['path'],b['releases']),(${JSON.stringify(compose)},b['compose'])]:\n fd=os.open(p+'.next',os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)\n with os.fdopen(fd,'w') as f: json.dump(data,f)\n os.replace(p+'.next',p)`;
  ssh('python3 -c '+quote(rollback));ssh(`docker compose -f ${compose} up -d --no-deps --wait --wait-timeout 180 gmr-engine`,{timeout:240000});throw error;
 }
}else throw Error('Use --prepare or --activate');
