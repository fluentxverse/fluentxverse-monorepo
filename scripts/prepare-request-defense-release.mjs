import { cpSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ssh } from './lib/cloud-ssh.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),release=join(root,'output/release/request-defense-20261024');
mkdirSync(join(release,'api'),{recursive:true});
const manifest={createdAt:new Date().toISOString(),files:{},apiBaselineImage:JSON.parse(ssh("docker inspect fluentxverse-server --format '{{json .Image}}'")),apiBaselineTag:JSON.parse(ssh("docker inspect fluentxverse-server --format '{{json .Config.Image}}'")),apiBaselineIndexHash:''};
const api=join(release,'api');
function copy(from,to){mkdirSync(dirname(to),{recursive:true});copyFileSync(from,to);manifest.files[from.replace(root+'/','')]=createHash('sha256').update(readFileSync(from)).digest('hex');}
function replace(path,before,after){const text=readFileSync(path,'utf8');if(text.split(before).length!==2)throw Error('Changed baseline: '+path);writeFileSync(path,text.replace(before,after));}
const index=ssh('docker exec fluentxverse-server cat /app/src/index.ts');
const updating=process.argv.includes('--refresh-current');
if(index.includes('requestDefense')!==updating)throw Error('Use --refresh-current only for the existing defense image.');
if(!['fluentxverse-cloud/api:container-stats-20261023','fluentxverse-cloud/api:request-defense-20261024','fluentxverse-cloud/api:request-defense-policy-20261024','fluentxverse-cloud/api:request-defense-multipart-20261024'].includes(manifest.apiBaselineTag))throw Error('Unknown baseline image; review.');
manifest.apiBaselineIndexHash=createHash('sha256').update(index).digest('hex');writeFileSync(join(api,'index.ts'),index);
if(!updating){
replace(join(api,'index.ts'),"import { containerStatsRoute } from './routes/containerStats.route';","import { containerStatsRoute } from './routes/containerStats.route';\nimport { requestDefense } from './utils/requestDefense';");
const start=index.indexOf('// Security: Maximum body size limit'),end=index.indexOf('  .use(swagger');
if(start<0||end<=start||end-start>2000)throw Error('Body limit markers changed.');
const before=index.slice(start,end);
if(!before.includes('const MAX_BODY_SIZE = 10 * 1024 * 1024;')||!before.includes('contentLength > MAX_BODY_SIZE'))throw Error('Body limit baseline changed.');
replace(join(api,'index.ts'),before,`// Request admission runs before route parsing, including chunked requests.\nconst app = new Elysia({ serve: { idleTimeout: 255 } })\n  .onRequest(context => requestDefense.before(context))\n  .onAfterResponse(({ request }) => requestDefense.release(request))\n`);
}
for(const path of ['src/utils/atomicRateLimit.ts','src/utils/rateLimiter.ts','src/utils/requestDefense.ts','tests/requestDefense.test.ts','tests/atomicRateLimit.test.ts','tests/atomicRateLimit.redis.ts'])copy(join(root,'fluentxverse-server',path),join(api,path));
copy(join(root,'shared/requestDefense.ts'),join(api,'shared/requestDefense.ts'));
manifest.apiBaselineRoutes={};
// Patch only manual multipart parser options in the deployed route sources.
for(const name of ['tutor','interview','lesson']){
  const source=ssh(`docker exec fluentxverse-server cat /app/src/routes/${name}.route.ts`);
  manifest.apiBaselineRoutes[name]=createHash('sha256').update(source).digest('hex');
  const parts=source.split(/(?=\n  \.(?:post|put|delete|get)\()/);
  let count=0;
  const patched=parts.map(part=>{
    if(!part.includes('request.formData()'))return part;
    count++;
    if(part.includes("parse: 'none'"))return part;
    const end=part.lastIndexOf('\n  })');
    if(end<0)throw Error('Manual parser route boundary changed: '+name);
    return part.slice(0,end)+part.slice(end).replace('\n  })',"\n  }, { parse: 'none' })");
  }).join('');
  if(count!==({tutor:2,interview:1,lesson:3})[name])throw Error('Unexpected multipart handler count: '+name);
  const target=join(api,'src/routes',name+'.route.ts');mkdirSync(dirname(target),{recursive:true});writeFileSync(target,patched);
}
writeFileSync(join(api,'Dockerfile'),`FROM ${manifest.apiBaselineTag}\nCOPY --chown=appuser:appgroup index.ts /app/src/index.ts\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\nCOPY shared/ /shared/\n`);
cpSync(join(root,'infra/edge-guard'),join(release,'edge/infra/edge-guard'),{recursive:true,filter:path=>!['.wrangler','node_modules'].includes(path.split('/').at(-1))});
copy(join(root,'shared/requestDefense.ts'),join(release,'edge/shared/requestDefense.ts'));
const privateDir=join(homedir(),'.local/state/fluentxverse/request-defense-20261024');mkdirSync(privateDir,{recursive:true,mode:0o700});
try{readFileSync(join(privateDir,'edge-secret.json'));}catch{writeFileSync(join(privateDir,'edge-secret.json'),JSON.stringify({EDGE_SHARED_SECRET:randomBytes(32).toString('hex')}),{mode:0o600});}
writeFileSync(join(release,'source-manifest.json'),JSON.stringify(manifest,null,2));
console.log('Prepared request-defense-only API overlay and isolated edge source; no frontend or proving artifacts changed.');
