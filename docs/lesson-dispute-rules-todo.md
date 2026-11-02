# Lesson Dispute Rules TODO

Status: core implementation completed locally; not deployed. Detailed checkboxes
below remain acceptance/release checks unless explicitly marked complete. See
[implementation and verification](lesson-disputes-implementation.md).
Updated: 2026-10-31.

## Student Reporting

- [x] Remove the student-facing teaching-duration question.
- [x] Open attendance issue reporting two minutes after the scheduled lesson
  start, while the lesson is ongoing.
- [x] Offer these three choices:
  - Tutor has not joined.
  - Tutor joined late.
  - Tutor left / is no longer available.
- [ ] Store the report time and available classroom connection evidence. Keep
  collecting later arrivals, departures and reconnections. A student report alone
  does not establish tutor fault.
- [x] Allow one student case per lesson, with one immutable submission: no editing,
  changing the complaint or submitting another case for that lesson. Explain this
  before sending, so the student includes their complete account and evidence.
- [ ] Send the student's case to staff and, where applicable, request a private
  tutor response only after the scheduled lesson ends. The
  tutor may see the allegation needed to respond, but the student must not see the
  tutor's reply or attachments. This is not a tutor/student conversation. Staff
  review both accounts; publish only the appropriate decision/outcome to each
  participant, not the other party's private evidence or staff notes.
- [x] Staff are the arbiter and the only intermediary: students and tutors must
  never exchange issue messages or see one another's private replies/attachments.
  Enforce participant-specific visibility and reply permissions server-side, not
  only through hidden UI controls.
- [x] After staff send the student a final decision in their inbox, allow the
  student to reply privately to staff about that decision. These messages do not
  edit/replace the immutable original report or create a second lesson case, and
  are never visible to the tutor. They must not automatically reopen the case,
  restart a tutor deadline, change the slot outcome or issue another refund; staff
  must explicitly decide any reconsideration.
- [x] The tutor's decision message is read-only: no inline reply, including via
  direct API requests. This is separate from the single explanation reply allowed
  when requested before resolution. Tutor reconsideration requires a separate
  support ticket linked to the case; it is not a reply to the decision message.
- [ ] Acknowledge a student report automatically in the student's private inbox.
  Notify the student of resolution and the refund outcome without exposing private
  tutor explanations, medical details or disciplinary records.
- [ ] For an ongoing-lesson report about a missing or late tutor, send an urgent
  lesson reminder by email. This is not an inbox request for a dispute response;
  the latter must wait until the lesson ends. Include lesson day/date, time and timezone and an authenticated
  classroom link, without unnecessary student information. Recheck that the lesson
  is still ongoing and the reminder remains relevant before dispatch; skip stale
  queued reminders after the lesson ends or the tutor reconnects.
- [ ] Deduplicate and rate-limit reminders per lesson/tutor/channel, track delivery
  failures and retries, and avoid repeated alerts when a student updates a report.
  Email/SMS delivery failure must not lose the durable inbox case. SMS requires a
  configured provider and a verified eligible tutor phone number; do not claim SMS
  delivery is operational before those prerequisites are tested.
- [ ] Future only: implement SMS reminders after provider setup and verified phone
  support. SMS is currently unavailable; use email and the private inbox for this
  phase, with no dependency on SMS activation.

## Post-Lesson Reporting

- [ ] After the lesson ends, show these general issue categories instead of the
  three ongoing-lesson attendance choices: Internet connection problem; Audio or
  microphone problem; Device problem; Power interruption; Health or personal
  emergency; Tutor-related issue; Lesson material problem; Other lesson issue.
- [ ] Under Tutor-related issue, show: Tutor was unavailable or unresponsive
  during the lesson; Tutor's audio or video was not working; Tutor did not follow
  my lesson preferences or material request; Tutor's explanations or corrections
  were unclear; Tutor behaved inappropriately or disrespectfully; Other
  tutor-related issue.
- [ ] Require details for either student Other choice. A report already submitted
  during the lesson cannot be edited, supplemented or resubmitted after the lesson.
- [ ] Also allow Tutor has not joined (displayed retrospectively as Tutor did not
  join), Tutor joined late, and Tutor left early / was no longer available after
  the lesson, including when the student did not report during the lesson.
  Accept post-lesson reports within 48 hours of the scheduled lesson end and route
  these attendance complaints through tutor response first, then the same
  duration-based decision rules as ongoing-lesson reports.
- [ ] Eligible post-lesson reports create the tutor private inbox request once,
  identifying the lesson day/date, start/end time and timezone, with the same
  explanation and attachment capabilities. Do not send an expired "join now"
  email/SMS reminder for a completed lesson.
