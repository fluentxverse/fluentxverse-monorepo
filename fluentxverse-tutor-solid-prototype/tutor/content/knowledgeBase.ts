// Timing and policy guidance follows the current schedule, lesson controls, and tutor terms.
export const knowledgeCategories = [
  { id: 'getting-started', label: 'Getting started' },
  { id: 'scheduling', label: 'Schedule & attendance' },
  { id: 'classroom', label: 'Classroom & devices' },
  { id: 'teaching', label: 'Teaching & feedback' },
  { id: 'account', label: 'Account & support' },
  { id: 'compensation', label: 'Compensation' },
] as const;
export type KnowledgeCategory = typeof knowledgeCategories[number]['id'];
export type KnowledgeSection = { id: string; title: string; paragraphs?: string[]; steps?: string[]; note?: string };
export type KnowledgeArticle = {
  slug: string; title: string; summary: string; category: KnowledgeCategory; tags: string[];
  sections: KnowledgeSection[]; links: { label: string; href: string }[];
};
export const knowledgeUpdatedOn = '2026-10-22';
export const knowledgeArticles: KnowledgeArticle[] = [
  {
    slug: 'getting-ready-to-teach', title: 'Getting ready to teach', category: 'getting-started',
    summary: 'Your application, assessments, interview, and teaching readiness.', tags: ['onboarding', 'certification', 'approval', 'exam'],
    sections: [
      { id: 'application', title: 'Check your application', paragraphs: ['Open Home to review your onboarding progress. Complete the application details and the assessment or interview steps shown for your account. Registration alone does not mean you are approved to teach.'] },
      { id: 'prepare', title: 'Prepare your workspace', steps: ['Check your profile information and the status of any requested changes.', 'Test your camera, microphone, headphones, and connection before a lesson.', 'Review the available teaching materials and the current tutor terms. Complete any separately required agreements before teaching.'] },
      { id: 'approval', title: 'If a step is still pending', paragraphs: ['Use the status shown on Home rather than repeating an assessment or application. Contact support with the step, your account email, and a screenshot if the status appears incorrect.'], note: 'Completing an assessment does not guarantee approval, lesson bookings, or earnings.' },
    ], links: [{ label: 'Open Home', href: '/home' }, { label: 'Tutor terms', href: '/terms-of-service' }],
  },
  {
    slug: 'update-your-tutor-profile', title: 'Update your tutor profile', category: 'getting-started',
    summary: 'Keep your photo, introduction, and teaching information current.', tags: ['bio', 'picture', 'photo', 'video', 'profile'],
    sections: [
      { id: 'edit', title: 'Review your information', steps: ['Open My Profile.', 'Use the edit controls next to the information you want to change.', 'Save your changes and check any approval or review status displayed.'] },
      { id: 'introduction', title: 'Make your introduction useful', paragraphs: ['Use a clear profile photo and a short, accurate introduction. Describe the learning goals you can help with and your relevant experience. Do not claim qualifications or outcomes you cannot support.'] },
      { id: 'video', title: 'Check your introduction video', paragraphs: ['Preview your introduction after uploading it. Check that your face is visible and your speech is easy to hear. If an upload fails, keep the error message and file details for support; do not include account passwords.'] },
    ], links: [{ label: 'My Profile', href: '/profile' }],
  },
  {
    slug: 'open-and-manage-availability', title: 'Open and manage your availability', category: 'scheduling',
    summary: 'Publish time you can teach and understand the calendar states.', tags: ['slots', 'calendar', 'open', 'available', 'PHT', 'JST'],
    sections: [
      { id: 'publish', title: 'Publish available time', steps: ['Open Schedule and select the week and time period.', 'Select eligible slots you can reliably attend.', 'Review the selection and confirm the opening. Check that the calendar reflects the saved change.'] },
      { id: 'states', title: 'Open is not the same as booked', paragraphs: ['An open slot offers your availability to students. A booked slot has a student reservation and must be kept available. Closed, past, or otherwise unavailable cells cannot be treated as bookable time.', 'Use the calendar legend and the confirmation shown for a selected slot. The server controls eligibility and deadlines, not your device clock.'] },
      { id: 'timezone', title: 'Check the time zone', paragraphs: ['Tutor schedules use Philippine Time (PHT). Student schedules use Japan Standard Time (JST), which is one hour ahead. Both views refer to the same actual lesson. Check the date as well as the time when discussing a booking.'] },
    ], links: [{ label: 'Open Schedule', href: '/schedule' }],
  },
  {
    slug: 'confirm-availability-and-attendance', title: 'Confirm availability and attend your lesson', category: 'scheduling',
    summary: 'Availability confirmation and classroom entry are separate steps.', tags: ['present', '35', '11', 'confirmation', 'TA-302', 'attendance'],
    sections: [
      { id: 'confirmation', title: 'Confirm during the displayed window', paragraphs: ['The current availability confirmation window is 35 to 11 minutes before class. Use the schedule controls and verify that your confirmation is saved. For consecutive slots, review the group selected by the app before confirming.'], note: 'An unconfirmed, unbooked open slot can close with TA-302 at the confirmation deadline. Check your schedule instead of relying only on a notification.' },
      { id: 'entry', title: 'Enter your booked classroom', paragraphs: ['Confirming availability does not enter the classroom. Open the booked lesson and join when classroom entry becomes available. Be ready for the scheduled start; the service enforces a five-minute-after-start tutor entry deadline.'] },
      { id: 'records', title: 'Check unexpected attendance records', paragraphs: ['Review the specific lesson and your performance metrics. If a record appears incorrect, collect the booking reference, lesson date, displayed time zone, and the relevant error or entry evidence, then contact support.'] },
    ], links: [{ label: 'Open Schedule', href: '/schedule' }, { label: 'Performance Metrics', href: '/performance-metrics' }],
  },
  {
    slug: 'slot-changes-and-booking-restrictions', title: 'Slot changes and booking restrictions', category: 'scheduling',
    summary: 'Understand protected bookings, late changes, and restricted availability.', tags: ['blocked', 'block', 'BLK-601', 'cancel', 'TA-301', 'TA-303', 'penalty'],
    sections: [
      { id: 'changes', title: 'Review before changing a slot', paragraphs: ['Booked time is protected because a student has committed to it. Use the absence or schedule controls provided by the app rather than assuming that closing the browser cancels a lesson.', 'An unbooked opening cancelled at least 48 hours ahead has no short-notice penalty. Later cancellations receive TA-303. Read the slot confirmation carefully before applying a change.'] },
      { id: 'restriction', title: 'If new openings are restricted', paragraphs: ['Read the restriction shown in Schedule, including any reason or expiry. Do not create another account to bypass it. A restriction on new openings does not mean existing booked lessons can be ignored.'], note: 'Only authorized staff can review or lift an administrative restriction. This knowledge base cannot change an account status.' },
      { id: 'review', title: 'Request a review', steps: ['Identify the affected booking or slot and the displayed code.', 'Record the date, time zone, and what happened. Include relevant screenshots without exposing private student details.', 'Contact support with the requested correction. Continue checking the actual account status while the request is reviewed.'] },
    ], links: [{ label: 'Open Schedule', href: '/schedule' }, { label: 'Contact support', href: 'mailto:support@fluentxverse.com' }],
  },
  {
    slug: 'join-your-classroom', title: 'Join your classroom', category: 'classroom',
    summary: 'Open the right lesson and understand classroom access times.', tags: ['join', 'enter', 'room', 'lesson', 'early', 'late'],
    sections: [
      { id: 'join', title: 'Open the booked lesson', steps: ['Find the booking in Schedule or your upcoming lessons.', 'Check the student, date, and start time.', 'Open the lesson and use its classroom entry control when eligible.'] },
      { id: 'timing', title: 'Classroom access times', paragraphs: ['Eligible participants can enter up to five minutes before the scheduled start. Classroom chat and live communication unlock at the scheduled start.', 'The room may remain available for a voluntary wrap-up until three minutes after the scheduled end. That is not a guaranteed paid lesson extension.'], note: 'A cancelled or otherwise ineligible booking does not authorize classroom access. Server-enforced deadlines still apply if a device clock is incorrect.' },
      { id: 'unavailable', title: 'If the entry control is unavailable', paragraphs: ['Check the booking status and the current lesson window. If access should be available, preserve the error message, booking reference, and time, then contact support. Do not share the classroom link as a substitute for authorized access.'] },
    ], links: [{ label: 'Open Schedule', href: '/schedule' }],
  },
  {
    slug: 'camera-microphone-and-connection', title: 'Camera, microphone, and connection checks', category: 'classroom',
    summary: 'Troubleshoot missing audio, blocked permissions, and connection problems.', tags: ['audio', 'video', 'sound', 'headphones', 'network', 'browser', 'permission'],
    sections: [
      { id: 'permissions', title: 'Check device access', steps: ['Allow camera and microphone access for the tutor site in your browser.', 'Choose the intended camera and microphone in the classroom device controls.', 'Check that the microphone is not muted and that headphones use the expected output device.', 'Close other applications that may be using the same camera or microphone.'] },
      { id: 'connection', title: 'Check the connection state', paragraphs: ['A working camera preview does not mean you are connected to the student. Check the classroom connection status as well as your local devices.', 'If the connection drops, use the available reconnect controls and check your network. Preserve any error before refreshing. Avoid repeatedly opening the same lesson in multiple tabs.'] },
      { id: 'report', title: 'Keep a record of an interruption', paragraphs: ['For a lesson problem, use the lesson issue control while its reporting window is open. Include what failed and when it happened. If that control is unavailable, contact support with the booking reference and error details.'] },
    ], links: [{ label: 'Open Schedule', href: '/schedule' }, { label: 'Contact support', href: 'mailto:support@fluentxverse.com' }],
  },
  {
    slug: 'report-and-review-lesson-issues', title: 'Report and review lesson issues', category: 'classroom',
    summary: 'Record a lesson problem and follow sent or received reports.', tags: ['report', 'issue', 'student absent', 'no-show', 'reliability', 'received'],
    sections: [
      { id: 'submit', title: 'Report from the affected lesson', steps: ['Open the relevant booked lesson.', 'Use the lesson issue control when the reporting window is open.', 'Choose the accurate issue and provide the details requested. Check the confirmation before leaving the page.'] },
      { id: 'follow', title: 'Follow the review', paragraphs: ['Open Performance Metrics and select Lesson issues to review sent and received reports. Use the direction and review-status controls to locate a report.', 'A report being submitted is not the same as a confirmed finding or a resolved case. Check the review status rather than assuming an automatic penalty or payment outcome.'] },
      { id: 'evidence', title: 'Share only relevant evidence', paragraphs: ['Keep the booking reference, date, time zone, and concise details of the interruption. Send evidence through authorized support channels. Never include a password, recovery phrase, or unrelated student information.'] },
    ], links: [{ label: 'Lesson issues', href: '/performance-metrics?period=all#issues' }],
  },
  {
    slug: 'prepare-lesson-materials', title: 'Prepare your lesson materials', category: 'teaching',
    summary: 'Review the learner context and choose appropriate teaching content.', tags: ['curriculum', 'business english', 'conversational skills', 'daily dispatch', 'young learners'],
    sections: [
      { id: 'learner', title: 'Start with the learner', paragraphs: ['Review the lesson page for the learner context, goals, requests, and available assessment information. Use the recorded level as context, not as a reason to ignore how the student responds during the lesson.'] },
      { id: 'materials', title: 'Prepare the selected content', steps: ['Open Materials and choose an available curriculum.', 'Review the lesson goal, vocabulary, practice tasks, and teaching notes.', 'Check that required images or media load before class.', 'Use the classroom material controls for the booked lesson rather than sending an unrelated editor or administrator link.'] },
      { id: 'adapt', title: 'Adapt during class', paragraphs: ['Keep the lesson goal clear, allow the student time to speak, and adjust pacing to the learner. Follow the student requests shown in the lesson where appropriate. Record meaningful progress and any material handoff in the lesson notes.'] },
    ], links: [{ label: 'Learning Materials', href: '/materials' }],
  },
  {
    slug: 'write-and-submit-lesson-notes', title: 'Write and submit lesson notes', category: 'teaching',
    summary: 'Give accurate feedback and complete notes within the lesson window.', tags: ['feedback', 'notes', '48 hours', 'assessment', 'handoff', 'overdue'],
    sections: [
      { id: 'write', title: 'Write useful feedback', paragraphs: ['Open the completed lesson and review the available note fields. Describe what the student practiced, a specific strength, and a useful next step. Use observed examples rather than generic praise or invented progress.'] },
      { id: 'submit', title: 'Check the submission window', paragraphs: ['The current note edit window is 48 hours after the scheduled lesson end. Follow the eligibility and deadline shown for that lesson. Save or submit using the provided control and check its confirmation.'], note: 'Do not falsely mark a learner absent to avoid notes. A reopened late submission does not become an on-time submission.' },
      { id: 'follow-up', title: 'Review outstanding notes', paragraphs: ['Use Performance Metrics to review overdue notes, then open the affected lesson. If the edit window has closed or an accurate submission is blocked, contact support with the booking reference. Do not create a different lesson record to work around the deadline.'] },
    ], links: [{ label: 'Open Schedule', href: '/schedule' }, { label: 'Performance Metrics', href: '/performance-metrics' }],
  },
  {
    slug: 'inbox-notifications-and-support', title: 'Inbox, notifications, and support', category: 'account',
    summary: 'Find platform messages and send support the details they need.', tags: ['email', 'announcement', 'message', 'contact', 'help'],
    sections: [
      { id: 'messages', title: 'Check messages and notifications', paragraphs: ['Inbox contains platform messages. Select a message to read it, use Unread to find new messages, or pin an item you need to revisit.', 'Notifications can link to bookings, lesson notes, or account events. Always check the current lesson or account status; a notification is not the authoritative record of a later change.'] },
      { id: 'support', title: 'Contact the support team', paragraphs: ['Email support@fluentxverse.com from the address associated with your account. Explain that you are using the tutor app and describe the action that failed.'], steps: ['Include the affected booking reference or page, if relevant.', 'Give the date, time, and displayed time zone.', 'Attach a relevant screenshot or exact error message and state the resolution you need.'] },
      { id: 'safe-details', title: 'Keep sensitive details private', paragraphs: ['Never send passwords, authentication codes, private keys, or recovery phrases. Remove unrelated student details from screenshots. Support review does not guarantee a particular outcome or response time.'] },
    ], links: [{ label: 'Open Inbox', href: '/inbox' }, { label: 'Contact support', href: 'mailto:support@fluentxverse.com' }],
  },
  {
    slug: 'account-security-and-privacy', title: 'Account security and privacy', category: 'account',
    summary: 'Protect access, update credentials, and raise a privacy concern.', tags: ['password', 'email', 'settings', 'privacy', 'recording', 'security'],
    sections: [
      { id: 'security', title: 'Protect your account', paragraphs: ['Use a unique password and protect any connected sign-in account. Do not share credentials or allow another person to teach under your identity. Sign out of shared devices.', 'Use Settings to review the available email, password, and personal-information controls. Check the confirmation after a change.'] },
      { id: 'recording', title: 'Respect classroom privacy', paragraphs: ['Follow the recording permissions and controls shown for the lesson. Do not assume that a general terms agreement authorizes every recording, or that a student has consented because they entered the room.', 'Do not publish student recordings, identifying chat, or personal information. Keep evidence within authorized review and support channels.'] },
      { id: 'requests', title: 'Report unauthorized access or request help', paragraphs: ['Contact support@fluentxverse.com for security or privacy concerns. Describe the affected tutor account and relevant event without sending a password or recovery phrase. Review the Privacy Policy for information about data requests.'] },
    ], links: [{ label: 'My Profile', href: '/profile' }, { label: 'Privacy Policy', href: '/privacy-policy' }],
  },
  {
    slug: 'compensation-records-and-questions', title: 'Compensation records and questions', category: 'compensation',
    summary: 'Review lesson evidence and raise a payment discrepancy.', tags: ['payment', 'pay', 'payout', 'rate', 'earnings', 'income'],
    sections: [
      { id: 'arrangement', title: 'Use your accepted payment arrangement', paragraphs: ['Your accepted tutor payment arrangement determines rates, eligibility, payment timing, deductions, and any invoicing requirements. A student ticket price, a lesson count, or a performance score is not itself a payout statement.'], note: 'The knowledge base does not set a rate or payment schedule. Refer to your accepted arrangement and any account-specific payment notices.' },
      { id: 'records', title: 'Check the relevant records', steps: ['Identify the lessons or payment period involved.', 'Review attendance, lesson issues, and any applicable decision or notice.', 'Keep the booking or transaction references and the amount you believe needs review.'] },
      { id: 'question', title: 'Raise a discrepancy securely', paragraphs: ['Contact support with your account email, the affected period, the reference numbers, and the difference you are asking about. Do not request a student transfer or send private payment credentials.', 'A submitted issue or appeal does not automatically decide compensation. Wait for the actual review outcome and payment record.'] },
    ], links: [{ label: 'Performance Metrics', href: '/performance-metrics' }, { label: 'Contact support', href: 'mailto:support@fluentxverse.com' }],
  },
];

const normalize = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function searchKnowledge(query: string, category = 'all', saved?: readonly string[]): KnowledgeArticle[] {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean).slice(0, 24);
  return knowledgeArticles.map(article => {
    const title = normalize(article.title), summary = normalize(article.summary), tags = normalize(article.tags.join(' '));
    const body = normalize(article.sections.map(section => [section.title, ...(section.paragraphs || []), ...(section.steps || []), section.note || ''].join(' ')).join(' '));
    const haystack = `${title} ${summary} ${tags} ${body}`;
    const score = terms.reduce((sum, term) => sum + (title.includes(term) ? 8 : summary.includes(term) ? 4 : tags.includes(term) ? 3 : 1), 0);
    return { article, score, matches: terms.every(term => haystack.includes(term)) };
  }).filter(({ article, matches }) => matches && (category === 'all' || article.category === category) && (!saved || saved.includes(article.slug)))
    .sort((a, b) => b.score - a.score).map(result => result.article);
}
export function parseKnowledgeBookmarks(raw: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((value): value is string => typeof value === 'string' && knowledgeArticles.some(article => article.slug === value)))].slice(0, 50);
  } catch { return []; }
}
