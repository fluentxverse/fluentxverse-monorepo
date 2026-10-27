import type { TutorCertificationProofResponse } from '../api/proof.api';

// Teaching access is application approval, not the status of a ZK proof.
export function hasTeachingAccess(result: TutorCertificationProofResponse): boolean {
  const snapshot = result?.snapshot;
  return snapshot?.writtenPassed === true && snapshot.speakingPassed === true
    && snapshot.profileApproved === true && snapshot.interviewPassed === true
    && Array.isArray(snapshot.missingRequirements) && snapshot.missingRequirements.length === 0;
}
