import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, symlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const release = 'output/release/lesson-registry-20261104', source = join(release, 'engine-source');
mkdirSync(release, { recursive: true });
if (!existsSync(source)) cpSync('output/release/dispute-mainnet-20261103/engine-source', source, {
  recursive: true, verbatimSymlinks: true, filter: p => !['node_modules', '.git'].includes(p.split('/').at(-1)),
});
if (!existsSync(join(source, 'node_modules'))) symlinkSync('/home/paulanthonyarriola/Desktop/budol/gmr-engine/node_modules', join(source, 'node_modules'), 'dir');
const write = (path, value) => { mkdirSync(join(source, path, '..'), { recursive: true }); writeFileSync(join(source, path), value); };
const edit = (file, before, after) => {
  const path = join(source, file), value = readFileSync(path, 'utf8');
  if (value.includes(after)) return;
  if (value.split(before).length !== 2) throw Error('Ambiguous registry preparation anchor: ' + file);
  writeFileSync(path, value.replace(before, after));
};
const digest = value => createHash('sha256').update(value).digest('hex');
const built = JSON.parse(readFileSync('smart-contracts/contracts/lesson-disputes/solidity/out/LessonRegistry.sol/LessonRegistry.json'));
const artifact = JSON.stringify({ abi: built.abi, bytecode: built.bytecode.object, runtime: built.deployedBytecode.object,
  compiler: '0.8.28+commit.7893614a', evmVersion: 'cancun' });
