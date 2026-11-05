import {mkdir,readFile,writeFile,copyFile,chmod,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {buildEddsa} from 'circomlibjs';
import {identityPolicyHash,signIdentityCredential,assertIdentitySignals} from '../fluentxverse-server/src/services/tutorIdentity/credential';
import {assertContributedGroth16Key} from '../fluentxverse-server/src/services/proof.services/groth16KeySafety';

const root=resolve('output/release/identity-mainnet-20261103'),dir=join(root,'prover'),setup=join(root,'setup');
await mkdir(dir,{recursive:true,mode:0o700});await mkdir(setup,{recursive:true,mode:0o700});
const run=(command:string,args:string[])=>{try{return execFileSync(command,args,{encoding:'utf8',timeout:300000,maxBuffer:2e6});}catch{throw Error(`Identity setup step failed: ${command} ${args[0]}`);}};
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const tau=join(setup,'public.ptau');
try{await readFile(tau);}catch{const r=await fetch('https://circom.info/powersOfTau28_hez_final_13.ptau');if(!r.ok)throw Error('Public powers of tau unavailable');await writeFile(tau,new Uint8Array(await r.arrayBuffer()),{mode:0o600});}
// BLAKE2b digest published by iden3/snarkjs for the public Hermez phase-one ceremony.
if(createHash('blake2b512').update(await readFile(tau)).digest('hex')!=='58efc8bf2834d04768a3d7ffcd8e1e23d461561729beaac4e3e7a47829a1c9066d5320241e124a1a8e8aa6c75be0ba66f65bc8239a0542ed38e11276f6fdb4d9')throw Error('Public ceremony digest differs');
run('circom',['fluentxverse-server/circuits/tutor-identity-v1/tutor_identity.circom','--r1cs','--wasm','-l','node_modules/circomlib/circuits','-o',setup]);
const r1cs=join(setup,'tutor_identity.r1cs'),key=join(dir,'identity.zkey');
try{await readFile(key);}catch{
 run('snarkjs',['groth16','setup',r1cs,tau,join(setup,'initial.zkey')]);
 run('snarkjs',['zkey','contribute',join(setup,'initial.zkey'),key,'--name=FluentXVerse mainnet phase two','-e='+randomBytes(64).toString('hex')]);
 await rm(join(setup,'initial.zkey'));
}
run('snarkjs',['zkey','verify',r1cs,tau,key]);
run('snarkjs',['zkey','export','verificationkey',key,join(dir,'vk.json')]);
await copyFile(join(setup,'tutor_identity_js/tutor_identity.wasm'),join(dir,'identity.wasm'));
let seed:Buffer;
try{seed=await readFile(join(dir,'issuer.key'));}catch(e:any){if(e.code!=='ENOENT')throw e;seed=randomBytes(32);await writeFile(join(dir,'issuer.key'),seed,{flag:'wx',mode:0o600});}
const eddsa=await buildEddsa(),[issuerAx,issuerAy]=eddsa.prv2pub(seed).map((x:any)=>eddsa.F.toObject(x).toString());
const binding={chainId:42161 as const,collection:'0x25cbb57f2dccc478889a232a64fcee210fffd972',holder:'0x'+'1'.repeat(40),mock:false};
const signed=await signIdentityCredential({submissionId:'synthetic-local',currentSubmissionId:'synthetic-local',interviewId:'i',currentInterviewId:'i',status:'verified',adultConfirmed:true,interviewResult:'pass',interviewPassed:true,identityVerified:true,banned:false,revoked:false,walletPublicationConsent:true,walletBound:true},binding,seed);seed.fill(0);
const artifacts:any={};
for(const [name,file] of Object.entries({wasm:'identity.wasm',zkey:'identity.zkey',vk:'vk.json'})){
 await chmod(join(dir,file),0o600);artifacts[name]={path:file,sha256:sha(await readFile(join(dir,file)))};
}
assertContributedGroth16Key(JSON.parse(await readFile(join(dir,'vk.json'),'utf8')));
await writeFile(join(setup,'input.json'),JSON.stringify(signed.input),{mode:0o600});
run('snarkjs',['groth16','fullprove',join(setup,'input.json'),join(dir,'identity.wasm'),key,join(setup,'proof.json'),join(setup,'public.json')]);
const verified=run('snarkjs',['groth16','verify',join(dir,'vk.json'),join(setup,'public.json'),join(setup,'proof.json')]);
if(!verified.includes('OK!'))throw Error('Production local proof failed');
assertIdentitySignals(JSON.parse(await readFile(join(setup,'public.json'),'utf8')),binding,{issuerAx,issuerAy});
await rm(join(setup,'input.json'));
const manifest={version:1,mode:'production',policyHash:identityPolicyHash,chainId:42161,collection:binding.collection,
 operator:'0xc67f2499aef7ce2b2e8c2f0cf3f5f0d1583757f1',rpcUrl:'https://arb1.arbitrum.io/rpc',issuerAx,issuerAy,
 issuerKeyPath:'/run/tutor-identity-mainnet/issuer.key',verificationNetwork:'zkVerify',domainId:10,artifacts,
 setupPolicy:'Public Hermez phase one (pinned BLAKE2b); new self-operated phase-two contribution. No independent audit claimed.'};
const bytes=JSON.stringify(manifest,null,2)+'\n';await writeFile(join(dir,'release.json'),bytes,{mode:0o600});
await writeFile(join(root,'prover-verification.json'),JSON.stringify({passed:true,manifestSHA256:sha(Buffer.from(bytes)),artifacts,sourceSHA256:sha(await readFile('fluentxverse-server/circuits/tutor-identity-v1/tutor_identity.circom')),chainTransactions:0},null,2));
console.log(JSON.stringify({productionReleasePrepared:true,localProofVerified:true,manifestSHA256:sha(Buffer.from(bytes)),chainTransactions:0}));
process.exit(0);
