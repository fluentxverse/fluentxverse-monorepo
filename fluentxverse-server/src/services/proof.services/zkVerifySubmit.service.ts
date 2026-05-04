import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import {
  CurveType,
  Library,
  TransactionStatus,
  zkVerifySession,
  type VerifyTransactionInfo,
} from 'zkverifyjs';
import { getDriver } from '../../db/memgraph';
import { generateLocalTutorCertificationProof } from './localGroth16.service';
import type { TutorCertificationProofStatus } from './proof.interface';

const serviceDir = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(serviceDir, '../../..');

export interface ZkVerifySubmissionResult {
  credentialId: string;
  txHash: string | null;
  blockHash: string | null;
  status: string;
  proofType: string;
  domainId: number | undefined;
  aggregationId: number | undefined;
  statement: string | null;
}

function getSeedPhrase(): string {
  const seedPhrase = process.env.ZKVERIFY_SEED_PHRASE || process.env.SEED_PHRASE;
  if (!seedPhrase) {
    throw new Error('ZKVERIFY_SEED_PHRASE is required to submit proofs to zkVerify');
  }
  return seedPhrase;
}

function getDomainId(): number {
  const raw = process.env.ZKVERIFY_DOMAIN_ID || '0';
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid ZKVERIFY_DOMAIN_ID: ${raw}`);
  }
  return parsed;
}

export function isZkVerifySubmissionConfigured(): boolean {
  const enabled = (process.env.ZKVERIFY_ENABLED || 'true').toLowerCase();
  const seedPhrase = process.env.ZKVERIFY_SEED_PHRASE || process.env.SEED_PHRASE;
  return enabled !== 'false' && Boolean(seedPhrase);
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(join(serverRoot, path), 'utf8'));
}

async function persistZkVerifyResult(tutorId: string, result: ZkVerifySubmissionResult): Promise<void> {
  const driver = getDriver();
  const session = driver.session();
  const now = new Date().toISOString();

  try {
    await session.run(
      `MATCH (u:User {id: $tutorId})-[:HAS_CERTIFICATION_CREDENTIAL]->(c:TutorCertificationCredential {id: $credentialId})
       SET c.status = $credentialStatus,
           c.zkVerifySubmittedAt = $now,
           c.zkVerifyVerifiedAt = CASE WHEN $credentialStatus = 'verified' THEN $now ELSE c.zkVerifyVerifiedAt END,
           c.zkVerifyTxHash = $txHash,
           c.zkVerifyBlockHash = $blockHash,
           c.zkVerifyTransactionStatus = $status,
           c.zkVerifyProofType = $proofType,
           c.zkVerifyDomainId = $domainId,
           c.zkVerifyAggregationId = $aggregationId,
           c.zkVerifyStatement = $statement,
           c.updatedAt = $now,
           u.tutorCertificationProofStatus = $credentialStatus
       RETURN c`,
      {
        tutorId,
        credentialId: result.credentialId,
        credentialStatus: result.status === TransactionStatus.Finalized ? 'verified' : 'submitted',
        now,
        txHash: result.txHash,
        blockHash: result.blockHash,
        status: result.status,
        proofType: result.proofType,
        domainId: result.domainId ?? null,
        aggregationId: result.aggregationId ?? null,
        statement: result.statement,
      }
    );
  } finally {
    await session.close();
  }
}

export async function persistZkVerifyFailure(
  tutorId: string,
  credentialId: string,
  error: unknown,
  trigger = 'zkverify_submission'
): Promise<void> {
  const driver = getDriver();
  const session = driver.session();
  const now = new Date().toISOString();
  const message = error instanceof Error ? error.message : String(error);
  const credentialStatus: TutorCertificationProofStatus = 'failed';

  try {
    await session.run(
      `MATCH (u:User {id: $tutorId})-[:HAS_CERTIFICATION_CREDENTIAL]->(c:TutorCertificationCredential {id: $credentialId})
       SET c.status = $credentialStatus,
           c.zkVerifyLastError = $message,
           c.zkVerifyLastErrorAt = $now,
           c.zkVerifyLastTrigger = $trigger,
           c.updatedAt = $now,
           u.tutorCertificationProofStatus = $credentialStatus
       RETURN c`,
      {
        tutorId,
        credentialId,
        credentialStatus,
        message,
        now,
        trigger,
      }
    );
  } finally {
    await session.close();
  }
}

export async function submitTutorCertificationProofToZkVerify(tutorId: string): Promise<ZkVerifySubmissionResult> {
  const localProof = await generateLocalTutorCertificationProof(tutorId);
  const seedPhrase = getSeedPhrase();
  const domainId = getDomainId();

  const proof = await readJson(localProof.proofPath);
  const publicSignals = await readJson(localProof.publicPath);
  const verificationKey = await readJson(localProof.verificationKeyPath);

  const session = await zkVerifySession.start().Volta().withAccount(seedPhrase);

  try {
    const { transactionResult } = await session
      .verify()
      .groth16({ library: Library.snarkjs, curve: CurveType.bn128 })
      .execute({
        proofData: {
          vk: verificationKey,
          proof,
          publicSignals,
        },
        domainId,
      });

    const txInfo: VerifyTransactionInfo = await transactionResult;
    const result: ZkVerifySubmissionResult = {
      credentialId: localProof.credentialId,
      txHash: txInfo.txHash || null,
      blockHash: txInfo.blockHash || null,
      status: txInfo.status,
      proofType: String(txInfo.proofType),
      domainId: txInfo.domainId,
      aggregationId: txInfo.aggregationId,
      statement: txInfo.statement,
    };

    await persistZkVerifyResult(tutorId, result);
    return result;
  } finally {
    await session.close();
  }
}
