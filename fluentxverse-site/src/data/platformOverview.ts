export type OverviewTopic = 'Business' | 'Operations' | 'Technology' | 'Privacy';
export type OverviewBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'steps'; items: string[] }
  | { kind: 'note'; title: string; text: string }
  | { kind: 'table'; headings: string[]; rows: string[][] };
export interface OverviewChapter { id: string; title: string; topic: OverviewTopic; summary: string; blocks: OverviewBlock[] }
const p = (text: string): OverviewBlock => ({ kind: 'paragraph', text });
const list = (...items: string[]): OverviewBlock => ({ kind: 'list', items });
const steps = (...items: string[]): OverviewBlock => ({ kind: 'steps', items });
const note = (title: string, text: string): OverviewBlock => ({ kind: 'note', title, text });
const table = (headings: string[], rows: string[][]): OverviewBlock => ({ kind: 'table', headings, rows });

export const overviewSourceDate = '2026-10-13';
export const overviewChapters: OverviewChapter[] = [
  { id: 'business-model', title: 'A useful English lesson comes first', topic: 'Business', summary: 'The product is human-led learning. Technology makes the service easier to coordinate and selected claims easier to verify.', blocks: [
    p('FluentXVerse connects students with tutors for live, one-to-one English lessons. The learning experience brings together a suitable tutor, a reliable appointment, useful materials, conversation practice, and feedback. Software supports that relationship rather than replacing the teacher.'),
    p('The initial positioning connects Filipino English tutors with learners in markets such as Japan, Korea, and Vietnam. These are intended audiences, not measured market share or a claim of established operations in every country.'),
    list('For students: tutor discovery, convenient scheduling, structured practice, and lesson history.', 'For tutors: published availability, teaching resources, student feedback, and clear operating expectations.', 'For the service: reviewable lesson records, consistent delivery, and a way to investigate problems.'),
    note('What we do not promise', 'A technical feature is not evidence of guaranteed fluency, accreditation, earnings, investment returns, or universal recognition of a credential.'),
  ] },
  { id: 'workspaces', title: 'Two apps. One coordinated service.', topic: 'Operations', summary: 'Learners, tutors, and authorized staff have distinct workspaces and responsibilities.', blocks: [
    table(['Workspace', 'Purpose'], [
      ['Student app', 'Discover tutors, book lessons, enter the classroom, study materials, and review lesson information.'],
      ['Tutor app', 'Apply and complete screening, manage availability, teach lessons, submit notes, and review performance.'],
      ['Administration', 'Review applications, maintain content, investigate service issues, and carry out permitted account or finance actions.'],
      ['Execution service', 'Perform approved proof and blockchain operations and retain their execution records.'],
    ]),
    p('These are not interchangeable accounts. The application server checks identity, ownership, and permission for protected actions. A hidden button is not a security control, and a successful technical operation does not replace a required business approval.'),
  ] },
  { id: 'lesson-journey', title: 'From first booking to follow-up', topic: 'Operations', summary: 'A lesson is a connected workflow, not simply a video call.', blocks: [
    steps('Discover a tutor and an available schedule. Sign-in is required when a visitor proceeds to booking.', 'Choose a slot. The server checks availability, overlapping appointments, tutor eligibility, and the applicable access rules.', 'Reserve and confirm. A temporary hold is not yet a confirmed lesson; the final booking must pass server checks.', 'Prepare and learn. The assigned learner and tutor meet in the authorized classroom window with materials and chat.', 'Follow up. Attendance and lesson outcomes are recorded, tutors provide required notes, and eligible learners can leave feedback.'),
    p('A standard lesson is 25 minutes within a 30-minute calendar slot. A bounded wrap-up window does not change the advertised lesson duration. Timezones are display choices: an 18:00 Philippine-time lesson and a 19:00 Japan-time lesson can be the same appointment.'),
    note('Keep the records distinct', 'Booking, attendance, completion, notes, feedback, and payment are separate events. Optional feedback is not required for a lesson to have taken place.'),
  ] },
  { id: 'tutor-screening', title: 'How tutors qualify', topic: 'Operations', summary: 'Assessment and human review establish teaching readiness; a credential serves a different purpose.', blocks: [
    p('Tutor onboarding combines an application and profile, written assessment, speaking assessment, and a human interview or approval process. Registration alone is not permission to teach. Decisions should identify the reviewed attempt, the reviewer, and the approval time.'),
    p('Written assessments use stored questions and answers. Speaking submissions are transcribed and assessed using the transcript; interview and profile approvals involve human judgment. The private-screening design checks approved, signed results against a defined policy without publishing exact scores, answers, audio, or internal notes.'),
    list('Teaching approval means the applicant has met platform requirements.', 'A proof generated or submitted is not necessarily a verified credential.', 'Credential acceptance also depends on the required verification receipt, validity, and revocation checks.'),
    note('A narrow, accountable claim', 'A proof does not independently establish that AI grading was correct, that the applicant answered unaided, or that a credential is accepted by a regulator. The issuer remains responsible for the original assessment.'),
  ] },
  { id: 'scheduling', title: 'Reliable scheduling and lesson access', topic: 'Operations', summary: 'The server enforces deadlines and ownership so both apps refer to the same appointment.', blocks: [
    p('Tutors publish 30-minute slots. An unpublished calendar cell is not bookable supply. Offered slots can be open, held, booked, closed, or past. Availability confirmation and actual attendance are different checks.'),
    table(['Boundary in the source guide', 'Purpose'], [
      ['11 minutes before start', 'Unconfirmed open slots stop being bookable.'],
      ['5 minutes before start', 'Tutor-confirmed slots reach their final booking cutoff; student cancellation is closed.'],
      ['Up to 5 minutes early', 'Assigned participants may enter to prepare; lesson communication starts at the scheduled time.'],
      ['3 minutes after scheduled end', 'The classroom authorization window closes.'],
    ]),
    p('The server serializes competing claims on a slot and rejects conflicts. A cancelled or rescheduled booking must also lose its old classroom authorization. Browser clocks and calendar colors do not override stored booking times or server rules.'),
  ] },
  { id: 'service-quality', title: 'Attendance, support, and accountability', topic: 'Operations', summary: 'Evidence should explain what happened before an operator decides what it means.', blocks: [
    p('Attendance uses classroom-entry evidence during the scheduled lesson. Schedule confirmation alone does not establish attendance, and a late arrival is not immediately a final absence. Students and tutors can submit eligible lesson reports for concerns such as lateness or connection trouble.'),
    p('Reports enter a review process with assignment, priority, private staff updates, and a reporter-visible resolution. Manual corrections require a reason, and revoked penalties retain history rather than disappearing from the record.'),
    list('Support reviews the exact lesson, timing, attendance, and reported problem.', 'Operations distinguishes a provider outage, a technical fault, and a business-rule rejection.', 'Quality review and finance decisions remain permission-restricted and leave an audit trail.'),
    note('Evidence is not a verdict', 'Room entry, reported media connection, a complaint, and a recording are different sources. None alone proves teaching quality or fault.'),
  ] },
  { id: 'commercial-model', title: 'Lesson access and business sustainability', topic: 'Business', summary: 'The commercial model is access to teaching, not speculation on a token.', blocks: [
    p('When enabled, paid packages or lesson credits connect a disclosed purchase to a defined teaching entitlement. Price, access conditions, and refund handling must be explained before taking payment. A trial allowance, historical ticket balance, and private lesson pass are different access modes.'),
    table(['Access model', 'Important distinction'], [
      ['Trial booking', 'A limited allowance for an eligible account; the guide describes a trial-first source configuration, not a guarantee that every deployment uses it.'],
      ['Historical tickets', 'Paid lesson-access records with their own balance and finance history. Existing purchases must not be silently erased or converted.'],
      ['Private lesson passes', 'Proof-backed single-use entitlements under a gated pilot; not evidence of a general paid or mainnet launch.'],
    ]),
    p('An eligible trial flow does not require a wallet, ticket transfer, or private pass. Actual access remains dependent on deployed settings and account eligibility. A trial is not automatically paid revenue or a payable tutor earning.'),
    list('Delivery costs include tutor compensation, recruitment, support, and quality review.', 'Infrastructure costs include live calls, storage, AI requests, payment processing, and applicable verification fees.', 'Sustainability also depends on acquisition costs, refunds, utilization, and repeat engagement.'),
  ] },
  { id: 'compensation', title: 'Compensation and financial controls', topic: 'Business', summary: 'A rate, an earned amount, and a completed payout are three different records.', blocks: [
    p('The source guide describes administrator-set tutor rates in USD, stored precisely with rate-change history, reasons, and version checks. An unset rate differs from a zero rate. Rate administration alone is not automatic payroll or proof of a completed payment.'),
    steps('Define the agreed terms and which lesson outcomes are payable.', 'Create lesson-level earnings records using the appropriate rate version and adjustment rules.', 'Review and authorize payouts and destinations.', 'Execute and reconcile the actual transfer before marking it complete.'),
    note('Implementation boundary', 'These stages describe the controls needed for a complete system, not a claim that automatic earnings and payroll are running. An uncertain transfer must be reconciled against its original identifier, not blindly resent.'),
  ] },
  { id: 'materials-ai', title: 'Teaching materials and AI assistance', topic: 'Technology', summary: 'The tutor leads; content tools support preparation and feedback.', blocks: [
    p('Materials are organized into courses, levels, chapters, and lesson pages. Tracks include conversational practice, Business English, Young Learners, discussion questions, and Daily Dispatch. A track in an editor does not mean every possible lesson is published.'),
    p('Tutors and students can receive different views of the same material. Answer keys, teaching guidance, and internal notes should not appear in a learner view. AI can assist with structured drafts, grammar, vocabulary explanations, pronunciation guidance, and transcript-based assessment support.'),
    list('Human review checks the learning objective, level, accuracy, and cultural suitability.', 'Assessment follows a rubric and retains the attempt and its approval evidence.', 'Providers receive only the information needed for the particular task.'),
    note('Not a claim of verified AI', 'Models can make plausible mistakes. A proof about a signed assessment does not prove correct AI execution or educational judgment. The guide does not establish zkML, guaranteed cost savings, or measured learning gains.'),
  ] },
  { id: 'architecture', title: 'How the technology fits together', topic: 'Technology', summary: 'Interfaces, business rules, records, live media, and verification play different roles.', blocks: [
    table(['Layer', 'Responsibility'], [
      ['Student and tutor interfaces', 'SolidJS applications for discovery, scheduling, learning, and teaching.'],
      ['Staff interface', 'A Preact dashboard for authorized operational work.'],
      ['Application API', 'Identity, permissions, booking rules, ownership, attendance, and approvals.'],
      ['Structured data and file storage', 'Business relationships, operational state, materials, and protected media; not everything belongs onchain.'],
      ['Delivery and live media', 'Cloudflare Workers deliver interfaces; configured media services carry lessons.'],
      ['Execution and key services', 'Approved proof or blockchain operations without exposing signing credentials to the browser.'],
    ]),
    p('These services can fail independently. A working profile page does not prove that booking, live calls, or a verification receipt is available. Durable records, stable operation identifiers, retry controls, and reconciliation support recovery without fabricating success.'),
  ] },
  { id: 'privacy-consent', title: 'Privacy, recordings, and consent', topic: 'Privacy', summary: 'A live lesson and a retained recording are separate activities with separate safeguards.', blocks: [
    p('Account sessions do not confer unlimited authority. Role-based checks restrict sensitive actions, including finance changes and recording access. Authentication or embedded-wallet tools do not replace application-level permissions or prove that each account is a unique human.'),
    p('Recording controls check permission from both assigned participants, their declared authority, media presence, and the authorized lesson window. A tutor engagement agreement does not authorize recording a student who declines or withdraws required consent. An adult or guardian declaration is not independent proof of guardianship.'),
    p('QA recordings are for restricted service review, not public marketing. The guide describes encrypted archives and authenticated administrator playback, with review and deletion activity recorded. Provider copies, backups, and delayed deletion require their own handling.'),
    note('No blanket privacy claims', 'Do not treat the service as completely anonymous or recordings as end-to-end encrypted from the media provider. Authorized processing, provider visibility, retention rules, and operational responsibilities still matter.'),
  ] },
  { id: 'verification', title: 'What private verification can prove', topic: 'Privacy', summary: 'Reveal less underlying information while verifying a carefully defined statement.', blocks: [
    p('A zero-knowledge proof can demonstrate that a particular rule was satisfied without revealing every private input. For example, approved assessment evidence can meet a screening policy without publishing a tutor\'s exact scores or recordings. The proof is only as meaningful as its rule, software, inputs, and issuer.'),
    table(['Feature design', 'Claim and boundary'], [
      ['Private tutor screening', 'Approved evidence meets a policy. Sharing is opt-in; scores and audio need not be public. This does not establish regulator recognition.'],
      ['Anonymous verified reviews', 'An eligible completed lesson can grant review entitlement. Enrollment still has an account association; later submission is designed to avoid a direct identifier.'],
      ['Provable review tallies', 'Selected feedback commitments and arithmetic match a batch. This does not establish honest sentiment or prove that no submission was omitted.'],
      ['Private lesson passes', 'A single-use entitlement can authorize access with less public spending history. The platform still knows the booking; this is not private payment processing.'],
    ]),
    p('Anonymous review pilots use eligibility rules, minimum cohort sizes, structured feedback, and limited windows. Membership and backup handling remain operational dependencies. The presence of code is not proof of approved cohort acceptance or publication.'),
    note('A badge is not a learning outcome', 'A credential is not proof of teaching quality. A review is not proof of call duration. A pass is not proof of learning. A valid proof does not remove trust in the original records.'),
  ] },
  { id: 'networks-status', title: 'Networks, receipts, and rollout boundaries', topic: 'Technology', summary: 'Source code, network connectivity, and a launched product are different milestones.', blocks: [
    p('The guide discusses Base for EVM operations and zkVerify for proof verification. Native balances, signing accounts, testnets, and mainnets have different roles. Test assets are not revenue, and funding an account does not activate a product feature.'),
    p('Proof generation, submission, verification, aggregation where required, relay publication, and application acceptance are separate stages. A transaction can finalize while its required destination receipt is missing; the product should remain pending until the relevant evidence arrives.'),
    table(['Area', 'How to read the source guide'], [
      ['Core teaching workflows', 'Accounts, application review, schedules, classrooms, materials, and issue handling are described as implemented workflows, dependent on running services and permissions.'],
      ['Private passes, reviews, and tallies', 'Scoped, gated pilot work. Approved cohorts, acceptance evidence, activation dependencies, and publication controls remain necessary.'],
      ['Tutor credentials', 'Evidence-bound design with approved artifacts and opt-in sharing. Implementation is not proof of independent audit or universal acceptance.'],
      ['Network integration', 'Mainnet connectivity and historical testnet evidence do not establish an end-to-end production launch of every module.'],
      ['Financial automation', 'Rate administration is separate from earnings ledgers, payout approval, and reconciled transfers.'],
    ]),
    note('A dated explanation, not a live status board', 'This public guide adapts the dashboard Platform Guide reviewed on October 13, 2026. Later releases, feature flags, agreements, and actual service records can differ. It is not a live deployment audit or a replacement for current terms and policies.'),
  ] },
  { id: 'measurement', title: 'What responsible growth looks like', topic: 'Business', summary: 'Useful learning and reliable service matter more than unqualified activity counts.', blocks: [
    p('The operating funnel is discovery, booking, attendance, useful learning, and repeat engagement. More bookings accompanied by more cancellations can increase support costs without improving the service. Published availability, booked lessons, completed lessons, and payouts should not be counted as the same outcome.'),
    list('Track bookable supply and tutor utilization with clear time ranges.', 'Review attendance, cancellations, note timeliness, unresolved issues, and feedback sample sizes.', 'Distinguish purchased credits, recognized revenue, operating fees, tutor earnings, refunds, and completed payouts.', 'Evaluate repeat booking, trial conversion where enabled, acquisition costs, and learning outcomes with a defined methodology.'),
    p('For funders and partners, meaningful next steps include strengthening curriculum quality, testing full verification workflows, reviewing security and privacy independently, validating service outcomes, and establishing sound financial reconciliation before expanding pilots.'),
    note('Evidence before impact claims', 'These are evaluation priorities, not published traction, measured learning gains, audited financial results, or guaranteed grant outcomes. Synthetic engineering tests are not real customers or delivered lessons.'),
  ] },
];

