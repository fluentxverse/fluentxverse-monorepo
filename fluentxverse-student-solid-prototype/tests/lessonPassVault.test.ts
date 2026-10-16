import { expect, test } from 'bun:test';
import { decryptPassVault, encryptPassVault, emptyPassVault, newPassNote, newPassReference } from '../student/utils/lessonPassVault';
test('encrypted recovery roundtrip, no plaintext secret, wrong account/password and tampering fail closed',async()=>{
  const note=newPassNote(),vault={...emptyPassVault(),notes:[note],orders:[{id:newPassReference(),sku:'basic-1',commitments:[note.commitment]}]};
  const envelope=await encryptPassVault(vault,'synthetic-test-passphrase','student-1');
  expect(envelope).not.toContain(note.privateKey); expect(envelope).not.toContain(note.commitment);
  expect(await decryptPassVault(envelope,'synthetic-test-passphrase','student-1')).toEqual(vault);
  await expect(decryptPassVault(envelope,'wrong-test-passphrase','student-1')).rejects.toThrow('Cannot unlock');
  await expect(decryptPassVault(envelope,'synthetic-test-passphrase','student-2')).rejects.toThrow('Cannot unlock');
  const changed=JSON.parse(envelope); changed.iv='0'.repeat(24);
  await expect(decryptPassVault(JSON.stringify(changed),'synthetic-test-passphrase','student-1')).rejects.toThrow('Cannot unlock');
  await expect(encryptPassVault(vault,'short','student-1')).rejects.toThrow('at least 12');
  await expect(encryptPassVault({...vault,notes:[{...note,commitment:'123'}]},'synthetic-test-passphrase','student-1')).rejects.toThrow('Invalid recovery');
});
