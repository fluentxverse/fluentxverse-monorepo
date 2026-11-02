import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {ssh,sshOptions,cloudHost,quote} from './lib/cloud-ssh.mjs';
const rootSSH=command=>execFileSync('ssh',[...sshOptions,'root@'+cloudHost,command],{encoding:'utf8',timeout:180000,maxBuffer:4e6});
const stage='/opt/fluentxverse/releases/tutor-identity-activation-20261102';
if(process.argv.includes('--storage')||process.argv.includes('--activate'))throw Error('RAM retention is retired. Use the private SeaweedFS deployment; --verify remains a synthetic HTTP test.');
if(process.argv.includes('--storage')){
 const code=String.raw`
import json,os,subprocess
from pathlib import Path
stage=Path('/opt/fluentxverse/releases/tutor-identity-activation-20261102');stage.mkdir(mode=0o700,parents=True,exist_ok=True)
fstab=Path('/etc/fstab');old=fstab.read_text()
backup=stage/'fstab.before';
if not backup.exists(): backup.write_text(old);backup.chmod(0o600)
# tmpfs is not enough: anonymous process memory must not spill onto disk either.
swaps=[line.split() for line in Path('/proc/swaps').read_text().splitlines()[1:]]
for entry in swaps:
 name=entry[0]
 if name.startswith('/dev/zram'):
  backing=Path('/sys/block/'+name.split('/')[-1]+'/backing_dev').read_text().strip()
  if backing!='none': raise RuntimeError('zram has disk writeback configured')
 elif name=='/swap.img':
  subprocess.run(['swapoff',name],check=True)
 else: raise RuntimeError('Unexpected disk swap; review manually')
lines=[]
for line in old.splitlines():
 parts=line.split()
 if parts and parts[0]=='/swap.img' and not line.lstrip().startswith('#'): line='# Disabled for private ID RAM storage: '+line
 lines.append(line)
mount='/run/fluentxverse-tutor-identity'
if not any(not x.lstrip().startswith('#') and len(x.split())>1 and x.split()[1]==mount for x in lines):
 lines.append('tmpfs '+mount+' tmpfs rw,noswap,noexec,nosuid,nodev,size=128m,mode=0700,uid=100,gid=101 0 0')
fstab.write_text('\n'.join(lines)+'\n')
Path(mount).mkdir(mode=0o700,exist_ok=True)
if subprocess.run(['mountpoint','-q',mount]).returncode: subprocess.run(['mount',mount],check=True)
options=subprocess.check_output(['findmnt','-n','-o','FSTYPE,OPTIONS','--target',mount],text=True).strip()
if 'tmpfs' not in options or 'noswap' not in options: raise RuntimeError('Private mount is not non-swappable tmpfs')
if Path('/sys/kernel/kexec_crash_loaded').read_text().strip()!='0': raise RuntimeError('Kernel crash dump enabled; review before collection')
drop=Path('/etc/systemd/system/docker.service.d/40-fluentxverse-identity-storage.conf');drop.parent.mkdir(parents=True,exist_ok=True)
drop.write_text('[Unit]\nRequiresMountsFor='+mount+'\n')
subprocess.run(['systemctl','daemon-reload'],check=True)
print(json.dumps({'privateMount':mount,'noswap':True,'diskSwapDisabled':True,'zramDiskWriteback':False,'dockerRestarted':False}))
`;
 console.log(rootSSH('python3 -c '+quote(code)));
}else if(process.argv.includes('--activate')){
 const meta=ssh('docker inspect fluentxverse-server --format '+quote('{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.project.config_files"}}')).trim().split('|');
 const config={services:{api:{environment:{TUTOR_IDENTITY_ENABLED:'true',TUTOR_IDENTITY_PRIVATE_DIR:'/run/tutor-identity'},volumes:['/run/fluentxverse-tutor-identity:/run/tutor-identity:Z'],ulimits:{core:{soft:0,hard:0}}}}};
 const checks=`import{db,closePool}from'./src/db/postgres';import{initDriver,getDriver,closeDriver}from'./src/db/memgraph';import{interviewStart}from'./src/services/interview.services/interviewTime';await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD,1);const s=getDriver().session();try{const active=await db.unsafe("SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'");const e=await s.run("MATCH(e:Exam) WHERE e.status IN ['generating','queued','processing'] RETURN count(e) AS n");const i=await s.run("MATCH(s:InterviewSlot {status:'booked'}) WHERE s.mediaClosedAt IS NULL RETURN s.date AS date,s.time AS time");if(active[0].n||Number(e.records[0].get('n'))||i.records.some(r=>{const t=interviewStart(r.get('date'),r.get('time'));return Date.now()>=t-900000&&Date.now()<t+1800000;}))throw Error('Active work: defer restart');console.log('No active classrooms, interviews or grading jobs.');}finally{await s.close();await closeDriver();await closePool();}`;
 console.log(ssh('docker exec fluentxverse-server bun --no-env-file -e '+quote(checks)));
 const code=`import json,os,subprocess\nfrom pathlib import Path\np=Path('${stage}/override.json');p.write_text(${JSON.stringify(JSON.stringify(config))});p.chmod(0o600)\nargs=${JSON.stringify(['docker','compose','-p',meta[0],...meta[1].split(',').flatMap(f=>['-f',f])])}\nsubprocess.run(args+['-f',str(p),'up','-d','--no-deps','--wait','--wait-timeout','120','api'],check=True)`;
 console.log(rootSSH('python3 -c '+quote(code)));
}else if(process.argv.includes('--verify')){
 const source=String.raw`import { initDriver,getDriver,closeDriver } from './src/db/memgraph';import { signAuthToken } from './src/utils/jwt';import { identityStorage } from './src/services/tutorIdentity/storage';
await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD,1);const s=getDriver().session(),id='identity-activation-'+crypto.randomUUID();let submission;
try{
 if(process.env.TUTOR_IDENTITY_ENABLED!=='true')throw Error('Collection disabled');
 await s.run("CREATE(:User {id:$id,role:'tutor',email:$email,verifiedEmail:true,verifiedEmailAddress:$email,writtenExamPassed:true,speakingExamPassed:true})",{id,email:id+'@example.invalid'});
 const token=await signAuthToken({userId:id,email:id+'@example.invalid',role:'tutor'},60);
 const form=new FormData();form.set('idType','national');form.set('birthDate','2000-01-01');form.set('consent','true');form.set('image',new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=','base64')],'synthetic.png',{type:'image/png'}));
 const response=await fetch('http://127.0.0.1:8765/tutor-identity/submit',{method:'POST',headers:{origin:'https://tutor.fluentxverse.com',cookie:'tutorAuth='+token},body:form});const body=await response.json();
 if(!response.ok||!body.success||body.data?.record?.status!=='pending_review')throw Error('Synthetic upload failed: '+response.status+' '+JSON.stringify(body));
 submission=body.data.record.id;const bytes=await identityStorage.get(submission);if(bytes[0]!==255||bytes[1]!==216)throw Error('Private JPEG check failed');
 const denied=await fetch('http://127.0.0.1:8765/tutor-identity/admin/'+submission+'/image',{headers:{origin:'https://dashboard.fluentxverse.com'}});if(denied.status!==403)throw Error('Private image access not protected');
 console.log(JSON.stringify({collectionEnabled:true,realHttpUploadPassed:true,encryptedReadbackPassed:true,unauthorizedReadDenied:true,syntheticOnly:true}));
}finally{const rows=await s.run('MATCH(i:TutorIdentity {tutorId:$id}) RETURN i.id AS id',{id});for(const row of rows.records)await identityStorage.remove(row.get('id'));await s.run('MATCH(i:TutorIdentity {tutorId:$id}) DETACH DELETE i',{id});await s.run('MATCH(u:User {id:$id}) DETACH DELETE u',{id});await s.close();await closeDriver();}`;
 const output=ssh('docker exec fluentxverse-server bun --no-env-file -e '+quote(source),{timeout:60000});console.log(output);
 mkdirSync(join(process.cwd(),'output/release/tutor-identity-activation-20261102'),{recursive:true});writeFileSync(join(process.cwd(),'output/release/tutor-identity-activation-20261102/verification.json'),JSON.stringify({output,at:new Date().toISOString()},null,2));
}else throw Error('Use --storage, --activate, --verify');
