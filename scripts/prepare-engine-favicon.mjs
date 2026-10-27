import { cpSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const root=process.cwd(),prior=join(root,'output/release/engine-compact-save-20261025/frontend');
const release=join(root,'output/release/engine-favicon-20261025/frontend');
mkdirSync(release,{recursive:true});
const response=await fetch('https://engine.fluentxverse.com/');
const html=await response.text();
if(!response.ok||!html.includes('/index-tnwmfcvp.js')||!html.includes('/index-61vk9s3x.css'))throw Error('Live frontend baseline changed');
cpSync(join(prior,'dist'),join(release,'dist'),{recursive:true});
for(const file of ['index-tnwmfcvp.js','index-61vk9s3x.css']){
  const r=await fetch('https://engine.fluentxverse.com/'+file);
  if(!r.ok||!Buffer.from(await r.arrayBuffer()).equals(readFileSync(join(prior,'dist',file))))throw Error('Live asset changed: '+file);
}
const icon='engine-favicon-v1.svg';
copyFileSync(join(root,'../budol/gmr-dashboard/public/engine-favicon.svg'),join(release,'dist',icon));
writeFileSync(join(release,'dist/index.html'),html.replace('</head>',`<link rel="icon" type="image/svg+xml" sizes="any" href="/${icon}">\n</head>`));
for(const file of ['worker.ts','wrangler.json'])copyFileSync(join(prior,file),join(release,file));
writeFileSync(join(release,'manifest.json'),JSON.stringify({preparedAt:new Date().toISOString(),baselineMatched:true,backendChanged:false,jsChanged:false,cssChanged:false,favicon:icon},null,2));
console.log('PASS favicon-only frontend release prepared');