- [x] For post-lesson reports, give the tutor the same 24-hour deadline from
  durable inbox message creation. A qualifying "10 minutes or less" response
  schedules TA-301 at that deadline without requiring staff review; the tutor can
  request reconsideration afterward through support. A qualifying "More than
  10 minutes" response goes to staff review, with no automatic penalty merely
  because review is pending. No qualifying reply by the deadline remains subject
  to the nonresponse rule. These are the same rules used for ongoing reports.

## Behavior Complaints: Staff First

- [x] Tutor behavior or misconduct complaints bypass duration-based routing and
  go directly to staff review. Do not automatically send the tutor an explanation
  request at lesson end, and do not start a tutor response deadline at that point.
- [ ] Staff review the complaint first. If staff find an issue requiring an
  explanation, staff manually send a tutor inbox request identifying the matter
  and required response. Its 24-hour response deadline starts when that request
  is durably created, with the same nonresponse rule and authorized extensions.
- [ ] Behavior investigations remain staff-reviewed regardless of any duration
  or reason in the tutor's explanation; a <=10-minute answer must not automatically
  resolve misconduct. Preserve the one-report/one-tutor-reply policy and private
  evidence access. Staff can decide the outcome without requesting an explanation
  if their initial review does not establish an issue requiring one.

## Punctuality And Attendance

- [ ] Set the punctuality cutoff to scheduled start plus two minutes. A first
  qualifying connection strictly after that cutoff is late.
- [ ] Independently record no entry within five minutes when no qualifying tutor
  connection occurred by scheduled start plus five minutes. A later arrival must
  not erase this historical record or prevent student reporting.
- [ ] Treat entry followed by departure as an interruption, not as never entering.
- [ ] Define qualifying connection evidence, including prejoined tutors,
  reconnects, multiple devices and incomplete logs. Missing or unhealthy telemetry
  must not be treated as conclusive evidence of absence.
- [ ] At lesson end, a reliably established full-lesson tutor no-entry results in
  one TA-301 and one student ticket refund, independently of student reporting.
  This is distinct from the five-minute no-entry statistics record.
- [ ] Automatically close any student issue case for a confirmed full-lesson tutor
  no-entry. State that closure was due to automatic no-show resolution; cancel any
  pending response requirement or nonresponse enforcement. Do not require another
  tutor reply or add a nonresponse breach for the closed case. Keep existing
  submissions and decisions as historical records rather than deleting them.

## Tutor Message And Response

- [ ] Send an automated private tutor inbox request for eligible non-behavior
  reports only after the scheduled lesson ends, showing the selected issue, lesson
  day/date, start/end time, timezone and report time. Process reports already queued
  during the lesson at that point; create requests for later accepted reports on
  submission. Never permit a dispute reply during the ongoing lesson. Reconcile
  full-lesson no-entry first and skip requests for auto-closed cases. Behavior
  complaints use the manual staff-first process above.
- [ ] State the response deadline and the automatic TA-301 rules prominently.
  Use a durable message creation timestamp for the 24-hour deadline, not the
  notification delivery/read time. Duplicate delivery must not reset it.
- [ ] Ask how much actual teaching took place: "10 minutes or less" or "More
  than 10 minutes". Zero minutes belongs to the first choice; exactly ten minutes
  also belongs to the first choice. This is the tutor's statement, not verified
  teaching duration.
- [ ] Offer these response reasons:
  - Internet connection problem.
  - Audio or microphone problem.
  - Device or accessory problem.
  - Power interruption.
  - Health or urgent personal matter.
  - Emergency.
  - Other.
- [ ] Other lets tutors explain an inaccurate or invalid student report without
  choosing a false technical/emergency reason. Keep Student-related issue and
  I disagree with the report absent as standalone options. Emergency explanations
  should not require medical details or other unnecessary sensitive information.
- [ ] Show an explanation text field and optional private image file attachments
  for every tutor response reason and either duration choice, for ongoing and
  post-lesson cases. Reuse the existing protected conversation mechanism; do not
  restrict these controls to Other or a particular reason. Retain image validation,
  size/count limits, encryption and owner/staff-only access. Broader file types
  need a separate security and retention policy before being enabled.
- [x] Allow exactly one sent tutor reply per case, with no editing, follow-up reply
  or draft-saving feature. Explain before send that the tutor should include their
  complete narration and any supporting images. The student never sees this reply.
- [x] Any successfully sent tutor reply, including a short message or image-only
  reply, satisfies the nonresponse requirement. Do not require a substantive
  explanation or all structured fields merely to stop the nonresponse clock.
  Staff assess inadequate replies; absent duration/reason data must not be guessed
  to trigger a duration-based automatic penalty. Reject empty/no-content requests;
  technical upload failure without a committed reply is not a successful send.
- [ ] Give the tutor the full 24-hour response window from the after-lesson inbox
  request so they can describe total teaching time. Do not introduce a separate automatic
  staff-review exception just because the tutor reconnects or resumes teaching;
  the submitted duration/reason and applicable staff decisions determine routing.
