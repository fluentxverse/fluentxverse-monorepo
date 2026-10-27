import type { OverviewChapter } from './platformOverview';
import type { PublicAppGuideContent } from '../components/PublicAppGuide';

const chapters: OverviewChapter[] = [
  { id: 'learning-experience', title: 'A learning experience built around people', topic: 'Business', summary: 'The student app connects a learner with a tutor, a reliable appointment, and useful follow-up.', blocks: [
    { kind: 'paragraph', text: 'FluentXVerse ESL is designed for live, one-to-one English learning. The student app brings tutor discovery, lesson booking, classroom access, learning materials, and lesson history into a connected journey. The tutor provides the conversation, explanation, and adaptation that software alone cannot supply.' },
    { kind: 'paragraph', text: 'A learner can explore tutors before signing in, then use an account to manage personal bookings and learning information. Practical goals can include everyday conversation, workplace communication, and confidence speaking English. The app is not a promise of guaranteed fluency or a substitute for a learner\'s own practice.' },
    { kind: 'list', items: ['Before a lesson: compare tutors and find a suitable time.', 'During a lesson: practise with a person using live audio, video, chat, and materials.', 'After a lesson: revisit the appointment, available notes, and learning preferences before deciding what comes next.'] },
    { kind: 'note', title: 'For partners and funders', text: 'This guide explains the learner-facing workflows found in the reviewed student source. It does not claim measured learning gains, active customer numbers, accreditation, or guaranteed commercial outcomes.' },
  ] },
  { id: 'account-access', title: 'Explore first. Sign in when it becomes personal.', topic: 'Operations', summary: 'Public discovery and protected student records have different access requirements.', blocks: [
    { kind: 'paragraph', text: 'The public homepage, tutor browsing, and tutor profiles help visitors understand the service. A visitor can inspect a tutor\'s schedule; proceeding with a booking requires sign-in or registration. Personal schedules, profiles, inbox messages, and assigned classrooms are protected account workflows.' },
    { kind: 'paragraph', text: 'Supported sign-in routes establish a student session. The application still checks the account and its role on the server; successful sign-in through an outside identity provider does not authorize access to another learner\'s booking or classroom.' },
    { kind: 'list', items: ['Use your own account for bookings, notes, preferences, and support requests.', 'Review sign-in and recovery prompts carefully. Do not share passwords, wallet recovery secrets, or private review backups with a tutor.', 'If a session expires, reauthenticate through the app rather than assuming a previously open page still grants access.'] },
    { kind: 'note', title: 'An account is not proof of a unique person', text: 'Identity checks and booking ownership remain important. Account creation alone does not independently establish age, guardianship, or that someone has only one account.' },
  ] },
  { id: 'find-a-tutor', title: 'Find a tutor who fits your next step', topic: 'Operations', summary: 'Profiles and availability help learners choose a person and an actual bookable time.', blocks: [
    { kind: 'paragraph', text: 'Browse Tutors supports a tutor-name search, a day selection, and time filters. The reviewed page uses Japan Standard Time (JST) labels while its availability requests use Philippine operational dates and times. A timezone label describes the same actual appointment, not a separate schedule.' },
    { kind: 'paragraph', text: 'The time filter starts with the next potentially bookable half-hour window. Elapsed start options disappear, and the default advances to the next operational day when today has no remaining starts. The server still decides whether an individual tutor\'s slot is bookable.' },
    { kind: 'list', items: ['Review the tutor\'s introduction, available profile information, teaching interests, and languages.', 'Watch an introduction video where one has been provided; not every tutor has the same profile content.', 'Inspect available schedules and, when signed in, save tutors to favorites.', 'Treat ratings and verification badges as specific pieces of information, not guarantees of a suitable teaching relationship.'] },
    { kind: 'note', title: 'No results is a useful state', text: 'A tutor can exist without having an open slot in the selected time window. Change the day, broaden the time range, or reset filters rather than treating a name search as a promise of availability.' },
  ] },
  { id: 'booking-a-lesson', title: 'From an open slot to a confirmed lesson', topic: 'Operations', summary: 'Selecting a time, holding it, and confirming a booking are separate steps.', blocks: [
    { kind: 'steps', items: ['Open a tutor\'s schedule and choose an offered lesson time.', 'Sign in if needed. Review the tutor, date, timezone, and applicable lesson-access requirements.', 'The server checks eligibility, availability, and conflicting bookings. A temporary reservation protects checkout but is not itself a completed booking.', 'Complete the enabled access flow and wait for the booking confirmation.', 'Find the confirmed appointment in your schedule and open its lesson page when you are ready to prepare.'] },
    { kind: 'paragraph', text: 'A standard lesson is 25 minutes inside a 30-minute calendar slot. The remaining calendar time separates appointments. A displayed slot can become unavailable before checkout finishes; server-side validation prevents competing requests from legitimately owning the same slot.' },
    { kind: 'note', title: 'Confirm the booking, not just a payment step', text: 'A ticket transfer, temporary hold, or waiting indicator is not the same as an assigned lesson. If the result is uncertain, check the original appointment and transaction status before starting another paid attempt.' },
  ] },
  { id: 'lesson-access', title: 'Trial allowances, tickets, and private passes', topic: 'Business', summary: 'Access modes are configuration-dependent and should not be confused with learning outcomes.', blocks: [
    { kind: 'table', headings: ['Access model', 'What a learner needs to know'], rows: [
      ['Eligible trial', 'A limited account allowance where trial booking is enabled. The trial flow does not require a wallet, ticket transfer, or private pass.'],
      ['Ticket-based access', 'An enabled ticket flow can require an applicable balance and confirmation steps. The reviewed source includes ticket and purchase-history pages behind a launch setting.'],
      ['Private lesson pass', 'A proof-backed, single-use entitlement in a gated design. Its implementation does not establish general availability or private payment processing.'],
    ] },
    { kind: 'paragraph', text: 'The booking dialog checks the enabled access mode. Visible pages, account eligibility, and payment requirements can differ across deployments. Review the actual offer and confirmation rather than inferring an entitlement from this public guide.' },
    { kind: 'note', title: 'No invented prices or commercial promises', text: 'This guide does not set package prices, token values, trial quotas, refund amounts, or investment returns. Applicable terms, deployed rules, and the actual account record take precedence.' },
  ] },
  { id: 'manage-your-schedule', title: 'Keep track of upcoming and past lessons', topic: 'Operations', summary: 'The schedule and lesson page are the learner\'s appointment record.', blocks: [
    { kind: 'paragraph', text: 'The schedule organizes appointments so students can review upcoming and past lessons, identify the tutor and time, and open lesson details. Classroom availability is time-bound; seeing an appointment is not permission to join any room at any time.' },
    { kind: 'paragraph', text: 'Cancellation eligibility and entitlement restoration are different questions. The source rules close ordinary student cancellation during the final five minutes before a lesson. The cancellation confirmation also distinguishes early and late handling, including a one-hour boundary for the reviewed trial-restoration and ticket-refund presentation.' },
    { kind: 'list', items: ['Read the exact cancellation notice before confirming.', 'A cancelled booking should not retain authorization to use its old classroom.', 'An issue report does not automatically cancel a lesson or trigger a refund.', 'Use the confirmed schedule and server response when a browser clock, timezone, or status appears inconsistent.'] },
    { kind: 'note', title: 'A deadline is not a guarantee of refund', text: 'Being allowed to cancel does not automatically mean a credit or trial allowance will be restored. Support decisions and access modes have their own rules and recorded outcomes.' },
  ] },
  { id: 'the-classroom', title: 'The classroom: conversation with context', topic: 'Operations', summary: 'Audio, video, chat, and teaching materials support a shared lesson.', blocks: [
    { kind: 'paragraph', text: 'An assigned learner opens the lesson page and enters the authorized classroom when the join window is available. The reviewed timing model permits preparation up to five minutes early, starts lesson communication at the scheduled time, and closes authorization after a bounded wrap-up.' },
    { kind: 'list', items: ['Check the camera and microphone devices and respond to browser permission prompts.', 'Use microphone and camera controls within the supported lesson state.', 'Follow shared materials and use lesson chat to support the conversation.', 'A room entry, a reported media connection, and attendance are related but distinct pieces of evidence.'] },
    { kind: 'paragraph', text: 'The lesson is not an always-open video room. Cancelled or unauthorized bookings must not retain communication access. Browser permissions, the media provider, the application connection, and the learner\'s network can affect the experience independently.' },
    { kind: 'note', title: 'Prepare without assuming the lesson has started', text: 'Device preparation and early room entry do not change the advertised 25-minute lesson or independently prove that teaching took place.' },
  ] },
  { id: 'learning-materials', title: 'A library for practical English practice', topic: 'Technology', summary: 'The learner view complements tutor-led teaching without exposing teaching-only content.', blocks: [
    { kind: 'table', headings: ['Reviewed collection', 'Learning focus'], rows: [
      ['Conversational Skills', 'Everyday exchanges, vocabulary, speaking practice, and discussion.'],
      ['Business English', 'Workplace communication, meetings, presentations, and professional vocabulary.'],
      ['Daily Dispatch', 'Reading and discussion with vocabulary and comprehension prompts.'],
    ] },
    { kind: 'paragraph', text: 'The materials library provides search and collection filters. Individual courses can organize published lessons by level or chapter. Additional routes, such as Young Learners, do not mean every proposed collection is published or that every student sees an identical catalogue.' },
    { kind: 'paragraph', text: 'Students and tutors may see different information for the same lesson. Answer keys and internal teaching guidance should remain separate from the learner view. Content availability is not a claim that a course is accredited, complete at every level, or independently proven effective.' },
  ] },
  { id: 'profile-and-notes', title: 'Preferences, lesson history, and follow-up', topic: 'Operations', summary: 'Useful context helps the next lesson build on the last one.', blocks: [
    { kind: 'paragraph', text: 'The student profile brings together personal learning information, history, and materials-related views. Lesson preferences include a camera preference, an error-correction preference, and other requests. These communicate needs to the service; they do not override safety, consent, or classroom policy.' },
    { kind: 'paragraph', text: 'History & Notes shows past appointments and links to lesson details. The reviewed history view uses five entries per page rather than showing an unbounded list. Available tutor notes give learners something concrete to revisit between lessons.' },
    { kind: 'list', items: ['Review the previous lesson before choosing what to practise next.', 'Update requests when your needs change rather than expecting a tutor to infer them.', 'Treat missing or delayed notes as a record to check, not proof of a particular learning result.', 'A learner history is a service record, not an accredited qualification or an independently validated proficiency score.'] },
  ] },
  { id: 'messages-and-support', title: 'Messages, notifications, and lesson concerns', topic: 'Operations', summary: 'Communication and issue handling are part of the service, not separate from it.', blocks: [
    { kind: 'paragraph', text: 'The app includes account messages and notifications for relevant platform and lesson events. Notifications can direct a learner back to the appropriate lesson or record. A stale notification should not override the current booking state.' },
    { kind: 'paragraph', text: 'Eligible lesson issue reports let learners raise concerns such as lateness, connection trouble, or another service problem. Operations reviews the report and its evidence. A report is not an automatic finding against a tutor, cancellation, or payment adjustment.' },
    { kind: 'steps', items: ['Identify the exact appointment, tutor, date, and reported concern.', 'Describe what happened without sharing passwords, private keys, or another person\'s private information.', 'Use the eligible in-app reporting route or the published support contact.', 'Check the recorded resolution and any separate booking or financial outcome.'] },
  ] },
  { id: 'consent-and-privacy', title: 'Your lesson is not public content', topic: 'Privacy', summary: 'Personal records, live calls, and recordings require different safeguards.', blocks: [
    { kind: 'paragraph', text: 'Schedules, lesson notes, and assigned classrooms depend on the signed-in account and server-side permission checks. A visitor reading this guide does not gain access to learner records. Neither a tutor nor an ordinary user should receive another student\'s private history.' },
    { kind: 'paragraph', text: 'Where recording is supported, the reviewed classroom controls require versioned permission from both assigned participants, declared authority, actual media presence, and the authorized lesson window. A tutor\'s standing agreement does not authorize recording a student who declines or withdraws required consent.' },
    { kind: 'paragraph', text: 'Quality-review recordings are not intended as public marketing media. A restricted encrypted archive is different from end-to-end encryption against the media provider. Provider handling, backups, retention, and authorized access remain part of the privacy picture.' },
    { kind: 'note', title: 'Consent and identity are not interchangeable', text: 'A recorded adult or guardian declaration is not independent proof of guardianship. Do not assume blanket anonymity, zero retention, unrestricted playback, or that a preference setting replaces a required recording permission.' },
  ] },
  { id: 'feedback-and-proof', title: 'Feedback and private verification', topic: 'Privacy', summary: 'Eligibility, anonymity, and verified learning are different claims.', blocks: [
    { kind: 'paragraph', text: 'The source includes eligibility-dependent anonymous-review components and a student review workspace. Enrollment follows qualifying completed-lesson rules. Structured ratings and topics avoid free-form identifying comments; the interface describes one review per tutor per month and publication only in a batch of at least five reviews.' },
    { kind: 'paragraph', text: 'A private review identity or backup can be needed to submit feedback. Enrollment can remain associated with the account even when a later submission avoids a direct identifier. Small groups and outside information can still reveal who gave feedback.' },
    { kind: 'list', items: ['A review entitlement is not proof of call duration or teaching quality.', 'A provable tally can check selected commitments and arithmetic without proving honest sentiment or complete inclusion.', 'Private passes reduce some public entitlement traces; they do not make payments or bookings invisible to the platform.', 'Pilot code, a verification badge, and a generally available production feature are different milestones.'] },
    { kind: 'note', title: 'Eligibility and rollout limits still apply', text: 'This guide does not activate a review window, publish a cohort, or promise a private pass. Feature settings, sufficient participation, required receipts, and approved operational rules must be satisfied.' },
  ] },
  { id: 'technology-and-limits', title: 'What software and AI do behind the scenes', topic: 'Technology', summary: 'The interface coordinates learning; protected services enforce the rules.', blocks: [
    { kind: 'paragraph', text: 'The student app is a SolidJS interface delivered separately from the application API. The API checks identity, booking ownership, availability, deadlines, and permitted classroom actions. Storage, authentication, live media, and any enabled transaction or verification service can fail independently.' },
    { kind: 'paragraph', text: 'AI supports selected content preparation, language explanations, and assessment-related workflows across the platform. That is not a claim of an autonomous tutor, an always-available student AI assistant, independently verified AI execution, or a validated proficiency assessment.' },
    { kind: 'note', title: 'A source review is not a live audit', text: 'This guide was prepared from the shipped student-interface source and associated policy descriptions reviewed on October 24, 2026. UI routes, deployment flags, account eligibility, agreements, and actual records determine what is available. It does not report live infrastructure health or establish a universal mainnet launch.' },
  ] },
  { id: 'student-outcomes', title: 'What progress should mean', topic: 'Business', summary: 'Participation and useful follow-up matter more than unqualified activity counts.', blocks: [
    { kind: 'paragraph', text: 'A meaningful learner journey moves from finding a suitable tutor to attending, practising, receiving feedback, and choosing the next step. More bookings alone do not establish learning gains; a completed lesson, an optional review, and a proficiency improvement are different measures.' },
    { kind: 'list', items: ['Evaluate discovery-to-booking friction, attendance, cancellations, and repeat engagement.', 'Review the usefulness and timeliness of lesson notes, support resolution, and feedback.', 'Measure educational outcomes with an explicit methodology rather than treating a badge or transaction as learning evidence.', 'Separate synthetic test activity from real learners and delivered lessons.'] },
    { kind: 'note', title: 'For responsible expansion', text: 'Curriculum evaluation, accessibility, reliable classroom delivery, privacy review, and sound access/refund controls are useful partnership priorities. They are not published traction, guaranteed fluency, accredited results, or a promise of grant funding.' },
  ] },
];

