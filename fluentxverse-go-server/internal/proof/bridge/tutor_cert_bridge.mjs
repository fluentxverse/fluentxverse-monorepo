import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { buildEddsa, buildPoseidon } from 'circomlibjs';

const BN254_FIELD_MODULUS = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
const SCHEMA_VERSION = 'fluentxverse.tutor-certification.v1';
const CIRCUIT_VERSION = 'tutor-certification-circom.v1';
const WRITTEN_PASSING_SCORE = 90;
const SPEAKING_PASSING_SCORE = 85;

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(',')}}`;
}

function hashJson(value) {
  return `sha256:${createHash('sha256').update(stableStringify(value)).digest('hex')}`;
}

function fieldElementFromHash(value) {
  return (BigInt(`0x${hashJson(value).replace(/^sha256:/, '')}`) % BN254_FIELD_MODULUS).toString();
}

async function poseidonField(inputs) {
  const poseidon = await buildPoseidon();
  const output = poseidon(inputs.map((input) => BigInt(input)));
  return poseidon.F.toObject(output).toString();
}

function getIssuer() {
  return process.env.TUTOR_CERT_ISSUER_ID || 'fluentxverse:tutor-certification:v1';
}

function getIssuerSecret() {
  const secret = process.env.TUTOR_CERT_ISSUER_SECRET || process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('TUTOR_CERT_ISSUER_SECRET is required for tutor certification proofs');
  }
  return secret || 'dev-only-tutor-certification-issuer-secret';
}

async function getIssuerKeypair() {
  const eddsa = await buildEddsa();
  const poseidon = await buildPoseidon();
  const privateKey = createHash('sha256').update(getIssuerSecret()).digest();
  const publicKey = eddsa.prv2pub(privateKey);
  return {
    eddsa,
    poseidon,
    privateKey,
    publicKey: [
      poseidon.F.toObject(publicKey[0]).toString(),
      poseidon.F.toObject(publicKey[1]).toString(),
    ],
  };
}

function credentialCommitment(snapshot) {
  const salt = process.env.TUTOR_CERT_COMMITMENT_SALT || process.env.TUTOR_CERT_ISSUER_SECRET;
  if (!salt && process.env.NODE_ENV === 'production') {
    throw new Error('TUTOR_CERT_COMMITMENT_SALT is required for tutor certification proofs');
  }
  return hashJson({
    tutorId: snapshot.tutorId,
    walletAddress: snapshot.smartWalletAddress || snapshot.walletAddress || null,
    salt: salt || 'dev-only-tutor-certification-commitment-salt',
  });
}

function subjectHashField(snapshot) {
  return fieldElementFromHash({
    tutorId: snapshot.tutorId,
    walletAddress: snapshot.smartWalletAddress || snapshot.walletAddress || null,
  });
}

function credentialNonceField(snapshot) {
  return fieldElementFromHash({
    tutorId: snapshot.tutorId,
    schemaVersion: SCHEMA_VERSION,
    salt: process.env.TUTOR_CERT_COMMITMENT_SALT || process.env.TUTOR_CERT_ISSUER_SECRET || 'dev-only-tutor-certification-commitment-salt',
  });
}

async function credentialCommitmentField(snapshot) {
  return poseidonField([subjectHashField(snapshot), credentialNonceField(snapshot)]);
}

async function credentialMessageField(input) {
  return poseidonField([
    input.writtenScore,
    input.speakingScore,
    input.profileApproved,
    input.interviewPassed,
    input.credentialCommitment,
    input.credentialTypeHash,
    input.schemaVersionHash,
    input.issuerHash,
    input.assessmentRoot,
  ]);
}

async function signCredentialMessage(message) {
  const { eddsa, poseidon, privateKey, publicKey } = await getIssuerKeypair();
  const signature = eddsa.signPoseidon(privateKey, poseidon.F.e(BigInt(message)));
  const issuerHash = await poseidonField(publicKey);
  return {
    issuerAx: publicKey[0],
    issuerAy: publicKey[1],
    issuerHash,
    signatureR8x: poseidon.F.toObject(signature.R8[0]).toString(),
    signatureR8y: poseidon.F.toObject(signature.R8[1]).toString(),
    signatureS: BigInt(signature.S).toString(),
  };
}

async function buildPublicSignals(snapshot, assessments = []) {
  const sortedAssessments = [...assessments].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const issuer = await getIssuerKeypair();
  const assessmentRootFields = sortedAssessments.length > 0
    ? sortedAssessments.map((assessment) => ({
      id: assessment.id,
      type: assessment.type,
      payloadHash: assessment.payloadHash,
      issuerSignature: assessment.issuerSignature,
    }))
    : [{
      tutorId: snapshot.tutorId,
      writtenExamId: snapshot.writtenExamId,
      speakingExamId: snapshot.speakingExamId,
      interviewSlotId: snapshot.interviewSlotId,
      schemaVersion: SCHEMA_VERSION,
    }];

  return {
    credentialTypeHash: hashJson('fluentxverse.tutor.ai-verified-certification'),
    credentialCommitment: credentialCommitment(snapshot),
    credentialCommitmentField: await credentialCommitmentField(snapshot),
    credentialTypeHashField: fieldElementFromHash('fluentxverse.tutor.ai-verified-certification'),
    schemaVersionHashField: fieldElementFromHash(SCHEMA_VERSION),
    issuerHashField: await poseidonField(issuer.publicKey),
    issuerAx: issuer.publicKey[0],
    issuerAy: issuer.publicKey[1],
    schemaVersion: SCHEMA_VERSION,
    circuitVersion: CIRCUIT_VERSION,
    issuer: getIssuer(),
    writtenThreshold: WRITTEN_PASSING_SCORE,
    speakingThreshold: SPEAKING_PASSING_SCORE,
    requirementSetHash: hashJson(['written_exam', 'speaking_exam', 'profile_approval', 'interview_pass']),
    assessmentRoot: hashJson(assessmentRootFields),
    assessmentRootField: fieldElementFromHash(assessmentRootFields),
  };
}

async function buildCircuitInput(snapshot, credential = {}) {
  const publicSignals = credential.publicSignals || await buildPublicSignals(snapshot);
  const issuer = await getIssuerKeypair();
  const credentialBase = {
    writtenScore: String(Math.trunc(Number(snapshot.writtenScore ?? 0))),
    speakingScore: String(Math.trunc(Number(snapshot.speakingScore ?? 0))),
    profileApproved: snapshot.profileApproved ? '1' : '0',
    interviewPassed: snapshot.interviewPassed ? '1' : '0',
    credentialCommitment: String(publicSignals.credentialCommitmentField || await credentialCommitmentField(snapshot)),
    credentialTypeHash: String(publicSignals.credentialTypeHashField || fieldElementFromHash('fluentxverse.tutor.ai-verified-certification')),
    schemaVersionHash: String(publicSignals.schemaVersionHashField || fieldElementFromHash(SCHEMA_VERSION)),
    issuerHash: String(publicSignals.issuerHashField || await poseidonField(issuer.publicKey)),
    issuerAx: String(publicSignals.issuerAx || issuer.publicKey[0]),
    issuerAy: String(publicSignals.issuerAy || issuer.publicKey[1]),
    assessmentRoot: String(publicSignals.assessmentRootField || fieldElementFromHash({
      tutorId: snapshot.tutorId,
      writtenExamId: snapshot.writtenExamId,
      speakingExamId: snapshot.speakingExamId,
      interviewSlotId: snapshot.interviewSlotId,
      schemaVersion: SCHEMA_VERSION,
    })),
  };
  const signature = await signCredentialMessage(await credentialMessageField(credentialBase));
  return {
    ...credentialBase,
    subjectHash: subjectHashField(snapshot),
    credentialNonce: credentialNonceField(snapshot),
    signatureR8x: signature.signatureR8x,
    signatureR8y: signature.signatureR8y,
    signatureS: signature.signatureS,
  };
}

async function submitZkVerify(input) {
  const {
    CurveType,
    Library,
    zkVerifySession,
  } = await import('zkverifyjs');
  const seedPhrase = process.env.ZKVERIFY_SEED_PHRASE || process.env.SEED_PHRASE;
  if (!seedPhrase) throw new Error('ZKVERIFY_SEED_PHRASE is required to submit proofs to zkVerify');
  const domainId = Number(process.env.ZKVERIFY_DOMAIN_ID || '0');
  if (!Number.isInteger(domainId) || domainId < 0) throw new Error(`Invalid ZKVERIFY_DOMAIN_ID: ${process.env.ZKVERIFY_DOMAIN_ID}`);

  const proof = JSON.parse(await readFile(input.proofPath, 'utf8'));
  const publicSignals = JSON.parse(await readFile(input.publicPath, 'utf8'));
  const verificationKey = JSON.parse(await readFile(input.verificationKeyPath, 'utf8'));
  const session = await zkVerifySession.start().Volta().withAccount(seedPhrase);
  try {
    const { transactionResult } = await session
      .verify()
      .groth16({ library: Library.snarkjs, curve: CurveType.bn128 })
      .execute({
        proofData: { vk: verificationKey, proof, publicSignals },
        domainId,
      });
    return await transactionResult;
  } finally {
    await session.close();
  }
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

try {
  const input = await readStdin();
  let result;
  if (input.mode === 'public-signals') {
    const publicSignals = await buildPublicSignals(input.snapshot, input.assessments || []);
    result = { credentialCommitment: publicSignals.credentialCommitment, publicSignals };
  } else if (input.mode === 'circuit-input') {
    result = await buildCircuitInput(input.snapshot, input.credential || {});
  } else if (input.mode === 'zkverify-submit') {
    result = await submitZkVerify(input);
  } else {
    throw new Error(`Unsupported proof bridge mode: ${input.mode}`);
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`${error?.stack || error?.message || String(error)}\n`);
  process.exit(1);
}
