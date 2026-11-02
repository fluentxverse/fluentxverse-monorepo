import {execFileSync,spawn} from 'node:child_process';
import {cpSync,existsSync,mkdirSync,readFileSync,writeFileSync,readdirSync,realpathSync,symlinkSync,lstatSync} from 'node:fs';
import {join,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';

const root=process.cwd(),release=join(root,'output/release/interview-chat-20261030');
const apps=[
 {name:'tutor',dir:'fluentxverse-tutor-solid-prototype',baseline:'tutor-first-lesson-guide-20261030',previous:'dc9734c5-5a7b-4252-af2a-966874ec3873',port:5284,domain:'tutor.fluentxverse.com',files:['tutor/pages/InterviewRoomPage.tsx','tutor/pages/InterviewRoomPage.css','tutor/Components/InterviewChat.tsx']},
 {name:'dashboard',dir:'fluentxverse-dashboard',baseline:'admin-compact-reports-20261029',previous:'efbc9015-9b77-459b-bbd8-a4129101c3e2',port:5285,domain:'dashboard.fluentxverse.com',files:['src/pages/InterviewRoomPage.tsx','src/pages/InterviewRoomPage.css','src/Components/InterviewChat.tsx']}
];
const shared=['shared/interviewCall.ts','shared/interviewChat.ts','shared/ui/interview-chat.css','shared/tests/interviewCall.test.ts'];
const env={...process.env,CI:'1'},hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const run=(command,args,options={})=>execFileSync(command,args,{encoding:'utf8',env,maxBuffer:10e6,...options});
const save=(path,data)=>{mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(data,null,2));};
const front=app=>join(release,app.name,'frontend'),cwd=app=>join(front(app),app.dir);
const wrangler=(app,args)=>run('bunx',['--bun','wrangler@4.152.0',...args,'--config','wrangler.jsonc'],{cwd:cwd(app)});
const guard=app=>{const versions=JSON.parse(wrangler(app,['deployments','list','--json'])).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0].versions;if(versions.length!==1||versions[0].version_id!==app.previous||versions[0].percentage!==100)throw Error(app.name+' baseline changed');};
const browser=live=>run('node',['scripts/test-interview-chat.cjs'],{env:{...env,INTERVIEW_TUTOR_URL:live?'https://tutor.fluentxverse.com':'http://127.0.0.1:5284',INTERVIEW_DASHBOARD_URL:live?'https://dashboard.fluentxverse.com':'http://127.0.0.1:5285'}});
const published=async url=>{let failure;for(let n=0;n<3;n++){try{const res=await fetch(url,{signal:AbortSignal.timeout(20000)});if(res.status<500)return res;await res.body?.cancel();failure=Error('HTTP '+res.status);}catch(error){failure=error;}await new Promise(r=>setTimeout(r,1000));}throw failure;};

if(process.argv.includes('--prepare')){
 if(existsSync(join(release,'manifest.json'))&&!process.argv.includes('--refresh'))throw Error('Release already prepared');
 const sources={};
 for(const app of apps){
  const baseline=join(root,'output/release',app.baseline,app.name,'frontend');
  cpSync(baseline,front(app),{recursive:true,verbatimSymlinks:true,filter:path=>!['node_modules','dist','.wrangler'].includes(path.split('/').at(-1))&&!path.split('/').at(-1).startsWith('.env')&&!(lstatSync(path).isSymbolicLink()&&existsSync(join(front(app),relative(baseline,path))))});
  if(!existsSync(join(cwd(app),'node_modules')))symlinkSync(realpathSync(join(baseline,app.dir,'node_modules')),join(cwd(app),'node_modules'),'dir');
  guard(app);
  for(const file of [...app.files.map(file=>app.dir+'/'+file),...shared]){const target=join(front(app),file);mkdirSync(dirname(target),{recursive:true});cpSync(join(root,file),target);sources[relative(release,target)]=hash(readFileSync(target));}
  console.log(run('bun',['test','./shared/tests/interviewCall.test.ts'],{cwd:front(app)}));
  console.log(run('bun',['run','build'],{cwd:cwd(app)}));
 }
 save(join(release,'manifest.json'),{sources,apps:apps.map(app=>({name:app.name,previous:app.previous,htmlHash:hash(readFileSync(join(cwd(app),'dist/index.html')))})),apiUnchanged:true});
}else if(process.argv.includes('--verify')){
 const servers=apps.map(app=>spawn(process.execPath,[join(app.name==='dashboard'?root:cwd(app),'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port',String(app.port),'--strictPort'],{cwd:cwd(app),env,stdio:'ignore',detached:true}));
 try{
  for(const app of apps){let ready=false;for(let n=0;n<80;n++){try{if((await fetch('http://127.0.0.1:'+app.port)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}if(!ready)throw Error('Preview unavailable');}
  console.log(browser(false));
  save(join(release,'verification.json'),{passed:true,apps:apps.map(app=>({name:app.name,htmlHash:hash(readFileSync(join(cwd(app),'dist/index.html')))})),verifiedAt:new Date().toISOString()});
 }finally{for(const server of servers)try{process.kill(-server.pid,'SIGTERM');}catch{}}
}else if(process.argv.includes('--activate')){
 const manifest=JSON.parse(readFileSync(join(release,'manifest.json'))),verified=JSON.parse(readFileSync(join(release,'verification.json')));
 if(!verified.passed)throw Error('Verification required');
 for(const [file,expected]of Object.entries(manifest.sources))if(hash(readFileSync(join(release,file)))!==expected)throw Error('Prepared source changed');
 for(const app of apps){guard(app);const current=hash(readFileSync(join(cwd(app),'dist/index.html')));if(current!==manifest.apps.find(item=>item.name===app.name).htmlHash||current!==verified.apps.find(item=>item.name===app.name).htmlHash)throw Error('Build changed');}
 const deployed=[];
 try{
  for(const app of apps){const output=wrangler(app,['deploy']);console.log(output);const version=output.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];if(!version)throw Error('Missing version');deployed.push({name:app.name,version});}
  for(const app of apps){const dist=join(cwd(app),'dist'),res=await published('https://'+app.domain+'/interview'),html=await res.text(),refs=text=>[...text.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(m=>m[1]).sort();if(!res.ok||JSON.stringify(refs(html))!==JSON.stringify(refs(readFileSync(join(dist,'index.html'),'utf8'))))throw Error('HTML mismatch');
   for(const file of readdirSync(join(dist,'assets')).filter(file=>/\.(js|css)$/.test(file))){const asset=await published('https://'+app.domain+'/assets/'+file);if(!asset.ok||hash(Buffer.from(await asset.arrayBuffer()))!==hash(readFileSync(join(dist,'assets',file))))throw Error('Asset mismatch: '+file);}
  }
  console.log(browser(true));save(join(release,'deployment.json'),{deployed,apiUnchanged:true,publicAssetsVerified:true,deployedAt:new Date().toISOString()});
 }catch(error){for(const app of apps.slice().reverse())if(deployed.some(item=>item.name===app.name))console.log(wrangler(app,['rollback',app.previous,'--yes']));throw error;}
}else throw Error('Use --prepare, --verify or --activate');
