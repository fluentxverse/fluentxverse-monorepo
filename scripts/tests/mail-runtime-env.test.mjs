import { test } from 'node:test';
import assert from 'node:assert/strict';
import { literalComposeEnvironment, parseMailboxEnvironment } from '../lib/mail-runtime-env.mjs';

test('mailbox dotenv parsing preserves literal dollars instead of expanding variables', () => {
  const parsed = parseMailboxEnvironment('AGNES="literal$NOT_A_VARIABLE$!"\nSUPPORT=\'literal${NOT_A_VARIABLE}$$\'\n');
  assert.equal(parsed.AGNES, 'literal$NOT_A_VARIABLE$!');
  assert.equal(parsed.SUPPORT, 'literal${NOT_A_VARIABLE}$$');
});

test('Compose environment escapes every dollar without mutating the original values', () => {
  const environment = { MAIL_PASS: 'literal$NOT_A_VARIABLE${OTHER}$$!', NORMAL: 'normal' };
  assert.deepEqual(literalComposeEnvironment(environment), {
    MAIL_PASS: 'literal$$NOT_A_VARIABLE$${OTHER}$$$$!', NORMAL: 'normal',
  });
  assert.equal(environment.MAIL_PASS, 'literal$NOT_A_VARIABLE${OTHER}$$!');
});
