# Retired Legacy Proof Implementation

These source snapshots preserve the V1 implementation for investigation. They are text files, not runtime modules. Do not restore, compile, deploy or use their setup instructions.

Both legacy setup paths exported their initial Groth16 zkey without a phase-two contribution. Offline review reproduced acceptance of witness-free fabricated proofs using the public verification keys. Phase-one entropy does not repair this failure.

Active modules now reject generation and submission without a feature-flag override. Stored credentials and transactions remain untouched for historical investigation, but API responses do not endorse them as valid proofs. Status reads cannot renew expiry or replace public signals.

The active V1 tutor circuit source has explicit 0..100 score bounds solely as a source-level correction. Old compiled artifacts remain retired. V2 screening must use an independently reviewed circuit and setup release; this archive does not provide either.

The manifest records hashes of the archived text snapshots. It contains no private keys, witnesses, real assessment inputs or proving artifacts.
