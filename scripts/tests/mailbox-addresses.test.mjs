import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dottedMailboxAccounts } from '../lib/mailbox-addresses.mjs';

const fixture = () => [['agnes', 'agnesveloso'], ['mark', 'markvibas'], ['paul', 'paularriola'], ['yehna', 'yehnalee'], ['support', 'support']].map(([id, name]) => {
  const address = `${name}@fluentxverse.com`, connection = { host: 'mail.spacemail.com', user: address, passwordEnv: `MAIL_${id.toUpperCase()}_PASSWORD` };
  return { id, address, label: address, shared: id === 'support', adminIds: id === 'support' ? [] : [`owner-${id}`], imap: { ...connection, port: 993 }, smtp: { ...connection, port: 465, secure: true } };
});

test('dotted mailbox migration changes addresses and logins but preserves passwords and access', () => {
  const accounts = fixture(), before = structuredClone(accounts), migrated = dottedMailboxAccounts(accounts);
  assert.deepEqual(migrated.map(account => account.address), ['agnes.veloso', 'mark.vibas', 'paul.arriola', 'yehna.lee', 'support'].map(name => `${name}@fluentxverse.com`));
  for (const [index, account] of migrated.entries()) {
    assert.equal(account.imap.user, account.address); assert.equal(account.smtp.user, account.address);
    assert.deepEqual({ ...account, address: before[index].address, label: before[index].label, imap: { ...account.imap, user: before[index].imap.user }, smtp: { ...account.smtp, user: before[index].smtp.user } }, before[index]);
  }
  assert.deepEqual(accounts, before);
  assert.strictEqual(migrated[4], accounts[4]);
  assert.deepEqual(dottedMailboxAccounts(migrated), migrated);
});

test('dotted mailbox migration rejects unknown, missing, duplicate or mismatched accounts', () => {
  assert.throws(() => dottedMailboxAccounts(fixture().slice(1)));
  const duplicate = fixture(); duplicate[0] = duplicate[1]; assert.throws(() => dottedMailboxAccounts(duplicate));
  const unknown = fixture(); unknown[0].id = 'other'; assert.throws(() => dottedMailboxAccounts(unknown));
  const login = fixture(); login[0].imap.user = 'other@fluentxverse.com'; assert.throws(() => dottedMailboxAccounts(login));
});
