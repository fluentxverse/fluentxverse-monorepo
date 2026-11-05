import {execFileSync,spawn} from 'node:child_process';
import {cpSync,existsSync,mkdirSync,readFileSync,writeFileSync,symlinkSync,realpathSync,lstatSync,readdirSync} from 'node:fs';
import {join,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';
const root=process.cwd(),app='fluentxverse-tutor-solid-prototype',release=join(root,'output/release/tutor-hero-horizontal-badges-20261103');
const base=join(root,'output/release/tutor-hero-decoration-current-20261103/frontend'),front=join(release,'frontend'),cwd=join(front,app);
const previous='cbb27f42-b6bd-4578-a8bc-12b1ef9c366b',env={...process.env,CI:'1'};
const files=['tutor/Components/IndexOne/Banner.tsx','tutor/Components/IndexOne/Banner.css'];
const run=(cmd,args,options={})=>execFileSync(cmd,args,{cwd,env,encoding:'utf8',maxBuffer:8e6,...options});
const hash=x=>createHash('sha256').update(x).digest('hex');
const wrangler=args=>run('bunx',['--bun','wrangler@4.152.0',...args,'--config','wrangler.jsonc']);
const guard=()=>{const v=JSON.parse(wrangler(['deployments','list','--json'])).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0].versions;if(v.length!==1||v[0].version_id!==previous)throw Error('Tutor baseline changed');};
const record=(file,data)=>{mkdirSync(release,{recursive:true});writeFileSync(join(release,file),JSON.stringify(data,null,2));};
const publicCheck=async(url,expected)=>{for(let i=0;i<15;i++){const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(r.ok&&hash(Buffer.from(await r.arrayBuffer()))===expected)return;await new Promise(r=>setTimeout(r,3000));}throw Error('Published content mismatch: '+url);};
if(process.argv.includes('--prepare')){
 if(!existsSync(cwd))cpSync(base,front,{recursive:true,verbatimSymlinks:true,filter:p=>!['node_modules','dist','.wrangler'].includes(p.split('/').at(-1))&&!p.split('/').at(-1).startsWith('.env')&&!(lstatSync(p).isSymbolicLink()&&existsSync(join(front,relative(base,p))))});
 if(!existsSync(join(cwd,'node_modules')))symlinkSync(realpathSync(join(base,app,'node_modules')),join(cwd,'node_modules'),'dir');
 guard();
 const sources={};
 for(const file of files){mkdirSync(dirname(join(cwd,file)),{recursive:true});cpSync(join(root,app,file),join(cwd,file));sources[file]=hash(readFileSync(join(cwd,file)));}
 console.log(run('bun',['run','build']));
 record('manifest.json',{previous,sources,html:hash(readFileSync(join(cwd,'dist/index.html'))),apiUnchanged:true});
}else if(process.argv.includes('--serve')||process.argv.includes('--verify')){
 const child=spawn(process.execPath,[join(cwd,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5290','--strictPort'],{cwd,env,stdio:'ignore',detached:true});
 try{
  let ready=false;for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:5290')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}if(!ready)throw Error('Preview unavailable');
  if(process.argv.includes('--serve')){console.log('http://127.0.0.1:5290');await new Promise(resolve=>{process.once('SIGTERM',resolve);process.once('SIGINT',resolve);});}
  else{console.log(run('node',['scripts/tests/tutor-hero.cjs'],{cwd:root,env:{...env,TUTOR_TEST_URL:'http://127.0.0.1:5290'}}));record('verification.json',{passed:true,html:hash(readFileSync(join(cwd,'dist/index.html')))});}
 }finally{try{process.kill(-child.pid,'SIGTERM');}catch{}}
}else if(process.argv.includes('--deploy')){
 const verified=JSON.parse(readFileSync(join(release,'verification.json'))),manifest=JSON.parse(readFileSync(join(release,'manifest.json')));
 if(!verified.passed||verified.html!==manifest.html||verified.html!==hash(readFileSync(join(cwd,'dist/index.html'))))throw Error('Verify exact build first');
 for(const[file,expected]of Object.entries(manifest.sources))if(hash(readFileSync(join(cwd,file)))!==expected)throw Error('Source changed');
 guard();let version;
 try{
  const output=wrangler(['deploy']);console.log(output);version=output.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];if(!version)throw Error('Missing worker version');
  const dist=join(cwd,'dist'),refs=x=>[...x.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m=>m[1]).sort();let matched=false;
  for(let i=0;i<15;i++){const html=await(await fetch('https://tutor.fluentxverse.com/')).text();if(JSON.stringify(refs(html))===JSON.stringify(refs(readFileSync(join(dist,'index.html'),'utf8')))){matched=true;break;}await new Promise(r=>setTimeout(r,3000));}if(!matched)throw Error('Public HTML mismatch');
  for(const file of readdirSync(join(dist,'assets')).filter(f=>/\.(js|css)$/.test(f)))await publicCheck('https://tutor.fluentxverse.com/assets/'+file,hash(readFileSync(join(dist,'assets',file))));
  console.log(run('node',['scripts/tests/tutor-hero.cjs'],{cwd:root,env:{...env,TUTOR_TEST_URL:'https://tutor.fluentxverse.com'}}));
  record('deployment.json',{previous,version,verified:true,apiUnchanged:true,at:new Date().toISOString()});
 }catch(error){if(version)console.log(wrangler(['rollback',previous,'--yes']));throw error;}
}else throw Error('Use --prepare, --serve, --verify or --deploy');
