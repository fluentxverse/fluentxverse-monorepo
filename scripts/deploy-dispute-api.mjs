import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync, unlinkSync } from 'node:fs';
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes } from 'node:crypto';
import { parseEnv } from 'node:util';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (!process.argv.includes('--deploy')) throw new Error('Use --deploy after completing the isolated release checks.');
const root=fileURLToPath(new URL('../',import.meta.url));
const image='fluentxverse-server:lesson-disputes-20261018';
function docker(args,input) {
  const result=spawnSync('docker',args,{input,encoding:'utf8',maxBuffer:8*1024*1024});
  if(result.status!==0)throw new Error(`Docker ${args[0]} failed: ${result.stderr||'no diagnostic'}`);
  return result.stdout;
}
const old=JSON.parse(docker(['inspect','fluentxverse-server']))[0];
if(old.Config.Image!=='fluentxverse-server:profile-optimization-20261017')throw new Error('Live API changed; do not overwrite it.');
const project=old.Config.Labels['com.docker.compose.project'],serviceName=old.Config.Labels['com.docker.compose.service'];
const networks=Object.keys(old.NetworkSettings.Networks);
if(!project||!serviceName||networks.length!==1)throw new Error('Unexpected deployment layout.');
if(old.Config.Env.some(line=>line.includes('\n')))throw new Error('Multiline runtime environment requires manual review.');
const runtime=Object.fromEntries(old.Config.Env.map(line=>{const i=line.indexOf('=');return[line.slice(0,i),line.slice(i+1)];}));
const keyFile=path.join(root,'fluentxverse-server/config/lesson-privacy.env');
const checkIgnore=spawnSync('git',['check-ignore',keyFile],{cwd:root,encoding:'utf8'});
if(checkIgnore.status!==0)throw new Error('The key file must be Git-ignored before provisioning.');
let keys;
if(existsSync(keyFile)) keys=parseEnv(readFileSync(keyFile,'utf8'));
else {
  if(runtime.LESSON_PRIVACY_ENCRYPTION_KEY||runtime.LESSON_PRIVACY_SIGNING_KEY)throw new Error('Existing runtime keys must be backed up; refusing to replace them.');
  keys={LESSON_PRIVACY_ENCRYPTION_KEY:randomBytes(32).toString('hex'),
    LESSON_PRIVACY_SIGNING_KEY:generateKeyPairSync('ed25519').privateKey.export({format:'der',type:'pkcs8'}).toString('base64')};
  writeFileSync(keyFile,Object.entries(keys).map(([key,value])=>`${key}=${value}`).join('\n')+'\n',{mode:0o600,flag:'wx'});
}
chmodSync(keyFile,0o600);
if(!/^[a-f0-9]{64}$/i.test(keys.LESSON_PRIVACY_ENCRYPTION_KEY||''))throw new Error('Invalid evidence encryption key.');
const signingKey=createPrivateKey({key:Buffer.from(keys.LESSON_PRIVACY_SIGNING_KEY||'','base64'),format:'der',type:'pkcs8'});
if(signingKey.asymmetricKeyType!=='ed25519')throw new Error('An Ed25519 signing key is required.');
for(const key of ['LESSON_PRIVACY_ENCRYPTION_KEY','LESSON_PRIVACY_SIGNING_KEY'])
  if(runtime[key]&&runtime[key]!==keys[key])throw new Error('Provisioned and existing keys differ; refusing rotation.');
