# Privacy Improvement Backlog

Status: candidate designs, not a list of deployed features or promised releases.
Items 2 and 7 now have [locally tested implementations](privacy-ai-notes-and-payouts.md).
Payout activation/native pilot remain gated; settlement is not implemented.
Recorded: October 25, 2026. Priority ordering is provisional.

Existing access-controlled records are not automatically user-controlled,
anonymous or end-to-end encrypted. Use ordinary encryption, data minimization
and authorization where sufficient; use ZK only for a concrete private statement.

## Parked Recording Proposal

[Student-controlled recording access](student-controlled-recordings-proposal.md)
captures the proposed encrypted archive and dispute-specific key-sharing flow.
Capture/provider access, key recovery and tutor rights remain unresolved.

## Near-Term Data Protection

### 1. Student-Controlled Notes And Learning History

Extend today's authenticated access with explicit, scoped sharing of selected
notes and assessment history. A tutor could receive a student-approved summary
instead of an entire history, with purpose, expiry, revocation and access logs.
Optional user-controlled encryption requires a separate recovery design.
This does not need ZK initially. Past legitimate recipients can retain copies.

### 2. Reduced Disclosure To AI Services

Inventory outbound assessment/lesson-generation payloads and remove unnecessary
names, emails, booking references and unrelated history. Separate AI processing
consent and document each provider's retention settings. Limit prompt/response
logging and establish deletion behavior.
This is data minimization, not confidential inference: a provider processing
audio or text still receives that content. Voice itself can identify a speaker.

### 3. Field-Level Protection For Interview And Support Records

Encrypt sensitive interviewer comments, attachments and support narratives with
separate keys and narrowly scoped access. Add per-case access grants, auditing,
retention and reviewed key rotation. Staff who need scheduling should not
automatically receive interview notes. Do not present this as a new guarantee
until access paths, exports, search indexes and backups are covered.

### 4. Privacy-Preserving External Analytics

Publish coarse, delayed ecosystem statistics instead of identifying event logs.
Suppress small groups and restrict repeated slices that can reveal individuals
by subtraction. For stronger statistical privacy, evaluate differential privacy
with contribution bounds and an explicit privacy budget.
Do not add arbitrary noise and label it differential privacy. A ZK proof of a
count's arithmetic does not itself make the count private.

## Verifiable Disclosure Candidates

### 5. Private Learning-Achievement Credentials

Let a student prove an issuer-signed statement such as completion of a defined
course or meeting an assessment threshold without revealing all scores, tutors,
recordings or dates. Bind credentials to a policy and holder; support expiry,
revocation and recipient-specific challenges. Avoid a public student identifier
when unlinkable presentations are a requirement.
This proves authorized records, not who personally learned or answered.

### 6. Private Discount Or Scholarship Eligibility

Prove eligibility from a trusted issuer's credential without disclosing the
underlying application documents or exact qualifying values. Use a scoped
nullifier to prevent repeat redemption. Define the real eligibility policy and
issuer first; do not collect sensitive documents merely to demonstrate ZK.

### 7. Confidential Tutor Payout Authorization

Continue the [existing compensation roadmap](tutor-compensation.md): prove that
authorized, unrefunded earnings and a private contracted rate produce the claim,
with atomic duplicate prevention and claimant binding. Keep web3 work in Engine.
Ordinary settlement still reveals recipient and amount. Shielded settlement is
a separate, reviewed protocol integration, not a property supplied by zkVerify.

## Suggested Sequence

1. Inventory sensitive fields, recipients and retention across existing workflows.
2. Prioritize AI data minimization and scoped learning-history sharing.
3. Choose one portable learning credential pilot with a real verifier/use case.
4. Revisit recording control after the capture and recovery decisions are settled.
5. Advance payouts only with a defined settlement and custody model.

## References

- [W3C Verifiable Credentials Data Model](https://www.w3.org/TR/vc-data-model-2.0/)
- [NIST differential privacy guidance](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-226.pdf)