write('internal/contracts/lesson_registry/artifact.json', artifact);
write('internal/contracts/lesson_registry.go', `package contracts
import("crypto/sha256";_ "embed";"encoding/hex";"encoding/json";"errors")
//go:embed lesson_registry/artifact.json
var lessonRegistryArtifact []byte
func LessonRegistryArtifact()(LessonDisputesBuild,error){
 h:=sha256.Sum256(lessonRegistryArtifact);if hex.EncodeToString(h[:])!="${digest(artifact)}"{return LessonDisputesBuild{},errors.New("registry artifact integrity failure")}
 var a LessonDisputesBuild;if e:=json.Unmarshal(lessonRegistryArtifact,&a);e!=nil{return a,e};return a,nil
}
`);
if (!existsSync(join(source, 'scripts/lesson-registry-sync.ts'))) {
edit('internal/disputes/protocol.go', 'type Config struct {', 'type Config struct {\n\tLessonRegistry bool `json:"lessonRegistry,omitempty"`');
edit('internal/disputes/protocol.go', '\tu, e := url.Parse(c.FeedURL)', `\tfeedPath := "/internal/dispute-chain/events"
 if c.LessonRegistry {
  if c.ChainID != 421614 || (c.Mode != "pilot" && c.Mode != "observe") || !strings.HasPrefix(c.Epoch,"registry-") { return errors.New("registry writes are testnet-only with a separate epoch") }
  feedPath = "/internal/lesson-registry/events"
 }
 u, e := url.Parse(c.FeedURL)`);
edit('internal/disputes/protocol.go', '!strings.HasSuffix(u.Path, "/internal/dispute-chain/events")', '!strings.HasSuffix(u.Path, feedPath)');
edit('internal/disputes/protocol.go', 'type Event struct {', 'type Event struct {\n\tBookingRevision int64 `json:"bookingRevision,omitempty"`\n\tReasonCommitment string `json:"reasonCommitment,omitempty"`');
edit('internal/disputes/protocol.go', 'e.Version != 1 || e.Sequence', '(e.Version != 1 && e.Version != 2) || e.Sequence');
edit('internal/disputes/protocol.go', 'if e.CaseSequence != 1 || e.EndedAt < 1 {', 'if (e.Version == 1 && e.CaseSequence != 1) || (e.Version == 2 && e.CaseSequence < 2) || e.EndedAt < 1 {');
edit('internal/disputes/protocol.go', '\tswitch e.Kind {', `\tswitch e.Kind {
 case "booking", "booking_reschedule", "booking_cancel":
  if e.Version != 2 || e.BookingRevision < 1 || (e.Kind == "booking" && (e.CaseSequence != 1 || e.BookingRevision != 1)) || (e.Kind != "booking" && e.BookingRevision < 2) || (e.Kind == "booking_reschedule" && !nonzeroWord(e.ReasonCommitment)) {return e,errors.New("invalid booking event")}
`);
edit('internal/disputes/worker.go', 'artifact, err := contracts.LessonDisputesArtifact()', 'artifact, err := contracts.LessonDisputesArtifact()\n\tif w.Binding.LessonRegistry {artifact,err=contracts.LessonRegistryArtifact()}');
edit('internal/disputes/worker.go', 'cmd := exec.CommandContext(child, "bun", "scripts/dispute-sync.ts")', 'script:="scripts/dispute-sync.ts";if w.Binding.LessonRegistry {script="scripts/lesson-registry-sync.ts"}\n\tcmd := exec.CommandContext(child, "bun", script)');
edit('internal/disputes/worker.go', 'Version    int               `json:"version"`', 'Version    int               `json:"version"`\n\t\tChainID int64 `json:"chainId"`\n\t\tContract string `json:"contract"`');
edit('internal/disputes/worker.go', 'if page.Version != 1 || page.PolicyHash', 'version:=1;if w.Binding.LessonRegistry {version=2;if page.ChainID!=w.Binding.ChainID || !strings.EqualFold(page.Contract,w.Binding.Contract){return errors.New("registry feed binding mismatch")}}\n\tif page.Version != version || page.PolicyHash');
// Validate versions at BOTH intake and saved-record processing.
edit('internal/disputes/worker.go', 'e, err := DecodeEvent(raw, w.Binding.PolicyHash)', 'e, err := w.decode(raw)');
edit('internal/disputes/worker.go', 'event, err := DecodeEvent(record.Event, w.Binding.PolicyHash)', 'event, err := w.decode(record.Event)');
write('internal/disputes/registry.go', `package disputes
import("encoding/json";"errors")
func(w *Worker)decode(raw json.RawMessage)(Event,error){e,err:=DecodeEvent(raw,w.Binding.PolicyHash);if err!=nil{return e,err};expected:=1;if w.Binding.LessonRegistry{expected=2};if e.Version!=expected{return e,errors.New("event version does not match deployment binding")};return e,nil}
`);
}
// The same journal/finality/nonce-lock implementation is reused, with a separate artifact and transport.
if (!readFileSync(join(source, 'cmd/api/main.go'), 'utf8').includes('GMR_ENGINE_LESSON_REGISTRY_CONFIG_PATH')) {
  edit('cmd/api/main.go', '\terrs := make(chan error, 1)', `\tif path := os.Getenv("GMR_ENGINE_LESSON_REGISTRY_CONFIG_PATH"); path != "" {
  worker,err:=disputes.New(cfg,engineStore,path)
  if err!=nil {log.Fatalf("lesson registry sync configuration: %v",err)}
  if !worker.Binding.LessonRegistry {log.Fatal("lesson registry worker requires a v2 binding")}
  go worker.Run(runCtx)
 }
 errs := make(chan error, 1)`);
}
write('scripts/lesson-registry-sync.ts', `import{transport as legacyTransport}from"./dispute-sync";
import{createPublicClient,http,type Hex}from"viem";
export async function transport(request:any,account?:any){
 const c=request.config;
 if(!c?.lessonRegistry||c.chainId!==421614||!["pilot","observe"].includes(c.mode)||!c.epoch?.startsWith("registry-"))throw Error("Registry transport is testnet-only");
 if(request.action!=="inspect"&&c.mode!=="pilot")throw Error("Observer cannot write");
 if(request.action==="plan"&&["booking","booking_reschedule","booking_cancel"].includes(request.event?.kind)){
  const inspected=await legacyTransport({...request,action:"inspect"}) as {paused:boolean;approved:boolean};
  if(inspected.paused||!inspected.approved)throw Error("Registry not active under approved policy");
  const e=request.event;if(e.version!==2||e.policyHash!==c.policyHash)throw Error("Registry event binding mismatch");
  let operation:any;
  if(e.kind==="booking")operation={functionName:"recordBooking",args:[e.caseKey,e.commitment,e.policyHash],signer:"operator"};
  else{
   const client=createPublicClient({transport:http(request.rpcUrl)});
   const b:any=await client.readContract({address:c.contract as Hex,abi:request.artifact.abi,functionName:"getBooking",args:[e.caseKey]});
   if(Number(b.status)!==1||BigInt(e.bookingRevision)!==b.revision+1n)throw Error("Booking revision or status mismatch");
   operation={functionName:e.kind==="booking_cancel"?"cancelBooking":"rescheduleBooking",args:e.kind==="booking_cancel"?[e.caseKey,b.revision.toString(),e.commitment]:[e.caseKey,b.revision.toString(),e.commitment,e.policyHash,e.reasonCommitment],signer:"operator"};
  }
  return{operations:[operation]};
 }
 if(request.event&&request.event.version!==2)throw Error("Registry cannot consume legacy events");
 return legacyTransport(request,account);
}
if(import.meta.main){try{console.log(JSON.stringify(await transport(await Bun.stdin.json())))}catch{console.error("Registry synchronization deferred; retain journal");process.exitCode=1}}
`);
// Dedicated Sepolia deployment/replay CLI; existing production CLI and worker remain untouched.
for (const file of ['main.go', 'replay.go']) {
  let value = readFileSync(join(source, 'cmd/dispute-pilot', file), 'utf8')
    .replaceAll('contracts.LessonDisputesArtifact()', 'contracts.LessonRegistryArtifact()')
    .replaceAll('scripts/dispute-pilot.ts', 'scripts/lesson-registry-pilot.ts')
    .replaceAll('scripts/dispute-sync.ts', 'scripts/lesson-registry-sync.ts')
    .replaceAll('/app/deployments/dispute-pilot-20261102/', '/app/deployments/lesson-registry-pilot-20261104/')
    .replaceAll('lesson-dispute-sepolia-pilot:', 'lesson-registry-sepolia-pilot:')
    .replaceAll('lesson-dispute-sepolia-reconciler-test-only', 'lesson-registry-sepolia-reconciler-test-only')
    .replaceAll('Epoch: "manual-test-only"', 'Epoch: "registry-manual-test-only", LessonRegistry: true')
    .replaceAll('FeedURL: "http://127.0.0.1/internal/dispute-chain/events"', 'FeedURL: "http://127.0.0.1/internal/lesson-registry/events"');
  write('cmd/lesson-registry-pilot/' + file, value);
}
write('scripts/lesson-registry-pilot.ts', readFileSync(join(source, 'scripts/dispute-pilot.ts'), 'utf8'));
for (const file of ['registry_test.go']) cpSync('integrations/lesson-registry/engine/' + file, join(source, 'internal/disputes', file));
cpSync('integrations/lesson-registry/engine/lesson-registry.e2e.ts', join(source, 'scripts/lesson-registry.e2e.ts'));
mkdirSync(join(source, 'cmd/lesson-registry-observer-test'), { recursive: true });
cpSync('integrations/lesson-registry/engine/observer_main.go', join(source, 'cmd/lesson-registry-observer-test/main.go'));
const run = (command, args) => execFileSync(command, args, { cwd: source, stdio: 'inherit',
  env: { ...process.env, CGO_ENABLED: '0', GOCACHE: '/tmp/fxv-engine-go-cache' } });
