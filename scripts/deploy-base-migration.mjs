import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { cloudTarget, quote, ssh, sshOptions } from './lib/cloud-ssh.mjs';

const release=join(process.cwd(),'output/release/base-migration-20261024');
const manifest=JSON.parse(readFileSync(join(release,'source-manifest.json')));
const stage='/opt/fluentxverse/releases/base-migration-20261024';
const configPath='/opt/fluentxverse/releases/20261023/compose.private.json';
const imageAPI='fluentxverse-cloud/api:base-migration-20261024', imageEngine='fluentxverse-cloud/gmr-engine:base-migration-20261024';
const run=(cmd,args,options={})=>execFileSync(cmd,args,{encoding:'utf8',maxBuffer:8*1024*1024,...options});
const upload=(from,to)=>run('scp',[...sshOptions,from,`${cloudTarget}:${to}`]);
const digest=value=>createHash('sha256').update(value).digest('hex');
const privateDir=join(homedir(),'.local/state/fluentxverse/base-migration-20261024');mkdirSync(privateDir,{recursive:true,mode:0o700});
const selected=new Set(['2a798002-7ed3-4e98-853e-62306479b9da','55e96ef6-0cb5-4d64-b369-8c7fec976188','ee2dd009-1cee-4ade-ae3c-13535004ee1d','683a093b-10fb-44d9-9ca4-e268f3e0ce5d','b89ee4cb-625d-41af-b56e-ac7744fce805']);

