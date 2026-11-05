import { cpSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const release = 'output/release/lesson-registry-batching-20261104', source = join(release, 'engine-source');
mkdirSync(release, { recursive: true });
cpSync('output/release/lesson-registry-mainnet-20261104/engine-source', source, { recursive: true, verbatimSymlinks: true,
  filter: p => !['node_modules', '.git'].includes(p.split('/').at(-1)) });
if (!existsSync(join(source, 'node_modules'))) symlinkSync('/home/paulanthonyarriola/Desktop/budol/gmr-engine/node_modules', join(source, 'node_modules'), 'dir');
const edit = (file, before, after) => {
  const p = join(source, file), s = readFileSync(p, 'utf8');
  if (s.split(before).length !== 2) throw Error('Ambiguous batch anchor: ' + file);
  writeFileSync(p, s.replace(before, after));
};
for (const [from, to] of [['batch_store.go', 'internal/store/registry_batch.go'], ['batch_worker.go', 'internal/disputes/registry_batch.go'],
  ['batch_test.go', 'internal/disputes/registry_batch_test.go'], ['batch_store_test.go', 'internal/store/registry_batch_test.go'],
  ['batch.e2e.ts', 'scripts/registry-batch.e2e.ts'], ['production-batch-test.ts', 'scripts/production-batch-test.ts']]) cpSync('integrations/lesson-registry/engine/' + from, join(source, to));
edit('scripts/registry-production.e2e.ts', "import assert from 'node:assert/strict';", "import assert from 'node:assert/strict';\nimport {testProductionBatch} from './production-batch-test';");
edit('scripts/registry-production.e2e.ts', "  console.log('PASS pinned mainnet", "  await testProductionBatch({transport,config,rpcUrl,artifact,operator,client,rpc});\n  console.log('PASS pinned mainnet");
edit('internal/store/dispute_sync.go', 'type DisputeSyncRecord struct {', `type DisputeSyncRecord struct {
 BatchLeader string \`json:"batchLeader,omitempty"\`
 BatchMembers []string \`json:"batchMembers,omitempty"\`
 BatchEvents []json.RawMessage \`json:"batchEvents,omitempty"\`
 BatchState string \`json:"batchState,omitempty"\`
 BatchHash string \`json:"batchHash,omitempty"\``);
edit('internal/disputes/worker.go', 'type Worker struct {', 'type Worker struct {\n batchLimit int');
edit('internal/disputes/worker.go', '\tw.call = w.command', '\tif binding.LessonRegistry {w.batchLimit,err=registryBatchLimit();if err!=nil{return nil,err}}\n w.call = w.command');
edit('internal/disputes/worker.go', '\tif record.State == "review" {', ` record,err=w.bookingBatch(ctx,record);if err!=nil{return err}
 if record.BatchLeader!="" {if err=w.validateBookingBatch(record);err!=nil{return err}}
 if record.State == "review" && record.BatchLeader=="" {`);
edit('internal/disputes/worker.go', 'if err = w.call(ctx, map[string]any{"action": "prepare",', 'if err = w.recordCall(ctx, record, map[string]any{"action": "prepare",');
edit('internal/disputes/worker.go', 'if err = w.call(ctx, map[string]any{"action": "broadcast",', 'if err = w.recordCall(ctx, record, map[string]any{"action": "broadcast",');
edit('internal/disputes/worker.go', '\tvar status result\n', ` if record.BatchLeader!="" {var checked struct{Valid bool \`json:"valid"\`};if err=w.recordCall(ctx,record,map[string]any{"action":"validateBatch","event":event,"operation":op,"raw":record.Raw,"hash":record.Hash,"wallet":record.Wallet},&checked);err!=nil{return err};if !checked.Valid{return errors.New("signed batch validation failed")}}
 var status result
`);
edit('internal/disputes/worker.go', '\tif status.Found && status.Finalized {', ` if status.Found && status.Finalized {
  if record.BatchLeader!="" {db,ok:=w.db.(batchJournal);if !ok{return errors.New("durable batch journal unavailable")};return db.DisputeSyncFinalizeBatch(ctx,binding,*record,w.Binding.ProjectID,wallet,lockID,status.BlockHash)}`);
const worker = join(source, 'internal/disputes/worker.go');
writeFileSync(worker, readFileSync(worker, 'utf8').replaceAll('w.db.DisputeSyncSave(ctx,', 'w.saveRecord(ctx,'));
const ts = join(source, 'scripts/lesson-registry-sync.ts');
writeFileSync(ts, readFileSync(ts, 'utf8').replace('createPublicClient,http,type Hex', 'createPublicClient,http,encodeFunctionData,parseTransaction,recoverTransactionAddress,keccak256,type Hex'));
edit('scripts/lesson-registry-sync.ts', 'if(request.action==="plan"&&', `if(request.events!==undefined){
  const events=request.events;
  if(!Array.isArray(events)||events.length<2||events.length>32||!request.event||["version","kind","id","sequence","caseSequence","bookingRevision","caseKey","commitment","policyHash"].some(k=>request.event[k]!==events[0][k]))throw Error("Invalid batch membership");
  const keys=new Set(),ids=new Set();
  for(let i=0;i<events.length;i++){const e=events[i];if(e.version!==2||e.kind!=="booking"||e.caseSequence!==1||e.bookingRevision!==1||e.policyHash!==c.policyHash||!Number.isSafeInteger(e.sequence)||e.sequence<1||e.sequence!==events[0].sequence+i||typeof e.id!=="string"||!e.id||!/^0x[0-9a-f]{64}$/.test(e.caseKey)||!/^0x[0-9a-f]{64}$/.test(e.commitment)||/^0x0+$/.test(e.caseKey)||/^0x0+$/.test(e.commitment)||keys.has(e.caseKey)||ids.has(e.id))throw Error("Invalid batch member");keys.add(e.caseKey);ids.add(e.id)}
  const operation={functionName:"recordBookings",args:[events.map((e:any)=>({lessonKey:e.caseKey,commitment:e.commitment,policyHash:e.policyHash}))],signer:"operator"};
  if(request.action==="plan"){const state:any=await legacyTransport({...request,action:"inspect"});if(state.paused||!state.approved)throw Error("Registry not active under approved policy");return{operations:[operation]}}
  if(["prepare","broadcast","simulate","validateBatch"].includes(request.action)){if(request.operation?.signer!=="operator"||request.operation?.functionName!=="recordBookings"||encodeFunctionData({abi:request.artifact.abi,...operation})!==encodeFunctionData({abi:request.artifact.abi,...request.operation}))throw Error("Batch operation differs from frozen members")}
  if(request.action==="validateBatch"){const tx=parseTransaction(request.raw),signer=await recoverTransactionAddress({serializedTransaction:request.raw});if(keccak256(request.raw)!==request.hash||tx.chainId!==c.chainId||tx.to?.toLowerCase()!==c.contract.toLowerCase()||(tx.value||0n)!==0n||tx.data!==encodeFunctionData({abi:request.artifact.abi,...operation})||signer.toLowerCase()!==c.operator.toLowerCase()||signer.toLowerCase()!==request.wallet?.toLowerCase())throw Error("Signed batch differs from frozen members");return{valid:true}}
 }else if(request.operation?.functionName==="recordBookings")throw Error("Batch operation requires frozen members");
 if(request.action==="plan"&&`);
const run = (command, args) => execFileSync(command, args, { cwd: source, stdio: 'inherit', env: { ...process.env, CGO_ENABLED: '0', GOCACHE: '/tmp/fxv-engine-go-cache' } });
run('gofmt', ['-w', 'internal/store/dispute_sync.go', 'internal/store/registry_batch.go', 'internal/store/registry_batch_test.go', 'internal/disputes/worker.go', 'internal/disputes/registry_batch.go', 'internal/disputes/registry_batch_test.go']);
run('go', ['test', './internal/disputes', './internal/store', './internal/contracts', './cmd/api']);
run('bunx', ['tsc', '--noEmit', '--target', 'esnext', '--module', 'esnext', '--moduleResolution', 'bundler', '--skipLibCheck', '--strict', '--types', 'bun', 'scripts/lesson-registry-sync.ts']);
run('bun', ['--no-env-file', 'scripts/registry-batch.e2e.ts']);
run('bun', ['--no-env-file', 'scripts/lesson-registry.e2e.ts']);
run('bun', ['--no-env-file', 'scripts/registry-production.e2e.ts']);
mkdirSync(join(release, 'engine/scripts'), { recursive: true });
run('go', ['build', '-buildvcs=false', '-trimpath', '-ldflags=-s -w', '-o', resolve(release, 'engine/gmr-engine'), './cmd/api']);
cpSync(ts, join(release, 'engine/scripts/lesson-registry-sync.ts'));
writeFileSync(join(release, 'engine/Dockerfile'), 'FROM fluentxverse-cloud/gmr-engine:lesson-registry-mainnet-20261104\nCOPY gmr-engine /usr/local/bin/gmr-engine\nCOPY scripts/ /app/scripts/\n');
execFileSync('tar', ['-czf', join(release, 'engine.tar.gz'), '-C', join(release, 'engine'), '.']);
writeFileSync(join(release, 'prepared.json'), JSON.stringify({ image: 'fluentxverse-cloud/gmr-engine:lesson-registry-batching-20261104', baseline: 'fluentxverse-cloud/gmr-engine:lesson-registry-mainnet-20261104', batchSize: 32, contractUnchanged: true }));