run('gofmt', ['-w', 'internal/disputes', 'internal/contracts/lesson_registry.go', 'cmd/lesson-registry-pilot', 'cmd/api/main.go']);
run('go', ['test', './internal/disputes', './internal/store', './internal/contracts', './cmd/lesson-registry-pilot', './cmd/api']);
run('bunx', ['tsc', '--noEmit', '--target', 'esnext', '--module', 'esnext', '--moduleResolution', 'bundler', '--skipLibCheck', '--strict', '--types', 'bun', 'scripts/lesson-registry-sync.ts']);
run('bun', ['--no-env-file', 'scripts/lesson-registry.e2e.ts']);
mkdirSync(join(release, 'engine/scripts'), { recursive: true });
for (const name of ['api', 'lesson-registry-pilot']) run('go', ['build', '-buildvcs=false', '-trimpath', '-ldflags=-s -w', '-o', resolve(release, 'engine', name === 'api' ? 'gmr-engine' : name), './cmd/' + name]);
for (const file of ['dispute-sync.ts', 'lesson-registry-sync.ts', 'lesson-registry-pilot.ts', 'vault-account.ts']) cpSync(join(source, 'scripts', file), join(release, 'engine/scripts', file));
writeFileSync(join(release, 'engine/Dockerfile'), 'FROM fluentxverse-cloud/gmr-engine:dispute-mainnet-20261103\nCOPY gmr-engine lesson-registry-pilot /usr/local/bin/\nCOPY scripts/ /app/scripts/\n');
execFileSync('tar', ['-czf', join(release, 'engine.tar.gz'), '-C', join(release, 'engine'), '.']);
writeFileSync(join(release, 'prepared.json'), JSON.stringify({ image: 'fluentxverse-cloud/gmr-engine:lesson-registry-20261104',
  baseline: 'fluentxverse-cloud/gmr-engine:dispute-mainnet-20261103', artifactSHA256: digest(artifact), testnetOnly: true }));
