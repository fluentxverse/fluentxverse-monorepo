import { client } from './utils';

export type TutorCertificationProofStatus =
  | 'requirements_incomplete'
  | 'ready_for_proving'
  | 'local_proof_generated'
  | 'submitted'
  | 'verified'
  | 'failed';

export type TutorCertificationRequirement =
  | 'written_exam'
  | 'speaking_exam'
  | 'profile_approval'
  | 'interview_pass';

export interface TutorCertificationSnapshot {
  tutorId: string;
  writtenPassed: boolean;
  writtenScore: number | null;
  speakingPassed: boolean;
  speakingScore: number | null;
  profileApproved: boolean;
  profileStatus: string;
  interviewPassed: boolean;
  interviewCompletedAt: string | null;
  interviewResult: string | null;
  missingRequirements: TutorCertificationRequirement[];
}

export interface TutorCertificationCredential {
  id: string;
  tutorId: string;
  status: TutorCertificationProofStatus;
  credentialCommitment: string | null;
  schemaVersion: string;
  circuitVersion: string;
  proofSystem: string;
  issuer: string;
  publicSignals: Record<string, unknown> | null;
  missingRequirements: TutorCertificationRequirement[];
  zkVerifyTxHash?: string | null;
  zkVerifyAggregationId?: string | null;
  issuedAt?: string | null;
  verifiedAt?: string | null;
  expiresAt?: string | null;
  updatedAt: string;
}

export interface TutorCertificationProofResponse {
  snapshot: TutorCertificationSnapshot;
  credential: TutorCertificationCredential;
}

export interface LocalTutorCertificationProofResult {
  credentialId: string;
  artifactDir: string;
  inputPath: string;
  witnessPath: string;
  proofPath: string;
  publicPath: string;
  verificationKeyPath: string;
  proofHash: string;
  publicHash: string;
  verificationKeyHash: string;
  verified: boolean;
}

export const proofApi = {
  getTutorCertificationStatus: async (): Promise<TutorCertificationProofResponse> => {
    const response = await client.get('/proof/tutor-certification/me');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get certification proof status');
    }
    return response.data.data;
  },

  maybeIssueTutorCertification: async (): Promise<TutorCertificationProofResponse> => {
    const response = await client.post('/proof/tutor-certification/maybe-issue');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to issue certification proof');
    }
    return response.data.data;
  },

  generateLocalTutorCertificationProof: async (): Promise<LocalTutorCertificationProofResult> => {
    const response = await client.post('/proof/tutor-certification/generate-local');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to generate local certification proof');
    }
    return response.data.data;
  },
};
