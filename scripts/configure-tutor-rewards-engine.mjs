import { root, project } from './identity-mainnet-operations.mjs';
import { quote } from './lib/cloud-ssh.mjs';
const remote = '/opt/fluentxverse/releases/tutor-rewards-20261104/private';
const configure = `import neo4j from 'neo4j-driver';const p=await Bun.stdin.json();const d=neo4j.driver(p.URI,p.USER?neo4j.auth.basic(p.USER,p.PASSWORD):undefined),s=d.session();
try{const row=(await s.run('MATCH(a:EngineApp {id:$id}) RETURN a',{id:'${project}'})).records[0];if(!row)throw Error('Missing FluentXVerse Engine project');const a=row.get('a').properties;
const chains=a.allowedChains||[],contracts=a.allowedContracts||[];
if(chains.length&&!chains.some(v=>Number(v)===4663))chains.push(neo4j.int(4663));
if(contracts.length)for(const address of ['0x90153ced2a37eeba68c68f945653c7959ba0f627','0x5fc5360d0400a0fd4f2af552add042d716f1d168'])if(!contracts.some(v=>v.toLowerCase()===address))contracts.push(address);
await s.run('MATCH(a:EngineApp {id:$id}) SET a.allowedChains=$chains,a.allowedContracts=$contracts RETURN a.id',{id:'${project}',chains,contracts});
console.log(JSON.stringify({projectId:'${project}',robinhoodPermitted:true,existingPermissionsPreserved:true}));
}finally{await s.close();await d.close();}`;
const key = `const p=await Bun.stdin.json();const r=await fetch('http://127.0.0.1:8090/admin/apps/${project}/api-keys',{method:'POST',headers:{'Content-Type':'application/json','X-GMR-Engine-Admin-Key':p.admin},body:JSON.stringify({name:'Tutor rewards control 20261104',scopes:['transactions:read','transactions:write']})});if(!r.ok)throw Error('Rewards connection creation failed');const j=await r.json();if(!j.plaintext)throw Error('No rewards key');console.log(JSON.stringify({key:j.plaintext,keyId:j.key.id,projectId:'${project}'}));`;
const py = `import json,subprocess,os
from pathlib import Path
r=Path('${remote}');r.mkdir(parents=True,exist_ok=True,mode=0o700)
e=json.loads(subprocess.check_output(['docker','inspect','budol-gmr-engine-1']))[0];a=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-server']))[0]
if e['Config']['Image']!='fluentxverse-cloud/gmr-engine:lesson-registry-batching-20261104' or e['State']['Health']['Status']!='healthy':raise RuntimeError('Engine baseline changed')
env=dict(x.split('=',1) for x in e['Config']['Env'])
def private(path,value):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as f:json.dump(value,f);f.flush();os.fsync(f.fileno())
p={k:env.get('GMR_ENGINE_MEMGRAPH_'+k,env.get('ENGINE_MEMGRAPH_'+k,'')) for k in ['URI','USER','PASSWORD']}
print(subprocess.check_output(['docker','run','--rm','-i','--network','container:budol-gmr-engine-1','--entrypoint','bun',a['Config']['Image'],'--no-env-file','-e',${JSON.stringify(configure)}],input=json.dumps(p),text=True))
connection=r/'connection.private.json'
if not connection.exists():
 p={'admin':env.get('GMR_ENGINE_ADMIN_API_KEY',env.get('ENGINE_ADMIN_API_KEY',''))}
 result=json.loads(subprocess.check_output(['docker','run','--rm','-i','--network','container:budol-gmr-engine-1','--entrypoint','bun',a['Config']['Image'],'--no-env-file','-e',${JSON.stringify(key)}],input=json.dumps(p),text=True))
 private(connection,result)
rpc=json.loads(env.get('GMR_ENGINE_CHAIN_RPC_URLS','{}'))
if '4663' in rpc and rpc['4663']!='https://rpc.mainnet.chain.robinhood.com':raise RuntimeError('Existing Robinhood RPC differs; inspect before replacing')
if '4663' not in rpc:
 backup=r/'engine-network-rollback.private.json'
 if not backup.exists():private(backup,e)
 rpc['4663']='https://rpc.mainnet.chain.robinhood.com'
 override=r/'engine-network.override.json'
 if not override.exists():private(override,{'services':{'gmr-engine':{'environment':{'GMR_ENGINE_CHAIN_RPC_URLS':json.dumps(rpc)}}}})
 labels=e['Config']['Labels'];files=labels['com.docker.compose.project.config_files'].split(',')
 if not all(Path(f).is_file() for f in files):raise RuntimeError('Missing Engine compose baseline')
 args=['docker','compose','-p',labels['com.docker.compose.project']]+[v for f in files for v in ['-f',f]]
 subprocess.run(args+['-f',str(override),'up','-d','--no-deps','--wait','--wait-timeout','120','gmr-engine'],check=True)
print(json.dumps({'robinhoodRpcConfigured':True,'dedicatedRewardsConnection':True,'contractActivationChanged':False}))`;
console.log(root('python3 -c ' + quote(py), { timeout: 300000 }));
