import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
const release=join(process.cwd(),'output/release/base-migration-20261024/frontend');
const assets=join(release,'assets');mkdirSync(assets,{recursive:true});
const base='https://engine.fluentxverse.com';
const get=async path=>{const r=await fetch(base+path,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Live dashboard asset unavailable: '+path);return Buffer.from(await r.arrayBuffer());};
let html=(await get('/')).toString();
const script=html.match(/type="module"[^>]*src="([^"]+)"/)?.[1];
if(script!=='/index-k4ck0r8h.js')throw Error('Dashboard baseline changed; do not overwrite another deployment.');
let js=(await get(script)).toString();
if(createHash('sha256').update(js).digest('hex')!=='bc009f4c046cf8da810108702ef6a15e34434d657cc1e005e54201a1f5a4d10f')throw Error('Dashboard bundle baseline changed.');
const replace=(before,after)=>{if(js.split(before).length!==2)throw Error('Compiled dashboard marker changed: '+before);js=js.replace(before,after);};
// Mechanical edits to the verified deployed bundle avoid shipping unrelated UI work.
replace('xe=2651420,No=[{id:2651420,name:"Horizen Testnet"},{id:26514,name:"Horizen"}', 'xe=8453,No=[{id:8453,name:"Base"},{id:84532,name:"Base Sepolia"},{id:2651420,name:"Horizen Testnet (Legacy)"},{id:26514,name:"Horizen (Retiring)"}');
replace(',{id:8453,name:"Base"},{id:84532,name:"Base Sepolia"},{id:137', ',{id:137');
replace('function sn(e,a){if(e===2651420)', 'function sn(e,a){if(e===8453)return`https://basescan.org/address/${a}`;if(e===84532)return`https://sepolia.basescan.org/address/${a}`;if(e===2651420)');
replace('function Yd(e,a){if(e===2651420)', 'function Yd(e,a){if(e===8453)return`https://basescan.org/tx/${a}`;if(e===84532)return`https://sepolia.basescan.org/tx/${a}`;if(e===2651420)');
const name='/index-base-'+createHash('sha256').update(js).digest('hex').slice(0,12)+'.js';
writeFileSync(join(assets,name),js);html=html.replace(script,name);writeFileSync(join(assets,'index.html'),html);
for(const path of ['/index-sh9f1d77.css','/public/client-env.js','/training-52z8h50g.webp']){const target=join(assets,path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,await get(path));}
copyFileSync('/home/paulanthonyarriola/Desktop/budol/cloudflare/gmr-dashboard._headers',join(assets,'_headers'));
copyFileSync('/home/paulanthonyarriola/Desktop/budol/gmr-dashboard/src/worker.ts',join(release,'worker.ts'));
const config=JSON.parse(readFileSync('/home/paulanthonyarriola/Desktop/budol/wrangler.fluentxverse-engine.jsonc'));
delete config.$schema;config.main='./worker.ts';config.assets.directory='./assets';
writeFileSync(join(release,'wrangler.json'),JSON.stringify(config,null,2));
writeFileSync(join(release,'manifest.json'),JSON.stringify({previousBundle:script,bundle:name,defaultChainId:8453,baseExplorerLinks:true,unrelatedSourceUIExcluded:true},null,2));
console.log('Prepared deployed-dashboard-only Base defaults and explorer links: '+name);
