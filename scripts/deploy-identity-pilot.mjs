import{execFileSync}from'node:child_process';
import{cpSync,mkdirSync,writeFileSync,readFileSync}from'node:fs';
import{join,dirname}from'node:path';
import{createHash}from'node:crypto';
import{ssh,sshOptions,cloudHost,quote}from'./lib/cloud-ssh.mjs';
const id='identity-pilot-20261103',release=join(process.cwd(),'output/release',id),remote='/opt/fluentxverse/releases/'+id;
const previous='fluentxverse-cloud/api:identity-interview-pass-20261102',image='fluentxverse-cloud/api:'+id;
const root=(cmd,options={})=>execFileSync('ssh',[...sshOptions,'root@'+cloudHost,cmd],{encoding:'utf8',timeout:2100000,maxBuffer:6e6,...options});
if(process.argv.includes('--prepare')){
 const files=['src/services/interview.services/interview.service.ts','src/services/tutorIdentity/service.ts','src/services/tutorIdentity/credential.ts','src/services/tutorIdentity/issuance.ts',
   'src/services/tutorIdentity/gateway.ts','src/services/tutorIdentity/metadata.ts','src/services/tutorIdentity/issuanceWorker.ts','src/services/tutorIdentity/worker.ts','src/services/tutorIdentity/schema.ts',
   'src/routes/tutorIdentity.route.ts','src/routes/proof.route.ts','scripts/identity-pilot.ts',
   'tests/identityCredential.test.ts','tests/identityIssuance.test.ts','tests/tutorIdentity.test.ts','tests/tutorIdentity.http.test.ts'];
 for(const f of files){const dest=join(release,'api',f);mkdirSync(dirname(dest),{recursive:true});cpSync(join('fluentxverse-server',f),dest);}
 writeFileSync(join(release,'api/Dockerfile'),`FROM ${previous}\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\nCOPY --chown=appuser:appgroup scripts/ /app/scripts/\n`);
 const tar=execFileSync('tar',['-czf','-','-C',join(release,'api'),'.']);root(`mkdir -p ${remote}/api && tar -xzf - -C ${remote}/api`,{input:tar});
 console.log(root(`docker build --network none -t ${image} ${remote}/api`,{timeout:120000}));
 console.log(root(`docker run --rm --network none --entrypoint bun ${image} --no-env-file build src/index.ts --target=bun --outfile=/tmp/identity.js`,{timeout:90000}));
 console.log(root(`docker run --rm --network none --entrypoint bun ${image} --no-env-file test tests/identityCredential.test.ts tests/identityIssuance.test.ts tests/tutorIdentity.test.ts tests/tutorIdentity.http.test.ts`,{timeout:60000}));
 const sources=Object.fromEntries(files.map(f=>[f,createHash('sha256').update(readFileSync(join(release,'api',f))).digest('hex')]));
 const imageId=root(`docker image inspect ${image} --format '{{.Id}}'`).trim();
 writeFileSync(join(release,'verification.json'),JSON.stringify({passed:true,sources,imageId}));
}else if(process.argv.includes('--install-prover')){
 let tar;
 try{tar=execFileSync('tar',['-czf','-','-C',join(release,'prover'),'.'],{maxBuffer:16*1024*1024});}
 catch{throw Error('Could not package private pilot proving artifacts');}
 try{execFileSync('ssh',[...sshOptions,'root@'+cloudHost,`install -d -m 700 ${remote}/prover && tar -xzf - -C ${remote}/prover && chown -R 100:101 ${remote}/prover && chmod 700 ${remote}/prover && chmod 600 ${remote}/prover/*`],{input:tar});}
 catch{throw Error('Could not install private pilot proving artifacts');}
 console.log(JSON.stringify({installed:true,mode:'pilot'}));
}else if(process.argv.includes('--pilot')){
 const pin=(await import('node:crypto')).createHash('sha256').update(readFileSync(join(release,'prover/release.json'))).digest('hex');
 const python=`import json,subprocess,os\nfrom pathlib import Path\nr=Path('${remote}');base=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-server']))[0]\nnet=next(n for n in base['NetworkSettings']['Networks'] if n!='bridge')\nname='fxv-identity-pilot-graph'\nif subprocess.run(['docker','inspect',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode:\n subprocess.run(['docker','run','-d','--name',name,'--network',net,'--label','fxv.identity-pilot=20261103','memgraph/memgraph:latest'],check=True,stdout=subprocess.DEVNULL)\nenv={'MEMGRAPH_URI':'bolt://fxv-identity-pilot-graph:7687','TUTOR_IDENTITY_ISSUANCE_ENABLED':'true','TUTOR_IDENTITY_RELEASE_PATH':'/run/tutor-identity-prover/release.json','TUTOR_IDENTITY_RELEASE_SHA256':'${pin}','TUTOR_IDENTITY_ENGINE_API_BASE':'http://gmr-engine:8090','TUTOR_IDENTITY_ENGINE_API_KEY':json.loads((r/'connection.private.json').read_text())['key']}\np=r/'pilot.env.private';fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)\nwith os.fdopen(fd,'w') as f:\n for k,v in env.items(): f.write(k+'='+v+'\\n')\nsubprocess.run(['docker','run','--rm','--name','fxv-identity-pilot-runner','--network',net,'--env-file',str(p),'-v',str(r/'prover')+':/run/tutor-identity-prover:ro','--entrypoint','bun','${image}','--no-env-file','run','scripts/identity-pilot.ts'],check=True)`;
 const isolatedPython=python.replace("'--network',net,'--env-file'", "'--network','container:fluentxverse-server','--env-file'");
 console.log(root('python3 -c '+quote(isolatedPython)));
}else if(process.argv.includes('--activate')){
 const verification=JSON.parse(readFileSync(join(release,'verification.json')));
 if(!verification.passed || !JSON.parse(readFileSync(join(release,'pilot-result.json'))).passed)throw Error('The build and live pilot must pass first');
 for(const [f,hash]of Object.entries(verification.sources||{}))if(createHash('sha256').update(readFileSync(join('fluentxverse-server',f))).digest('hex')!==hash)throw Error('Scoped source changed; rebuild and verify before activation');
 if(!verification.imageId||root(`docker image inspect ${image} --format '{{.Id}}'`).trim()!==verification.imageId)throw Error('Tested image changed');
 if(ssh("docker inspect fluentxverse-server --format '{{.Config.Image}}'").trim()!==previous)throw Error('API baseline changed; do not overwrite another deployment');
 const checks=readFileSync('scripts/activate-tutor-identity-storage.mjs','utf8').split('const checks=`')[1].split('`;')[0];
 console.log(ssh('docker exec fluentxverse-server bun --no-env-file -e '+quote(checks)));
 const [project,files]=ssh('docker inspect fluentxverse-server --format '+quote('{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.project.config_files"}}')).trim().split('|');
 const pin=(await import('node:crypto')).createHash('sha256').update(readFileSync(join(release,'prover/release.json'))).digest('hex');
 const configure=`import json,os\nfrom pathlib import Path\nr=Path('${remote}');key=json.loads((r/'connection.private.json').read_text())['key']\nc={'services':{'api':{'image':'${image}','environment':{'TUTOR_IDENTITY_ISSUANCE_ENABLED':'true','TUTOR_IDENTITY_RELEASE_PATH':'/run/tutor-identity-prover/release.json','TUTOR_IDENTITY_RELEASE_SHA256':'${pin}','TUTOR_IDENTITY_ENGINE_API_BASE':'http://gmr-engine:8090','TUTOR_IDENTITY_ENGINE_API_KEY':key},'volumes':[str(r/'prover')+':/run/tutor-identity-prover:ro']}}}\np=r/'pilot-override.private.json';fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)\nwith os.fdopen(fd,'w') as f: json.dump(c,f)`;
 root('python3 -c '+quote(configure));
 const args=['docker','compose','-p',project,...files.split(',').flatMap(f=>['-f',f])];
 const up=extra=>[...args,...extra,'up','-d','--no-deps','--wait','--wait-timeout','120','api'].map(quote).join(' ');
 try{console.log(root(up(['-f',remote+'/pilot-override.private.json'])));if(!(await fetch('https://api.fluentxverse.com/health')).ok)throw Error('API health check failed');}
 catch(e){console.log(root(up([])));throw e;}
 const result=JSON.parse(readFileSync(join(release,'pilot-result.json'))),metadata=result.metadata;
 if(metadata.properties.chainId!==421614||metadata.properties.mock!==true||metadata.properties.collection.toLowerCase()!==result.collection.toLowerCase())throw Error('Invalid public TEST metadata');
 const publish=`import{initDriver,getDriver,closeDriver}from'./src/db/memgraph';await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD,1);const s=getDriver().session();try{await s.run('MERGE(m:TutorIdentityPublicMetadata {id:$id}) SET m.chainId=421614,m.mock=true,m.tokenHex=$hex,m.json=$json',{id:${JSON.stringify('421614:'+result.collection.toLowerCase()+':'+result.tokenId)},hex:${JSON.stringify(BigInt(result.tokenId).toString(16).padStart(64,'0'))},json:${JSON.stringify(JSON.stringify(metadata))}});console.log(JSON.stringify({publicTestMetadataPublished:true}));}finally{await s.close();await closeDriver();}`;
 console.log(ssh('docker exec fluentxverse-server bun --no-env-file -e '+quote(publish)));
 writeFileSync(join(release,'deployment.json'),JSON.stringify({image,previous,mode:'pilot',automaticTestIssuanceEnabled:true,productionIssuanceEnabled:false,at:new Date().toISOString()}));
}else throw Error('Use --prepare, --install-prover, --pilot or --activate');
