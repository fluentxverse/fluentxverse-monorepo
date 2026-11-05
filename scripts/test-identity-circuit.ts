import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { signIdentityCredential, assertIdentitySignals } from '../fluentxverse-server/src/services/tutorIdentity/credential';

// Synthetic, self-operated development setup. Never promotes keys to production.
const existing = process.argv.includes('--verify-existing');
const dir = resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || 'output/identity-proof-pilot-20261102');
await mkdir(dir, { recursive: true, mode: 0o700 });
const run = (...args: string[]) => execFileSync('snarkjs', args, { stdio: 'pipe', timeout: 240000 });
const r1cs = join(dir, 'tutor_identity.r1cs');
const binding = { chainId: 421614 as const, collection: '0x'+'1'.repeat(40), holder: '0x'+'2'.repeat(40), mock: true };
let signed = await signIdentityCredential({ submissionId:'synthetic',currentSubmissionId:'synthetic',interviewId:'synthetic',currentInterviewId:'synthetic',
  status:'verified',adultConfirmed:true,interviewResult:'pass',interviewPassed:true,identityVerified:true,banned:false,revoked:false,walletPublicationConsent:true,walletBound:true }, binding, randomBytes(32));
if (existing) {
  signed.input = JSON.parse(await readFile(join(dir, 'input.json'), 'utf8'));
  signed.issuer = {issuerAx:signed.input.issuerAx,issuerAy:signed.input.issuerAy};
} else {
await writeFile(join(dir, 'input.json'), JSON.stringify(signed.input), { mode: 0o600 });
run('powersoftau', 'new', 'bn128', '13', join(dir, 'pot0.ptau'));
run('powersoftau', 'contribute', join(dir, 'pot0.ptau'), join(dir, 'pot1.ptau'), '--name=Local development only', '-e='+randomBytes(64).toString('hex'));
run('powersoftau', 'prepare', 'phase2', join(dir, 'pot1.ptau'), join(dir, 'pot-final.ptau'));
run('powersoftau', 'verify', join(dir, 'pot-final.ptau'));
run('groth16', 'setup', r1cs, join(dir, 'pot-final.ptau'), join(dir, 'initial.zkey'));
run('zkey', 'contribute', join(dir, 'initial.zkey'), join(dir, 'development.zkey'), '--name=Local development only', '-e='+randomBytes(64).toString('hex'));
run('zkey', 'verify', r1cs, join(dir, 'pot-final.ptau'), join(dir, 'development.zkey'));
run('zkey', 'export', 'verificationkey', join(dir, 'development.zkey'), join(dir, 'vk.json'));
run('groth16', 'fullprove', join(dir, 'input.json'), join(dir, 'tutor_identity_js/tutor_identity.wasm'), join(dir, 'development.zkey'), join(dir, 'proof.json'), join(dir, 'public.json'));
}
run('groth16', 'verify', join(dir, 'vk.json'), join(dir, 'public.json'), join(dir, 'proof.json'));
const signals = JSON.parse(await readFile(join(dir, 'public.json'), 'utf8'));
assertIdentitySignals(signals, binding, signed.issuer);
const { assertContributedGroth16Key } = await import('../fluentxverse-server/src/services/proof.services/groth16KeySafety');
assertContributedGroth16Key(JSON.parse(await readFile(join(dir, 'vk.json'), 'utf8')));
for (const i of [1,2,3,4,5,6,7,8,9]) {
  const bad = [...signals]; bad[i] = (BigInt(bad[i]) + 1n).toString();
  await writeFile(join(dir, 'bad-public.json'), JSON.stringify(bad), { mode: 0o600 });
  let rejected = false;
  try { const output = run('groth16','verify',join(dir,'vk.json'),join(dir,'bad-public.json'),join(dir,'proof.json')).toString(); rejected = /Invalid proof/i.test(output); }
  catch (error: any) { if (error.status === 1 && !error.signal) rejected = true; else throw error; }
  if (!rejected) throw Error('Tampered identity public signal accepted: '+i);
}
for (const name of ['adultConfirmed','liveMatch','interviewPassed','signatureS'] as const) {
  const bad = { ...signed.input, [name]: '0' };
  await writeFile(join(dir, 'bad.json'), JSON.stringify(bad), { mode: 0o600 });
  let rejected = false;
  try { run('wtns','calculate',join(dir,'tutor_identity_js/tutor_identity.wasm'),join(dir,'bad.json'),join(dir,'bad.wtns')); }
  catch { rejected = true; }
  if (!rejected) throw Error('Invalid identity witness accepted: '+name);
}
console.log(JSON.stringify({ localGroth16Verified:true, tamperedSignalsRejected:9, invalidWitnessesRejected:4,
  productionApproved:false, mock:true, chainTransactions:0 }));
process.exit(0);
