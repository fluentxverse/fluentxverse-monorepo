# Private ID Storage

## Current Deployment

Identity images are stored as AES-256-GCM ciphertext in the existing private SeaweedFS filer
under `/private-tutor-identity/{random-submission-id}.bin`. The API does not return filer URLs.
The public lesson-file proxy excludes this prefix. Authorized staff view decrypted images via
the audited, authenticated identity endpoint with `private, no-store` responses.

Each image has an independent random key. Keys persist on disk in a private API volume backed
by `/opt/fluentxverse/private/tutor-identity-keys`, owned by the API UID/GID, mode 0700 with 0600
key files. Only keys live in this volume; image files do not. Configure it with
`TUTOR_IDENTITY_KEY_DIR=/run/tutor-identity`. The filer uses the existing `SEAWEED_FILER_URL`.

**Images are not retained in RAM.** The obsolete RAM-retention mount and its boot dependency
were removed, and the original disk-swap configuration was restored. API/VPS restarts no longer
require resubmission when SeaweedFS data and the key volume remain intact. Processing still
uses bounded, short-lived upload/decode buffers and temporary files which are removed after
sanitization. The two concurrent decoder limit and upload size limits remain in effect.

## Deletion Rules

- Staff acceptance starts the 84-hour booking window. Expiry without booking invalidates the
  submission and schedules deletion plus a resubmission notification.
- Blurry/unreadable/unsuitable document rejection schedules deletion at the next Manila midnight.
- A final interview decision schedules image deletion at the next Manila midnight.
- Applicant cancellation, interview no-show and live mismatch require resubmission and schedule
  immediate deletion. Access is denied once the deletion deadline is reached, even before the
  next worker sweep finishes. The worker polls every minute in bounded batches.
- Minimal non-image verification/access/decision records remain in Memgraph. No ID image is
  stored in Memgraph or Postgres, sent to an AI provider, or published on-chain.

Deletion destroys the image key first, deletes the SeaweedFS file, then records completion.
If Seaweed deletion fails, the key is already gone and the worker retries rather than marking
cleanup successful. Repeated deletion and missing-file responses are safe. A filer outage is
not treated as a missing identity image and must not invalidate applications.

Seaweed deletion removes the live file reference; volume compaction/vacuum controls physical
space reclamation. This is not a guarantee of forensic erasure from disk or existing snapshots.
Apply an explicit backup retention policy to both Seaweed data and private keys: copies of
both in an old backup can recover an image after live deletion. Do not promise "no traces
anywhere" or unlimited backup retention while presenting the live cleanup deadline as global
erasure. Keep keys out of source control, logs, public storage and casual source backups.

## Verification

The `tutor-identity-seaweed-20261102` API release is a scoped storage-only overlay. No frontend,
Engine, lesson, salary, wallet or credential deployment was changed. There were zero retained
uploads at initial inspection and zero at the cutover migration. The migration procedure still
stops uploads first and transfers/verifies any intervening ciphertext before switching volumes.

Tests cover authenticated encryption, distinct keys, context/tamper rejection, file-size bounds,
persistent-instance readback, deletion retries and the full identity lifecycle with a disposable
Memgraph and Seaweed-compatible fixture server. Live verification uses synthetic data only:
real HTTP upload, private access rejection, fresh-process readback and actual Seaweed deletion.
All synthetic files and applicant records are removed afterward.
