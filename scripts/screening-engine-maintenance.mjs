import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const state = join(homedir(), '.local/state/fluentxverse/screening-production-20261022');
const backup = JSON.parse(readFileSync(join(state, 'runtime-backup.json'))), identity = JSON.parse(readFileSync(join(state, 'identity.json')));
const env = Object.fromEntries(backup.engine.Config.Env.map(v => [v.slice(0, v.indexOf('=')), v.slice(v.indexOf('=') + 1)]));
const dbEnv = Object.fromEntries(['URI', 'USER', 'PASSWORD'].map(k => ['DB_' + k, env['GMR_ENGINE_MEMGRAPH_' + k] || env['ENGINE_MEMGRAPH_' + k] || '']));
const envFile = join(state, 'graph-maintenance.env');
writeFileSync(envFile, Object.entries(dbEnv).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });
const source = `import neo4j from 'neo4j-driver';
const input=await Bun.stdin.json(),d=neo4j.driver(process.env.DB_URI,neo4j.auth.basic(process.env.DB_USER,process.env.DB_PASSWORD)),s=d.session();
try{
 const pending=await s.run("MATCH(n) WHERE (n:EngineTransaction OR n:ZKProofSubmission) AND n.status IN ['queued','signing','deploying','processing','pending','submitting','submitted'] RETURN labels(n)[0] AS kind,n.status AS status,n.transactionResult AS result");
 for(const row of pending.records){let result={};try{result=JSON.parse(row.get('result')||'{}');}catch{}
 if(!(row.get('kind')==='ZKProofSubmission'&&result.status==='finalized'))throw Error('Unsettled Engine operation; defer release');}
 if(input.link){const r=await s.run("MATCH(owner:GMRAccount)-[:OWNS_ENGINE_APP]->(parent:EngineApp {id:$parent}),(app:EngineApp {id:$id}) SET app.parentProjectId=parent.id,app.moduleName='Screening',app.updatedAt=$now MERGE(owner)-[:OWNS_ENGINE_APP]->(app) RETURN app.id AS id",{parent:input.parent,id:input.id,now:new Date().toISOString()});if(r.records.length!==1)throw Error('Project owner binding failed');}
 console.log(JSON.stringify({unsettledOperations:0,historicalFinalizedJournals:pending.records.length,moduleLinked:input.link}));
}finally{await s.close();await d.close();}`;
try {
 const result = execFileSync('docker', ['run', '--rm', '-i', '--network', Object.keys(backup.engine.NetworkSettings.Networks)[0],
   '--env-file', envFile, backup.api.Config.Image, 'bun', '-e', source], { encoding: 'utf8',
   input: JSON.stringify({ link: process.argv.includes('--link-module'), id: identity.projectId, parent: identity.parentProjectId }), timeout: 30000 });
 console.log(result.trim());
} finally { rmSync(envFile, { force: true }); }
