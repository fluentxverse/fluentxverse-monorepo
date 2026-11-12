import {execFileSync,spawn} from 'node:child_process';
import {cpSync,existsSync,lstatSync,mkdirSync,readFileSync,readdirSync,symlinkSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';

const root=process.cwd(),release=resolve('output/release/site-changelog-20261110'),cwd=join(release,'site');
const baseline=resolve('output/release/site-changelog-20261107/site');
const tools='/tmp/fxv-changelog-tools-20261110/node_modules';
const previous='e413215f-95f2-4f30-b525-1617694f9065';
const sources=['src/data/changelogEntries.json','tests/changelog.test.ts'];
const hash=x=>createHash('sha256').update(x).digest('hex'),fileHash=file=>hash(readFileSync(file));
const run=(command,args,options={})=>execFileSync(command,args,{cwd,encoding:'utf8',env:{...process.env,CI:'1',PATH:tools+'/.bin:'+process.env.PATH},timeout:300000,maxBuffer:5e6,...options});
const wrangler=args=>run('node',[join(tools,'wrangler/bin/wrangler.js'),...args,'--config','wrangler.toml']);
const record=(file,value)=>writeFileSync(join(release,file),JSON.stringify(value,null,2)+'\n');
const read=file=>JSON.parse(readFileSync(join(release,file),'utf8'));
const guard=()=>{const v=JSON.parse(wrangler(['deployments','list','--json'])).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0].versions;if(v.length!==1||v[0].version_id!==previous)throw Error('Live website changed; review baseline');};
const publicHash=async(domain,file)=>{const r=await fetch('https://'+domain+'/'+file,{cache:'no-store',signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('Published file missing: '+domain+'/'+file);return hash(Buffer.from(await r.arrayBuffer()));};
const browserTest=base=>console.log(run('node',['tests/browser/changelog.cjs'],{cwd:resolve('fluentxverse-site'),env:{...process.env,SITE_URL:base,PLAYWRIGHT_MODULE:join(tools,'@playwright/test')}}));
function verify(){const m=read('manifest.json');for(const[file,sha]of Object.entries(m.sources))if(fileHash(join(cwd,file))!==sha)throw Error('Verified source changed');if(m.html!==fileHash(join(cwd,'dist/index.html'))||m.feed!==fileHash(join(cwd,'dist/changelog.json')))throw Error('Build changed');return m;}

if(process.argv.includes('--prepare')){
 if(existsSync(release))throw Error('Release already exists; preserve previous evidence');
 mkdirSync(release,{recursive:true});
 cpSync(baseline,cwd,{recursive:true,verbatimSymlinks:true,filter:p=>!['node_modules','dist','.wrangler','.git'].includes(p.split('/').at(-1))&&!p.split('/').at(-1).startsWith('.env')});
 symlinkSync(tools,join(cwd,'node_modules'),'dir');guard();
 for(const file of ['index.html','changelog.json'])if(await publicHash('fluentxverse.com',file)!==fileHash(join(baseline,'dist',file)))throw Error('Live baseline mismatch');
 const old=JSON.parse(readFileSync(join(baseline,'dist/changelog.json'))),next=JSON.parse(readFileSync('fluentxverse-site/src/data/changelogEntries.json'));
 for(const entry of old.entries)if(JSON.stringify(next.entries.find(e=>e.id===entry.id))!==JSON.stringify(entry))throw Error('Published history altered: '+entry.id);
 for(const file of sources)cpSync(resolve('fluentxverse-site',file),join(cwd,file));
 console.log(run('bun',['test','tests/changelog.test.ts']));
 console.log(run('bun',['run','build']));
 record('manifest.json',{previous,entries:next.entries.length,added:next.entries.length-old.entries.length,publishedHistoryPreserved:true,sources:Object.fromEntries(sources.map(f=>[f,fileHash(join(cwd,f))])),html:fileHash(join(cwd,'dist/index.html')),feed:fileHash(join(cwd,'dist/changelog.json')),evidence:['engine-thirdweb-leaderboards-20261109/release-report.json','engine-score-publication-20261109/game-publication-activated.json','engine-managed-shop-20261110/api-deployed.json'],scope:'Changelog entries only; no app, contract, curriculum, or other site changes'});
}else if(process.argv.includes('--verify')){
 const m=verify(),child=spawn(process.execPath,[join(tools,'vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5354','--strictPort'],{cwd,detached:true,stdio:'ignore'});
 try{let ready=false;for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:5354/changelog')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}if(!ready)throw Error('Preview unavailable');browserTest('http://127.0.0.1:5354');record('verification.json',{passed:true,html:m.html,feed:m.feed,at:new Date().toISOString()});}finally{try{process.kill(-child.pid,'SIGTERM');}catch{}}
}else if(process.argv.includes('--deploy')){
 const m=verify(),v=read('verification.json');if(!v.passed||m.html!==v.html||m.feed!==v.feed)throw Error('Verify exact build');guard();let version;
 try{const output=wrangler(['deploy']);console.log(output);version=output.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];if(!version)throw Error('Deployment version missing');record('deployment-progress.json',{previous,version});
  const files=['index.html','changelog.json',...readdirSync(join(cwd,'dist/assets')).filter(f=>/\.(js|css)$/.test(f)).map(f=>'assets/'+f)];
  for(const domain of ['fluentxverse.com','www.fluentxverse.com'])for(const file of files){let matched=false;for(let i=0;i<12;i++){if(await publicHash(domain,file)===fileHash(join(cwd,'dist',file))){matched=true;break;}await new Promise(r=>setTimeout(r,2000));}if(!matched)throw Error('Published asset mismatch: '+domain+'/'+file);}
  browserTest('https://fluentxverse.com');record('deployment.json',{previous,version,entries:m.entries,added:m.added,assetsVerified:true,browserTestsPassed:true,url:'https://fluentxverse.com/changelog',at:new Date().toISOString()});
 }catch(error){if(version)console.log(wrangler(['rollback',previous,'--yes']));throw error;}
}else throw Error('Use --prepare, --verify or --deploy');
