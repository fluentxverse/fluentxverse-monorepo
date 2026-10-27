# Tutor Application Email Confirmation

## Flow

Registration saves the tutor account and session, attempts an initial confirmation
email without holding the registration response open for SMTP, and redirects to
`/confirm-email`. Initial delivery is best-effort, not a durable mail queue. The
authenticated confirmation page provides a bounded resend if delivery fails or
the process restarts during the first attempt.

The sender is `tutor@fluentxverse.com`. Its password comes only from server `TUTOR`.
Production links are pinned to `https://tutor.fluentxverse.com/confirm-email`.
Confirmation mail includes a branded HTML version with an embedded PNG icon and
text wordmark, a clickable confirmation button, and a clickable fallback URL.
The PNG is a MIME CID attachment, not a remotely loaded image or tracking pixel.
The plain-text alternative retains the same confirmation URL. This fixed template
has a dedicated rendering path; interactive administrator drafts still use their
existing restrictive HTML sanitizer. Existing emails are not retroactively changed.
Raw confirmation tokens use a URL fragment, not a query parameter; the page
removes the fragment immediately and requires an explicit confirmation action.
Opening a GET link alone does not consume it, and confirmation does not sign the
user in. A logged-in different tutor cannot confirm another tutor's link.

Each token has 256 bits of OS randomness and a 30-minute lifetime. Only its SHA256
hash is stored, in a separate Memgraph record that is never included in login
responses. A token binds to the tutor ID, current normalized email and email-address
version. Resending replaces it. Consumption and the verified flag commit together
under the tutor's write lock. Changing an email clears verification and increments
the address version, including if the user later switches back to the old address.

Resend requires a tutor session, a trusted tutor origin, a 60-second account
cooldown, and a five-request cap per one-hour window. The shared Redis request
defense also bounds public confirmation traffic and request-body size. Unknown
SMTP outcomes are reported honestly; the token remains usable until expiry or
replacement, rather than automatically resending an uncertain message.

Written and speaking examination HTTP routes and mutation-service entry points
check the current database email binding, not a browser flag or stale JWT. Status
reads remain available so existing completed applications retain their progress.
Unverified legacy accounts are not silently marked verified. Existing teachers'
classrooms and other non-assessment actions are not gated by this feature.

## Administrator Mail Access

When `TUTOR` is configured, `mailConfigs` adds Tutor Applications as a shared mailbox
or marks an existing mailbox for that exact address shared. Every current or future
`admin`/`superadmin` can use it through the existing dashboard Email page. No dashboard
bundle change is needed. Personal mailbox access rules are unchanged, and students
and tutors receive no access to the administrator mail service.

Administrators with shared mailbox access are trusted to read its messages,
including any Sent copies of confirmation links. They must not use those links on
behalf of applicants. Mail passwords remain server-only; mailbox API responses do
not contain credentials, provider connection details, or token hashes.

## Deployment

The production gate must not be deployed until the mailbox passes both SMTP and
IMAP TLS authentication. The deployment utility reads the password literally from
the server `.env`, preserves existing runtime configuration, escapes Compose dollar
characters, defers restarts during active classrooms, and includes rollback.

```bash
node scripts/deploy-tutor-email-confirmation.mjs --verify-mail
node scripts/deploy-tutor-email-confirmation.mjs --prepare
node scripts/deploy-tutor-email-confirmation.mjs --build
node scripts/deploy-tutor-email-confirmation.mjs --activate
```

On 2026-10-26, the mailbox password was reset and both SMTP and IMAP authentication
passed. The scoped API and tutor Worker release was deployed. A real confirmation
was received in the controlled tutor mailbox and its decoded sender, recipient,
production link, and token hash were verified. No secret is recorded here.

The live pilot confirmed that an unverified temporary applicant could not generate
a written exam, confirmation enabled assessment-route access, an immediate resend
was rate-limited, and replaying the used token failed. All five existing admins
passed the shared-mailbox access check. The temporary applicant and its token
record were removed afterward. Browser checks also passed against the deployed
bundle at 1440px, 390px, and 320px using fixture APIs.

To repeat the live pilot explicitly:

```bash
node scripts/verify-tutor-email-confirmation.mjs --send-live-test-email
```

This sends one real email to `tutor@fluentxverse.com`, creates and removes a temporary
Memgraph applicant, and does not create an Engine wallet or generate an AI exam.

## Verification

- `tests/tutorEmail.test.ts`: mailbox grants, private-mail isolation, safe public
  status, exact address binding, fixed production origin and fragment transport.
- `tests/tutorEmailTemplate.test.ts`: actual MIME generation, embedded logo,
  clickable links with intact token fragments, plain-text alternative, origin and
  recipient validation, and compatibility with the dashboard's received-mail sanitizer.
- `tests/browser/tutorEmailTemplate.cjs`: 800/390/320px rendered decoded mail,
  visible logo, readable button, no page overflow, and no external image requests.
- `tests/tutorEmail.persistence.ts`: isolated actual Memgraph, replay, expiry,
  concurrent confirmation and resends, rate caps, email-version changes, exam HTTP
  and direct-service rejection, and unknown SMTP outcomes. It never sends real mail.
- Existing `tests/application.persistence.ts`: written/oral attempts, saved answers,
  encrypted recordings, worker leases, atomic pass flags, interview races and role
  isolation; verified applicant fixtures preserve those tests' original purpose.
- Tutor browser `tests/browser/emailVerification.cjs`: 1440/390/320px layouts,
  registration redirect, direct-exam redirect, resend cooldown, cross-tab recheck,
  signed-out explicit confirmation and expired-link recovery. Uses fixture APIs.