export const overviewGlossary = [
  ['Commitment', 'A sealed digital reference that binds information without openly publishing all of its contents.'],
  ['Nullifier', 'A one-use marker that helps reject repeated use of the same review or lesson entitlement.'],
  ['Issuer', 'The organization responsible for making and signing a claim, such as an approved assessment result.'],
  ['Receipt', 'Evidence that a required verification result reached the required network or destination.'],
  ['Reconciliation', 'Checking original records and execution outcomes before resolving an uncertain action.'],
  ['Audit trail', 'A record of who changed something, when, and why; not an independent security audit.'],
] as const;

export function overviewText(chapter: OverviewChapter): string {
  return [chapter.title, chapter.summary, ...chapter.blocks.flatMap(block => block.kind === 'list' || block.kind === 'steps' ? block.items : block.kind === 'table' ? [...block.headings, ...block.rows.flat()] : block.kind === 'note' ? [block.title, block.text] : [block.text])].join(' ');
}
export function filterOverview(query: string, topic: OverviewTopic | 'All' = 'All') {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return overviewChapters.filter(chapter => (topic === 'All' || chapter.topic === topic) && words.every(word => overviewText(chapter).toLowerCase().includes(word)));
}
export const overviewReadingMinutes = Math.ceil(overviewChapters.map(overviewText).join(' ').split(/\s+/).length / 220);
