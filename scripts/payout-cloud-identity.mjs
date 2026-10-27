import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {ssh,quote} from './lib/cloud-ssh.mjs';
const state=join(homedir(),'.local/state/fluentxverse/payout-activation-20261025');mkdirSync(state,{recursive:true,mode:0o700});
const path=join(state,'identity.json');
let identity;
if(existsSync(path))identity=JSON.parse(readFileSync(path));
else{
  const source=`const admin=async(path,body)=>{const response=await fetch('http://127.0.0.1:8090/admin'+path,{method:body?'POST':'GET',headers:{'content-type':'application/json','X-GMR-Engine-Admin-Key':process.env.GMR_ENGINE_ADMIN_API_KEY||process.env.ENGINE_ADMIN_API_KEY},body:body?JSON.stringify(body):undefined});if(!response.ok)throw Error('Project administration failed '+response.status);return response.json();};
  const name='FluentXVerse Private Payouts',inventory=await admin('/apps'),old=inventory.apps.find(a=>a.name===name);
  const app=old||(await admin('/apps',{name,environment:'production',allowedChains:[8453],gasFreeEnabled:false,rateLimitPerMinute:30})).app;
  const generated=await admin('/apps/'+app.id+'/api-keys',{name:'Payout authorization server only',scopes:['contracts:read','contracts:write','transactions:read']});
  if(!generated.plaintext)throw Error('Project key not created');console.log(JSON.stringify({projectId:app.id,apiKey:generated.plaintext,parentProjectId:'2a798002-7ed3-4e98-853e-62306479b9da'}));`;
  identity=JSON.parse(ssh(`docker exec budol-gmr-engine-1 bun -e ${quote(source)}`,{timeout:60000}));
  writeFileSync(path,JSON.stringify(identity,null,2),{mode:0o600,flag:'wx'});
}
const live=JSON.parse(ssh('docker inspect budol-gmr-engine-1'))[0];
const env=Object.fromEntries(live.Config.Env.map(v=>[v.slice(0,v.indexOf('=')),v.slice(v.indexOf('=')+1)]));
const input={...identity,uri:env.GMR_ENGINE_MEMGRAPH_URI||env.ENGINE_MEMGRAPH_URI,user:env.GMR_ENGINE_MEMGRAPH_USER||env.ENGINE_MEMGRAPH_USER||'',password:env.GMR_ENGINE_MEMGRAPH_PASSWORD||env.ENGINE_MEMGRAPH_PASSWORD||''};
const source=`import neo4j from'neo4j-driver';const r=await Bun.stdin.json(),driver=neo4j.driver(r.uri,neo4j.auth.basic(r.user,r.password)),s=driver.session();
try{const result=await s.executeWrite(async tx=>{const rows=await tx.run("MATCH(owner:GMRAccount)-[:OWNS_ENGINE_APP]->(parent:EngineApp {id:$parent}),(a:EngineApp {id:$id}) SET a.parentProjectId=parent.id,a.moduleName='Private Payouts',a.updatedAt=$now MERGE(owner)-[:OWNS_ENGINE_APP]->(a) RETURN a.id AS id",{parent:r.parentProjectId,id:r.projectId,now:new Date().toISOString()});if(rows.records.length!==1)throw Error('Payout module ownership binding failed');return rows.records[0].get('id');});console.log(JSON.stringify({moduleLinked:true,projectId:result}));}finally{await s.close();await driver.close();}`;
console.log(ssh(`docker exec -i fluentxverse-server bun -e ${quote(source)}`,{input:JSON.stringify(input),timeout:30000}).trim());
