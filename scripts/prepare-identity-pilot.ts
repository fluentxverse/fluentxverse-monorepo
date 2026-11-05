import { mkdir, readFile, writeFile, copyFile, chmod } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { resolve, join } from 'node:path';
import { buildEddsa } from 'circomlibjs';
import { identityPolicyHash } from '../fluentxverse-server/src/services/tutorIdentity/credential';
import { assertContributedGroth16Key } from '../fluentxverse-server/src/services/proof.services/groth16KeySafety';

const root=resolve('output/release/identity-pilot-20261103'),directory=join(root,'prover');
const operations=JSON.parse(await readFile(join(root,'operations.json'),'utf8'));
if(operations.deploymentStatus!=='confirmed'||!/^0x[a-fA-F0-9]{40}$/.test(operations.collection))throw Error('Confirm the pilot collection first');
await mkdir(directory,{recursive:true,mode:0o700});
let seed:Buffer;
try{seed=await readFile(join(directory,'issuer.key'));}
catch(e:any){if(e.code!=='ENOENT')throw e;seed=randomBytes(32);await writeFile(join(directory,'issuer.key'),seed,{flag:'wx',mode:0o600});}
const eddsa=await buildEddsa(),[issuerAx,issuerAy]=eddsa.prv2pub(seed).map((x:any)=>eddsa.F.toObject(x).toString());seed.fill(0);
const artifacts:any={};
for(const [name,file] of Object.entries({wasm:'tutor_identity_js/tutor_identity.wasm',zkey:'development.zkey',vk:'vk.json'})){
  const target=name==='wasm'?'identity.wasm':name==='zkey'?'identity.zkey':'vk.json';
  await copyFile(resolve('output/identity-proof-pilot-20261102',file),join(directory,target));await chmod(join(directory,target),0o600);
  artifacts[name]={path:target,sha256:createHash('sha256').update(await readFile(join(directory,target))).digest('hex')};
}
assertContributedGroth16Key(JSON.parse(await readFile(join(directory,'vk.json'),'utf8')));
const manifest={version:1,mode:'pilot',policyHash:identityPolicyHash,chainId:421614,collection:operations.collection,
  operator:'0xc67f2499aef7ce2b2e8c2f0cf3f5f0d1583757f1',rpcUrl:'https://sepolia-rollup.arbitrum.io/rpc',issuerAx,issuerAy,
  issuerKeyPath:'/run/tutor-identity-prover/issuer.key',verificationNetwork:'Volta',domainId:0,artifacts,
  setupPolicy:'Self-operated development setup. TEST ONLY. No independent audit or production approval.'};
const bytes=JSON.stringify(manifest,null,2)+'\n';await writeFile(join(directory,'release.json'),bytes,{mode:0o600});
console.log(JSON.stringify({mode:'pilot',collection:manifest.collection,manifestSHA256:createHash('sha256').update(bytes).digest('hex'),productionApproved:false}));
