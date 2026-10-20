import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

if(!process.argv.includes('--deploy'))throw new Error('Use --deploy after the feature-only production previews pass.');
const root=fileURLToPath(new URL('../',import.meta.url));
const release=path.join(root,'output/release/lesson-dispute-20261018');
const previous={student:'b6e22900-3bab-41ef-9ad1-7c4105c665d8',tutor:'dd3d7ffb-43dd-46d2-bc5f-c2b48e0b65af',dashboard:'a45954a2-fdcd-44d8-af13-ab24017732c2'};
const directories=Object.fromEntries(['student','tutor','dashboard'].map(app=>[app,path.join(release,'frontends',app==='dashboard'?'fluentxverse-dashboard':`fluentxverse-${app}-solid-prototype`)]));
const keys=Object.values(parseEnv(readFileSync(path.join(root,'fluentxverse-server/config/lesson-privacy.env'),'utf8'))).filter(value=>value.length>32);
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(dir,entry.name)):[path.join(dir,entry.name)]);}
for(const dir of Object.values(directories))for(const file of files(path.join(dir,'dist'))){
  const bytes=readFileSync(file);
  if(keys.some(key=>bytes.includes(Buffer.from(key))))throw new Error('A private evidence key was found in frontend output. Deployment blocked.');
}
console.log('PASS frontend output does not contain evidence encryption/signing keys.');
function wrangler(app,args){
  const result=spawnSync('bunx',['--bun','wrangler@4.151.1',...args,'--config','wrangler.jsonc'],{cwd:directories[app],env:{...process.env,CI:'1'},encoding:'utf8',maxBuffer:8*1024*1024});
  if(result.status!==0)throw new Error(`${app} Wrangler ${args[0]} failed: ${result.stderr||result.stdout}`);
  return result.stdout;
}
const report={createdAt:new Date().toISOString(),previous,versions:{},apiKeyId:JSON.parse(readFileSync(path.join(release,'api-release.json'),'utf8')).keyId};
for(const app of Object.keys(directories)){
  const output=wrangler(app,['deployments','list']);
  const versions=[...output.matchAll(/Version\(s\):\s+\(100%\)\s+([a-f0-9-]{36})/g)];
  if(versions.at(-1)?.[1]!==previous[app])throw new Error(`${app} deployment changed. Review its new version before replacing it.`);
}
const completed=[];
try{
  for(const app of Object.keys(directories)){
    console.log(`Deploying feature-only ${app} assets...`);
    const output=wrangler(app,['deploy']);
    const version=output.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];
    if(!version)throw new Error(`${app} deployed but the version ID could not be recorded; inspect it before proceeding.`);
    completed.push(app);report.versions[app]=version;
    writeFileSync(path.join(release,'frontend-release.json'),JSON.stringify(report,null,2)+'\n');
    console.log(`PASS ${app}: ${version}`);
  }
}catch(error){
  for(const app of completed.reverse()){
    console.error(`Restoring previous ${app} assets after the interrupted release.`);
    wrangler(app,['rollback',previous[app],'--message','Restore assets after incomplete lesson-evidence release']);
  }
  throw error;
}
console.log('PASS all three public frontends deployed.');
