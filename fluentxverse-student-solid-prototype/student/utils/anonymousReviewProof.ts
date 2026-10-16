import { keccak256, toHex } from 'viem';
import { reviewMessageJson, REVIEW_DEPTH, REVIEW_MIN_BATCH, type AnonymousReviewContent, type AnonymousReviewGroup,
  type AnonymousReviewProof } from '../shared/anonymousReviews';
import { loadReviewIdentity } from './anonymousReviewIdentity';

async function artifact(url: string, pin: string, limit: number, signal: AbortSignal) {
  if (!/^[a-f0-9]{64}$/.test(pin) || !url.startsWith('/anonymous-reviews/')) throw new Error('Unapproved review proof files');
  const response = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', signal });
  if (!response.ok || Number(response.headers.get('content-length') || 0) > limit) throw new Error('Approved review proof files are unavailable');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > limit) throw new Error('Review proof file is too large');
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
  if (digest !== pin) throw new Error('Review proof file failed its integrity check');
  return bytes;
}
export async function generateAnonymousReview(accountId: string, commitment: string, group: AnonymousReviewGroup,
  content: AnonymousReviewContent, signal: AbortSignal): Promise<AnonymousReviewProof> {
  if (group.state !== 'open' || !group.root || group.depth !== REVIEW_DEPTH || group.members.length < REVIEW_MIN_BATCH)
    throw new Error('Review cohort is not open');
  const identity = loadReviewIdentity(accountId, group.id, commitment);
  const wasm = await artifact(group.artifacts.wasmUrl, group.artifacts.wasmSha256, 16 * 1024 * 1024, signal);
  const zkey = await artifact(group.artifacts.zkeyUrl, group.artifacts.zkeySha256, 64 * 1024 * 1024, signal);
  if (signal.aborted) throw new Error('Proof generation cancelled');
  const worker = new Worker(new URL('../workers/anonymousReview.worker.ts', import.meta.url), { type: 'module' });
  try {
    return await new Promise<AnonymousReviewProof>((resolve, reject) => {
      const abort = () => finish(() => reject(new Error('Proof generation cancelled')));
      const timer = setTimeout(() => finish(() => reject(new Error('Proof generation timed out. Please try again.'))), 180_000);
      const finish = (action: () => void) => { clearTimeout(timer); signal.removeEventListener('abort', abort); action(); };
      signal.addEventListener('abort', abort, { once: true });
      worker.onmessage = event => finish(() => event.data.error ? reject(new Error(event.data.error)) : resolve(event.data.proof));
      worker.onerror = () => finish(() => reject(new Error('Review proof worker could not start')));
      worker.postMessage({ privateKey: identity.export(), members: group.members, root: group.root,
        message: BigInt(keccak256(toHex(reviewMessageJson(group.id, content)))).toString(), scope: group.scope, depth: group.depth, wasm, zkey }, [wasm, zkey]);
    });
  } finally { worker.terminate(); }
}
