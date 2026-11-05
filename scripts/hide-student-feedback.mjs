import {execFileSync,spawn} from 'node:child_process';
import {cpSync,existsSync,readFileSync,writeFileSync,symlinkSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {studentPublicBuildEnv} from './lib/student-public-build-env.mjs';
const root=process.cwd(),release=resolve('output/release/student-hide-feedback-20261105'),front=join(release,'frontend'),name='fluentxverse-student-solid-prototype',cwd=join(front,name);
const previous='643efed2-5dd8-4e7d-8367-2d63a2db2be3';
const env={...process.env,CI:'1',...studentPublicBuildEnv(root)};
const run=(cmd,args,options={})=>execFileSync(cmd,args,{cwd,env,encoding:'utf8',timeout:240000,maxBuffer:5e6,...options});
const wrangler=args=>run('bunx',['--bun','wrangler@4.152.0',...args,'--config','wrangler.jsonc']);
const hash=x=>createHash('sha256').update(x).digest('hex');
const record=(file,data)=>writeFileSync(join(release,file),JSON.stringify(data,null,2));
const guard=()=>{const v=JSON.parse(wrangler(['deployments','list','--json'])).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0].versions;if(v.length!==1||v[0].version_id!==previous)throw Error('Student production baseline changed');};
const edit=(file,before,after)=>{const path=join(cwd,file),s=readFileSync(path,'utf8');if(s.split(before).length!==2)throw Error('Ambiguous anchor '+file);writeFileSync(path,s.replace(before,after));};
if(process.argv.includes('--prepare')){
 if(!existsSync(cwd))cpSync('output/release/learning-terminology-20261104/student/frontend',front,{recursive:true,verbatimSymlinks:true,filter:p=>!['node_modules','dist','.wrangler','.git'].includes(p.split('/').at(-1))&&!p.split('/').at(-1).startsWith('.env')});
 if(!existsSync(join(cwd,'node_modules')))symlinkSync(resolve(name,'node_modules'),join(cwd,'node_modules'),'dir');
 guard();
 for(const file of ['student/App.tsx','student/Components/IndexOne/SideBar.tsx','student/Components/AnonymousLessonReview.tsx'])cpSync(join('output/release/learning-terminology-20261104/student/frontend',name,file),join(cwd,file));
 edit('student/App.tsx',"const Reviews = page(() => import('./pages/AnonymousReviewsPage'));\n",'');
 edit('student/App.tsx','<Route path="/reviews" component={protect(Reviews)} />','<Route path="/reviews" component={() => <Navigate href="/home" />} />');
 edit('student/Components/IndexOne/SideBar.tsx','    { href: "/reviews", label: "Feedback", icon: ShieldCheck },\n','');
 edit('student/Components/IndexOne/SideBar.tsx','UserRound, ShieldCheck','UserRound');
 edit('student/Components/AnonymousLessonReview.tsx','        <a href="/reviews">My feedback</a>\n','');
 console.log(run('bun',['run','build']));record('manifest.json',{previous,html:hash(readFileSync(join(cwd,'dist/index.html'))),scope:'Hide feedback navigation and redirect reviews to home; no backend changes'});
}else if(process.argv.includes('--verify')||process.argv.includes('--deploy')){
 const test=async base=>{
  const {chromium}=await import('@playwright/test');const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
  try{for(const width of [1440,390]){const page=await browser.newPage({viewport:{width,height:900}});let reviewRequests=0;
   await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===base)return r.continue();if(u.pathname.includes('anonymous-reviews'))reviewRequests++;let json={success:true,data:[]};if(u.pathname==='/student/me')json.user={userId:'hide-feedback-fixture',firstName:'Test',role:'student',email:'test@example.invalid'};return r.fulfill({json});});
   await page.goto(base+'/reviews');await page.waitForURL(base+'/home');
   if(await page.locator('a[href="/reviews"]').count()||await page.getByRole('heading',{name:'My feedback',exact:true}).count()||reviewRequests)throw Error('Feedback is still accessible');
   console.log('PASS '+width+': reviews redirect, navigation hidden, no review API requests');await page.close();
  }}finally{await browser.close();}
 };
 if(process.argv.includes('--verify')){
  const child=spawn(process.execPath,[join(root,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5342','--strictPort'],{cwd,env,detached:true,stdio:'ignore'});
  try{let ready=false;for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:5342')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}if(!ready)throw Error('Preview unavailable');await test('http://127.0.0.1:5342');record('verification.json',{passed:true,html:hash(readFileSync(join(cwd,'dist/index.html')))});}finally{try{process.kill(-child.pid,'SIGTERM');}catch{}}
 }else{
  const m=JSON.parse(readFileSync(join(release,'manifest.json'))),v=JSON.parse(readFileSync(join(release,'verification.json')));if(!v.passed||v.html!==m.html||v.html!==hash(readFileSync(join(cwd,'dist/index.html'))))throw Error('Exact build not verified');guard();let version;
  try{const output=wrangler(['deploy']);console.log(output);version=output.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];if(!version)throw Error('Missing version');record('deployment-progress.json',{previous,version});
   for(const file of ['index.html',...readdirSync(join(cwd,'dist/assets')).filter(f=>/\.(js|css)$/.test(f)).map(f=>'assets/'+f)]){let ok=false;for(let i=0;i<10;i++){const r=await fetch('https://student.fluentxverse.com/'+file,{signal:AbortSignal.timeout(20000)});if(r.ok&&hash(Buffer.from(await r.arrayBuffer()))===hash(readFileSync(join(cwd,'dist',file)))){ok=true;break;}await new Promise(r=>setTimeout(r,2000));}if(!ok)throw Error('Asset mismatch '+file);}
   await test('https://student.fluentxverse.com');record('deployment.json',{previous,version,verified:true,at:new Date().toISOString()});
  }catch(error){if(version)console.log(wrangler(['rollback',previous,'--yes']));throw error;}
 }
}else throw Error('Use --prepare, --verify or --deploy');
