import{execFileSync}from'node:child_process';
import{cpSync,mkdirSync,writeFileSync,readFileSync}from'node:fs';
import{join,dirname}from'node:path';
import{ssh,sshOptions,cloudHost,quote}from'./lib/cloud-ssh.mjs';
const id='identity-interview-pass-20261102',release=join(process.cwd(),'output/release',id),remote='/opt/fluentxverse/releases/'+id;
const previous='fluentxverse-cloud/api:interview-join-feedback-20261102',image='fluentxverse-cloud/api:'+id;
const rootSSH=cmd=>execFileSync('ssh',[...sshOptions,'root@'+cloudHost,cmd],{encoding:'utf8',timeout:180000,maxBuffer:6e6});
if(process.argv.includes('--prepare')){
 for(const f of ['src/services/tutorIdentity/service.ts','src/services/interview.services/interview.service.ts','tests/tutorIdentity.test.ts','tests/tutorIdentity.http.test.ts']){const dest=join(release,'api',f);mkdirSync(dirname(dest),{recursive:true});cpSync(join('fluentxverse-server',f),dest);}
 writeFileSync(join(release,'api/Dockerfile'),`FROM ${previous}\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\n`);
 const tar=execFileSync('tar',['-czf','-','-C',join(release,'api'),'.']);ssh(`mkdir -p ${remote}/api && tar -xzf - -C ${remote}/api`,{input:tar});
 console.log(ssh(`docker build --network none -t ${image} ${remote}/api`,{timeout:120000}));
 console.log(ssh(`docker run --rm --network none --entrypoint bun ${image} --no-env-file build src/index.ts --target=bun --outfile=/tmp/interview.js`,{timeout:90000}));
 console.log(ssh(`docker run --rm --network none --entrypoint bun ${image} --no-env-file test tests/tutorIdentity.test.ts tests/tutorIdentity.http.test.ts`,{timeout:60000}));
 writeFileSync(join(release,'verification.json'),JSON.stringify({passed:true}));
}else if(process.argv.includes('--activate')){
 if(!JSON.parse(readFileSync(join(release,'verification.json'))).passed)throw Error('Verify first');
 if(ssh("docker inspect fluentxverse-server --format '{{.Config.Image}}'").trim()!==previous)throw Error('Baseline changed');
 const checks=readFileSync('scripts/activate-tutor-identity-storage.mjs','utf8').split('const checks=`')[1].split('`;')[0];console.log(ssh('docker exec fluentxverse-server bun --no-env-file -e '+quote(checks)));
 const [project,files]=ssh('docker inspect fluentxverse-server --format '+quote('{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.project.config_files"}}')).trim().split('|');
 rootSSH('python3 -c '+quote(`import json,os\np='${remote}/override.json'\nfd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)\nwith os.fdopen(fd,'w') as f: json.dump({'services':{'api':{'image':'${image}'}}},f)`));
 const args=['docker','compose','-p',project,...files.split(',').flatMap(f=>['-f',f])];const up=extra=>[...args,...extra,'up','-d','--no-deps','--wait','--wait-timeout','120','api'].map(quote).join(' ');
 try{console.log(rootSSH(up(['-f',remote+'/override.json'])));if(!(await fetch('https://api.fluentxverse.com/health')).ok)throw Error('Unhealthy');}catch(e){console.log(rootSSH(up([])));throw e;}
 writeFileSync(join(release,'deployment.json'),JSON.stringify({image,previous,at:new Date().toISOString()}));
}else throw Error('Use --prepare or --activate');
