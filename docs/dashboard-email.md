# Native Dashboard Email

The dashboard's `/email` route is a FluentXVerse-owned mail client. `/inbox` remains the separate platform-announcements tool. The active Bun/Elysia API supplies `/admin/mail/*`; this work does not promote the experimental Go backend.

## Included

- Multiple server-configured mailboxes, IMAP folders and unread counts; create folders.
- Per-folder search (sender, recipient, subject and body), unread/starred filters, and 25-message pagination.
- Full-width inbox and message views beside the folder sidebar, with Back and previous/next message navigation; formatted/plain-text reading, image controls, safe downloads, read/unread, stars, archive, spam, trash and moving messages. Bulk actions apply to selected messages, never implicitly to every search result.
- Rich-text composition with a restricted Quill toolbar, To/Cc/Bcc, signatures, contact suggestions and file attachments.
- Reply, Reply All respecting Reply-To and excluding the mailbox itself, and forwarding with original attachments within the size limit.
- Debounced server autosave, explicit draft save, optimistic revisions, close warnings, and personal draft lists.
- Per-operator contacts and signatures, connection testing, responsive folders/list/reader views, accessible native dialogs and error recovery.

## Provider Requirements

The selected provider is Spacemail (Spaceship). The adapter also supports other hosted mailboxes with standard IMAP over TLS and authenticated SMTP (implicit TLS or mandatory STARTTLS). An API-only transactional sending service is not a complete inbound mailbox. Provider-specific OAuth-only connections require a future adapter; this version uses server-side provider/app passwords. Selecting a provider does not connect a mailbox until its actual address and credentials are configured.

Use `fluentxverse-server/config/mail.env.example` as the configuration template. Set `MAIL_ACCOUNTS_JSON` and password secrets on the **application API server**, not the dashboard's Cloudflare Worker. Each connection refers to the name of a password environment variable; no password is included in API responses or browser storage. Multiple entries can use different mailboxes/providers. Mailbox IDs must be unique.

For SMTP 465 use `secure:true`; for SMTP 587 use `secure:false` (STARTTLS is still required). IMAP is implicit TLS, typically port 993. Certificate validation cannot be disabled in these adapters. Set `sentFolder` when a provider does not advertise its Sent folder with IMAP special-use metadata. Some providers save their own Sent copy: confirm their behavior to avoid duplicate Sent-folder copies.

Personal mailboxes require the administrator's existing Admin ID in `adminIds`; superadmins have no bypass. Only the support mailbox uses `shared:true`, granting access to every authenticated dashboard administrator (not tutors, students or the public). Each named administrator sees their personal mailbox plus support; the separate `destrega` superadmin sees support only. The server checks the live administrator record, role and mailbox grant on every request. The client never supplies a hostname, password or arbitrary From address. After configuration, restart the API and use Email settings > Test connection; that checks both IMAP and SMTP but sends no test message.

Configure the provider's MX, SPF, DKIM and DMARC records using its domain-setup instructions. The email client does not provision a domain, change DNS or guarantee deliverability.

## Spacemail Setup

