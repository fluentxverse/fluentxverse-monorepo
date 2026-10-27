import { expect, test } from 'bun:test';
import { hasTeachingAccess } from '../tutor/utils/teachingAccess';
import type { TutorCertificationProofResponse } from '../tutor/api/proof.api';

const approved = () => ({ snapshot: { writtenPassed: true, speakingPassed: true, profileApproved: true,
  interviewPassed: true, missingRequirements: [] }, credential: { status: 'retired' } });
test('teaching access requires all four server approvals, not a proof status or email bypass', () => {
  expect(hasTeachingAccess(approved() as unknown as TutorCertificationProofResponse)).toBe(true);
  for (const key of ['writtenPassed', 'speakingPassed', 'profileApproved', 'interviewPassed']) {
    for (const value of [false, null, undefined, 'true']) {
      const result: any = approved(); result.snapshot[key] = value;
      expect(hasTeachingAccess(result)).toBe(false);
    }
  }
  for (const result of [undefined, {}, { snapshot: {} }, { snapshot: { missingRequirements: [] } },
    { ...approved(), snapshot: { ...approved().snapshot, missingRequirements: ['profile_approval'] } },
    { ...approved(), snapshot: { ...approved().snapshot, missingRequirements: undefined } }])
    expect(hasTeachingAccess(result as TutorCertificationProofResponse)).toBe(false);
});
