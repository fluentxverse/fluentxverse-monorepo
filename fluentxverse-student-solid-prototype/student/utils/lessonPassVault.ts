import { Identity } from '@semaphore-protocol/identity';
import { PASS_PROTOCOL, passId, passScalar } from '../shared/lessonPasses';

export interface PassVault {
  protocol: typeof PASS_PROTOCOL;
  notes: Array<{ commitment: string; privateKey: string }>;
  orders: Array<{ id: string; sku: string; commitments: string[] }>;
  intents: Array<{ id: string; passId: string; refundCommitment: string }>;
}
const encoder = new TextEncoder();
const hex = (bytes: Uint8Array) => Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
const bytes = (value: string) => new Uint8Array(value.match(/../g)!.map(n => parseInt(n, 16)));
export const newPassReference = () => `0x${hex(crypto.getRandomValues(new Uint8Array(32)))}` as `0x${string}`;
export const newPassNote = () => { const identity = new Identity(); return { commitment: identity.commitment.toString(), privateKey: identity.export() }; };
export const emptyPassVault = (): PassVault => ({ protocol: PASS_PROTOCOL, notes: [], orders: [], intents: [] });
function validate(value: any): PassVault {
  if (value?.protocol !== PASS_PROTOCOL || !Array.isArray(value.notes) || !Array.isArray(value.orders) || !Array.isArray(value.intents)
    || value.notes.length > 1024 || value.orders.length > 1024 || value.intents.length > 1024) throw new Error('Invalid recovery vault');
  const commitments = new Set<string>();
  for (const note of value.notes) {
    passScalar(note.commitment);
    if (typeof note.privateKey !== 'string' || note.privateKey.length > 512 || Identity.import(note.privateKey).commitment.toString() !== note.commitment || commitments.has(note.commitment))
      throw new Error('Invalid recovery vault');
    commitments.add(note.commitment);
  }
  for (const order of value.orders) { passId(order.id); if (!['basic-1','basic-30'].includes(order.sku) || !Array.isArray(order.commitments) || order.commitments.some((n: string) => !commitments.has(n))) throw new Error('Invalid recovery order'); }
  for (const intent of value.intents) { passId(intent.id); if (typeof intent.passId !== 'string' || !commitments.has(intent.refundCommitment)) throw new Error('Invalid recovery intent'); }
  return value;
}
async function derive(password: string, salt: Uint8Array) {
  if (password.length < 12) throw new Error('Recovery passphrase must contain at least 12 characters');
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', iterations: 600000, salt: salt as Uint8Array<ArrayBuffer> }, material,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt','decrypt']);
}
export async function encryptPassVault(vault: PassVault, password: string, accountId: string): Promise<string> {
  validate(vault); if (!accountId) throw new Error('Student account required');
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derive(password, salt);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(`${PASS_PROTOCOL}:${accountId}`) }, key, encoder.encode(JSON.stringify(vault)));
  const ciphertext = btoa(Array.from(new Uint8Array(encrypted), n => String.fromCharCode(n)).join(''));
  const envelope = JSON.stringify({ version: 1, kdf: 'PBKDF2-SHA256', iterations: 600000, salt: hex(salt), iv: hex(iv), ciphertext });
  if (envelope.length > 262144) throw new Error('Recovery vault capacity reached');
  return envelope;
}
export async function decryptPassVault(envelope: string, password: string, accountId: string): Promise<PassVault> {
  try {
    if (envelope.length > 262144) throw new Error();
    const value = JSON.parse(envelope);
    if (Object.keys(value).sort().join(',') !== 'ciphertext,iterations,iv,kdf,salt,version' || value.version !== 1 || value.kdf !== 'PBKDF2-SHA256'
      || value.iterations !== 600000 || !/^[a-f0-9]{32}$/.test(value.salt) || !/^[a-f0-9]{24}$/.test(value.iv) || typeof value.ciphertext !== 'string') throw new Error();
    const key = await derive(password, bytes(value.salt));
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(value.iv) as Uint8Array<ArrayBuffer>, additionalData: encoder.encode(`${PASS_PROTOCOL}:${accountId}`) }, key,
      Uint8Array.from(atob(value.ciphertext), n => n.charCodeAt(0)));
    return validate(JSON.parse(new TextDecoder().decode(decrypted)));
  } catch { throw new Error('Cannot unlock backup. Check its passphrase and student account.'); }
}
