import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const root=process.cwd(),site=join(root,'fluentxverse-site'),credentialFollowup=process.argv.includes('--remove-credential-reference');
const followup=credentialFollowup||process.argv.includes('--remove-references');
const prior=join(root,'output/release',credentialFollowup?'site-remove-onchain-references-20261025':'site-onchain-education-20261025');
const release=credentialFollowup?join(root,'output/release/site-remove-credential-reference-20261025'):followup?join(root,'output/release/site-remove-onchain-references-20261025'):prior;
const previous=followup?JSON.parse(readFileSync(join(prior,'deployment.json'))).version:'db770651-c95d-4473-9840-915a8606cef7';
const source=join(release,'source'),assets=join(release,'assets');
const run=(c,a,o={})=>execFileSync(c,a,{encoding:'utf8',maxBuffer:4*1024*1024,...o});
const files=directory=>readdirSync(directory,{withFileTypes:true}).flatMap(f=>f.isDirectory()?files(join(directory,f.name)):[join(directory,f.name)]);
const live=async path=>{const r=await fetch('https://fluentxverse.com/'+path,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Missing live file '+path);return Buffer.from(await r.arrayBuffer());};
const versions=()=>[...run('npx',['wrangler','deployments','list','--config','wrangler.toml'],{cwd:site,env:{...process.env,CI:'1'}}).matchAll(/Version\(s\):\s+\(100%\)\s+([a-f0-9-]{36})/g)].at(-1)?.[1];
if(process.argv.includes('--prepare')){
  if(existsSync(join(release,'manifest.json')))throw Error('Release already prepared');
  const dist=followup?join(prior,'assets'):join(site,'dist');
  if(!(await live('index.html')).equals(readFileSync(join(dist,'index.html'))))throw Error('Starting dist no longer matches production');
  for(const file of [...files(join(dist,'assets')),join(dist,'changelog.json')]){
    const path=file.slice(dist.length+1);
    if(!(await live(path)).equals(readFileSync(file)))throw Error('Unrelated asset differs from production: '+path);
  }
  if(versions()!==previous)throw Error('Production Worker changed');
  mkdirSync(release,{recursive:true});cpSync(dist,join(release,'baseline-assets'),{recursive:true});
  mkdirSync(source,{recursive:true});
  for(const p of ['src','public','tests','index.html','package.json','vite.config.ts','tsconfig.json'])cpSync(join(followup?join(prior,'source'):site,p),join(source,p),{recursive:true});
  if(followup)for(const p of ['src/pages/OnchainPage.tsx','src/pages/OnchainPage.css'])cpSync(join(site,p),join(source,p));
  symlinkSync(join(root,'node_modules'),join(source,'node_modules'));
  run('bun',['test','tests/onchainEducation.test.ts'],{cwd:source,stdio:'inherit'});
  run('bun',['run','build'],{cwd:source,stdio:'inherit'});
  cpSync(join(source,'dist'),assets,{recursive:true});
  writeFileSync(join(release,'wrangler.toml'),readFileSync(join(site,'wrangler.toml'),'utf8').replace('directory = "./dist"','directory = "./assets"'));
  writeFileSync(join(release,'manifest.json'),JSON.stringify({preparedAt:new Date().toISOString(),previousVersion:previous,route:'/onchain-education',changed:followup?['src/pages/OnchainPage.tsx','src/pages/OnchainPage.css']:['src/pages/OnchainPage.tsx','src/pages/OnchainPage.css','src/data/onchainEducation.ts','src/App.tsx'],backendChanged:false},null,2));
  console.log('PASS scoped onchain education release built from verified production baseline');
}else if(process.argv.includes('--deploy')){
  const manifest=JSON.parse(readFileSync(join(release,'manifest.json')));
  if(versions()!==manifest.previousVersion)throw Error('Production changed; do not overwrite another release');
  const out=run('npx',['wrangler','deploy','--config',join(release,'wrangler.toml')],{cwd:site,env:{...process.env,CI:'1'}});
  console.log(out);const version=out.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];if(!version)throw Error('Confirm Worker deployment');
  for(const p of ['index.html','changelog.json',...files(join(assets,'assets')).filter(p=>/\.(js|css)$/.test(p)).map(p=>p.slice(assets.length+1))])
    if(!(await live(p)).equals(readFileSync(join(assets,p))))throw Error('Published asset mismatch '+p);
  writeFileSync(join(release,'deployment.json'),JSON.stringify({deployedAt:new Date().toISOString(),version,previous:manifest.previousVersion,url:'https://fluentxverse.com/onchain-education',assetsVerified:true},null,2));
  console.log('PASS production onchain education page deployed and assets verified');
}else throw Error('Use --prepare or --deploy');
