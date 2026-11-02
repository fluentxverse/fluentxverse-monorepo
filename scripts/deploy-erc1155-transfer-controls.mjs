import {execFileSync} from 'node:child_process';
import {cpSync,mkdirSync,readFileSync,writeFileSync,existsSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {ssh,quote} from './lib/cloud-ssh.mjs';
const root=process.cwd(),id='erc1155-transfer-controls-20261102',release=join(root,'output/release',id),baseline='fluentxverse-cloud/gmr-engine:dispute-sync-20261102-r2',image='fluentxverse-cloud/gmr-engine:'+id;
const run=(cmd,args,cwd=root)=>execFileSync(cmd,args,{cwd,encoding:'utf8',maxBuffer:8e6,env:{...process.env,CGO_ENABLED:'0',GOCACHE:'/tmp/fxv-engine-go-cache'}});
if(process.argv.includes('--prepare')){
 const source=join(release,'engine-source');
 cpSync(join(root,'output/release/dispute-sync-20261102-r2/engine-source'),source,{recursive:true,verbatimSymlinks:true,filter:p=>!['node_modules','.git'].includes(p.split('/').at(-1))});
 if(!existsSync(join(source,'node_modules')))symlinkSync(join(root,'../budol/gmr-engine/node_modules'),join(source,'node_modules'),'dir');
 for(const f of ['templates.go','erc1155_transfers_test.go','testdata/erc1155_transfers.sol']){
  const dest=join(source,'internal/contracts',f);mkdirSync(join(dest,'..'),{recursive:true});cpSync(join(root,'../budol/gmr-engine/internal/contracts',f),dest);
 }
 console.log(run('go',['test','./internal/contracts','-v'],source));
 console.log(run('go',['test','./internal/deployer','./internal/httpapi','./cmd/api'],source));
 mkdirSync(join(release,'engine'),{recursive:true});
 run('go',['build','-buildvcs=false','-trimpath','-ldflags=-s -w','-o',join(release,'engine/gmr-engine'),'./cmd/api'],source);
 writeFileSync(join(release,'engine/Dockerfile'),`FROM ${baseline}\nCOPY gmr-engine /usr/local/bin/gmr-engine\n`);
 run('tar',['-czf',join(release,'engine.tar.gz'),'-C',join(release,'engine'),'.']);
}else if(process.argv.includes('--deploy')){
 if(ssh("docker inspect budol-gmr-engine-1 --format '{{.Config.Image}}'").trim()!==baseline)throw Error('Engine baseline changed');
 const remote='/opt/fluentxverse/releases/'+id;
 ssh(`install -d -m 700 ${remote}/engine && tar -xzf - -C ${remote}/engine`,{input:readFileSync(join(release,'engine.tar.gz'))});
 console.log(ssh(`docker build --network=none -t ${image} ${remote}/engine`,{timeout:120000}));
 // Reuse the established read-only check: includes the persistent pilot journal and pending tx queue.
 const script=readFileSync(join(root,'scripts/deploy-dispute-chain-release.mjs'),'utf8');
 const preflight=script.split('const preflight=String.raw`')[1].split('`;')[0];
 console.log(ssh('python3 -c '+quote(preflight),{timeout:60000}));
 const activate=`import json,os,subprocess\nfrom pathlib import Path\np=Path('/opt/fluentxverse/releases/20261023/compose.private.json');r=Path('${remote}')\nc=json.loads(p.read_text());s=c['services']['gmr-engine']\nif s['image']!='${baseline}': raise RuntimeError('Baseline changed')\nbackup=r/'rollback.private.json'\nif backup.exists(): raise RuntimeError('Rollback already exists')\nbackup.write_text(json.dumps(c));backup.chmod(0o600)\ns['image']='${image}'\nn=Path(str(p)+'.next');n.write_text(json.dumps(c));n.chmod(0o600);os.replace(n,p)\ntry:\n subprocess.run(['docker','compose','-f',str(p),'up','-d','--no-deps','--wait','--wait-timeout','180','gmr-engine'],check=True)\n subprocess.run(['docker','exec','budol-gmr-engine-1','wget','-qO-','http://127.0.0.1:8090/healthz'],check=True)\nexcept Exception:\n n.write_text(backup.read_text());n.chmod(0o600);os.replace(n,p)\n subprocess.run(['docker','compose','-f',str(p),'up','-d','--no-deps','--wait','gmr-engine'],check=True)\n raise`;
 console.log(ssh('python3 -c '+quote(activate),{timeout:240000}));
 writeFileSync(join(release,'deployment.json'),JSON.stringify({image,baseline,contractDeployed:false,at:new Date().toISOString()},null,2));
}else throw Error('Use --prepare or --deploy');
