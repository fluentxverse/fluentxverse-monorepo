import { Group } from '@semaphore-protocol/group';
import { Identity } from '@semaphore-protocol/identity';
import { generateProof } from '@semaphore-protocol/proof';
self.onmessage = async event => {
  try {
    const { privateKey, members, root, message, scope, depth, wasm, zkey } = event.data;
    const identity = Identity.import(privateKey), group = new Group(members.map(BigInt));
    if (group.root.toString() !== root || group.indexOf(identity.commitment) < 0) throw new Error();
    const artifacts = { wasm: new Uint8Array(wasm), zkey: new Uint8Array(zkey) } as unknown as Parameters<typeof generateProof>[5];
    self.postMessage({ proof: await generateProof(identity, group, message, scope, depth, artifacts) });
  } catch { self.postMessage({ error: 'Could not prove pass ownership. Check the recovery key and approved proof files.' }); }
};
