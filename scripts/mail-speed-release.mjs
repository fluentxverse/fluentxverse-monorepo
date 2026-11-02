import {execFileSync} from 'node:child_process';
import {ssh,quote} from './lib/cloud-ssh.mjs';
const mode=process.argv[2];if(!['--prepare','--activate'].includes(mode))throw Error('Use --prepare or --activate');
const dir='/opt/fluentxverse/releases/mail-speed-20261031',image='fluentxverse-cloud/api:mail-speed-20261031';
if(mode==='--prepare'){
 const bundle=execFileSync('tar',['-czf','-','fluentxverse-server/src/services/mail/mailProvider.ts','fluentxverse-server/src/services/mail/mailConnectionPool.ts']);
 ssh(`install -d -m 700 ${quote(dir)} && tar -xzf - -C ${quote(dir)}`,{input:bundle});
}
const code=String.raw`
import json,subprocess,os,tempfile
from pathlib import Path
p=Path('${dir}');image='${image}'
def run(args):return subprocess.check_output(args,text=True)
old=json.loads(run(['docker','inspect','fluentxverse-server']))[0]
expected='fluentxverse-cloud/api:project-destinations-20261029-enrollment'
if old['Config']['Image']!=expected:raise Exception('Live API changed; review release base')
if '${mode}'=='--prepare':
 (p/'Dockerfile').write_text('FROM '+expected+'\nCOPY fluentxverse-server/src/services/mail /app/src/services/mail\n')
 subprocess.run(['docker','build','-t',image,str(p)],check=True,stdout=subprocess.DEVNULL)
 env=dict(x.split('=',1) for x in old['Config']['Env'])
 minimal={k:env[k] for k in ['TUTOR','MAIL_ACCOUNTS_JSON'] if k in env}
 if 'MAIL_ACCOUNTS_JSON' in minimal:
  accounts=json.loads(minimal['MAIL_ACCOUNTS_JSON']);accounts=[a for a in accounts if a['address'].lower()=='tutor@fluentxverse.com']
  minimal['MAIL_ACCOUNTS_JSON']=json.dumps(accounts)
  for a in accounts:
   for protocol in ['smtp','imap']:
    key=a[protocol]['passwordEnv']
    if key in env:minimal[key]=env[key]
 fd,name=tempfile.mkstemp(dir=p);os.fchmod(fd,0o600)
 try:
  with os.fdopen(fd,'w') as f:f.write('\n'.join(k+'='+v for k,v in minimal.items()))
  program="""import{mailConfigs}from './src/services/mail/mailConfig';import{mailProvider,closeMailConnections}from './src/services/mail/mailProvider';const a=mailConfigs().find(a=>a.address==='tutor@fluentxverse.com');if(!a)throw Error('Tutor mailbox unavailable');try{for(let i=0;i<3;i++){let t=performance.now();await mailProvider.folders(a);const foldersMs=Math.round(performance.now()-t);t=performance.now();await mailProvider.list(a,'INBOX',1,'','all');console.log(JSON.stringify({iteration:i,foldersMs,inboxMs:Math.round(performance.now()-t)}));}}finally{closeMailConnections();} """
  report=run(['docker','run','--rm','--env-file',name,image,'bun','-e',program])
  (p/'benchmark.txt').write_text(report);print(report)
 finally:os.unlink(name)
 (p/'verified.json').write_text(json.dumps({'image':image,'base':expected,'imageId':run(['docker','image','inspect','--format','{{.Id}}',image]).strip()}))
else:
 verified=json.loads((p/'verified.json').read_text())
 if verified['imageId']!=run(['docker','image','inspect','--format','{{.Id}}',image]).strip():raise Exception('Verified image changed')
 check="""import{query,closePool}from './src/db/postgres';try{const r=await query(\"SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'\");if(r.rows[0].n)throw Error('Active classrooms: defer restart');}finally{await closePool();}"""
 subprocess.run(['docker','exec','fluentxverse-server','bun','-e',check],check=True)
 labels=old['Config']['Labels'];service=labels['com.docker.compose.service'];project=labels['com.docker.compose.project']
 args=['docker','compose','-p',project]
 for f in labels['com.docker.compose.project.config_files'].split(','):args+=['-f',f]
 override=p/'override.json';rollback=p/'rollback.json'
 override.write_text(json.dumps({'services':{service:{'image':image}}}));rollback.write_text(json.dumps({'services':{service:{'image':expected}}}))
 (p/'runtime-before.json').write_text(json.dumps(old));(p/'runtime-before.json').chmod(0o600)
 try:
  subprocess.run(args+['-f',str(override),'up','-d','--no-deps',service],check=True)
  new=json.loads(run(['docker','inspect','fluentxverse-server']))[0]
  mounts=lambda c:sorted((m['Type'],m['Source'],m['Destination'],m['RW']) for m in c['Mounts'])
  if sorted(new['Config']['Env'])!=sorted(old['Config']['Env']) or mounts(new)!=mounts(old) or new['HostConfig']['PortBindings']!=old['HostConfig']['PortBindings'] or set(new['NetworkSettings']['Networks'])!=set(old['NetworkSettings']['Networks']):raise Exception('Runtime configuration changed; rolling back')
  import time,urllib.request
  for i in range(30):
   try:
    if urllib.request.urlopen('http://127.0.0.1:8765/health',timeout=3).status==200:break
   except Exception:time.sleep(2)
  else:raise Exception('API health check failed')
  print(json.dumps({'deployed':image,'base':expected,'health':200}))
 except Exception:
  subprocess.run(args+['-f',str(rollback),'up','-d','--no-deps',service],check=True);raise
`;
console.log(ssh('python3 -c '+quote(code)));
