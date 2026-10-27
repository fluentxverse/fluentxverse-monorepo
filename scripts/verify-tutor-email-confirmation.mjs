import { ssh, quote } from './lib/cloud-ssh.mjs';

if (!process.argv.includes('--send-live-test-email'))
  throw Error('Use --send-live-test-email to send one confirmation to the controlled tutor mailbox.');

// The temporary account has no Engine wallet, exam, booking, or financial record.
const code = String.raw`
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { initDriver, getDriver, closeDriver } from './src/db/memgraph';
import { signAuthToken } from './src/utils/jwt';
import { mailConfigs, mayUseMailbox } from './src/services/mail/mailConfig';
import { AdminService } from './src/services/admin.services/admin.service';
const { ImapFlow } = await import(Bun.resolveSync('imapflow', '/app/src/services/mail'));
const { simpleParser } = await import(Bun.resolveSync('mailparser', '/app/src/services/mail'));
const id = 'email-live-qa-' + randomUUID(), address = 'tutor@fluentxverse.com';
const account = mailConfigs().find(a => a.address === address);
assert(account, 'Shared tutor mailbox missing');
const client = new ImapFlow({ host: account.imap.host, port: account.imap.port, secure: true,
  auth: { user: account.imap.user, pass: account.imapPassword }, logger: false,
  connectionTimeout: 15000, greetingTimeout: 10000, socketTimeout: 30000 });
client.on('error', () => {});
await initDriver(process.env.MEMGRAPH_URI, process.env.MEMGRAPH_USER, process.env.MEMGRAPH_PASSWORD);
const db = getDriver().session();
let created = false, lock;
try {
  const existing = await db.run('MATCH(u:User) WHERE toLower(u.email)=$email RETURN count(u) AS n', { email: address });
  assert.equal(Number(existing.records[0].get('n')), 0, 'Controlled test address already belongs to an account');
  await client.connect();
  lock = await client.getMailboxLock('INBOX', { readOnly: true });
  await db.run('CREATE(:User {id:$id,email:$email,role:$role,firstName:$firstName,lastName:$lastName,verifiedEmail:false,createdAt:$at})',
    { id, email: address, role: 'tutor', firstName: 'Email', lastName: 'Delivery QA', at: new Date().toISOString() });
  created = true;
  const cookie = 'tutorAuth=' + await signAuthToken({ userId: id, email: address, role: 'tutor' });
  const req = (path, method = 'GET', body) => fetch('https://api.fluentxverse.com' + path, {
    method, headers: { cookie, origin: 'https://tutor.fluentxverse.com', 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(90000) });
  const before = await req('/tutor/email-verification/');
  assert.equal(before.status, 200, 'Authenticated status endpoint');
  assert.equal((await before.json()).data.verified, false);
  const blocked = await req('/exam/written/generate', 'POST', {});
  assert.equal(blocked.status, 403, 'Unverified written exam must be blocked');
  assert.match(await blocked.text(), /Confirm your email/);
  assert.equal((await req('/tutor/email-verification/send', 'POST', {})).status, 200, 'Live confirmation send');
  assert.equal((await req('/tutor/email-verification/send', 'POST', {})).status, 429, 'Resend cooldown');
  const record = await db.run('MATCH(v:TutorEmailVerification {tutorId:$id}) RETURN v.tokenHash AS hash', { id });
  const hash = record.records[0].get('hash');
  let token;
  for (let attempt = 0; attempt < 18 && !token; attempt++) {
    const uids = await client.search({ from: address, subject: 'Confirm your FluentXVerse tutor application email' }, { uid: true });
    for (const uid of (uids || []).slice(-8).reverse()) {
      const message = await client.fetchOne(uid, { source: true }, { uid: true });
      if (!message) continue;
      const parsed = await simpleParser(message.source);
      const candidate = parsed.text?.split('https://tutor.fluentxverse.com/confirm-email#token=')[1]?.slice(0, 43);
      if (candidate && createHash('sha256').update(candidate).digest('hex') === hash) {
        assert(parsed.from?.value.some(a => a.address === address));
        assert(parsed.to?.value.some(a => a.address === address));
        const link = 'https://tutor.fluentxverse.com/confirm-email#token=' + candidate;
        assert(parsed.html && parsed.html.includes('Confirm email address'), 'Branded confirmation button missing');
        assert.equal(parsed.html.split('href="' + link + '"').length - 1, 2, 'Both HTML links must preserve the token');
        assert(parsed.attachments.some(a => a.contentId === '<fluentxverse-logo@inline>' && a.contentType === 'image/png'), 'Inline logo missing');
        token = candidate;
        break;
      }
    }
    if (!token) { await Bun.sleep(5000); await client.noop(); }
  }
  assert(token, 'Matching confirmation not delivered within 90 seconds');
  assert.equal((await req('/tutor/email-verification/confirm', 'POST', { token })).status, 200, 'Live confirmation');
  const after = await req('/tutor/email-verification/');
  assert.equal((await after.json()).data.verified, true);
  assert.equal((await req('/exam/active')).status, 200, 'Confirmed tutor can access assessment routes');
  assert.equal((await req('/tutor/email-verification/confirm', 'POST', { token })).status, 400, 'Used token must be rejected');
  const admins = (await db.run('MATCH(a:Admin) RETURN a')).records.map(r => r.get('a').properties);
  assert(admins.length > 0);
  assert(admins.every(a => mayUseMailbox({ userId: a.id, role: a.role || 'admin' }, account)));
  console.log(JSON.stringify({ liveFlowPassed: true, deliveredMessageMatchesTokenHash: true,
    unverifiedExamBlocked: true, verifiedAssessmentAccess: true, resendCooldown: true,
    replayRejected: true, brandedHtmlAndLogo: true, clickableButtonAndFallback: true,
    allAdminsHaveTutorMailbox: true, adminCount: admins.length }));
} finally {
  if (lock) lock.release();
  try { if (client.usable) await client.logout(); } catch {}
  client.close();
  try {
    if (created) {
      await db.executeWrite(async tx => {
        await tx.run('MATCH(v:TutorEmailVerification {tutorId:$id}) DETACH DELETE v', { id });
        await tx.run('MATCH(u:User {id:$id,email:$email}) DETACH DELETE u', { id, email: address });
      });
      const remaining = await new AdminService().getPendingTutors(500);
      console.log(JSON.stringify({ temporaryApplicantRemoved: true, pendingApplicantsRemaining: remaining.length }));
    }
  } finally { await db.close(); await closeDriver(); }
}
process.exit(0);
`;

try {
  process.stdout.write(ssh('docker exec fluentxverse-server bun --no-env-file -e ' + quote(code), { timeout: 240000 }));
} catch {
  console.error('Live email confirmation check failed. Inspect sanitized checks and confirm temporary-account cleanup.');
  process.exitCode = 1;
}
