import { Identity } from '@semaphore-protocol/identity';
import { passMessage, passScope, PASS_DEPTH, type PassAuthorization, type PassBatch, type PassMode } from '../shared/lessonPasses';
import type { AnonymousReviewProof } from '../shared/anonymousReviews';

async function artifact(url: string, pin: string, limit: number, signal: AbortSignal) {
  if (!/^[a-f0-9]{64}$/.test(pin) || !url.startsWith('/anonymous-reviews/')) throw new Error('Unapproved pass proof files');
  const response = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', signal });
  if (!response.ok || Number(response.headers.get('content-length') || 0) > limit) throw new Error('Pass proof files unavailable');
  const data = await response.arrayBuffer();
  if (data.byteLength > limit) throw new Error('Pass proof file too large');
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), n => n.toString(16).padStart(2, '0')).join('');
  if (hash !== pin) throw new Error('Pass proof file failed its integrity check');
  return data;
}
export async function generatePassProof(privateKey: string, authorization: PassAuthorization, batch: PassBatch, mode: PassMode, signal: AbortSignal): Promise<AnonymousReviewProof> {
  if (mode.mode !== 'private_passes' || !mode.artifacts || !mode.chainId || !mode.contract || batch.status !== 'active' || batch.root !== authorization.root)
    throw new Error('Pass issuance is not active');
  Identity.import(privateKey);
  const wasm = await artifact(mode.artifacts.wasmUrl, mode.artifacts.wasmSha256, 16 * 1024 * 1024, signal);
  const zkey = await artifact(mode.artifacts.zkeyUrl, mode.artifacts.zkeySha256, 64 * 1024 * 1024, signal);
  if (signal.aborted) throw new Error('Pass proof cancelled');
  const worker = new Worker(new URL('../workers/lessonPass.worker.ts', import.meta.url), { type: 'module' });
  try {
    return await new Promise((resolve, reject) => {
      let done = false;
      const finish = (action: () => void) => { if (done) return; done = true; clearTimeout(timer); signal.removeEventListener('abort', abort); action(); };
      const abort = () => finish(() => reject(new Error('Pass proof cancelled')));
      const timer = setTimeout(() => finish(() => reject(new Error('Pass proof timed out'))), 180000);
      signal.addEventListener('abort', abort, { once: true });
      worker.onmessage = event => finish(() => event.data.error ? reject(new Error(event.data.error)) : resolve(event.data.proof));
      worker.onerror = () => finish(() => reject(new Error('Pass proof worker unavailable')));
      worker.postMessage({ privateKey, members: batch.members, root: batch.root, message: passMessage(authorization), scope: passScope(mode.chainId!, mode.contract!),
        depth: PASS_DEPTH, wasm, zkey }, [wasm,zkey]);
    });
  } finally { worker.terminate(); }
}