export const studentOverview: PublicAppGuideContent = {
  path: '/esl-student-app',
  title: 'ESL Student App',
  eyebrow: 'FLUENTXVERSE ESL / THE LEARNER EXPERIENCE',
  lead: 'From finding your tutor to finding your voice.',
  description: 'A public guide for learners, partners, and funders: discovery, booking, live lessons, materials, follow-up, and the safeguards around them.',
  chapters,
  glossary: [
    ['Bookable slot', 'An offered time that still satisfies the tutor\'s availability and the server\'s booking rules.'],
    ['Reservation', 'A temporary hold during checkout; not yet a confirmed appointment.'],
    ['Lesson access', 'The eligible trial allowance, ticket, or other enabled entitlement required by the current booking mode.'],
    ['JST / PHT', 'Japan Standard Time / Philippine Time. JST is one hour ahead; the appointment still represents one actual moment.'],
    ['Consent', 'A specific required permission, not blanket authorization to use or publish a recording.'],
    ['Review cohort', 'A group of eligible participants used by a scoped feedback workflow. A small group can limit privacy.'],
  ],
  sourceDate: '2026-10-24',
  sourceDateLabel: 'October 24, 2026',
  sourceIntro: 'Prepared from the shipped student-interface source and associated policy descriptions, reviewed',
  sourceNote: 'Written from student routes, browsing and booking controls, schedules, classroom, materials, profiles, notes, and review components. It is not a live service audit or a copy of the tutor guide. Availability depends on deployed settings, eligibility, current agreements, and actual records.',
  portalHref: 'https://student.fluentxverse.com',
  portalLabel: 'Open the student app',
  imageWide: '/assets/img/esl-japanese-student-v2.webp',
  imageMobile: '/assets/img/esl-japanese-student-v2.webp',
  imageWidth: 1862,
  imageHeight: 845,
  relatedHref: '/esl-tutor-app',
  relatedLabel: 'The tutor-app and platform guide',
  student: true,
};
