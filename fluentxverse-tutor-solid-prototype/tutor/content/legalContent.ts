export type LegalKind = 'privacy' | 'terms';
export interface LegalSection { id: string; title: string; paragraphs: string[]; items?: string[] }
export interface LegalDocumentContent { title: string; description: string; sections: LegalSection[] }
const tutor = true;
const s = (id: string, title: string, paragraphs: string[], items?: string[]): LegalSection => ({id,title,paragraphs,items});
const privacy: LegalDocumentContent = {
title:'Privacy Policy',
description:tutor ? 'How we handle tutor applications, teaching activity, and personal information.' : 'How we handle your account, lessons, and personal information.',
sections:[
s('scope','Who this policy covers',[
'This policy describes how FluentXVerse handles personal information through its websites, account services, classrooms, and support tools. "We", "us", and "our" refer to the FluentXVerse service operator. Contact support@fluentxverse.com for privacy requests or information about the entity responsible for your account.',
tutor ? 'This is the tutor policy, covering visitors, applicants, and active tutors. Student information you encounter is also protected by the separate student Privacy Policy.' : 'This is the student policy, covering visitors, students, and parents or guardians managing learner accounts. Tutors have a separate Privacy Policy in the tutor app.',
'Feature-specific notices may provide additional details. Lesson recording is a mandatory tutor engagement requirement: before beginning work with FluentXVerse, tutors must sign a separate recording agreement. Merely visiting the website, registering, or accepting these general terms does not replace that signed agreement.']),
s('information','Information you provide',[
tutor ? 'We receive account and contact details, profile photos, biographies, introduction videos, teaching preferences, applications, qualifications, assessment answers and results, speaking-test audio and transcripts, and interview details or recordings where collected with an appropriate notice.' : 'We receive account and contact details, profile photos, English level, learning goals, preferences, lesson requests, favorite tutors, messages, attachments, surveys, ratings, and information sent to support.',
'We also process booking details, account identifiers, wallet addresses where used, and transaction references. Optional profile fields and uploads are your choice. Information necessary to authenticate, book, deliver, or pay for a service may be required for that service.',
'Do not submit passwords, wallet recovery phrases, private keys, payment security codes, or unnecessary identity documents in ordinary messages. Avoid sharing sensitive health, identity, or family information unless genuinely necessary.']),
s('activity','Lesson activity and technical information',[
'We process lesson dates, materials, classroom entry and exit events, attendance, connection events, chat history, reports, and lesson notes. These records support lesson delivery and review of attendance, safety, and technical disputes.',
tutor ? 'Tutor records also include availability, presence confirmations, cancellations, note submissions and revisions, feedback, metrics, restrictions, and relevant transaction or payout records.' : 'Student records also include tickets, reservations, cancellations, refunds, surveys, and lesson history.',
'Infrastructure and providers may process IP addresses, device and browser details, timestamps, request logs, security events, and connection diagnostics. Classroom technology may expose connection information to the media provider and, depending on connection technology, the other participant.']),
s('permissions','Camera, microphone, and uploads',[
'Camera and microphone permissions support live lessons, device tests, and explicitly offered assessment or interview features. Browser permission is separate from permission to record. You can manage permissions in your browser and use supported classroom media controls.',
'Declining a device permission may prevent the relevant feature from working. Uploaded files are those you choose to submit. Avoid showing private documents, other people, or sensitive spaces in your camera background. Only upload media you have permission to share.']),
s('recording','Required tutor recording agreement',[
'Before beginning teaching work with FluentXVerse, you must sign a separate recording agreement covering your participation in platform lesson recording for quality assurance, service standards, and related compliance or issue review. This is a mandatory condition of the tutor engagement, not an optional choice made afresh for every lesson.',
'The signed agreement provides standing tutor authorization within its stated scope while it remains valid. It must explain the recording purposes, information captured, access, retention, and applicable rights. Material changes outside its scope require appropriate notice and any new agreement or authorization required by law.',
'Your agreement does not authorize recording the student without their required permission. The student recording choice remains separate; where the student declines or withdraws permission, platform recording must not start or must stop through the service control process. A mandatory tutor agreement does not mean every lesson will be recorded.',
'Recordings may include voice, image, screen-shared material, and other information captured in the session. They support teaching-quality review, service standards, and related compliance or issue review; they are not public lesson media.',
'Contact support if you object to recording, wish to withdraw authorization where applicable, or request deletion of an existing recording. These requests do not undo capture already made or waive rights provided by law. Any effect on future teaching arrangements must be reviewed under the signed engagement and applicable law; the agreement is not an irrevocable waiver of privacy rights.',
'The current quality-assurance recording setting is 30 days from recording invocation. Expired files are queued for deletion; technical failures can delay physical removal. Consent records, recording metadata, and administrator access logs are separate and may be retained for accountability, security, or legal needs. This period does not describe interview or assessment audio.']),
s('purposes','Why we process information',[
'We use information for purposes relevant to the service or request:'],[
'Create and authenticate accounts, restore sessions, and protect credentials.',
'Display permitted profiles, connect learners with tutors, and manage slots and bookings.',
'Deliver classroom media, chat, materials, assessments, notes, and feedback.',
'Process ticket use, payment and refund records, and applicable tutor payments.',
'Calculate attendance and performance, investigate reports, and correct disputed outcomes.',
'Provide support and booking, lesson, account, and security notifications.',
'Detect fraud or abuse, diagnose failures, maintain infrastructure, and meet legal duties.']),
s('grounds','Processing grounds and consent',[
'Depending on applicable law, processing may be necessary to provide a requested service, perform an agreement, meet a legal duty, or protect legitimate interests such as account security and service reliability. Where consent is required, we seek it separately and allow withdrawal.',
'Sensitive information requires the protections and grounds required by applicable law. Withdrawing optional consent does not affect processing already lawfully carried out or information retained for another lawful purpose. Feature limitations are explained where relevant.']),
s('visibility','Who can see your information',[
tutor ? 'Your published tutor profile may show your name, photo, biography, introduction video, teaching information, ratings, and available slots. Visitors may browse published information without signing in. Avoid publishing personal contact details you do not want others to see.' : 'Your assigned tutor can see relevant student learning-context information, requests, messages, materials, and notes needed to teach you. A student account is not intended to be a public tutor-directory profile.',
'Your lesson counterpart receives the messages, attachments, and live media you share. Profile and review features may publish information identified as public in the relevant feature. Authorized support and administrative staff may access relevant records for service operation, issue investigation, and quality review.',
'Sharing information in a lesson does not permit the other participant to reuse it outside the service.']),
s('providers','Providers and other disclosures',[
'Providers support authentication, hosting, delivery, database and file storage, email, classroom media, AI features, and payment or wallet services where offered. They receive information needed for their role and may process technical information under their own notices.',
'Current integrations include Cloudflare for delivery and supported classroom media, Privy for student identity and wallet features where enabled, and OpenAI for supported AI or transcription features. Social sign-in providers receive information when you choose their sign-in option. Integration availability varies by feature.',
'We may disclose relevant information to meet lawful requests, protect people or the service, investigate fraud, resolve disputes, or support a business transfer with appropriate safeguards. This policy does not authorize a recipient to publish confidential lesson information.']),
s('ai','AI-assisted processing',[
tutor ? 'AI tools may process assessment answers, speaking-test audio or transcripts, and selected lesson or note content to produce suggested grades, corrections, explanations, or teaching assistance.' : 'Supported AI learning or note features may process submitted content to generate corrections, explanations, or suggestions. Tutors may use supported assistance tools with relevant lesson content.',
'AI results can be incomplete, biased, or incorrect. Do not submit unnecessary sensitive information. Contact support to request review of an inaccurate assessment, attendance result, or restriction.',
'Consent to quality-assurance recording is separate from using an AI feature. This policy does not grant permission to use classroom recordings for unrelated model training.']),
s('storage','Cookies and browser storage',[
'Authentication cookies and browser storage support sessions, security, preferences, and applicable identity or wallet flows. Local storage may hold theme preferences and lesson-note drafts. Third-party sign-in may use its own cookies or storage.',
'Clearing or restricting storage may sign you out, remove local drafts, or prevent features from working. Sign out on shared devices. Optional tracking, if introduced, requires the notices and choices required by law; this policy does not itself create advertising-tracking consent.']),
s('international','International processing',[
'Students and tutors may be in different countries, and providers or infrastructure may process information outside your country. Local data protection rules and access by public authorities can differ.',
'Where law requires safeguards, specific information about overseas recipients, or consent to an international transfer, those requirements must be met for that processing. Merely accepting this policy is not a substitute. Contact support for recipient and processing details relevant to your account.']),
s('retention','Retention and deletion',[
'Account, lesson, chat, transaction, assessment, report, and support records serve different purposes. They are retained as needed for the relevant service, dispute handling, security, accounting, or legal obligations, rather than under one universal period.',
'Request account closure or deletion through support. We may verify identity and address outstanding bookings, balances, disputes, or recordkeeping duties. Closure does not immediately erase transaction records, another participant\'s legitimate lesson records, audit logs, or backup copies.',
'Public blockchain transactions, where used, may remain visible after closure and cannot be erased through an account deletion function. Local drafts, downloads, and files stored on your device require separate removal.']),
s('security','Security and incident reporting',[
'We use authentication, role-based access, and restricted access to sensitive service records. Authorized administrative access to quality-assurance recordings is logged. No device, network, or storage system is guaranteed completely secure.',
'Protect credentials and report suspected compromise or exposed lesson information promptly. We investigate incidents and provide notifications where required by law. Support will not ask for private keys or wallet recovery phrases.']),
s('rights','Your privacy rights',[
'Depending on applicable law, you may request access, correction, deletion or blocking, restriction or objection to processing, an eligible portable copy, and withdrawal of consent. Rights are subject to lawful exceptions and proportionate identity verification.',
'Email support@fluentxverse.com with your account email and request. We may ask for information needed to verify identity or locate a record; never send passwords or private keys. We explain relevant limitations and respond within the period required by law.',
'You may complain to the relevant data protection authority, including the Philippine National Privacy Commission or Japan\'s Personal Information Protection Commission where their laws apply. Asking support for help does not waive that right.']),
s('children','Children and guardians',[
'A learner who cannot independently enter an agreement or authorize processing must have an appropriately authorized parent or guardian manage the necessary permissions. Offering young-learner materials does not by itself permit independent child registration.',
'Guardians can contact support regarding an account, recording permission, or deletion request. We may verify authority before disclosing information. Report information supplied without the required authorization so it can be reviewed.']),
s('changes','Updates and privacy contact',[
'The updated date appears above. Material changes require appropriate notice and new agreement or consent where required. Continued use alone does not replace a required signature or authorize recording outside the agreed scope or unrelated processing.',
'Email support@fluentxverse.com for privacy requests, security concerns, provider questions, or clarification. Identify whether your request concerns the student or tutor app.'])
]};
const terms: LegalDocumentContent = {
title:'Terms of Service',
description:tutor ? 'Rules for applications, teaching, attendance, and the tutor platform.' : 'Rules for your account, tickets, bookings, and online lessons.',
sections:[
s('agreement','About these terms',[
'These terms govern FluentXVerse websites and associated account, scheduling, classroom, and support services. "FluentXVerse", "we", and "us" refer to the service operator. Contact support for operator and contractual information relevant to your account.',
tutor ? 'These are the tutor-facing terms. A separately accepted engagement, rate schedule, or payment agreement can add specific obligations. These website terms do not establish a wage, employment classification, or guaranteed lesson volume.' : 'These are the student-facing terms. Purchase-specific information and clearly presented booking conditions supplement them. The tutor app has separate terms.',
'By registering or using services requiring an agreement, you agree to these terms subject to applicable law and any required acceptance process. If you do not agree, do not register or use those services. The separate Privacy Policy explains data handling. Tutors must also sign the required recording agreement before beginning teaching work; acceptance of these general terms alone is not that signature.']),
s('eligibility','Eligibility and authority',[
'Provide accurate information and act for another person only with authority. If you cannot independently enter a binding agreement under applicable law, an authorized parent or guardian must handle the necessary agreement and permissions.',
tutor ? 'You must have the legal authority and qualifications or permissions required for your teaching services. Completing an application or assessment does not guarantee approval, certification, or paid work.' : 'A parent or guardian managing a learner account must ensure appropriate supervision and permissions. Availability of a course does not establish an independent registration age.',
'Do not impersonate others, misrepresent qualifications, share credentials, or create accounts to evade restrictions.']),
s('accounts','Account security and notices',[
'Protect credentials and connected sign-in accounts, sign out of shared devices, and report unauthorized access. You are responsible for activity you authorize; this does not remove service obligations for faults or unauthorized activity attributable to us.',
'Maintain a working contact email. Notices about bookings, cancellations, payments, accounts, or security may appear in the app or email. Check current app status rather than relying solely on a notification.']),
s('service','The learning service',[
'FluentXVerse connects students and tutors for scheduled English lessons, with related materials, chat, notes, and feedback. Feature access depends on eligibility, availability, compatible devices, and supported integrations.',
'Progress depends on participation and other factors. No particular fluency result, examination score, certification, or commercial result is guaranteed. Materials and AI suggestions are educational, not professional legal, medical, or financial advice.',
'Maintenance or feature changes are subject to appropriate notice where required and do not override mandatory rights or purchase-specific commitments.']),
s('booking',tutor ? 'Availability and booked lessons' : 'Bookings and time zones',[
tutor ? 'Published slots communicate your availability. Confirm presence during the window displayed in the schedule. The current confirmation window is 35 to 11 minutes before class; unconfirmed unbooked slots can close at the deadline. Keep booked time available.' : 'A booking exists when the service confirms it. A temporary checkout reservation can expire and is not a completed booking. Review availability, ticket eligibility, price, and cutoffs before confirmation.',
'Student schedules use Japan Standard Time (JST); tutor schedules use Philippine Time (PHT). Check the displayed time zone and date. A lesson has one scheduled instant, and browser clock differences do not alter server-enforced deadlines.',
tutor ? 'Attend accepted lessons, follow relevant learner requests, and maintain suitable audio, connectivity, and a professional environment. Do not substitute another tutor without an authorized arrangement.' : 'Review the tutor, duration, date, and ticket type before booking. An expired reservation or account restriction can prevent completion even if an earlier screen showed availability.']),
s('classroom','Classroom timing and access',[
'Eligible participants can enter up to five minutes early. Classroom chat and live communication unlock only at the scheduled start. A cancelled or otherwise ineligible booking does not authorize access.',
'Be ready at the scheduled start. Tutors must meet the five-minute-after-start entry deadline enforced by the service. Booking eligibility and timing rules govern continuing classroom access.',
'The classroom may stay available for a voluntary wrap-up until three minutes after the scheduled end. This is not a guaranteed paid lesson extension. Access and communication stop at the grace-period deadline.']),
s('cancellation','Cancellation deadlines',[
'Student self-service cancellation must complete before the lesson is five minutes away. At or after that cutoff it is unavailable. Closing the app or not attending is not cancellation. Contact support about exceptional circumstances.',
tutor ? 'Use the provided absence and schedule controls. Declared absence, missed confirmation, late slot changes, and failure to enter can produce different outcomes. A booked lesson is not automatically an absence before its start merely because confirmation is missing.' : 'Cancellation eligibility and ticket-refund eligibility are separate. An allowed cancellation near the start may still be nonrefundable.',
'Cancellation completes when the server confirms it. A pending refund does not require another cancellation or duplicate transaction. Check status or contact support.']),
s('payment',tutor ? 'Compensation and payout arrangements' : 'Tickets, purchases, and refunds',tutor ? [
'Your accepted tutor payment arrangement determines rates, payment eligibility, timing, deductions, and invoicing requirements. A student ticket price is not a promise of your payout. These terms do not invent a compensation rate or schedule.',
'Review lesson and transaction records, provide accurate payment details, and meet lawful verification requirements. Report discrepancies. Do not request a student\'s payment credentials, private keys, or off-platform transfers.',
'Relevant fees, taxes, and third-party processing conditions must be disclosed in the applicable arrangement. These terms do not waive tax, employment, or other mandatory protections.'
] : [
'The current booking configuration uses one eligible ticket per lesson. Basic and Premium tickets may have different eligibility and purchase conditions. Review price, tier, expiration or transfer limits, and payment details presented before purchase.',
'For ordinary student cancellation, the current policy returns the booking ticket when cancellation completes at least one hour before the start. Cancellation less than one hour before the start ordinarily does not return the ticket. The separate five-minute cancellation cutoff still applies.',
'A ticket return is not a cash refund of its purchase price. Purchase refunds, service failures, disputed charges, and exceptional lesson refunds are reviewed against purchase terms and applicable law. These terms do not declare every purchase nonrefundable.',
'Ticket returns can be pending or require verification, especially for wallet transactions. Contact support with a booking or transaction reference for delays. Do not pay twice or disclose private keys to obtain a refund.'
]),
s('wallets','Wallet and third-party transactions',[
'Where wallets or blockchain transactions are available, check network, asset, destination, and transaction details before authorization. Providers may impose fees, conditions, availability limits, or recovery procedures.',
'Confirmed blockchain transactions may be irreversible and public. Tickets are for supported platform uses; there is no promise of investment returns, resale value, or recovery of funds sent outside supported flows. Mandatory consumer rights remain in force.',
'Never share a private key or recovery phrase. Report suspicious payment requests to support.']),
s('attendance','Attendance and restrictions',[
'The service records classroom presence, connection events, confirmation, cancellation, and declared absence. Outcomes distinguish tutor absence, student absence, cancellation, system issues, and other reviewed circumstances.',
tutor ? 'Unconfirmed unbooked slots, late withdrawal of availability, and booked-lesson absence can affect metrics or booking eligibility under displayed scheduling rules. Automatic booked-lesson no-entry outcomes are evaluated after the scheduled lesson, not merely before it starts.' : 'Late connection or nonattendance may affect lesson outcomes and ticket eligibility. A connection event alone does not prove who caused a technical problem.',
'Repeated attendance problems or abuse may lead to restrictions. Ask support to review an inaccurate outcome, penalty, refund, or restriction and provide the lesson reference.']),
s('reports','Issue reporting and review',[
'Eligible lesson and classroom flows allow one submitted report per participant per lesson. You can still contact support with clarification or additional evidence.',
tutor ? 'Student-related reasons distinguish a request to cancel from a student being late. Choose accurately. A report does not replace authorized cancellation or automatically establish absence.' : 'During an active lesson, the missing-tutor report flow becomes available after the service observes at least 60 seconds of tutor absence, subject to eligibility checks.',
'Reports must be truthful and relevant. Submission is not automatic fault, refund approval, or a penalty. Support may review attendance, messages, transactions, consented recordings, and other relevant evidence.']),
s('feedback','Notes, surveys, and reviews',[
tutor ? 'Complete eligible lesson notes accurately within the displayed submission window. The current edit window is 48 hours after the scheduled lesson end. Do not falsely mark absence to avoid notes or invent learner progress.' : 'Eligible lessons can provide notes and an optional satisfaction survey. You can explain what went well and what could improve. Completing optional feedback is not required for ordinary lesson access.',
'Reviews must be respectful and based on experience. Do not include fabricated claims, harassment, or unnecessary personal information. Public reviews may be moderated for safety and accuracy, not merely because they are critical.',
'Feedback, metrics, and note histories support quality improvement and dispute review as described in the Privacy Policy.']),
s('recording','Recording and confidentiality',[
'Recording agreement is mandatory for tutors who decide to work with FluentXVerse. Before beginning teaching work, you must sign the separate recording agreement covering platform lesson recording for quality assurance, service standards, and related compliance or issue review. The agreement supplies standing tutor authorization within its scope, rather than a new optional tutor decision for each lesson.',
'The tutor agreement does not override a student recording choice. Platform recording requires the applicable student permission and must respect student refusal or withdrawal. It does not guarantee that every lesson is recorded or authorize personal recording, public posting, advertising, or unrelated AI training.',
'The Privacy Policy explains recording access and the current 30-day retention setting. Raise objections or requests concerning the agreement with support. Your statutory privacy rights remain in force; any effect on future teaching arrangements is subject to the signed engagement and applicable law.',
'Do not privately record, screenshot, rebroadcast, or publish another person\'s lesson, image, voice, messages, or information without required permission and a lawful basis. Permission for platform quality recording is not permission for personal recording or public posting.',
tutor ? 'Use student information only for authorized teaching and support. Do not retain unnecessary copies, move private information to unapproved tools, or contact learners for unrelated purposes. Report accidental disclosure promptly.' : 'Respect tutor privacy and content rights. Do not redistribute private classroom content or use it for impersonation, harassment, or commercial exploitation.']),
s('conduct','Acceptable use and safeguarding',[
'Treat participants respectfully and use the platform for legitimate learning, teaching, and related support.'],[
'No harassment, discrimination, threats, sexual exploitation, grooming, or inappropriate contact with minors.',
'No fraud, impersonation, false qualifications, fabricated attendance, or manipulated reviews.',
'No malicious files, credential theft, unauthorized access, or infrastructure disruption.',
'No unlawful uploads, copyright infringement, private-data scraping, or disclosure of others\' personal details.',
'No requests for recovery phrases, payment passwords, or suspicious external transactions.',
'Report safety concerns. Contact local emergency services for immediate danger; this platform is not an emergency service.'
]),
s('content','Content ownership and use',[
'Branding, software, and platform-owned materials belong to FluentXVerse or its licensors. Third-party content retains its owners\' rights. Access gives a limited right to use materials for their intended service, not ownership or unrestricted redistribution.',
'You retain rights you hold in original uploads, messages, and notes. You authorize storage, processing, and display reasonably needed to provide the feature you choose, deliver lessons, and handle support. Public profile content follows that feature\'s visibility.',
'Only submit content you have permission to share. Report infringement to support with the relevant material and rights. This service-use permission does not grant unrelated advertising or AI-training rights to confidential classroom recordings.']),
s('ai','AI tools and assessments',[
tutor ? 'Assessments, transcription, and AI-assisted grading can inform tutor review. Do not cheat, submit others\' responses, or misrepresent assistance. Request review of an inaccurate result.' : 'AI explanations and suggestions can be inaccurate. Check important answers with a tutor; generated text is not a guaranteed assessment of ability.',
'Providers may process content submitted to supported features as described in the Privacy Policy. Avoid unnecessary sensitive information. Automated outputs do not remove the right to request human review of a disputed service outcome.']),
s('closure','Suspension and closure',[
'We may restrict access to protect people, address fraud or serious misuse, meet legal duties, or investigate credible concerns. Where appropriate and legally required, we explain the reason and provide a review path; urgent safety measures may occur first.',
'Request closure through support. Outstanding lessons, tickets, payments, and disputes remain subject to applicable conditions and mandatory law. Closure does not erase all records or permit forfeiture of rights that cannot be waived.',
'When access ends, stop using restricted services and confidential information. Privacy and lawful recordkeeping obligations can continue.']),
s('responsibility','Service limits and legal rights',[
'Device, internet, provider, and maintenance failures can interrupt service. Uninterrupted access and a particular learning or commercial result are not guaranteed. Report failures for review of the lesson, payment, and responsibility.',
'Each party remains responsible for its conduct under applicable law. Nothing here excludes liability that cannot lawfully be excluded, waives mandatory consumer protections, or removes legally protected claims concerning fraud, negligence, or privacy.',
'These terms do not impose a blanket refund waiver, unilateral liability cap, or assumption that every technical incident is the user\'s fault.']),
s('disputes','Disputes, updates, and contact',[
'Email support@fluentxverse.com with the account, booking or transaction reference, issue, and requested resolution. We may request proportionate evidence. Never include passwords or private keys.',
'These terms do not require mandatory private arbitration or prevent complaints to a competent court or regulator. Applicable law and any valid separately agreed jurisdiction terms govern rights; mandatory local protections remain.',
'The revised date appears above. Material changes require appropriate notice and any acceptance required by law. New terms do not retroactively remove accrued rights, change a completed purchase without lawful basis, or authorize optional processing without required consent.'
])
]};
export function legalDocument(kind: LegalKind): LegalDocumentContent { return kind === 'privacy' ? privacy : terms; }
