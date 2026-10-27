import PublicAppGuide, { type PublicAppGuideContent } from '../components/PublicAppGuide';
import { overviewChapters, overviewGlossary, overviewSourceDate } from '../data/platformOverview';

const guide: PublicAppGuideContent = {
  path: '/esl-tutor-app',
  title: 'FluentXVerse ESL',
  eyebrow: 'ESL TUTOR APP / PLATFORM OVERVIEW',
  lead: 'The lesson, the people, and the technology behind it.',
  description: 'A public guide for partners and funders: how the tutor app connects to learning, service delivery, and carefully scoped verification.',
  chapters: overviewChapters,
  glossary: overviewGlossary,
  sourceDate: overviewSourceDate,
  sourceDateLabel: 'October 13, 2026',
  sourceIntro: 'Adapted from the dashboard Platform Guide, source-reviewed',
  sourceNote: 'Public adaptation of the administration Platform Guide. Internal procedures are omitted; the underlying boundaries and source-review date are retained. Current agreements, approved operating rules, and actual records take precedence.',
  portalHref: 'https://tutor.fluentxverse.com',
  portalLabel: 'Open the tutor app',
  imageWide: '/assets/img/esl-platform-overview-wide.webp',
  imageMobile: '/assets/img/esl-platform-overview-mobile.webp',
  imageWidth: 2048,
  imageHeight: 683,
  relatedHref: '/esl-student-app',
  relatedLabel: 'The student-app guide',
};
export default function EslTutorAppPage() { return <PublicAppGuide guide={guide}/>; }
