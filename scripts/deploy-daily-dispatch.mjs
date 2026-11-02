import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { cloudTarget, quote, ssh, sshOptions } from './lib/cloud-ssh.mjs';

const source = resolve(process.argv[2] || '../fluentxverse-ai');
const release = resolve('output/release/daily-dispatch-20261027');
const stage = '/opt/fluentxverse/releases/daily-dispatch-20261027';
const image = 'fluentxverse-cloud/dispatch:20261027';
const files = ['Dockerfile.dispatch', 'package.json', 'bun.lock', 'src'];
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 8e6, ...options });
mkdirSync(release, { recursive: true });
run('bun', ['test', 'tests/daily.policy.test.ts'], { cwd: source, stdio: 'inherit' });
const archive = join(release, 'dispatch-source.tar.gz');
run('tar', ['-czf', archive, '-C', source, ...files]);
const sha256 = createHash('sha256').update(readFileSync(archive)).digest('hex');
ssh(`mkdir -p ${quote(stage)}`);
run('scp', [...sshOptions, archive, `${cloudTarget}:${stage}/source.tar.gz`]);
ssh(`echo ${quote(`${sha256}  ${stage}/source.tar.gz`)} | sha256sum -c -`);
ssh(`mkdir -p ${stage}/source && tar -xzf ${stage}/source.tar.gz -C ${stage}/source`);
console.log(ssh(`docker build --file ${stage}/source/Dockerfile.dispatch -t ${image} ${stage}/source`, { timeout: 600000 }));
// Copy only the generator's required credentials on the host; never print them.
const configure = `import json,subprocess,os
stage=${JSON.stringify(stage)}
c=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-server']))[0]
e=dict(s.split('=',1) for s in c['Config']['Env'])
keys=['MEMGRAPH_URI','MEMGRAPH_USER','MEMGRAPH_PASSWORD','OPENAI_API_KEY','NEWSAPI_KEY','GNEWS_KEY']
for k in ['MEMGRAPH_URI','MEMGRAPH_PASSWORD','OPENAI_API_KEY']:
 if not e.get(k): raise RuntimeError('Missing required setting: '+k)
env={k:e[k].replace('$','$$') for k in keys if e.get(k)}
env['NODE_ENV']='production'
config={'services':{'dispatch':{'image':${JSON.stringify(image)},'container_name':'fluentxverse-dispatch','restart':'unless-stopped','environment':env,'networks':['app'],'read_only':True,'tmpfs':['/tmp:rw,nosuid,size=67108864,uid=1000,gid=1000'],'mem_limit':'768m','cpus':0.5,'pids_limit':128,'cap_drop':['ALL'],'security_opt':['no-new-privileges:true'],'logging':{'driver':'json-file','options':{'max-size':'10m','max-file':'3'}}}},'networks':{'app':{'external':True,'name':'fluentxverse-cloud_app'}}}
path=stage+'/compose.private.json'
fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
with os.fdopen(fd,'w') as f: json.dump(config,f)
print('Private generator configuration prepared; API configuration unchanged.')`;
console.log(ssh(`python3 -c ${quote(configure)}`));
console.log(ssh(`docker compose -p fluentxverse-dispatch -f ${stage}/compose.private.json up -d --no-build`, { timeout: 120000 }));
writeFileSync(join(release, 'deployment.json'), JSON.stringify({ image, sourceHash: sha256, deployedAt: new Date().toISOString(), schedule: '03:00 Asia/Manila', apiChanged: false }, null, 2));
console.log('Daily Dispatch worker deployed. Verify its first publication and health before accepting the release.');
