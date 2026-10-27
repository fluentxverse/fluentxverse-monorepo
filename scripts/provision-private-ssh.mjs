import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { cloudHost, sshOptions } from './lib/cloud-ssh.mjs';

if(!process.argv.includes('--configure'))throw Error('Use --configure to install private administrative SSH.');
const directory=join(homedir(),'.ssh/fluentxverse-cloud');
const state=join(homedir(),'.local/state/fluentxverse/private-access-20261024');mkdirSync(state,{recursive:true,mode:0o700});
const run=(cmd,args,options={})=>execFileSync(cmd,args,{encoding:'utf8',maxBuffer:2*1024*1024,...options});
const remote=(cmd,host=cloudHost)=>run('ssh',[...sshOptions,'root@'+host,cmd],{timeout:180000});
const local=(...args)=>run('docker',['run','--rm','--privileged','--pid=host','--network=host','--entrypoint','nsenter','redis:7-alpine','-t','1','-m','-u','-i','-n','--',...args],{timeout:180000});
const file=join(state,'wireguard.private.json');
let config=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):null;
if(!config){
  const routes=JSON.parse(run('ip',['-j','route','show']));
  if(routes.some(r=>r.dst?.startsWith('10.78.24.')))throw Error('Administrative subnet already in use.');
  const serverKey=run('wg',['genkey']).trim(),clientKey=run('wg',['genkey']).trim(),recoveryKey=run('wg',['genkey']).trim();
  const publicKey=key=>run('wg',['pubkey'],{input:key+'\n'}).trim();
  config={serverKey,clientKey,recoveryKey,serverPublic:publicKey(serverKey),clientPublic:publicKey(clientKey),recoveryPublic:publicKey(recoveryKey),preshared:run('wg',['genpsk']).trim(),recoveryPSK:run('wg',['genpsk']).trim()};
  writeFileSync(file,JSON.stringify(config,null,2),{mode:0o600});
}
console.log(remote('dnf -y install wireguard-tools').split('\n').slice(-4).join('\n'));
const serverConfig=`[Interface]\nAddress = 10.78.24.1/24\nListenPort = 51820\nPrivateKey = ${config.serverKey}\n\n[Peer]\nPublicKey = ${config.clientPublic}\nPresharedKey = ${config.preshared}\nAllowedIPs = 10.78.24.2/32\n\n[Peer]\nPublicKey = ${config.recoveryPublic}\nPresharedKey = ${config.recoveryPSK}\nAllowedIPs = 10.78.24.3/32\n`;
const peerConfig=(key,psk,address)=>`[Interface]\nAddress = ${address}/32\nPrivateKey = ${key}\n\n[Peer]\nPublicKey = ${config.serverPublic}\nPresharedKey = ${psk}\nAllowedIPs = 10.78.24.1/32\nEndpoint = ${cloudHost}:51820\nPersistentKeepalive = 25\n`;
const serverFile=join(state,'server.conf'),clientFile=join(state,'client.conf'),recoveryFile=join(directory,'wireguard-recovery.conf');
writeFileSync(serverFile,serverConfig,{mode:0o600});writeFileSync(clientFile,peerConfig(config.clientKey,config.preshared,'10.78.24.2'),{mode:0o600});writeFileSync(recoveryFile,peerConfig(config.recoveryKey,config.recoveryPSK,'10.78.24.3'),{mode:0o600});
run('scp',[...sshOptions,serverFile,'root@'+cloudHost+':/root/fxv-wg-next.conf']);
remote('install -d -m 0700 /etc/wireguard');remote('install -m 0600 /root/fxv-wg-next.conf /etc/wireguard/wgfxv.conf');remote('restorecon /etc/wireguard/wgfxv.conf');
const zones=remote('firewall-cmd --get-zones').trim().split(/\s+/);
if(!zones.includes('fxv-admin'))remote('firewall-cmd --permanent --new-zone=fxv-admin');
remote('firewall-cmd --permanent --zone=fxv-admin --set-target=DROP');
remote('firewall-cmd --permanent --zone=fxv-admin --add-interface=wgfxv');
remote('firewall-cmd --permanent --zone=fxv-admin --add-service=ssh');
remote('firewall-cmd --permanent --zone=public --add-port=51820/udp');
// Reload before removing public SSH so the original recovery path remains available.
remote('firewall-cmd --reload');remote('systemctl enable --now wg-quick@wgfxv');
local('/usr/bin/install','-d','-m','0700','/etc/wireguard');
local('/usr/bin/install','-m','0600',clientFile,'/etc/wireguard/wgfxv.conf');
local('/usr/sbin/restorecon','/etc/wireguard/wgfxv.conf');
local('/usr/bin/systemctl','enable','--now','wg-quick@wgfxv');
const privateOptions=[...sshOptions,'-o','HostKeyAlias='+cloudHost];
const privateSSH=(user,command)=>run('ssh',[...privateOptions,user+'@10.78.24.1',command],{timeout:45000});
let verified=false;
for(let attempt=0;attempt<12;attempt++){
  try{if(privateSSH('fluentxverse-deploy','printf private-ssh-ok').trim()==='private-ssh-ok'){verified=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,3000));
}
if(!verified||privateSSH('root','id -u').trim()!=='0')throw Error('Private SSH failed. Public SSH has NOT been disabled.');
writeFileSync(join(directory,'transport.json'),JSON.stringify({mode:'wireguard',host:'10.78.24.1',hostKeyAlias:cloudHost,interface:'wgfxv',configuredAt:new Date().toISOString()},null,2),{mode:0o600});
if(!process.argv.includes('--close-public')){
  console.log(JSON.stringify({privateSSHVerified:true,rootRecoveryVerified:true,publicSSHChanged:false}));process.exit(0);
}
privateSSH('root','systemd-run --unit=fluentxverse-ssh-rollback --on-active=5m /usr/bin/firewall-cmd --zone=public --add-service=ssh');
try{
  privateSSH('root','firewall-cmd --zone=public --remove-service=ssh');
  if(privateSSH('root','printf private-after-firewall').trim()!=='private-after-firewall')throw Error('Private SSH failed after firewall closure.');
  if(privateSSH('root','systemctl is-enabled wg-quick@wgfxv').trim()!=='enabled')throw Error('Private network not persistent.');
  privateSSH('root','firewall-cmd --permanent --zone=public --remove-service=ssh');
  privateSSH('root','systemctl stop fluentxverse-ssh-rollback.timer');
  config.publicSSHClosedAt=new Date().toISOString();writeFileSync(file,JSON.stringify(config,null,2),{mode:0o600});
  console.log(JSON.stringify({privateSSHVerified:true,rootRecoveryVerified:true,publicSSHClosed:true,rollbackCancelled:true,privateHost:'10.78.24.1'}));
}catch(error){privateSSH('root','firewall-cmd --zone=public --add-service=ssh');throw error;}
