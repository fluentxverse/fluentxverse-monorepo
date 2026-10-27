# Student-Controlled Recording Access

Status: parked proposal, not implemented or approved for deployment.
Recorded: October 25, 2026.

## Goal

Let a student control disclosure of a lesson recording to authorized support staff
when opening a dispute. The recording remains encrypted in private off-chain
storage. Public chains receive only carefully designed commitments and proof
evidence, never video, transcripts, plaintext decryption keys or student identifiers.

This would replace routine administrator access for participating recordings.
Ordinary QA would require a separate, explicit authorization policy. Recording
still requires the tutor's consent as well as the student's.

## Current Boundary

Today, QA recordings are encrypted in SeaweedFS, but the platform holds the root
key and can decrypt them through authorized administrator playback. Current
consent, access auditing and retention controls are described in
[video-call infrastructure](video-call-infrastructure.md).

RealtimeKit's composite recorder receives the media it records. Encrypting its
output afterward cannot prove that the provider or ingestion process never had
plaintext access. Do not describe an archive-only upgrade as provider-blind or
end-to-end encrypted recording.

## Proposed Mechanism

1. Generate an independent random data-encryption key for each recording, using
   an established authenticated-encryption implementation and authenticated context.
2. Wrap that key to a student-controlled encryption public key. Do not retain a
   generally usable platform copy. This requires a capture/ingestion trust review;
   deleting a key variable does not prove that copies were never retained.
3. Keep ciphertext in private Seaweed storage. Maintain an immutable recording
   manifest binding ciphertext integrity, encryption format and a randomized
   recording commitment to the authorized lesson record.
4. Show a separate dispute disclosure confirmation identifying the recording,
   intended recipients, purpose and permitted access window.
5. The student's client wraps the recording key for an approved recipient's
   encryption public key. Never derive the key from a public wallet address or
   treat a social-login session as an encryption secret.
6. Issue a grant bound to the exact recording commitment, case commitment,
   recipient key, policy version, validity window and fresh authorization nonce.
7. Validate current recipient permissions, expiry, revocation and grant bindings
   before serving encrypted content. Record access and authorization changes
   without logging keys or private payloads.

HPKE is one candidate for recipient key wrapping, not a decision to implement
custom cryptography. Use a maintained implementation after compatibility review.

## Optional ZK And On-Chain Layer

An illustrative proof statement is:

> The holder of an issuer-authorized lesson credential approved disclosure of
> this recording commitment to this approved recipient for this case commitment.

The circuit must bind the holder secret, issuer signature, recording, recipient,
case, policy, authorization nonce and relevant validity conditions. Public
inputs must be reviewed for linkage and replay across recipients, cases, chains
and projects. A proof does not establish the truth of a complaint or the
completeness of a recording.

GMR Engine would own new circuits, artifact approval, proving, zkVerify
submission and receipt reconciliation. The application remains the authorized
source of lesson/case records. Client secret ownership must not be defeated by
uploading the student's decryption secret to Engine.

The existing official zkVerify bridge can anchor verified authorization evidence
on Base. Neither zkVerify nor that bridge stores secrets or releases keys.
No new application contract is assumed by this proposal. Without an independently
enforced key-release system, grant acceptance, revocation and replay prevention
still depend on the application and its operators.

Basic encrypted sharing can ship without ZK. Add proofs only for a precisely
specified private authorization claim that another party needs to verify.

## Decisions Before Implementation

- Capture boundary: archive-only protection, or a redesigned recording process
  that excludes the platform/provider from plaintext access?
- Student key storage, multi-device access, account takeover defenses and recovery.
  Recovery escrow weakens a claim of exclusive student control.
- Tutor rights: can a tutor initiate a complaint or request access when the
  student declines? Do not introduce an undisclosed staff bypass.
- Separate ordinary QA consent from dispute-specific disclosure.
- Recipient key custody: staff device, dedicated service or another reviewed model?
- Whether access applies to a full recording or separately encrypted segments.
- Retention, provider-copy deletion, backups and revocation semantics.
- Whether on-chain audit metadata would expose dispute timing or link students.

Once a recipient obtains plaintext or a usable key, the platform cannot
cryptographically revoke their copies. A short-lived playback session is not
an expiring decryption key. Existing recordings cannot retroactively acquire a
guarantee that earlier viewers or providers never retained a copy.

## Acceptance Checklist

- [ ] Approve the threat model, participant rights and recovery policy.
- [ ] Verify the recording pipeline's actual plaintext and temporary-file exposure.
- [ ] Demonstrate that normal staff credentials and database backups cannot
      decrypt an undisclosed archive under the chosen threat model.
- [ ] Test lost-device recovery and disclose exactly which parties can recover keys.
- [ ] Reject wrong recording, case, recipient, policy, replayed grant and stale consent.
- [ ] Test expired/revoked grants and participant withdrawal during recording.
- [ ] Independently review key management and any new circuit before activation.
- [ ] Run a consented pilot; keep current recordings and rollout flags separate.

## References

- [HPKE, RFC 9180](https://www.rfc-editor.org/rfc/rfc9180.html)
- [RealtimeKit recording architecture](https://developers.cloudflare.com/realtime/realtimekit/faq/)
- [zkVerify verification and aggregation](https://docs.zkverify.io/handbook/introduction/two-modes)
- [Privacy roadmap](privacy-roadmap.md)
