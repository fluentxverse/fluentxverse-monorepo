import {cpSync,existsSync,mkdirSync,readFileSync,writeFileSync,readdirSync,lstatSync,chmodSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {root} from './identity-mainnet-operations.mjs';
const workspace=process.cwd(),target=resolve('../budol'),evidence=join(target,'.recovery-private');
const backend=resolve('output/release/tutor-rewards-aero-20261104/engine-source');
const frontend=resolve('output/release/lesson-disputes-shared-roles-20261102/frontend');
const hash=b=>createHash('sha256').update(b).digest('hex');
const copy=(from,to)=>{mkdirSync(dirname(to),{recursive:true});cpSync(from,to,{recursive:true,verbatimSymlinks:true,filter:p=>!lstatSync(p).isSymbolicLink()&&!['node_modules','.wrangler','.git'].includes(p.split('/').at(-1))&&!p.split('/').at(-1).startsWith('.env')});};
const save=(path,data)=>{mkdirSync(dirname(path),{recursive:true,mode:0o700});writeFileSync(path,data,{flag:'wx',mode:0o600});};
const mode=process.argv[2];
if(mode==='--restore'){
 if(existsSync(target))throw Error('Destination exists; never overwrite recovered or user files');
 mkdirSync(target,{mode:0o700});mkdirSync(evidence,{mode:0o700});
 copy(backend,join(target,'gmr-engine'));
 for(const file of ['gmr-dashboard','src','public','worker.ts','wrangler.json','tsconfig.json','tsconfig.gmr-dashboard.json'])copy(join(frontend,file),join(target,file));
 copy(join(frontend,'package.json'),join(evidence,'original-frontend-package.json'));
 const image=root("docker inspect budol-gmr-engine-1 --format '{{.Config.Image}}'").trim();
 if(image!=='fluentxverse-cloud/gmr-engine:tutor-rewards-claims-20261104')throw Error('Production backend changed; inspect before continuing');
 const archive=root('docker exec budol-gmr-engine-1 tar -czf - -C /app scripts contracts zk package.json bun.lock',{encoding:null,maxBuffer:200e6,timeout:300000});
 save(join(evidence,'engine-runtime-files.tar.gz'),archive);
 const listing=execFileSync('tar',['-tzf',join(evidence,'engine-runtime-files.tar.gz')],{encoding:'utf8',maxBuffer:5e6}).trim().split('\n');
 if(listing.some(p=>p.startsWith('/')||p.split('/').includes('..')))throw Error('Unsafe archive entry');
 execFileSync('tar',['-xzf',join(evidence,'engine-runtime-files.tar.gz'),'--no-same-owner','-C',join(target,'gmr-engine')]);
 const binary=root('docker exec budol-gmr-engine-1 cat /usr/local/bin/gmr-engine',{encoding:null,maxBuffer:64e6});
 save(join(evidence,'production-gmr-engine'),binary);
 save(join(evidence,'production-entrypoint.sh'),root('docker exec budol-gmr-engine-1 cat /usr/local/bin/docker-entrypoint.sh'));
 const liveHashes=root("docker exec budol-gmr-engine-1 sh -c 'find /app/scripts /app/contracts /app/zk -type f -exec sha256sum {} +'");
 save(join(evidence,'runtime-files.sha256'),liveHashes);
 save(join(evidence,'go-build-info.txt'),execFileSync('go',['version','-m',join(evidence,'production-gmr-engine')],{encoding:'utf8'}));
 const assets=[];
 for(const path of readdirSync(join(frontend,'dist'),{recursive:true}).filter(p=>lstatSync(join(frontend,'dist',p)).isFile())){
  if(path==='_headers')continue;
  const response=await fetch('https://engine.fluentxverse.com/'+path,{signal:AbortSignal.timeout(30000),cache:'no-store'});
  if(!response.ok)throw Error('Missing production frontend file: '+path);
  const data=Buffer.from(await response.arrayBuffer());
  if(hash(data)!==hash(readFileSync(join(frontend,'dist',path))))throw Error('Frontend snapshot mismatch: '+path);
  save(join(evidence,'cloudflare-assets',path),data);assets.push({path,sha256:hash(data)});
 }
 copy(join(frontend,'dist/_headers'),join(evidence,'cloudflare-assets/_headers'));
 save(join(evidence,'recovery-manifest.json'),JSON.stringify({recoveredAt:new Date().toISOString(),target,image,backendSource:backend,frontendSource:frontend,cloudflareVersion:'d9c5d161-0632-4c00-bacb-0db719e9609d',binarySHA256:hash(binary),runtimeArchiveSHA256:hash(archive),assets,excluded:['production environment values','live databases','wallet secrets','private project configs'],productionModified:false},null,2));
 console.log(JSON.stringify({restored:target,backend:true,frontend:true,productionAssetsMatched:assets.length,productionModified:false}));
}else if(mode==='--verify-runtime'){
 const lines=readFileSync(join(evidence,'runtime-files.sha256'),'utf8').trim().split('\n');let count=0;
 for(const line of lines){const m=line.match(/^([a-f0-9]{64})\s+\/app\/(.+)$/);if(!m)throw Error('Invalid runtime checksum');if(hash(readFileSync(join(target,'gmr-engine',m[2])))!==m[1])throw Error('Runtime mismatch: '+m[2]);count++;}
 console.log(JSON.stringify({runtimeFilesMatched:count}));
}else throw Error('Use --restore or --verify-runtime');
