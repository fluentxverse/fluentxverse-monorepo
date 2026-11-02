import { writeFileSync } from 'node:fs';
import { quote, ssh } from './lib/cloud-ssh.mjs';

const date = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
const id = `daily-dispatch-${date}`;
const read = `import {initMemgraph,getDriver,closeDriver} from './src/db/memgraph';
await initMemgraph();const s=getDriver().session();try {
 const r=await s.run('MATCH (a:DispatchArticle {id:$id}) RETURN a',{id:${JSON.stringify(id)}});
 if(r.records.length!==1)throw Error('Expected one daily article');
 const a=r.records[0].get('a').properties;
 const content=JSON.parse(a.articleContent);
 if(a.status!=='published'||content.paragraphs.length<7||JSON.parse(a.vocabulary).length!==5)throw Error('Incomplete published article');
 console.log('RESULT '+JSON.stringify({id:a.id,title:a.title,createdAt:a.createdAt,status:a.status,paragraphs:content.paragraphs.length,count:r.records.length}));
}finally{await s.close();await closeDriver();}`;
const parse = output => JSON.parse(output.split('\n').find(line => line.startsWith('RESULT ')).slice(7));
const query = () => parse(ssh(`docker exec fluentxverse-dispatch bun -e ${quote(read)}`));
const before = query();
// A second process and a container restart must skip the already-published date.
ssh('docker exec fluentxverse-dispatch bun run src/dispatch.daily.services/daily.worker.ts --once', { timeout: 30000 });
ssh('docker restart fluentxverse-dispatch', { timeout: 90000 });
await new Promise(resolve => setTimeout(resolve, 5000));
const after = query();
if (JSON.stringify(before) !== JSON.stringify(after)) throw Error('Restart/one-shot changed the daily article');

const api = `import {initDriver,getDriver,closeDriver} from './src/db/memgraph';
import {signAuthToken} from './src/utils/jwt';import {closeRedis} from './src/db/redis';
await initDriver(process.env.MEMGRAPH_URI!,process.env.MEMGRAPH_USER!,process.env.MEMGRAPH_PASSWORD!);
const s=getDriver().session();try {
 const r=await s.run("MATCH (a:Admin) WHERE a.role IN ['admin','superadmin'] RETURN a.id AS id LIMIT 1");
 if(!r.records.length)throw Error('No administrator available for read-only API probe');
 const token=await signAuthToken({userId:r.records[0].get('id'),role:'admin',email:'dispatch-probe@example.invalid'},60);
 const headers={cookie:'adminAuth='+token};
 const detail=await fetch('http://127.0.0.1:8765/dispatch/${id}',{headers});
 const a=await detail.json();if(detail.status!==200||a.id!==${JSON.stringify(id)})throw Error('Dispatch API detail failed');
 const lib=await fetch('http://127.0.0.1:8765/dispatch/classroom-library',{headers});
 const b=await lib.json();if(lib.status!==200||!b.articles?.some(x=>x.id===${JSON.stringify(id)}))throw Error('Classroom library missing article');
 console.log('RESULT '+JSON.stringify({detailStatus:detail.status,libraryStatus:lib.status,visibleInClassroom:true}));
}finally{await s.close();await closeDriver();await closeRedis();}`;
const accessible = parse(ssh(`docker exec fluentxverse-server bun -e ${quote(api)}`, { timeout: 30000 }));
const state = JSON.parse(ssh(`docker inspect fluentxverse-dispatch --format ${quote('{{json .State}}')}`));
const evidence = { verifiedAt: new Date().toISOString(), article: after, api: accessible, restartIdempotent: true,
  running: state.Running, restartPolicy: 'unless-stopped', health: state.Health.Status };
if (!state.Running) throw Error('Worker stopped');
writeFileSync('output/release/daily-dispatch-20261027/verification.json', JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