- [ ] Allow tutors to mark student absence using the authorized attendance flow.
  If the student also reports the lesson, route the conflicting accounts to staff
  review. Neither the absence mark nor the report alone establishes fault.

## Automatic TA-301 And Reconsideration

- [ ] When the tutor submits "10 minutes or less" together with any of the six
  reasons above, including Emergency, for either an ongoing or post-lesson report,
  schedule automatic TA-301 without requiring staff review for the existing
  24-hour case deadline (measured from durable inbox message creation). Do not
  change the slot to TA-301 immediately upon submission, and do not restart the
  clock on a reply. Keep the case pending until the deadline unless staff resolve
  it first; recheck the current response and staff decision before applying it.
- [ ] Apply the nonresponse rule to every issue report requiring a tutor reply:
  no successfully sent tutor response within 24 hours results in TA-301, subject to
  audited staff override. This is not limited to attendance complaints or a
  particular selected reason. A staff reply does not count as the tutor's response.
- [ ] Enforce one tutor reply with a transactional uniqueness check. Retrying a
  successful send must return its existing result rather than create another reply.
  A reply committed strictly before the deadline counts as timely; the deadline worker
  must recheck committed replies under the same case lock before applying a penalty.
- [ ] Close the reply form at the response deadline and show "Response deadline
  expired". Enforce the cutoff server-side using authoritative server time, even
  if a stale browser still shows Send or the penalty worker has not yet run.
  At or after the deadline, reject new submissions without saving a reply. Starting
  an upload before the cutoff does not reserve a timely submission; the reply must
  be successfully recorded before it. An idempotent retry of an already committed
  timely reply can return that existing result without accepting a new reply.
- [ ] Clearly mark the issue report and its case history "TA-301 - No tutor reply
  within 24 hours" when the nonresponse deadline is enforced. Show the response
  deadline and actual enforcement timestamp to staff and the tutor; distinguish
  this from a duration-based TA-301. Keep student notifications limited to the
  resolution and refund information rather than private disciplinary details.
- [ ] Persist a structured nonresponse reason and deadline-breach event linked to
  the case, lesson, tutor and penalty. Keep these records in Memgraph and make
  them available to staff reporting/statistics for future additional nonresponse
  penalties. Deduplicate enforcement so retries do not create extra incidents.
- [ ] Do not accept late replies in the expired case. Direct tutors to a separate
  support ticket for reconsideration and retain the historical nonresponse flag.
  Staff may record a reversal or excused breach with an audited reason, or explicitly
  extend the deadline through the authorized outage process. Future penalty
  calculations must distinguish active, reversed and excused incidents.
- [ ] Additional nonresponse penalties are planned, not yet specified or enabled.
  Define their amount/type, escalation window and override rules before applying
  them; recording a breach must not silently activate an unspecified extra penalty.
- [ ] Route "More than 10 minutes" responses to staff review, including Other.
  A timely qualifying response satisfies the response deadline: do not apply
  automatic TA-301 merely because staff review remains pending after 24 hours.
  Do not automatically approve completion either; retain the case and financial
  hold until staff record a decision.
- [ ] Do not infer admission of fault from Other: it may explicitly challenge the
  student report. Route Other to staff review regardless of duration; it does not
  trigger the six-reason duration-based automatic penalty. Any timely sent reply
  still satisfies the nonresponse requirement.
- [ ] Route replies without sufficient structured duration/reason data to staff
  review; they still stop nonresponse enforcement.
- [ ] Tell the tutor that reconsideration is available by opening a support ticket.
  Link the ticket to the lesson, report and penalty; preserve the original decision.
- [ ] Preserve staff authority to choose TA-301, No penalty or PAST (administrative
  removal, not hard deletion), with a recorded actor, timestamp and reason.
- [ ] Do not falsify attendance when applying a penalty: a tutor can have entered
  the classroom and still receive TA-301. Update statistics to support this.
- [ ] Apply each penalty once despite duplicate requests, worker retries or
  simultaneous staff action. Staff decisions must not be overwritten by timers.
- [ ] The student-report response rules apply only when a student files an issue;
  do not create response obligations for ordinary unreported interruptions. Keep
  independent automatic tutor no-show reconciliation separate.
- [ ] For reported lessons involving an alleged platform outage, allow the tutor
  to open a support ticket for staff review. Staff can resolve or reconsider the
  penalty; logging health and outage evidence must be visible to reviewers.
- [ ] Staff handle platform outages manually: permit an audited deadline extension
  and, when appropriate, SYS-501 compensation. Record the revised deadline, actor
  and reason; honor the extension during enforcement. SYS-501 compensation must
  use the existing authorized financial policy, not invent an amount in this worker.

## Finance, Proofs And Reliable Processing

