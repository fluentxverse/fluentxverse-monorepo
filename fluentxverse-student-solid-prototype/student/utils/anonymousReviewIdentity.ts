import { Identity } from '@semaphore-protocol/identity';
import { REVIEW_PROTOCOL } from '../shared/anonymousReviews';
const key = (accountId: string, groupId: string) => `fxv:anonymous-review:${accountId}:${groupId}`;
export function loadReviewIdentity(accountId: string, groupId: string, enrolledCommitment: string | null) {
  const saved = localStorage.getItem(key(accountId, groupId));
  if (!saved && enrolledCommitment) throw new Error('Your review key is not on this device. Restore its backup to continue.');
  const identity = saved ? Identity.import(saved) : new Identity();
  if (enrolledCommitment && identity.commitment.toString() !== enrolledCommitment)
    throw new Error('This device has a different review key. Restore the enrolled key.');
  if (!saved) localStorage.setItem(key(accountId, groupId), identity.export());
  return identity;
}
export function backupReviewIdentity(accountId: string, groupId: string, commitment: string | null) {
  const identity = loadReviewIdentity(accountId, groupId, commitment);
  const blob = new Blob([JSON.stringify({ protocol: REVIEW_PROTOCOL, groupId, privateKey: identity.export() })], { type: 'application/json' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `fluentxverse-review-key-${groupId.slice(2, 10)}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function restoreReviewIdentity(accountId: string, groupId: string, commitment: string, json: string) {
  const data = JSON.parse(json);
  if (data.protocol !== REVIEW_PROTOCOL || data.groupId !== groupId || typeof data.privateKey !== 'string') throw new Error('Wrong review key backup');
  const identity = Identity.import(data.privateKey);
  if (identity.commitment.toString() !== commitment) throw new Error('Backup does not match your enrolled review key');
  localStorage.setItem(key(accountId, groupId), identity.export());
}
