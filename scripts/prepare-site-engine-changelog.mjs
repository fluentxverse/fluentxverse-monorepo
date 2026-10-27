import { cpSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
const root=process.cwd(),site=join(root,'fluentxverse-site'),release=join(root,'output/release/site-engine-changelog-20261025');
const baseline=join(release,'baseline'),source=join(release,'site');
const build=directory=>execFileSync(join(root,'node_modules/.bin/vite'),['build'],{cwd:directory,stdio:'inherit'});
const fetchLive=async path=>{const r=await fetch('https://fluentxverse.com/'+path,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Live asset missing: '+path);return Buffer.from(await r.arrayBuffer());};
if(process.argv.includes('--capture')){
 if(!existsSync(baseline)){
  mkdirSync(baseline,{recursive:true});
  for(const path of ['src','public','index.html','package.json','vite.config.ts','tsconfig.json'])cpSync(join(site,path),join(baseline,path),{recursive:true});
  symlinkSync(join(root,'node_modules'),join(baseline,'node_modules'));
 }
 build(baseline);
 const assets=['index.html',...readdirSync(join(baseline,'dist/assets'),{withFileTypes:true}).filter(f=>f.isFile()).map(f=>'assets/'+f.name)];
 for(const path of assets)if(!(await fetchLive(path)).equals(readFileSync(join(baseline,'dist',path))))throw Error('Unrelated source differs from live: '+path);
 writeFileSync(join(release,'baseline-check.json'),JSON.stringify({verifiedAt:new Date().toISOString(),matchedAssets:assets.length},null,2));
 console.log('PASS current site source reproduces production assets');
}else{
 JSON.parse(readFileSync(join(release,'baseline-check.json')));
 cpSync(baseline,source,{recursive:true,filter:path=>!['node_modules','dist'].includes(path.split('/').at(-1))});
 if(!existsSync(join(source,'node_modules')))symlinkSync(join(root,'node_modules'),join(source,'node_modules'));
 const changed=['src/data/changelog.ts','src/data/changelogEntries.json','src/pages/ChangelogPage.tsx','src/pages/ChangelogPage.css','src/App.tsx'];
 for(const path of changed)copyFileSync(join(site,path),join(source,path));
 build(source);
 const assets=join(release,'assets');
 // Preserve the previous production public assets, not unreviewed local additions.
 cpSync(join(root,'output/release/site-changelog-20261024/assets'),assets,{recursive:true});
 for(const path of ['index.html','changelog.json','assets'])cpSync(join(source,'dist',path),join(assets,path),{recursive:true});
 writeFileSync(join(release,'wrangler.toml'),readFileSync(join(site,'wrangler.toml'),'utf8').replace('directory = "./dist"','directory = "./assets"'));
 writeFileSync(join(release,'manifest.json'),JSON.stringify({preparedAt:new Date().toISOString(),changed,backendChanged:false,previousEntriesPreserved:true,feedIDs:JSON.parse(readFileSync(join(source,'src/data/changelogEntries.json'))).entries.map(e=>e.id)},null,2));
 console.log('PASS scoped Engine changelog release prepared');
}