if(process.argv.includes('--build')){
  for(const [file,hash]of Object.entries(manifest.baselineFiles)){
    const engine=file.startsWith('engine/'),path=file.slice(file.indexOf('/')+1);
    if(digest(ssh(`docker exec ${engine?'budol-gmr-engine-1':'fluentxverse-server'} cat ${quote('/app/'+path)}`))!==hash)throw Error('Live source baseline changed: '+file);
  }
  for(const [part,image]of [['engine-overlay',imageEngine],['api-overlay',imageAPI]]){
    run('tar',['-czf',join(release,part+'.tar.gz'),'-C',join(release,part),'.']);
    ssh(`mkdir -p ${stage}/${part}`);upload(join(release,part+'.tar.gz'),`${stage}/${part}.tar.gz`);
    ssh(`tar -xzf ${stage}/${part}.tar.gz -C ${stage}/${part}`);
    console.log(ssh(`docker build --pull=false --network=none -t ${image} ${stage}/${part}`,{timeout:180000}));
  }
  console.log(ssh(`docker run --rm --network none --entrypoint bun ${imageEngine} test ./scripts/horizen-receipt.test.ts ./scripts/screening-bridge-prover.test.ts`,{timeout:60000}));
  console.log(ssh(`docker run --rm --network none -e NODE_ENV=test --entrypoint bun ${imageAPI} test ./tests/baseMigration.test.ts ./tests/requestDefense.test.ts`,{timeout:60000}));
  writeFileSync(join(release,'images-built.json'),JSON.stringify({imageAPI,imageEngine,builtAt:new Date().toISOString()},null,2));
}else if(process.argv.includes('--activate')){
  JSON.parse(readFileSync(join(release,'images-built.json')));
  const config=JSON.parse(ssh(`cat ${quote(configPath)}`));
  if(config.services.api.image!==manifest.apiImage||config.services['gmr-engine'].image!==manifest.engineImage)throw Error('Live images changed since preparation.');
  const engineEnv=config.services['gmr-engine'].environment,apiEnv=config.services.api.environment;
  const mappings=JSON.parse(engineEnv.GMR_ENGINE_CHAIN_RPC_URLS||'{}');
  let rpc=mappings['8453'];
  if(!rpc){const candidate=Object.values(mappings).find(url=>new URL(url).hostname==='base-sepolia.g.alchemy.com');if(candidate){const next=new URL(candidate);next.hostname='base-mainnet.g.alchemy.com';rpc=next.href;}}
  if(!rpc)rpc='https://mainnet.base.org';
  const chainResponse=await fetch(rpc,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]}),signal:AbortSignal.timeout(15000)});
  const chain=await chainResponse.json();if(chain.result!=='0x2105')throw Error('Base RPC identity/entitlement verification failed; no live settings changed.');
  const bridge='0xCb47A3C3B9Eb2E549a3F2EA4729De28CafbB2b69';
  const mounts=JSON.parse(ssh("docker inspect budol-gmr-engine-1 --format '{{json .Mounts}}'"));
  const configMount=mounts.find(m=>m.Destination==='/app/config');if(!configMount)throw Error('Engine configuration mount missing.');
  const changes=[];
  for(const envKey of ['GMR_ENGINE_SCREENING_PROVER_PATH','GMR_ENGINE_ZKVERIFY_POLICY_PATH']){
    const path=engineEnv[envKey];if(!path?.startsWith('/app/config/'))throw Error('Unknown Engine configuration path.');
    const hostPath=configMount.Source+path.slice('/app/config'.length);
    const original=ssh(`cat ${quote(hostPath)}`),data=JSON.parse(original);
    for(const [id,p]of Object.entries(data)){
      if(!selected.has(id))continue;
      if(envKey==='GMR_ENGINE_SCREENING_PROVER_PATH'){
        if(p.enabled!==true||p.config?.chainId!==26514||p.config?.domainId!==3)throw Error('Unexpected screening release baseline.');
        Object.assign(p.config,{chainId:8453,domainId:2,bridge,verificationNetwork:'zkVerify'});
      }else{
        p.network='zkVerify';p.domainId=2;
        if(p.bindings){p.bindings.chainId='8453';p.bindings.adapterAddress=BigInt(bridge).toString();}
      }
    }
    const local=join(privateDir,envKey+'.json');writeFileSync(local,JSON.stringify(data,null,2),{mode:0o600});
    changes.push({hostPath,local,hash:digest(original)});
  }
  mappings['8453']=rpc;
  Object.assign(engineEnv,{GMR_ENGINE_CHAIN_ID:'8453',GMR_ENGINE_RPC_URL:rpc,GMR_ENGINE_BASE_MAINNET_RPC_URL:rpc,GMR_ENGINE_CHAIN_RPC_URLS:JSON.stringify(mappings),GMR_ENGINE_ZKVERIFY_NETWORK:'zkVerify',GMR_ENGINE_ZKVERIFY_RPC_URL:'https://zkverify-rpc.zkverify.io',GMR_ENGINE_ZKVERIFY_WS_URL:'wss://zkverify-rpc.zkverify.io'});
  Object.assign(apiEnv,{SCREENING_CHAIN_ID:'8453',SCREENING_RPC_URL:rpc,SCREENING_ZKVERIFY_DOMAIN_ID:'2',SCREENING_RECEIPT_BRIDGE:bridge,
    ANONYMOUS_REVIEWS_CHAIN_ID:'8453',ANONYMOUS_REVIEWS_RPC_URL:rpc,ANONYMOUS_REVIEWS_DOMAIN_ID:'2',ANONYMOUS_REVIEWS_BRIDGE:bridge,
    LESSON_PASSES_CHAIN_ID:'8453',LESSON_PASSES_RPC_URL:rpc,LESSON_PASSES_DOMAIN_ID:'2',LESSON_PASSES_BRIDGE:bridge,ZKVERIFY_DOMAIN_ID:'2',TICKET_CHAIN_ID:'8453'});
  // Retired custom contracts and disabled feature flags are not promoted to Base deployments.
  config.services.api.image=imageAPI;config.services['gmr-engine'].image=imageEngine;
  const active="import {db,closePool} from './src/db/postgres';try{const r=await db`SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'`;if(r[0].n>0)throw Error('Active classroom connections; defer migration');console.log(JSON.stringify({activeClassroomConnections:r[0].n}));}finally{await closePool();}";
  console.log(ssh(`docker exec fluentxverse-server bun -e ${quote(active)}`));
  const stamp=Date.now(),backup=configPath+'.pre-base-migration-'+stamp;
  ssh(`cp -p ${quote(configPath)} ${quote(backup)}`);
  for(const change of changes){if(digest(ssh(`cat ${quote(change.hostPath)}`))!==change.hash)throw Error('Engine configuration changed during preparation.');ssh(`cp -p ${quote(change.hostPath)} ${quote(change.hostPath+'.pre-base-migration-'+stamp)}`);}
  const compose=join(privateDir,'compose.private.json');writeFileSync(compose,JSON.stringify(config,null,2),{mode:0o600});
  let projectsMigrated=false;
  try{
    console.log(ssh(`docker compose -f ${quote(configPath)} stop api gmr-engine`,{timeout:120000}));
    for(const change of changes){upload(change.local,change.hostPath+'.base-next');ssh(`chmod 600 ${quote(change.hostPath+'.base-next')}`);ssh(`mv ${quote(change.hostPath+'.base-next')} ${quote(change.hostPath)}`);}
    upload(compose,configPath+'.base-next');ssh(`chmod 600 ${quote(configPath+'.base-next')}`);ssh(`mv ${quote(configPath+'.base-next')} ${quote(configPath)}`);
    // API and Engine writers are fenced while the allowlists change atomically.
    console.log(ssh(`docker compose -f ${quote(configPath)} run --rm --no-deps -T --entrypoint /usr/local/bin/gmr-base-migration gmr-engine --migrate-project-chains`,{timeout:150000}));
    projectsMigrated=true;
    console.log(ssh(`docker compose -f ${quote(configPath)} up -d --no-deps --wait --wait-timeout 120 gmr-engine api`,{timeout:180000}));
    const check="import {screeningChainConfig} from './src/services/screening/chain';import {horizenReceiptReader} from './src/services/proof.services/horizenReceipt';const c=screeningChainConfig();if(c.chainId!==8453||c.domainId!==2)throw Error('Base configuration not active');await horizenReceiptReader.check({...c,rpcUrl:process.env.SCREENING_RPC_URL});console.log(JSON.stringify({chainId:c.chainId,domainId:c.domainId,officialBaseBridgeAvailable:true}));";
    console.log(ssh(`docker exec fluentxverse-server bun -e ${quote(check)}`,{timeout:60000}));
  }catch(error){
    if(projectsMigrated){
      ssh(`docker compose -f ${quote(configPath)} stop api gmr-engine`,{timeout:120000});
      console.log(ssh(`docker compose -f ${quote(configPath)} run --rm --no-deps -T --entrypoint /usr/local/bin/gmr-base-migration gmr-engine --restore-project-chains`,{timeout:150000}));
    }
    for(const change of changes)ssh(`cp -p ${quote(change.hostPath+'.pre-base-migration-'+stamp)} ${quote(change.hostPath)}`);
    ssh(`cp -p ${quote(backup)} ${quote(configPath)}`);
    ssh(`docker compose -f ${quote(configPath)} up -d --no-deps --wait --wait-timeout 120 gmr-engine api`,{timeout:180000});throw error;
  }
  writeFileSync(join(release,'deployment.json'),JSON.stringify({deployedAt:new Date().toISOString(),imageAPI,imageEngine,chainId:8453,domainId:2,rpcProvider:new URL(rpc).hostname,previousCompose:backup,privateConfigurationBackups:changes.map(c=>c.hostPath+'.pre-base-migration-'+stamp),projectAllowlistsMigrated:true,withdrawalSent:false},null,2));
  console.log('PASS Base runtime configuration and five project allowlists migrated. Withdrawal remains a separate explicit operation.');
}else throw Error('Use --build or --activate.');
