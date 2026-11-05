import {execFileSync} from 'node:child_process';
import {cpSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
import {root} from './identity-mainnet-operations.mjs';
import {quote} from './lib/cloud-ssh.mjs';
const dir='output/release/identity-metadata-rate-limit-20261103';
const remote='/opt/fluentxverse/releases/identity-metadata-rate-limit-20261103';
const previous='fluentxverse-cloud/api:identity-admin-metadata-20261103',image='fluentxverse-cloud/api:identity-metadata-rate-limit-20261103';
const files=['src/utils/requestDefense.ts','tests/identityMetadataRateLimit.test.ts'];
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
mkdirSync(dir,{recursive:true});
if(process.argv.includes('--prepare')){
 for(const f of files){const p=join(dir,'api',f);mkdirSync(dirname(p),{recursive:true});cpSync(join('fluentxverse-server',f),p);}
 mkdirSync(join(dir,'api/shared'),{recursive:true});cpSync('shared/requestDefense.ts',join(dir,'api/shared/requestDefense.ts'));
 writeFileSync(join(dir,'api/Dockerfile'),`FROM ${previous}\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\nCOPY --chown=appuser:appgroup shared/ /shared/\n`);
 root(`mkdir -p ${remote}/api && tar -xzf - -C ${remote}/api`,{input:execFileSync('tar',['-czf','-','-C',join(dir,'api'),'.'])});
 console.log(root(`docker build --network none -t ${image} ${remote}/api`));
 console.log(root(`docker run --rm --network none --entrypoint bun ${image} --no-env-file build src/index.ts --target=bun --outfile=/tmp/identity-metadata-rate-limit.js`));
 console.log(root(`docker run --rm --network none --entrypoint bun ${image} --no-env-file test tests/identityMetadataRateLimit.test.ts tests/requestDefense.test.ts tests/identityAdminCredential.test.ts tests/identityProduction.test.ts`));
 writeFileSync(join(dir,'verification.json'),JSON.stringify({passed:true,hashes:Object.fromEntries([...files,'shared/requestDefense.ts'].map(f=>[f,sha(join(dir,'api',f))]))}));
}else if(process.argv.includes('--deploy')){
 const v=JSON.parse(readFileSync(join(dir,'verification.json')));
 if(!v.passed||Object.entries(v.hashes).some(([f,h])=>sha(join(dir,'api',f))!==h))throw Error('Verify exact release first');
 const py=`import json,subprocess\nfrom pathlib import Path\nc=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-server']))[0]\nif c['Config']['Image']!='${previous}': raise RuntimeError('API baseline changed')\ne=dict(x.split('=',1) for x in c['Config']['Env'])\nif e.get('TRUST_CLOUDFLARE_TUNNEL')!='true' or not e.get('REDIS_URL') or not e.get('JWT_SECRET'): raise RuntimeError('Trusted client IP and shared rate store configuration required')\nfiles=c['Config']['Labels']['com.docker.compose.project.config_files'].split(',');project=c['Config']['Labels']['com.docker.compose.project']\nargs=['docker','compose','-p',project]+[s for f in files for s in ['-f',f]]\np=Path('${remote}/override.json');p.write_text(json.dumps({'services':{'api':{'image':'${image}'}}}))\ntry: subprocess.run(args+['-f',str(p),'up','-d','--no-deps','--wait','--wait-timeout','120','api'],check=True)\nexcept Exception:\n subprocess.run(args+['up','-d','--no-deps','--wait','--wait-timeout','120','api'],check=True)\n raise\nprint(json.dumps({'apiUpdated':True,'trustedCloudflareIP':True,'sharedRateStoreConfigured':True,'mainnetConfigurationPreserved':True}))`;
 console.log(root('python3 -c '+quote(py),{timeout:180000}));
 writeFileSync(join(dir,'deployment.json'),JSON.stringify({image,previous,at:new Date().toISOString()}));
}else throw Error('Use --prepare or --deploy');
