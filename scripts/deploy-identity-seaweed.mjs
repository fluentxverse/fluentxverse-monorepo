import {execFileSync} from 'node:child_process';
import {mkdirSync,cpSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {ssh,sshOptions,cloudHost,quote} from './lib/cloud-ssh.mjs';
const root=process.cwd(),id='tutor-identity-seaweed-20261102',release=join(root,'output/release',id),remote='/opt/fluentxverse/releases/'+id;
const previous='fluentxverse-cloud/api:tutor-identity-admin-20261102',image='fluentxverse-cloud/api:'+id;
const rootSSH=(command,extra={})=>execFileSync('ssh',[...sshOptions,'root@'+cloudHost,command],{encoding:'utf8',timeout:180000,maxBuffer:6e6,...extra});
if(process.argv.includes('--build')){
 mkdirSync(join(release,'api/src/services/tutorIdentity'),{recursive:true});mkdirSync(join(release,'api/tests'),{recursive:true});
 cpSync(join(root,'fluentxverse-server/src/services/tutorIdentity/storage.ts'),join(release,'api/src/services/tutorIdentity/storage.ts'));
 for(const f of ['tutorIdentity.test.ts','tutorIdentity.http.test.ts'])cpSync(join(root,'fluentxverse-server/tests',f),join(release,'api/tests',f));
 writeFileSync(join(release,'api/Dockerfile'),`FROM ${previous}\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\n`);
 const tar=execFileSync('tar',['-czf','-','-C',join(release,'api'),'.']);
 ssh(`mkdir -p ${remote}/api && tar -xzf - -C ${remote}/api`,{input:tar});
 console.log(ssh(`docker build --network=none -t ${image} ${remote}/api`,{timeout:120000}));
 console.log(ssh(`docker run --rm --network none --entrypoint bun ${image} --no-env-file build src/index.ts --target=bun --outfile=/tmp/identity-seaweed.js`,{timeout:90000}));
 console.log(ssh(`docker run --rm --network none --entrypoint bun ${image} --no-env-file test tests/tutorIdentity.test.ts tests/tutorIdentity.http.test.ts`,{timeout:60000}));
}else if(process.argv.includes('--activate')){
 // Same active-work gate as the prior release. Do not restart an active classroom/interview.
 const checks=readFileSync(join(root,'scripts/activate-tutor-identity-storage.mjs'),'utf8').split('const checks=`')[1].split('`;')[0];
 console.log(ssh('docker exec fluentxverse-server bun --no-env-file -e '+quote(checks)));
 const migrate=String.raw`import{readdir,readFile,mkdir,writeFile}from'node:fs/promises';import{createHash}from'node:crypto';
const p=await Bun.stdin.json();let count=0;
for(const id of await readdir('/legacy')){if(!/^[a-f0-9-]{36}$/.test(id))continue;
 const key=await readFile('/legacy/'+id+'/key'),cipher=await readFile('/legacy/'+id+'/image');
 await mkdir('/keys/'+id,{recursive:true,mode:0o700});
 try{await writeFile('/keys/'+id+'/key',key,{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST'||!(await readFile('/keys/'+id+'/key')).equals(key))throw e;}
 const url=p.filer.replace(/\/$/,'')+'/private-tutor-identity/'+id+'.bin';
 const sent=await fetch(url,{method:'PUT',body:cipher,redirect:'error',signal:AbortSignal.timeout(15000)});if(!sent.ok)throw Error('Migration upload failed');
 const got=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000)});if(!got.ok)throw Error('Migration read failed');
 const hash=v=>createHash('sha256').update(v).digest('hex');if(hash(Buffer.from(await got.arrayBuffer()))!==hash(cipher))throw Error('Ciphertext changed during migration');key.fill(0);count++;
}console.log(JSON.stringify({migrated:count,ciphertextIntegrityVerified:true}));`;
 console.log(execFileSync('bun',['--no-env-file','-e',"new Bun.Transpiler({loader:'js'}).transformSync(await Bun.stdin.text());console.log('Migration script parser verified');"],{input:migrate,encoding:'utf8'}));
 const activate=`import json,os,subprocess\nfrom pathlib import Path\nr=Path('${remote}');r.mkdir(mode=0o700,parents=True,exist_ok=True)\nc=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-server']))[0]\nif c['Config']['Image']!='${previous}': raise RuntimeError('API baseline changed')\nenv=dict(x.split('=',1) for x in c['Config']['Env'])\nif env.get('TUTOR_IDENTITY_ENABLED')!='true': raise RuntimeError('Unexpected activation state')\nkeydir=Path('/opt/fluentxverse/private/tutor-identity-keys');keydir.mkdir(mode=0o700,parents=True,exist_ok=True);os.chown(keydir,100,101);os.chmod(keydir,0o700)\nfiler=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-seaweed-filer']))[0]\nnetworks=set(c['NetworkSettings']['Networks']).intersection(filer['NetworkSettings']['Networks'])\nif not networks: raise RuntimeError('No private filer network')\nproject=c['Config']['Labels']['com.docker.compose.project'];files=c['Config']['Labels']['com.docker.compose.project.config_files'].split(',')\nargs=['docker','compose','-p',project]+[part for f in files for part in ['-f',f]]\nconfig={'services':{'api':{'image':'${image}','environment':{'TUTOR_IDENTITY_ENABLED':'true','TUTOR_IDENTITY_KEY_DIR':'/run/tutor-identity'},'volumes':[str(keydir)+':/run/tutor-identity:Z']}}}\noverride=r/'override.json';override.write_text(json.dumps(config));override.chmod(0o600)\nsubprocess.run(['docker','stop','--time','30','fluentxverse-server'],check=True)\ntry:\n helper=['docker','run','--rm','-i','--security-opt','label=disable','--network',sorted(networks)[0],'-v','/run/fluentxverse-tutor-identity:/legacy:ro','-v',str(keydir)+':/keys','--entrypoint','bun','${image}','--no-env-file','-e',${JSON.stringify(migrate)}]\n subprocess.run(helper,input=json.dumps({'filer':env['SEAWEED_FILER_URL']}),text=True,check=True)\n subprocess.run(args+['-f',str(override),'up','-d','--no-deps','--wait','--wait-timeout','120','api'],check=True)\nexcept Exception:\n subprocess.run(args+['up','-d','--no-deps','--wait','--wait-timeout','120','api'],check=True)\n raise\nprint(json.dumps({'seaweedStorageEnabled':True,'keysPersistent':True}))`;
 console.log(rootSSH('python3 -c '+quote(activate),{timeout:240000}));
 writeFileSync(join(release,'deployment.json'),JSON.stringify({image,previous,imagesInSeaweed:true,keysPersistent:true,at:new Date().toISOString()},null,2));
}else if(process.argv.includes('--cleanup-ram')){
 const code=String.raw`import json,subprocess
from pathlib import Path
c=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-server']))[0]
if not any(m.get('Source')=='/opt/fluentxverse/private/tutor-identity-keys' and m.get('Destination')=='/run/tutor-identity' for m in c['Mounts']): raise RuntimeError('Persistent key volume not mounted')
subprocess.run(['umount','/run/fluentxverse-tutor-identity'],check=True)
p=Path('/etc/fstab');lines=[]
for line in p.read_text().splitlines():
 if line.startswith('tmpfs /run/fluentxverse-tutor-identity '): continue
 if line.startswith('# Disabled for private ID RAM storage: '): line=line.split('# Disabled for private ID RAM storage: ',1)[1]
 lines.append(line)
p.write_text('\n'.join(lines)+'\n')
drop=Path('/etc/systemd/system/docker.service.d/40-fluentxverse-identity-storage.conf')
if drop.exists() and drop.read_text()=='[Unit]\nRequiresMountsFor=/run/fluentxverse-tutor-identity\n': drop.unlink()
subprocess.run(['systemctl','daemon-reload'],check=True)
if not any(l.startswith('/swap.img ') for l in Path('/proc/swaps').read_text().splitlines()): subprocess.run(['swapon','/swap.img'],check=True)
print(json.dumps({'retainedImagesInRAM':False,'ramMountRemoved':True,'originalDiskSwapRestored':True}))`;
 console.log(rootSSH('python3 -c '+quote(code)));
}else if(process.argv.includes('--verify-persistence')){
 const source=String.raw`import{identityStorage}from'./src/services/tutorIdentity/storage';import{execFileSync}from'node:child_process';
const id=crypto.randomUUID(),bytes=Buffer.from('synthetic persistence verification');
try{await identityStorage.put(id,bytes);
 const child="import{identityStorage}from'./src/services/tutorIdentity/storage';const b=await identityStorage.get("+JSON.stringify(id)+");if(b.toString()!=='synthetic persistence verification')throw Error('Persistent read mismatch');console.log('fresh-process read passed');";
 execFileSync(process.execPath,['--no-env-file','-e',child],{stdio:'pipe'});
 const url=process.env.SEAWEED_FILER_URL.replace(/\/$/,'')+'/private-tutor-identity/'+id+'.bin';
 const publicRead=await fetch('http://127.0.0.1:8765/lesson/files/private-tutor-identity/'+id+'.bin');if(publicRead.ok)throw Error('Public proxy exposed private ciphertext');
 await identityStorage.remove(id);
 const r=await fetch(url,{method:'HEAD'});if(r.status!==404)throw Error('Seaweed object was not deleted');
 if(await identityStorage.has(id))throw Error('Key survived deletion');
 console.log(JSON.stringify({freshProcessRead:true,publicProxyDenied:true,seaweedObjectDeleted:true,keyDeleted:true,retainedImagesInRAM:false}));
}finally{await identityStorage.remove(id);}`;
 console.log(ssh('docker exec fluentxverse-server bun --no-env-file -e '+quote(source),{timeout:60000}));
}else throw Error('Use --build, --activate, --cleanup-ram, --verify-persistence');