- [ ] Hold disputed compensation and completion-proof finalization while the
  case is unresolved, including when the response deadline exceeds the normal
  48-hour completion window.
- [ ] Coordinate report acceptance and completion finalization under a shared
  lesson transaction/lock: an accepted report before the reporting cutoff must
  place its hold before earnings/proof finalization can proceed. Use server time
  and recheck accepted reports, not merely the scheduled completion timestamp.
- [ ] Prevent TA-301 and administratively removed lessons from earning tutor
  compensation or being certified as ordinary completed lessons.
- [ ] Every TA-301 must trigger return of the student's consumed lesson ticket,
  including independently detected tutor no-shows. Return the original entitlement
  once, with an audit trail, across all refund paths; define restoration for trial
  or other nonstandard credits without issuing duplicate or substitute value.
- [ ] A lesson has one final slot status and at most one base TA-301, with one
  refund entitlement. Keep causes/audit history separately without duplicating
  slot statuses, penalties or refunds when automatic and staff paths overlap.
- [ ] Let staff approve a student refund without penalizing the tutor. Store refund
  and disciplinary decisions separately; a refund alone must not imply TA-301.
  Preserve recovery work when penalty creation succeeds but refund delivery fails.
- [ ] No penalty means tutor earnings remain payable. Staff may refund the student
  while retaining tutor pay, with FluentXVerse absorbing the cost case by case.
  Store these choices explicitly and audit the decision.
- [ ] Commit the case decision, slot status and durable refund instruction together
  where possible in Memgraph; deliver external refunds through recoverable,
  idempotent processing. Show pending/failed/completed refund status and alert on
  failures. A transient database/network failure must not lose or duplicate value.
- [ ] Keep cases, deadlines, decisions and salary state in Memgraph; use PostgreSQL
  only where appropriate for existing logs/delivery records, not salary ownership.
- [ ] Use persistent indexed due work and bounded batches, not one in-memory timer
  per lesson. Recover after restart and alert on overdue processing/backlogs.

## Decisions Still Needed Before Implementation

- [ ] Confirm whether Health or urgent personal matter and Emergency should remain
  separate labels despite their overlap. Both currently carry the same rule.
- [ ] Define the staff action that pauses an automatic decision during support
  review; contacting support alone must not silently extend a deadline.
- [ ] Deferred by product decision: define staff review turnaround targets later.
- [ ] Define overdue alerts and the reconsideration window, including compensation
  restoration after a reversed penalty without silently reclaiming an already-issued
  student refund.

## Verification

- [ ] Test exact two-, five- and ten-minute boundaries, prejoins and late arrivals.
- [ ] Test brief entry/departure, reconnection, stale connections and telemetry failure.
- [ ] Test all seven reasons with both duration answers and zero teaching minutes;
  Other always routes to staff review. Behavior complaints use staff-first routing.
- [ ] Verify ongoing reports send relevant email reminders but no tutor dispute
  inbox request/reply access until lesson end; verify the full 24-hour window starts
  from actual durable request creation. Test delayed workers and full-no-show closure.
- [ ] Verify behavior complaints do not automatically notify/request a tutor reply
  or start a deadline; only a manual staff explanation request starts that clock.
- [ ] Verify timely "More than 10 minutes" responses remain in staff review
  beyond 24 hours without triggering the nonresponse penalty.
- [ ] Verify ongoing and post-lesson reports use identical duration routing:
  "10 minutes or less" plus a qualifying six-reason response schedules TA-301 at
  the existing 24-hour deadline without requiring staff review; "More than 10
  minutes" and Other go to staff review. Behavior complaints bypass duration rules.
- [ ] Test rejection of report/reply edits and second submissions, safe send retries,
  deadline races, restart recovery,
  staff overrides and support-ticket reconsideration.
- [ ] Test short and image-only replies stop nonresponse, private tutor reply and
  evidence access excludes the student, and staff decisions expose only approved
  outcome information. Test full-lesson no-entry closes cases and cancels deadlines,
  manual outage extensions and authorized SYS-501 compensation.
- [ ] Test nonresponse across all issue categories, visible case labeling, distinct
  duration/nonresponse causes, one breach per missed case deadline, rejection of late replies
  and audited reversal/excusal without accidental extra penalties.
- [ ] Verify a qualifying response leaves the slot unchanged before the 24-hour
  deadline and applies TA-301 once at or after it, unless superseded by staff.
- [ ] Test refund idempotency, payout/proof holds and attendance/penalty statistics.
- [ ] Test private inbox access, image attachment authorization and desktop/mobile UI.
- [ ] Test student-to-staff follow-ups on decisions without changing the original
  report, no student/tutor cross-visibility, and tutor decision reply denial in
  both UI and API. Verify follow-ups do not automatically reopen cases or refunds.
