import { Group } from '@semaphore-protocol/group';
import { Identity } from '@semaphore-protocol/identity';
import { generateProof } from '@semaphore-protocol/proof';

self.onmessage = async event => {
  try {
    const { privateKey, members, root, message, scope, depth, wasm, zkey } = event.data;
    const identity = Identity.import(privateKey), group = new Group(members.map(BigInt));
    if (group.root.toString() !== root || group.indexOf(identity.commitment) < 0) throw new Error('Review cohort does not contain this review key');
    // snarkjs accepts bytes in browsers; Semaphore's artifact type only lists paths.
    const artifacts = { wasm: new Uint8Array(wasm), zkey: new Uint8Array(zkey) } as unknown as Parameters<typeof generateProof>[5];
    const proof = await generateProof(identity, group, message, scope, depth, artifacts);
    self.postMessage({ proof });
  } catch { self.postMessage({ error: 'Could not generate the review proof. Check your review key and approved proof files.' }); }
};
