import { root, project } from './identity-mainnet-operations.mjs';
import { quote } from './lib/cloud-ssh.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const remote = '/opt/fluentxverse/releases/tutor-rewards-aero-20261104/private';
const image = 'fluentxverse-cloud/api:tutor-rewards-20261104-r6';
const mode = process.argv[2];
const adapter = '0x6f7f6dd424ac5ed441808288fb094eb0574bf6f2', feed = '0x25cbb57f2dccc478889a232a64fcee210fffd972';
if (mode === '--configure' || mode === '--approve-claims') {
  const approve = mode === '--approve-claims';
  const test = `import {alchemyRewardPrices} from './src/services/tutorRewards/alchemy';const p=await Bun.stdin.json();for(const key of p.keys){process.env.TUTOR_REWARDS_ALCHEMY_API_KEY=key;try{await alchemyRewardPrices.get(['0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec']);console.log(JSON.stringify({key}));process.exit(0);}catch{}}throw Error('No configured Alchemy key can supply a fresh NVDA price');`;
  const policy = `import neo4j from 'neo4j-driver';const p=await Bun.stdin.json();const d=neo4j.driver(p.URI,p.USER?neo4j.auth.basic(p.USER,p.PASSWORD):undefined),s=d.session();try{const r=(await s.run('MATCH(a:EngineApp {id:$id}) RETURN a',{id:'${project}'})).records[0];if(!r)throw Error('Missing project');const a=r.get('a').properties,contracts=a.allowedContracts||[];if(contracts.length){for(const address of ['${adapter}','${feed}'])if(!contracts.some(v=>v.toLowerCase()===address))contracts.push(address);await s.run('MATCH(a:EngineApp {id:$id}) SET a.allowedContracts=$contracts RETURN a.id',{id:'${project}',contracts});}console.log(JSON.stringify({existingPermissionsPreserved:true}));}finally{await s.close();await d.close();}`;
  const py = `import json,subprocess,os,re
from pathlib import Path
r=Path('${remote}');c=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-server']))[0];e=json.loads(subprocess.check_output(['docker','inspect','budol-gmr-engine-1']))[0]
if c['Config']['Image']!='${image}' or c['State']['Health']['Status']!='healthy' or e['Config']['Image']!='fluentxverse-cloud/gmr-engine:tutor-rewards-claims-20261104' or e['State']['Health']['Status']!='healthy':raise RuntimeError('Unexpected production baseline')
env=dict(x.split('=',1) for x in e['Config']['Env']);aenv=dict(x.split('=',1) for x in c['Config']['Env'])
def private(path,value):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as f:json.dump(value,f);f.flush();os.fsync(f.fileno())
name='claims-approved' if ${approve ? 'True' : 'False'} else 'aero-configured'
backup=r/(name+'-rollback.private.json');override=r/(name+'.override.json')
if not backup.exists():
 settings={'TUTOR_REWARDS_CLAIMS_APPROVED':'${approve ? 'true' : 'false'}'}
 if not ${approve ? 'True' : 'False'}:
  keys=[]
  for k,v in env.items():
   if 'ALCHEMY' in k and 'KEY' in k and v:keys.append(v)
   keys.extend(re.findall(r'https://[^/" ]*alchemy.com/v2/([A-Za-z0-9_-]+)',v))
  keys=list(dict.fromkeys(keys))
  result=json.loads(subprocess.check_output(['docker','exec','-i','fluentxverse-server','bun','--no-env-file','-e',${JSON.stringify(test)}],input=json.dumps({'keys':keys}),text=True))
  settings.update({'TUTOR_REWARDS_ALCHEMY_API_KEY':result['key'],'TUTOR_REWARDS_APPROVED_ADAPTERS':'${adapter}','TUTOR_REWARDS_PRICE_PUBLISHING_ENABLED':'true'})
  p={k:env.get('GMR_ENGINE_MEMGRAPH_'+k,env.get('ENGINE_MEMGRAPH_'+k,'')) for k in ['URI','USER','PASSWORD']}
  print(subprocess.check_output(['docker','run','--rm','-i','--network','container:budol-gmr-engine-1','--entrypoint','bun','${image}','--no-env-file','-e',${JSON.stringify(policy)}],input=json.dumps(p),text=True))
 else:
  if aenv.get('TUTOR_REWARDS_APPROVED_ADAPTERS')!='${adapter}' or not aenv.get('TUTOR_REWARDS_ALCHEMY_API_KEY'):raise RuntimeError('Aero must be configured first')
 private(backup,c);private(override,{'services':{'api':{'environment':settings}}})
elif not override.exists():raise RuntimeError('Incomplete activation journal; inspect manually')
labels=c['Config']['Labels'];files=labels['com.docker.compose.project.config_files'].split(',')
if str(override) not in files:files.append(str(override))
if not all(Path(f).is_file() for f in files):raise RuntimeError('Missing compose baseline')
args=['docker','compose','-p',labels['com.docker.compose.project']]+[v for f in files for v in ['-f',f]]
subprocess.run(args+['up','-d','--no-deps','--wait','--wait-timeout','120','api'],check=True)
print(json.dumps({'health':'healthy','claimsApproved':${approve ? 'True' : 'False'},'privateCredentialsNotExported':True}))`;
  console.log(root('flock -w 120 /tmp/fxv-aero-activation.lock python3 -c ' + quote(py), { timeout: 300000 }));
} else {
  if (!['--route', '--feed-enable', '--adapter-enable', '--publish', '--asset', '--open', '--status', '--quote-check', '--security-check', '--receipts', '--application-check'].includes(mode)) throw Error('Unknown activation step');
  const code = `import {parseAbi} from 'viem';
import {initDriver,getDriver,closeDriver} from './src/db/memgraph';
import {rewardsGateway as g,pin} from './src/services/tutorRewards/gateway';
import {aeroTutorRewards as aero,aeroPath} from './src/services/tutorRewards/aero';
import {tutorRewardsService as service} from './src/services/tutorRewards/service';
import {tutorRewardClaims} from './src/services/tutorRewards/claims';
import compiled from '/shared/tutorRewardsAeroArtifact.json';
await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD,1);
const s=getDriver().session(), mode=${JSON.stringify(mode)}, asset=aero.config.assets[0];
const run=(cypher,p={})=>s.run(cypher,p);
try {
 if(mode==='--application-check'){
  const id=(await run('MATCH(u:User) RETURN u.id AS id LIMIT 1')).records[0]?.get('id');if(!id)throw Error('No existing tutor account to check');
  const summary=await tutorRewardClaims.summary(id);
  console.log(JSON.stringify({summaryReadSuccessful:true,availableUsd:summary.availableUsd,claimsOpen:summary.claimsOpen,assetSymbols:summary.assets.map(a=>a.symbol),chainId:summary.chainId,privateWalletOrIdentityNotExported:true}));
 } else if(mode==='--receipts'){
  const result=[];
  for(const r of (await run('MATCH(o:AeroActivationCommand) RETURN o ORDER BY o.createdAt')).records){
   const o=r.get('o').properties;if(!o.engineId)throw Error('Activation has an unsubmitted operation');
   const abi=o.address===aero.config.adapter?compiled.adapter.abi:compiled.feed.abi;
   const state=await g.contractOperation(o.engineId,o.address,abi,o.method,JSON.parse(o.argsJson));
   await run('MATCH(o:AeroActivationCommand {id:$id}) SET o.status=$status,o.transactionHash=$hash RETURN o.id',{id:o.id,status:state.status,hash:state.transactionHash});
   result.push({method:o.method,target:o.address,...state});
  }
  await service.reconcile();
  for(const r of (await run('MATCH(o:TutorRewardOperation) WHERE o.id IN $ids RETURN o',{ids:['53124934-5110-4c7a-8ea8-dcab80bdd68f','53124934-5110-4c7a-8ea8-dcab80bdd690']})).records){const o=r.get('o').properties;result.push({method:JSON.parse(o.commandJson).method,target:pin.contract,status:o.status,transactionHash:o.transactionHash});}
  console.log(JSON.stringify({operations:result,allFinalized:result.length>=6&&result.every(o=>o.status==='finalized')}));
 } else if(mode==='--security-check'){
  const invalid={userId:'nonexistent-activation-test',wallet:pin.operator,claim:{},data:'0x',periodIds:[]};
  const r=await fetch(process.env.TUTOR_REWARDS_ENGINE_API_BASE+'/v1/tutor-rewards/authorize',{method:'POST',headers:{'Content-Type':'application/json','X-GMR-Engine-Key':process.env.TUTOR_REWARDS_ENGINE_API_KEY},body:JSON.stringify(invalid)});
  if(r.status!==403)throw Error('Engine failed closed-user authorization check');
  console.log(JSON.stringify({managedWalletMismatchRejected:true,status:r.status}));
 } else if(mode==='--status'){
  const state=await g.status();const read=(address,abi,fn,args=[])=>g.client.readContract({address,abi,functionName:fn,args});
  console.log(JSON.stringify({state,adapterPaused:await read(aero.config.adapter,compiled.adapter.abi,'paused'),feedPaused:await read(asset.feed,compiled.feed.abi,'paused'),route:await read(aero.config.adapter,compiled.adapter.abi,'paths',[asset.token]),feedObservedAt:String(await read(asset.feed,compiled.feed.abi,'observedAt')),asset:(await g.read('rewardAssets',[asset.token])).map(v=>typeof v==='bigint'?String(v):v),claimsApproved:process.env.TUTOR_REWARDS_CLAIMS_APPROVED==='true',publisherEnabled:process.env.TUTOR_REWARDS_PRICE_PUBLISHING_ENABLED==='true'}));
 } else if(mode==='--quote-check') {
  const q=await aero.quote(asset.token,'12');console.log(JSON.stringify({quoteSuccessful:true,token:q.token,expectedAmountOut:q.expectedAmountOut,minAmountOut:q.minAmountOut,deadline:q.deadline,claimsPaused:q.claimsPaused,noPurchaseSubmitted:true}));
 } else if(mode==='--asset'||mode==='--open'){
  if(mode==='--open'){await aero.bindings(asset);await aero.quote(asset.token,'12');}
  const actor=(await run('MATCH(a:Admin {role:"superadmin"}) RETURN a.id AS id ORDER BY a.id LIMIT 1')).records[0]?.get('id');if(!actor)throw Error('Superadmin missing');
  const body=mode==='--asset'?{action:'configure_asset',requestId:'53124934-5110-4c7a-8ea8-dcab80bdd68f',reason:'Approved deployment: pinned Aero route and Alchemy publisher feed; initial NVDA-only rewards integration.',params:{token:asset.token,adapter:aero.config.adapter,priceFeed:asset.feed,maxPriceAgeSeconds:300,maxSlippageBps:100}}
   :{action:'set_paused',requestId:'53124934-5110-4c7a-8ea8-dcab80bdd690',reason:'Activate tested managed-wallet reward claims; allocations remain paused until payroll configuration and funding.',params:{claimsPaused:false,allocationsPaused:true}};
  const result=await service.command(body,actor);await service.reconcile();console.log(JSON.stringify(result));
 } else {
  let address=aero.config.adapter,abi=compiled.adapter.abi,method,args;
  if(mode==='--route'){method='setRoute';args=[asset.token,aeroPath(asset)];}
  if(mode==='--adapter-enable'){method='setPaused';args=[false];}
  if(mode==='--feed-enable'){address=asset.feed;abi=compiled.feed.abi;method='setPaused';args=[false];}
  if(mode==='--publish'){const o=await aero.publication(asset.token);address=asset.feed;abi=compiled.feed.abi;method='publish';args=o.args;}
  const id='aero-activation:'+mode+(mode==='--publish'?':'+args[2]:'');
  let row=(await run('MATCH(o:AeroActivationCommand {id:$id}) RETURN o',{id})).records[0]?.get('o').properties;
  if(!row){row=(await run('CREATE(o:AeroActivationCommand {id:$id,address:$address,method:$method,argsJson:$args,status:"prepared",createdAt:$at}) RETURN o',{id,address,method,args:JSON.stringify(args),at:new Date().toISOString()})).records[0].get('o').properties;}
  args=JSON.parse(row.argsJson);if(row.address!==address||row.method!==method)throw Error('Activation binding changed');
  let engineId=row.engineId;
  if(!engineId){await run('MATCH(o:AeroActivationCommand {id:$id}) SET o.attempted=true RETURN o.id',{id});engineId=await g.submitContract(id,address,abi,method,args,!!row.attempted);await run('MATCH(o:AeroActivationCommand {id:$id}) SET o.engineId=$engineId RETURN o.id',{id,engineId});}
  const result=await g.contractOperation(engineId,address,abi,method,args);await run('MATCH(o:AeroActivationCommand {id:$id}) SET o.status=$status,o.transactionHash=$hash RETURN o.id',{id,status:result.status,hash:result.transactionHash});
  console.log(JSON.stringify({id,engineId,...result}));
 }
}finally{await s.close();await closeDriver();}`;
  const py = `import json,subprocess
c=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-server']))[0]
if c['Config']['Image']!='${image}' or c['State']['Health']['Status']!='healthy':raise RuntimeError('API baseline changed')
print(subprocess.check_output(['docker','exec','fluentxverse-server','bun','--no-env-file','-e',${JSON.stringify(code)}],text=True))`;
  const output = root('flock -w 120 /tmp/fxv-aero-activation.lock python3 -c ' + quote(py), { timeout: 240000 });
  console.log(output);
  if (['--status', '--receipts', '--quote-check', '--application-check', '--security-check'].includes(mode)) {
    const data = JSON.parse(output.trim().split('\n').filter(line => line.startsWith('{')).at(-1));
    mkdirSync('output/verification/tutor-rewards-aero', { recursive: true });
    writeFileSync('output/verification/tutor-rewards-aero/production' + mode.slice(1) + '.json', JSON.stringify({ at: new Date().toISOString(), ...data }, null, 2));
  }
}
