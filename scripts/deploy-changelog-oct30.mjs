import {execFileSync,spawn} from 'node:child_process';
import {cpSync,existsSync,mkdirSync,readFileSync,writeFileSync,readdirSync,symlinkSync,lstatSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const root=process.cwd(),release=join(root,'output/release/site-changelog-20261030'),baseline=join(root,'output/release/site-changelog-20261028'),cwd=join(release,'site'),previous='2c272fc5-87f2-4bce-8024-cd48274c438f';
const env={...process.env,CI:'1'},hash=data=>createHash('sha256').update(data).digest('hex');
const run=(cmd,args,opts={})=>execFileSync(cmd,args,{encoding:'utf8',env,maxBuffer:5e6,...opts});
const save=(name,data)=>writeFileSync(join(release,name),JSON.stringify(data,null,2));
const wrangler=args=>run('bunx',['--bun','wrangler@4.152.0',...args,'--config','wrangler.toml'],{cwd:release});
const guard=()=>{const versions=JSON.parse(wrangler(['deployments','list','--json'])).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0].versions;if(versions.length!==1||versions[0].version_id!==previous)throw Error('Live site changed');};
if(process.argv.includes('--prepare')){
 mkdirSync(release,{recursive:true});
 cpSync(join(baseline,'site'),cwd,{recursive:true,verbatimSymlinks:true,filter:path=>!['node_modules','dist','.wrangler'].includes(path.split('/').at(-1))&&!path.split('/').at(-1).startsWith('.env')});
 if(!existsSync(join(cwd,'node_modules')))symlinkSync(join(root,'node_modules'),join(cwd,'node_modules'),'dir');
 cpSync(join(baseline,'assets'),join(release,'assets'),{recursive:true});cpSync(join(baseline,'wrangler.toml'),join(release,'wrangler.toml'));
 guard();
 const source=join(root,'fluentxverse-site/src/data/changelogEntries.json'),next=JSON.parse(readFileSync(source)),old=JSON.parse(readFileSync(join(baseline,'assets/changelog.json')));
 for(const entry of old.entries)if(JSON.stringify(next.entries.find(item=>item.id===entry.id))!==JSON.stringify(entry))throw Error('Prior entry changed');
 cpSync(source,join(cwd,'src/data/changelogEntries.json'));
 cpSync(join(root,'fluentxverse-site/tests'),join(cwd,'tests'),{recursive:true});
 console.log(run('bun',['run','build'],{cwd}));
 for(const path of ['index.html','changelog.json','assets'])cpSync(join(cwd,'dist',path),join(release,'assets',path),{recursive:true});
 save('manifest.json',{previous,feedHash:hash(readFileSync(source)),htmlHash:hash(readFileSync(join(cwd,'dist/index.html'))),entries:next.entries.length,added:next.entries.length-old.entries.length});
}else if(process.argv.includes('--verify')){
 const server=spawn(process.execPath,[join(root,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5215','--strictPort'],{cwd,env,stdio:'ignore',detached:true});
 try{let ready=false;for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:5215/changelog')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}if(!ready)throw Error('Preview unavailable');
 console.log(run('node',['tests/browser/changelog.cjs'],{cwd,env:{...env,SITE_URL:'http://127.0.0.1:5215'}}));save('verification.json',{passed:true,htmlHash:hash(readFileSync(join(cwd,'dist/index.html')))});
 }finally{try{process.kill(-server.pid,'SIGTERM');}catch{}}
}else if(process.argv.includes('--activate')){
 const manifest=JSON.parse(readFileSync(join(release,'manifest.json'))),verified=JSON.parse(readFileSync(join(release,'verification.json')));
 if(!verified.passed||verified.htmlHash!==manifest.htmlHash||hash(readFileSync(join(release,'assets/index.html')))!==manifest.htmlHash||hash(readFileSync(join(release,'assets/changelog.json')))!==manifest.feedHash)throw Error('Verified build changed');
 guard();let version;
 try{const output=wrangler(['deploy']);console.log(output);version=output.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];if(!version)throw Error('Missing version');
 for(const domain of ['fluentxverse.com','www.fluentxverse.com'])for(const file of ['index.html','changelog.json',...readdirSync(join(cwd,'dist/assets')).filter(file=>/\.(js|css)$/.test(file)).map(file=>'assets/'+file)]){
 const res=await fetch('https://'+domain+'/'+file,{signal:AbortSignal.timeout(20000)});if(!res.ok||hash(Buffer.from(await res.arrayBuffer()))!==hash(readFileSync(join(release,'assets',file))))throw Error('Live asset mismatch: '+file);
 }
 console.log(run('node',['tests/browser/changelog.cjs'],{cwd,env:{...env,SITE_URL:'https://fluentxverse.com'}}));save('deployment.json',{version,previous,entries:manifest.entries,added:manifest.added,verifiedAt:new Date().toISOString()});
 }catch(error){if(version)console.log(wrangler(['rollback',previous,'--yes']));throw error;}
}else throw Error('Use --prepare, --verify or --activate');
