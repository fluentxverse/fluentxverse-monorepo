import {execFileSync,spawn} from 'node:child_process';
import {cpSync,existsSync,readFileSync,writeFileSync,symlinkSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const root=process.cwd(),release=resolve('output/release/site-web3-ecosystem-20261105'),cwd=join(release,'site');
const previous='ab98b53b-84e2-48f2-bc20-90d79b346b0d';
const files=['src/pages/HomePage.tsx','src/components/Web3Ecosystem.tsx','src/components/Web3Ecosystem.css'];
const hash=x=>createHash('sha256').update(x).digest('hex');
const run=(cmd,args,options={})=>execFileSync(cmd,args,{cwd,env:{...process.env,CI:'1'},encoding:'utf8',timeout:240000,maxBuffer:5e6,...options});
const wrangler=args=>run('bunx',['--bun','wrangler@4.152.0',...args,'--config','wrangler.toml']);
const record=(file,data)=>writeFileSync(join(release,file),JSON.stringify(data,null,2));
const guard=()=>{const v=JSON.parse(wrangler(['deployments','list','--json'])).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0].versions;if(v.length!==1||v[0].version_id!==previous)throw Error('Production site changed');};
const browserTest=base=>console.log(run('node',['tests/browser/web3Ecosystem.cjs'],{cwd:resolve('fluentxverse-site'),env:{...process.env,SITE_URL:base}}));
if(process.argv.includes('--prepare')){
 if(!existsSync(cwd))cpSync('output/release/site-about-mission-20261105/site',cwd,{recursive:true,verbatimSymlinks:true,filter:p=>!['node_modules','dist','.wrangler','.git'].includes(p.split('/').at(-1))&&!p.split('/').at(-1).startsWith('.env')});
 if(!existsSync(join(cwd,'node_modules')))symlinkSync(resolve('node_modules'),join(cwd,'node_modules'),'dir');
 guard();
 for(const file of files)cpSync(join(root,'fluentxverse-site',file),join(cwd,file));
 cpSync('fluentxverse-site/public/assets/img/providers',join(cwd,'public/assets/img/providers'),{recursive:true});
 console.log(run('bun',['run','build']));
 const source=Object.fromEntries([...files,...readdirSync(join(cwd,'public/assets/img/providers')).map(f=>'public/assets/img/providers/'+f)].map(file=>[file,hash(readFileSync(join(cwd,file)))]));
 record('manifest.json',{previous,source,html:hash(readFileSync(join(cwd,'dist/index.html'))),scope:'Homepage Web3 ecosystem section only; keep published About copy and all other sources'});
}else if(process.argv.includes('--verify')){
 const child=spawn(process.execPath,[join(root,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5343','--strictPort'],{cwd,detached:true,stdio:'ignore'});
 try{let ready=false;for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:5343')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}if(!ready)throw Error('Preview unavailable');browserTest('http://127.0.0.1:5343');record('verification.json',{passed:true,html:hash(readFileSync(join(cwd,'dist/index.html')))});}finally{try{process.kill(-child.pid,'SIGTERM');}catch{}}
}else if(process.argv.includes('--deploy')){
 const m=JSON.parse(readFileSync(join(release,'manifest.json'))),v=JSON.parse(readFileSync(join(release,'verification.json')));
 if(!v.passed||v.html!==m.html||m.html!==hash(readFileSync(join(cwd,'dist/index.html'))))throw Error('Exact build not verified');
 for(const[file,sha]of Object.entries(m.source))if(hash(readFileSync(join(cwd,file)))!==sha)throw Error('Verified source changed');
 guard();let version;
 try{const output=wrangler(['deploy']);console.log(output);version=output.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];if(!version)throw Error('Missing version');record('deployment-progress.json',{previous,version});
  const paths=['index.html','changelog.json',...readdirSync(join(cwd,'dist/assets')).filter(f=>/\.(js|css)$/.test(f)).map(f=>'assets/'+f),...readdirSync(join(cwd,'dist/assets/img/providers')).map(f=>'assets/img/providers/'+f)];
  for(const domain of ['fluentxverse.com','www.fluentxverse.com'])for(const path of paths){let matched=false;for(let i=0;i<12;i++){const r=await fetch('https://'+domain+'/'+path,{signal:AbortSignal.timeout(20000),cache:'no-store'});if(r.ok&&hash(Buffer.from(await r.arrayBuffer()))===hash(readFileSync(join(cwd,'dist',path)))){matched=true;break;}await new Promise(r=>setTimeout(r,2000));}if(!matched)throw Error('Published asset differs: '+domain+'/'+path);}
  browserTest('https://fluentxverse.com');
  console.log(run('node',['tests/browser/aboutMission.cjs'],{cwd:resolve('fluentxverse-site'),env:{...process.env,SITE_URL:'https://fluentxverse.com'}}));
  record('deployment.json',{previous,version,assetsVerified:true,browserTestsPassed:true,url:'https://fluentxverse.com',at:new Date().toISOString()});
 }catch(error){if(version)console.log(wrangler(['rollback',previous,'--yes']));throw error;}
}else throw Error('Use --prepare, --verify or --deploy');
