import {execFileSync,spawn} from 'node:child_process';
import {cpSync,mkdirSync,readFileSync,writeFileSync,existsSync,symlinkSync,realpathSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {root,remote,directory,collection,operator,engineRequest} from './identity-mainnet-operations.mjs';
import {quote} from './lib/cloud-ssh.mjs';
const previous='fluentxverse-cloud/api:identity-pilot-20261103',image='fluentxverse-cloud/api:identity-mainnet-20261103';
mkdirSync(directory,{recursive:true,mode:0o700});
const sha=b=>createHash('sha256').update(b).digest('hex');
const mode=process.argv[2];
const apiFiles=['src/services/tutorIdentity/credential.ts','src/services/tutorIdentity/gateway.ts','src/services/tutorIdentity/issuance.ts',
 'src/services/tutorIdentity/issuanceWorker.ts','src/services/tutorIdentity/metadata.ts','src/services/tutorIdentity/production.ts','src/services/tutorIdentity/service.ts',
 'src/routes/tutorIdentity.route.ts','src/routes/proof.route.ts','tests/identityCredential.test.ts','tests/identityIssuance.test.ts','tests/identityProduction.test.ts'];
const app='fluentxverse-tutor-solid-prototype',frontend=join(directory,'frontend-9177f159'),cwd=join(frontend,app);
const run=(command,args)=>execFileSync(command,args,{cwd,encoding:'utf8',env:{...process.env,CI:'1'},timeout:180000,maxBuffer:8e6});
const wrangler=args=>run('bunx',['--bun','wrangler@4.152.0',...args,'--config','wrangler.jsonc']);
const liveVersion=()=>JSON.parse(wrangler(['deployments','list','--json'])).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0].versions;
if(mode==='--prepare-api'){
 for(const f of apiFiles){const p=join(directory,'api',f);mkdirSync(dirname(p),{recursive:true});cpSync(join('fluentxverse-server',f),p);}
 writeFileSync(join(directory,'api/Dockerfile'),`FROM ${previous}\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\n`);
 const tar=execFileSync('tar',['-czf','-','-C',join(directory,'api'),'.']);
 root(`mkdir -p ${remote}/api && tar -xzf - -C ${remote}/api`,{input:tar});
 console.log(root(`docker build --network none -t ${image} ${remote}/api`,{timeout:120000}));
 console.log(root(`docker run --rm --network none --entrypoint bun ${image} --no-env-file build src/index.ts --target=bun --outfile=/tmp/mainnet-identity.js`));
 console.log(root(`docker run --rm --network none --entrypoint bun ${image} --no-env-file test tests/identityCredential.test.ts tests/identityIssuance.test.ts tests/identityProduction.test.ts tests/tutorIdentity.test.ts tests/tutorIdentity.http.test.ts`));
 const imageId=root(`docker image inspect ${image} --format '{{.Id}}'`).trim();
 writeFileSync(join(directory,'api-verification.json'),JSON.stringify({passed:true,imageId,sources:Object.fromEntries(apiFiles.map(f=>[f,sha(readFileSync(join('fluentxverse-server',f)))]))}));
}else if(mode==='--install-prover'){
 const v=JSON.parse(readFileSync(join(directory,'prover-verification.json')));
 if(!v.passed || sha(readFileSync(join(directory,'prover/release.json')))!==v.manifestSHA256)throw Error('Verify the production prover first');
 const tar=execFileSync('tar',['-czf','-','-C',join(directory,'prover'),'.'],{maxBuffer:32e6});
 root(`install -d -m 700 ${remote}/prover && tar -xzf - -C ${remote}/prover && chown -R 100:101 ${remote}/prover && chmod 700 ${remote}/prover && chmod 600 ${remote}/prover/*`,{input:tar});
 console.log(JSON.stringify({productionProverInstalled:true}));
}else if(mode==='--prepare-ui'){
 const baseline=join('output/release/tutor-hero-horizontal-badges-20261103/frontend');
 if(!existsSync(cwd))cpSync(baseline,frontend,{recursive:true,verbatimSymlinks:true,filter:p=>!['node_modules','dist','.wrangler'].includes(p.split('/').at(-1))&&!p.split('/').at(-1).startsWith('.env')});
 if(!existsSync(join(cwd,'node_modules')))symlinkSync(realpathSync(join(baseline,app,'node_modules')),join(cwd,'node_modules'),'dir');
 const live=liveVersion();if(live.length!==1||live[0].version_id!=='9177f159-e1ab-41fa-82d0-9ca1c613a8b9')throw Error('Tutor live baseline changed; rebase before deploying');
 cpSync(join(app,'tutor/Components/IdentitySubmission.tsx'),join(cwd,'tutor/Components/IdentitySubmission.tsx'));
 console.log(run('bun',['run','build']));
 writeFileSync(join(directory,'ui-plan.json'),JSON.stringify({baselineVersion:live[0].version_id,componentSHA256:sha(readFileSync(join(cwd,'tutor/Components/IdentitySubmission.tsx')))}));
}else if(mode==='--verify-ui'){
 const child=spawn('bunx',['vite','preview','--host','127.0.0.1','--port','5299','--strictPort'],{cwd,stdio:'ignore',detached:true});
 try{
   let ready=false;for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:5299')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
   if(!ready)throw Error('Scoped UI preview unavailable');
   console.log(execFileSync('node',['scripts/tests/tutor-identity-ui.cjs'],{encoding:'utf8',env:{...process.env,IDENTITY_ONLY_TUTOR:'1',IDENTITY_PRODUCTION:'1',IDENTITY_TUTOR_URL:'http://127.0.0.1:5299'},timeout:120000,maxBuffer:2e6}));
   writeFileSync(join(directory,'ui-verification.json'),JSON.stringify({passed:true,componentSHA256:sha(readFileSync(join(cwd,'tutor/Components/IdentitySubmission.tsx')))}));
 }finally{try{process.kill(-child.pid,'SIGTERM');}catch{}}
}else if(mode==='--deploy-ui'){
 const plan=JSON.parse(readFileSync(join(directory,'ui-plan.json'))),v=JSON.parse(readFileSync(join(directory,'ui-verification.json'))),live=liveVersion();
 if(!v.passed||live.length!==1||live[0].version_id!==plan.baselineVersion||sha(readFileSync(join(cwd,'tutor/Components/IdentitySubmission.tsx')))!==plan.componentSHA256)throw Error('Verify the unchanged UI release and baseline first');
 const output=wrangler(['deploy']);console.log(output);writeFileSync(join(directory,'ui-deployment.json'),JSON.stringify({output}));
}else if(mode==='--set-uri'){
 const uri=`https://api.fluentxverse.com/proof/tutor-identity/metadata/${collection}/{id}.json`;
 const abi=[{type:'function',name:'setURI',stateMutability:'nonpayable',inputs:[{name:'newURI',type:'string'}],outputs:[]}];
 const path=join(directory,'uri-transaction.json');
 if(existsSync(path)){const saved=JSON.parse(readFileSync(path));if(!saved.id)throw Error('Prior URI request needs reconciliation');console.log(JSON.stringify(engineRequest('/v1/transactions/'+saved.id)));}
 else{
   writeFileSync(path,JSON.stringify({attempted:true,uri}));
   const r=engineRequest('/v1/transactions',{idempotencyKey:'fxv-identity-mainnet-uri-20261103',chainId:42161,walletAddress:operator,
     contractAddress:collection,kind:'contract_write',method:'setURI',args:[uri],value:'0',metadata:{abi}});
   if(!r.transaction?.id)throw Error('Missing URI transaction reference');
   writeFileSync(path,JSON.stringify({id:r.transaction.id,uri}));console.log(JSON.stringify(r));
 }
}else if(mode==='--activate-api'){
 const v=JSON.parse(readFileSync(join(directory,'api-verification.json'))),p=JSON.parse(readFileSync(join(directory,'prover-verification.json')));
 if(!v.passed||!p.passed||!existsSync(join(directory,'ui-deployment.json')))throw Error('Complete API/prover tests and UI deployment first');
 for(const [f,h]of Object.entries(v.sources))if(sha(readFileSync(join('fluentxverse-server',f)))!==h)throw Error('Source changed since image tests');
 if(root(`docker image inspect ${image} --format '{{.Id}}'`).trim()!==v.imageId)throw Error('Tested image changed');
 const preflight=`import{loadIdentityRelease,IdentityEngineGateway}from'./src/services/tutorIdentity/gateway';import{horizenReceiptReader,BASE_MAINNET_BRIDGE}from'./src/services/proof.services/horizenReceipt';const {release,vk}=await loadIdentityRelease('/run/tutor-identity-mainnet/release.json','${p.manifestSHA256}');if(release.mode!=='production')throw Error('Wrong mode');const g=new IdentityEngineGateway(release,vk,process.env.TUTOR_IDENTITY_ENGINE_API_BASE,process.env.TUTOR_IDENTITY_ENGINE_API_KEY);await g.assertCollectionLocked({binding:{chainId:42161,collection:release.collection,holder:release.operator,mock:false},tokenId:'1',issuer:{issuerAx:release.issuerAx,issuerAy:release.issuerAy},verificationKeySHA256:release.artifacts.vk.sha256});await horizenReceiptReader.check({chainId:42161,domainId:10,bridge:BASE_MAINNET_BRIDGE,rpcUrl:release.rpcUrl});console.log(JSON.stringify({mainnetCollectionAndBridgeReady:true}));`;
 const python=`import json,subprocess,os\nfrom pathlib import Path\nr=Path('${remote}');c=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-server']))[0]\nif c['Config']['Image']!='${previous}': raise RuntimeError('API baseline changed')\nkey=json.loads((r/'connection.private.json').read_text())['key']\nenv={'TUTOR_IDENTITY_ENGINE_API_BASE':'http://gmr-engine:8090','TUTOR_IDENTITY_ENGINE_API_KEY':key}\np=r/'preflight.env.private';fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)\nwith os.fdopen(fd,'w') as f:\n for k,v in env.items(): f.write(k+'='+v+'\\n')\nsubprocess.run(['docker','run','--rm','--network','container:fluentxverse-server','--env-file',str(p),'-v',str(r/'prover')+':/run/tutor-identity-mainnet:ro','--entrypoint','bun','${image}','--no-env-file','-e',${JSON.stringify(preflight)}],check=True)\nfiles=c['Config']['Labels']['com.docker.compose.project.config_files'].split(',');project=c['Config']['Labels']['com.docker.compose.project']\nargs=['docker','compose','-p',project]+[s for f in files for s in ['-f',f]]\nconfig={'services':{'api':{'image':'${image}','environment':{'TUTOR_IDENTITY_ISSUANCE_ENABLED':'true','TUTOR_IDENTITY_ISSUANCE_MODE':'production','TUTOR_IDENTITY_RELEASE_PATH':'/run/tutor-identity-mainnet/release.json','TUTOR_IDENTITY_RELEASE_SHA256':'${p.manifestSHA256}',**env},'volumes':[str(r/'prover')+':/run/tutor-identity-mainnet:ro']}}}\noverride=r/'mainnet-override.private.json';fd=os.open(override,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)\nwith os.fdopen(fd,'w') as f: json.dump(config,f)\ntry: subprocess.run(args+['-f',str(override),'up','-d','--no-deps','--wait','--wait-timeout','120','api'],check=True)\nexcept Exception:\n subprocess.run(args+['up','-d','--no-deps','--wait','--wait-timeout','120','api'],check=True)\n raise\nprint(json.dumps({'productionIssuanceEnabled':True,'image':'${image}','manifestSHA256':'${p.manifestSHA256}'}))`;
 console.log(root('python3 -c '+quote(python),{timeout:210000}));
 writeFileSync(join(directory,'deployment.json'),JSON.stringify({image,previous,productionIssuanceEnabled:true,manifestSHA256:p.manifestSHA256,collection,at:new Date().toISOString()}));
}else throw Error('Choose --prepare-api, --install-prover, --prepare-ui, --deploy-ui, --set-uri or --activate-api');
