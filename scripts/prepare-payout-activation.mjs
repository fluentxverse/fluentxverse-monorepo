import {execFileSync} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import {chmodSync,existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';

const root=process.cwd(),engine=resolve(root,'../budol/gmr-engine'),state=join(homedir(),'.local/state/fluentxverse/payout-activation-20261025');
mkdirSync(state,{recursive:true,mode:0o700});chmodSync(state,0o700);
const hash=b=>createHash('sha256').update(b).digest('hex');
const save=(file,value)=>writeFileSync(join(state,file),JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});
const compiler=join(state,'tools/circom');
const bundle=join(engine,'zk/payouts/ceremonies/private-v2-20261025');
if(!existsSync(join(state,'issuer-seed')))writeFileSync(join(state,'issuer-seed'),randomBytes(32),{mode:0o600,flag:'wx'});
if(!existsSync(join(state,'nullifier-key')))writeFileSync(join(state,'nullifier-key'),randomBytes(32),{mode:0o600,flag:'wx'});
const pins=JSON.parse(execFileSync('bun',['--no-env-file','-e',`
import{readFileSync}from'node:fs';import{buildEddsa,buildPoseidon}from'circomlibjs';
import{payoutPolicyHash,FIELD}from'./scripts/payout-private-authorization.mjs';import{createHash}from'node:crypto';
const r=await Bun.stdin.json(),seed=readFileSync(r.seed),e=await buildEddsa(),p=await buildPoseidon(),pub=e.prv2pub(seed).map(v=>e.F.toObject(v).toString());
const scope=1n+BigInt('0x'+createHash('sha256').update('FluentXVerse:private-payouts:v2:production').digest('hex'))%(FIELD-1n);
console.log(JSON.stringify({policyHash:payoutPolicyHash,issuerAx:pub[0],issuerAy:pub[1],issuerHash:p.F.toObject(p(pub.map(BigInt))).toString(),scopeHash:String(scope)}));seed.fill(0);process.exit(0);`],
 {cwd:engine,input:JSON.stringify({seed:join(state,'issuer-seed')}),encoding:'utf8',timeout:30000}));
if(!existsSync(join(bundle,'build.json'))){
  const built=execFileSync('bun',['--no-env-file','-e',`import{buildReviewBundle}from'./scripts/screening-ceremony.ts';const r=await Bun.stdin.json();console.log(JSON.stringify(buildReviewBundle(r.directory,r.compiler,'tutor-payout.v2')));process.exit(0);`],
    {cwd:engine,input:JSON.stringify({directory:bundle,compiler}),encoding:'utf8',timeout:120000});
  console.log(built.trim());
}
const buildSHA256=hash(readFileSync(join(bundle,'build.json'))),ptau=join(state,'self-operated-phase-one-14.ptau');
if(!existsSync(ptau)){
  const result=execFileSync('bun',['--no-env-file','-e',`import{runScreeningWorker}from'./scripts/screening-worker.ts';const r=await Bun.stdin.json();console.log(JSON.stringify(await runScreeningWorker('setup',{action:'self-operated-phase-one',power:14,ptau:r.path},600000)));process.exit(0);`],
    {cwd:engine,input:JSON.stringify({path:ptau}),encoding:'utf8',timeout:650000});
  if(JSON.parse(result).generated!==true)throw Error('Fresh self-operated phase-one generation failed');
}
const bytes=readFileSync(ptau);
const qa=JSON.parse(readFileSync(join(engine,'zk/payouts/build/private-v2-development-qa.json')));
if(qa.circuitSHA256!==hash(readFileSync(join(engine,'zk/payouts/payout_authorization_v2.circom')))||qa.locallyVerified!==true||qa.privateWitnessMutationsRejected!==39||qa.publicStatementMutationsRejected!==20)throw Error('Circuit QA must match frozen release source');
const report={circuit:'tutor-payout.v2',buildSHA256,reviewedAt:new Date().toISOString(),reviewer:'FluentXVerse self-operated engineering review (Codex-assisted)',independentlyAudited:false,
  cryptographicQA:{invalidWitnessesRejected:39,publicSignalsRejected:20,realGroth16ProofVerified:true,synthetic:true},
  checked:['USD/rate/version/sum bounds','signed issuer and project/destination bindings','salted amount and recipient commitments','canonical active slots and duplicate-lesson constraints','expiry and signature binding','cross-chain lesson nullifiers','fresh phase-two setup and release pins','refund/cancel database races and duplicate generation','lost response cannot trigger automatic resubmission'],
  limitations:['Issuer attests authorized application records, not physical teaching','Entitlement and witness custody remain with Engine','No independent audit or independent phase-two contributor','Entropy destruction is operator-asserted','Backend consumes and revokes application authorizations; no custom consuming contract','No shielded settlement or production payment execution']};
if(!existsSync(join(state,'internal-review.json')))save('internal-review.json',report);
const input={operator:'FluentXVerse',ceremonyId:'fxv-private-payout-v2-20261025',buildDirectory:bundle,buildSHA256,
  outputDirectory:join(engine,'zk/payouts/releases/self-operated-v2-20261025'),ptauPath:ptau,ptauSHA256:hash(bytes),reviewReportPath:join(state,'internal-review.json'),
  phaseOneProvenance:{sourceURL:'urn:fluentxverse:setup:payout-v2:20261025:phase-one',ceremony:'FluentXVerse self-operated power14 phase one, fresh OS entropy; no independent contributor',verificationRecord:'Full snarkjs phase-one and phase-two verification required; both entropy destruction claims are operator-asserted'},
  config:{...pins,verificationNetwork:'zkVerify',chainId:8453,domainId:2,bridge:'0xCb47A3C3B9Eb2E549a3F2EA4729De28CafbB2b69',
    issuerSeedPath:join(state,'issuer-seed'),nullifierKeyPath:join(state,'nullifier-key'),issuerSeedHash:'0x'+hash(readFileSync(join(state,'issuer-seed'))),nullifierKeyHash:'0x'+hash(readFileSync(join(state,'nullifier-key')))}};
if(!existsSync(join(state,'self-operated-setup-input.json')))save('self-operated-setup-input.json',input);
if(process.argv.includes('--setup')){
  const result=execFileSync('bun',['--no-env-file','scripts/payout-self-operated.ts'],{cwd:engine,input:JSON.stringify(input),encoding:'utf8',timeout:3600000,maxBuffer:1024*1024});
  console.log(result.trim());
}
console.log(JSON.stringify({buildSHA256,releaseDirectory:input.outputDirectory,independentlyAudited:false,paidSubmissions:0}));
