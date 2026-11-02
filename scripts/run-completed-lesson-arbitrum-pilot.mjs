import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { ssh, quote, sshOptions, cloudTarget } from './lib/cloud-ssh.mjs';

const live = process.argv.includes('--live'), reconcile = process.argv.includes('--reconcile');
if (live === reconcile) throw Error('Choose --live (one paid submission) or --reconcile (read only on chain)');
const local = 'output/release/completed-lesson-arbitrum-20261030';
const remote = '/opt/fluentxverse/releases/completed-lesson-arbitrum-20261030';
mkdirSync(local, { recursive: true });
if (live && existsSync(local + '/submission-intent.json') && !process.argv.includes('--resume-preflight'))
  throw Error('Existing submission intent; use --reconcile, or --resume-preflight only if no remote journal exists');
const program = readFileSync('fluentxverse-server/tests/completedLesson.arbitrum.pilot.ts', 'utf8');
const prepare = `import json,os,pathlib,subprocess
root=pathlib.Path(${JSON.stringify(remote)})
root.mkdir(mode=0o700,parents=True,exist_ok=True)
api=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-server']))[0]
db=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-memgraph']))[0]
engine=json.loads(subprocess.check_output(['docker','inspect','budol-gmr-engine-1']))[0]
network=next(n for n in api['NetworkSettings']['Networks'] if n in db['NetworkSettings']['Networks'])
engine_network=next(n for n in api['NetworkSettings']['Networks'] if n in engine['NetworkSettings']['Networks'])
env=dict(v.split('=',1) for v in api['Config']['Env'])
selected={k:v for k,v in env.items() if k.startswith(('PAYOUT_','GMR_PAYOUT_')) or k=='PROOF_DESTINATION_MODE'}
if selected.get('PROOF_DESTINATION_MODE')!='project' or selected.get('PAYOUT_PROOF_SUBMISSIONS_ENABLED')!='true':raise RuntimeError('Live payout proof configuration differs')
if ${live ? 'True' : 'False'} and (root/'journal.json').exists():raise RuntimeError('Journal exists; do not resend')
selected.update(RUN_COMPLETED_LESSON_PILOT='one-authorized-arbitrum-submission',PILOT_GRAPH='bolt://fxv-completed-lesson-pilot-20261030:7687',PILOT_ACTION=${JSON.stringify(live ? 'live' : 'reconcile')})
if any('\\n' in v or '\\r' in v for v in selected.values()):raise RuntimeError('Unexpected environment encoding')
fd=os.open(root/'runner.env',os.O_CREAT|os.O_WRONLY|os.O_TRUNC,0o600)
with os.fdopen(fd,'w') as f:f.write(''.join(k+'='+v+'\\n' for k,v in selected.items()))
name='fxv-completed-lesson-pilot-20261030'
exists=subprocess.run(['docker','inspect',name],capture_output=True).returncode==0
if exists:
 existing=json.loads(subprocess.check_output(['docker','inspect',name]))[0]
 if existing['Config']['Labels'].get('fluentxverse.purpose')!='completed-lesson-proof-pilot':raise RuntimeError('Unexpected pilot container')
 if '--memory-limit=256' in existing['Config']['Cmd']:
  if (root/'journal.json').exists() or existing['State']['Running']:raise RuntimeError('Cannot resize an active or journaled pilot')
  subprocess.check_call(['docker','rm',name],stdout=subprocess.DEVNULL)
  exists=False
if not exists:
 if not ${live ? 'True' : 'False'}:raise RuntimeError('Pilot graph unavailable')
 subprocess.check_call(['docker','run','-d','--name',name,'--label','fluentxverse.purpose=completed-lesson-proof-pilot','--restart=no','--memory=768m','--cpus=0.5','--network',network,'-v',name+':/var/lib/memgraph',db['Image'],'--memory-limit=512'])
else:
 existing=json.loads(subprocess.check_output(['docker','inspect',name]))[0]
 if existing['Config']['Labels'].get('fluentxverse.purpose')!='completed-lesson-proof-pilot':raise RuntimeError('Unexpected pilot container')
 subprocess.check_call(['docker','start',name],stdout=subprocess.DEVNULL)
(root/'runtime.json').write_text(json.dumps({'image':api['Image'],'network':network,'engineNetwork':engine_network,'uid':os.getuid(),'gid':os.getgid()}))
print(json.dumps({'event':'isolated-pilot-ready','productionFinancialWrites':0}))
`;
console.log(ssh('python3 -c ' + quote(prepare), { timeout: 60000 }));
writeFileSync(local + '/pilot.ts', program);
execFileSync('scp', [...sshOptions, local + '/pilot.ts', cloudTarget + ':' + remote + '/pilot.ts'], { stdio: 'inherit', timeout: 30000 });
if (live && !existsSync(local + '/submission-intent.json'))
  writeFileSync(local + '/submission-intent.json', JSON.stringify({ startedAt: new Date().toISOString(), maximumSubmissions: 1 }), { flag: 'wx', mode: 0o600 });
const run = `import json,subprocess
from pathlib import Path
root=Path(${JSON.stringify(remote)})
r=json.loads((root/'runtime.json').read_text())
try:
 subprocess.check_call(['docker','create','--rm','--name','fxv-completed-lesson-pilot-runner','--restart=no','--no-healthcheck','--user',str(r['uid'])+':'+str(r['gid']),'--memory=768m','--cpus=1','--network',r['network'],'--env-file',str(root/'runner.env'),'-v',str(root)+':/pilot','-v',str(root/'pilot.ts')+':/app/tests/completedLesson.arbitrum.pilot.ts:ro','--workdir','/app','--entrypoint','bun',r['image'],'--no-env-file','tests/completedLesson.arbitrum.pilot.ts'],stdout=subprocess.DEVNULL)
 if r['engineNetwork']!=r['network']:subprocess.check_call(['docker','network','connect',r['engineNetwork'],'fxv-completed-lesson-pilot-runner'])
 result=subprocess.run(['docker','start','-a','fxv-completed-lesson-pilot-runner'])
 raise SystemExit(result.returncode)
finally:
 subprocess.run(['docker','stop','fxv-completed-lesson-pilot-20261030'],stdout=subprocess.DEVNULL)
 (root/'runner.env').unlink(missing_ok=True)
`;
try {
  console.log(ssh('python3 -c ' + quote(run), { timeout: 600000, maxBuffer: 1024 * 1024 }));
} finally {
  // This journal contains synthetic evidence identifiers and public transaction/receipt data only.
  try {
    const journal = ssh('test -f ' + quote(remote + '/journal.json') + ' && cat ' + quote(remote + '/journal.json'), { timeout: 30000 });
    writeFileSync(local + '/journal.json', JSON.stringify(JSON.parse(journal), null, 2) + '\n', { mode: 0o600 });
  } catch { console.error('No journal retrieved; inspect the remote pilot before any retry.'); }
}