The [official Spacemail settings](https://www.spaceship.com/knowledgebase/connect-spacemail-to-email-client/) are `mail.spacemail.com:993` for IMAP and `mail.spacemail.com:465` for SMTP, both implicit TLS. Both logins use the full mailbox address and that mailbox's password, not the Spaceship account password. IMAP/SMTP access must be enabled in Spacemail Manager or webmail. Certificate verification remains mandatory.

The provider-specific template is `fluentxverse-server/config/spacemail.env.example`. The addresses and password in that file are placeholders, not configured accounts. To stage a real connection without placing the password in shell arguments or chat, use a current-user-owned password file with mode `600`:

```bash
cd fluentxverse-server
bun scripts/configure-spacemail.ts --address YOUR_MAILBOX --admin-id EXISTING_ADMIN_ID --password-file /absolute/path/to/private-password-file
```

The command authenticates IMAP and SMTP without sending mail, then writes a mode-`600` environment JSON fragment under `~/.local/state/fluentxverse/spacemail/`. It never prints credentials. `--stage-only` skips connection verification and does not prove the mailbox works. Neither mode changes the live API. Apply the fragment through the deployment secret configuration on the API server, preserving existing environment values and merging any existing mailbox entries rather than replacing them. Restart only the API after checking for active classrooms; retain the previous private runtime configuration for rollback. Never commit the generated fragment, publish it to Cloudflare frontend variables, or copy it into logs.

Leave `sentFolder` unset initially so the provider's advertised Sent folder is discovered. After activation, check Email settings > Test connection, folder discovery, and a separately authorized send/receive round trip. Domain DNS and deliverability remain separate checks; no DNS changes or test messages are made by the setup command.

## Storage And Privacy

Received and sent messages live with the selected provider. Mail is fetched on demand rather than mirrored into the application database. Provider folder counts are not cached at the CDN. Dashboard drafts (including attachment bytes), private contacts/signatures and send receipts are persisted in PostgreSQL, not local/session storage. Protect database disks/backups with encryption and operational access controls; draft contents are not separately application-encrypted.

The email page temporarily caches up to 12 folder/search/filter pages for 60 seconds and 20 message bodies for five minutes, with a body-size cap. This cache is component-local memory only and clears on mailbox changes or page unmount; it never goes into browser storage or a shared API/CDN cache. Keys include account, folder and UID validity. Read/star actions update rows, the reader and unread badges without reloading status/folders/drafts. Moves invalidate the destination and refill only the current list in the background, retaining visible rows. Sending refreshes folder counts and invalidates Sent, not Inbox or the open reader. Explicit Refresh still fetches current provider state. Failed mutations leave existing messages intact.

Drafts are scoped to operator and mailbox, with a maximum of 100 saved drafts per operator. They are dashboard drafts, not synchronized into other IMAP clients' Drafts folders. Shared mailbox messages are shared; draft text and contacts are not.

Received HTML is allowlist-sanitized. Safe table attributes, typography, colors, spacing and responsive styles are preserved instead of adding borders to every cell. Stylesheets and inline declarations are parsed with PostCSS; imports, font loads, sender-defined custom variables and unsupported properties are removed. HTTPS background-image URLs are parsed with PostCSS Value Parser and rewritten to inert, application-generated variable references with bounded metadata. They cannot load until the reader enables images. Forms, sender scripts, SVG/MathML, frames and embedded objects remain blocked. Plain text is rendered as text, never inserted as HTML.

Formatted content is isolated in a sandbox without same-origin access. Its CSP permits only a randomly nonced, application-generated sizing helper, never sender scripts. The helper reports content height so the outer reader can scroll naturally; messages are accepted only from the correct frame, with the correct token, and within bounded dimensions. Header actions do not recreate the email document.

Embedded CID PNG/JPEG/GIF/WebP images require matching MIME types, file signatures and a 2 MB combined rendering budget. External images remain inert until **Show images** is selected for that message. Blocked images use local placeholders rather than broken-image icons or wrapped fallback text. Only HTTPS image URLs are enabled, with no referrer and a credentialless iframe where the browser supports it. This includes sanitized background artwork (up to 40 unique backgrounds), including responsive and dark-mode variants. These are direct browser requests, not a server-side image proxy: enabling them can expose the viewer's IP and signal opening to the sender. Consent is not saved across messages. External styles/fonts and non-image CSS resources stay blocked even after images are enabled. This is not a guarantee against tracking once external images are allowed.

Downloads use `attachment`, `application/octet-stream`, `nosniff`, a sandbox policy and `private, no-store`. Attachments are not virus-scanned: staff must follow normal untrusted-file procedures.

All mail API responses are private/non-cacheable. Mutations require the trusted dashboard Origin, authenticated admin cookie and mailbox access. Sender identity is fixed by server configuration; recipient/header validation rejects newline injection. SMTP cannot fetch URL or filesystem attachments. Account configuration and transport errors are redacted.

## Delivery Semantics

The server saves a draft before sending. A PostgreSQL transaction serializes send reservation, binds the request UUID to operator/mailbox/draft, checks draft revision and limits sending to 10 attempts per minute per operator. Repeated request IDs and simultaneous sends of the same draft do not invoke SMTP twice.

`sent` means the SMTP provider accepted the message, not that it reached the recipient's inbox. Partial recipient rejection and Sent-copy failures produce warnings. A successfully accepted, unchanged draft is removed; a newer edit in another tab is preserved.

SMTP does not provide a universal exactly-once delivery transaction. A timeout, crash or uncertain transport result may occur after the provider accepted mail. These requests stay `sending` or `unknown`; they are never automatically resent. Check the provider's Sent folder/delivery logs before explicitly composing a new copy. Delivery history stores status/IDs, not message bodies. Send reservations remain durable so retries after restart cannot silently duplicate a message.

## Limits And Verification

- 10 outgoing attachments totaling 5 MB; forwarding observes the same limit. This fits the existing API's 10 MB JSON request cap after base64 encoding.
- Reading/downloading source mail is limited to 20 MB. Large mail requires the provider's own client.
- 50 outgoing recipients, 250 personal contacts and signatures up to 3,000 characters.
- No scheduled send, OAuth adapter, push/IDLE sync, threading engine, rules, permanent-expunge command or attachment virus scanner is claimed. Refresh loads current provider state; search is scoped to the active folder.

Checks:

```bash
cd fluentxverse-server
bun test tests/mail.test.ts
npm run typecheck
# Use only a disposable PostgreSQL database on 127.0.0.1:15439 named fxv_mail_test:
DATABASE_URL=postgresql://postgres:mail-test-only@127.0.0.1:15439/fxv_mail_test \
MAIL_TEST_DATABASE_URL=postgresql://postgres:mail-test-only@127.0.0.1:15439/fxv_mail_test \
bun test tests/mail.persistence.test.ts

cd ../fluentxverse-dashboard
npm run build
EMAIL_TEST_URL=http://127.0.0.1:5198 node tests/browser/email.cjs
```

Browser checks use fixture API responses; they never send real mail or write production records. They cover 1440, 1100, 768, 375 and 320px viewports, search/pagination, actions, reader sandbox, attachments, autosave, connection tests, provider-disconnected state and uncertain sends. Persistence checks run only with the explicit isolated URL and verify real SQL transactions, JSON records, revision conflicts and concurrent-send deduplication. A real provider receive/send round trip remains pending mailbox credentials.

Primary library references: [ImapFlow](https://imapflow.com/docs/api/imapflow-client/), [Nodemailer SMTP](https://nodemailer.com/smtp), [Nodemailer message security options](https://nodemailer.com/message), [MailParser](https://nodemailer.com/extras/mailparser).