const publicKey=createPublicKey(signingKey).export({format:'der',type:'spki'}).toString('base64');
const keyId=createHash('sha256').update(Buffer.from(publicKey,'base64')).digest('hex');
const privateDir=path.join(homedir(),'.local/state/fluentxverse',`lesson-disputes-${Date.now()}`);
mkdirSync(privateDir,{recursive:true,mode:0o700});chmodSync(privateDir,0o700);
writeFileSync(path.join(privateDir,'evidence-keys-backup.env'),readFileSync(keyFile),{mode:0o600,flag:'wx'});
const configured={...runtime,...keys};
const temporaryEnv=path.join(privateDir,'preflight.env');
writeFileSync(temporaryEnv,Object.entries(configured).map(([key,value])=>`${key}=${value}`).join('\n')+'\n',{mode:0o600});
const preflight=`
import {query,closePool} from './src/db/postgres';
import {LessonPrivacyCrypto,verifyLessonEvidence} from './src/services/lessonPrivacy/crypto';
import {LessonPrivacyStore} from './src/services/lessonPrivacy/store';
const crypto=new LessonPrivacyCrypto();
if(!crypto.evidenceEnabled)throw new Error('Evidence keys are not valid');
try{
  const active=await query("SELECT COUNT(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'");
  if(active.rows[0].n>0)throw new Error('Active classroom connections found; defer the API restart');
  await new LessonPrivacyStore().ensure();
  const existing=await query("SELECT id,owner_id,owner_role,booking_id,ciphertext FROM lesson_privacy_records WHERE kind='evidence' LIMIT 101");
  if(existing.rows.length>100)throw new Error('Existing evidence requires an explicit migration review');
  for(const row of existing.rows){
    const context=JSON.stringify(['evidence',row.owner_role,row.owner_id,row.booking_id,row.id,null]);
    const envelope=crypto.open(row.ciphertext,context);
    if(!verifyLessonEvidence(envelope,crypto.issuer().publicKey))throw new Error('An existing snapshot cannot be verified with the configured issuer');
  }
  console.log(JSON.stringify({activeClassroomConnections:active.rows[0].n,existingSnapshots:existing.rows.length,keyId:crypto.issuer().keyId}));
}finally{await closePool();}
`;
let preflightResult;
try { preflightResult=JSON.parse(docker(['run','--rm','--network',networks[0],'--env-file',temporaryEnv,image,'bun','-e',preflight]).trim()); }
finally { unlinkSync(temporaryEnv); }
if(preflightResult.keyId!==keyId)throw new Error('Preflight issuer mismatch.');
console.log('PASS API preflight:',JSON.stringify(preflightResult));
const service={
  image,container_name:'fluentxverse-server',restart:old.HostConfig.RestartPolicy.Name,
  environment:Object.fromEntries(Object.entries(configured).map(([key,value])=>[key,value.replaceAll('$','$$')])),
  user:old.Config.User,working_dir:old.Config.WorkingDir,entrypoint:old.Config.Entrypoint,command:old.Config.Cmd,
  extra_hosts:old.HostConfig.ExtraHosts,logging:{driver:old.HostConfig.LogConfig.Type,options:old.HostConfig.LogConfig.Config},
  ports:Object.entries(old.HostConfig.PortBindings).flatMap(([port,bindings])=>bindings.map(binding=>({target:Number(port.split('/')[0]),protocol:port.split('/')[1],published:binding.HostPort,...(binding.HostIp?{host_ip:binding.HostIp}:{})}))),
  networks:Object.fromEntries(networks.map(name=>[name,{aliases:(old.NetworkSettings.Networks[name].Aliases||[]).filter(alias=>!/^[a-f0-9]{12,64}$/.test(alias))}])),
  volumes:old.Mounts.map(m=>({type:m.Type,source:m.Type==='volume'?m.Name:m.Source,target:m.Destination,read_only:!m.RW})),
  labels:Object.fromEntries(Object.entries(old.Config.Labels).filter(([key])=>!key.startsWith('com.docker.compose.'))),
};
if(old.HostConfig.ReadonlyRootfs)service.read_only=true;
if(old.HostConfig.SecurityOpt)service.security_opt=old.HostConfig.SecurityOpt;
if(old.HostConfig.CapDrop)service.cap_drop=old.HostConfig.CapDrop;
if(old.HostConfig.Init)service.init=true;
if(old.Config.Healthcheck){const h=old.Config.Healthcheck;service.healthcheck={test:h.Test,retries:h.Retries,...(h.Interval?{interval:`${h.Interval/1e6}ms`}:{}),...(h.Timeout?{timeout:`${h.Timeout/1e6}ms`}:{}),...(h.StartPeriod?{start_period:`${h.StartPeriod/1e6}ms`}:{})};}
const config={name:project,services:{[serviceName]:service},networks:Object.fromEntries(networks.map(name=>[name,{external:true,name}])),volumes:Object.fromEntries(old.Mounts.filter(m=>m.Type==='volume').map(m=>[m.Name,{external:true,name:m.Name}]))};
const releaseFile=path.join(privateDir,'runtime-compose.json'),rollbackFile=path.join(privateDir,'rollback-compose.json');
writeFileSync(releaseFile,JSON.stringify(config),{mode:0o600});
writeFileSync(rollbackFile,JSON.stringify({...config,services:{[serviceName]:{...service,image:old.Config.Image,environment:Object.fromEntries(Object.entries(runtime).map(([key,value])=>[key,value.replaceAll('$','$$')]))}}}),{mode:0o600});
try {
  docker(['compose','-p',project,'-f',releaseFile,'up','-d','--no-deps','--wait','--wait-timeout','90',serviceName]);
  const health=await fetch('http://127.0.0.1:8765/health');if(!health.ok)throw new Error('API health check failed.');
  const issuer=await (await fetch('http://127.0.0.1:8765/lesson-privacy/issuer')).json();
  if(!issuer.success||issuer.data.keyId!==keyId)throw new Error('Live issuer does not match the provisioned key.');
  const report={image,previousImage:old.Config.Image,publicKey,keyId,releasedAt:new Date().toISOString(),rollbackFile};
  writeFileSync(path.join(root,'output/release/lesson-dispute-20261018/api-release.json'),JSON.stringify(report,null,2)+'\n');
  console.log('PASS live API activated; existing environment, ports, network and volumes preserved.');
  console.log('Issuer fingerprint:',keyId);
} catch(error) {
  console.error('API activation failed; restoring the previous runtime.');
  docker(['compose','-p',project,'-f',rollbackFile,'up','-d','--no-deps','--wait','--wait-timeout','90',serviceName]);
  throw error;
}
