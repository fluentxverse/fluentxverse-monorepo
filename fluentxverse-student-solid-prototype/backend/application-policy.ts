import { permittedRoute } from './policy';

const reads = [
  /^\/student\/(socket-token|profile|last-viewed-lesson|favorites(?:\/[^/]+\/check)?)$/,
  /^\/tutor\/(search|[^/]+(?:\/availability)?)$/,
  /^\/schedule\/(student-bookings|student-stats|student-activity|available\/[^/]+|lesson\/[^/]+(?:\/(survey|issue-report))?|lesson-recap\/[^/]+|lesson-material-request\/[^/]+|classroom-notes\/[^/]+)$/,
  /^\/lesson-workflow\/student\/[^/]+(?:\/continuations)?$/,
  /^\/lesson\/(published\/[^/]+|[^/]+(?:\/student)?|files\/.+)$/,
  /^\/lesson-materials\/(published|public|checkpoint|view)\/[^/]+$/,
  /^\/dispatch(?:\/(classroom-library|archives(?:\/[^/]+)?|[^/]+))?$/,
  /^\/young-learners\/(published|public\/[^/]+)$/,
  /^\/inbox\/(messages|unread-count)$/,
  /^\/notifications(?:\/unread-count)?\/?$/,
  /^\/tickets\/(balance\/[^/]+|image\/[^/]+|my-purchases|purchases\/[^/]+)$/,
  /^\/lesson-passes\/(mode|me|batch\/0x[a-f0-9]{64})$/,
  /^\/proof\/(student-lessons\/me|student-lessons\/public\/[^/]+|tutor-certification\/public\/[^/]+)$/,
];
const writes: [string, RegExp][] = [
  ['POST', /^\/student\/(register(?:\/(privy|wallet))?|favorites\/[^/]+)$/],
  ['DELETE', /^\/student\/favorites\/[^/]+$/],
  ['PUT', /^\/student\/(preferences|about-me|last-viewed-lesson|user\/(email|password|personal-info))$/],
  ['POST', /^\/schedule\/(reserve|release-reservation|recover-transfer|book|cancel|preload|invalidate-cache|lesson\/[^/]+\/(issue-report|survey))$/],
  ['PUT', /^\/schedule\/lesson-material-request\/[^/]+$/],
  ['POST', /^\/inbox\/(mark-read\/[^/]+|mark-all-read|toggle-pin\/[^/]+)$/],
  ['POST', /^\/notifications\/(read-all|[^/]+\/read)$/],
  ['DELETE', /^\/notifications\/[^/]+$/],
  ['POST', /^\/tickets\/(purchase|consume|invalidate-cache\/[^/]+)$/],
  ['PUT', /^\/lesson-passes\/vault$/],
  ['POST', /^\/lesson-passes\/(orders|reservations(?:\/0x[a-f0-9]{64}\/(proof|return|recover))?)$/],
  ['POST', /^\/proof\/student-lessons\/[^/]+\/claim$/],
];

export function permittedApplicationRoute(method: string, path: string, writesEnabled = false) {
  if (/(?:^|\/)(admin|debug|performance|profile\/submit)(?:\/|$)/.test(path)) return false;
  if (/^\/lesson\/(list|search|my-lessons|my-merge-requests|save|create|update|publish|unpublish|archive|bulk-action|merge-request)(?:\/|$)/.test(path)) return false;
  if (/^\/tutor\/(profile|me|register|login)(?:\/|$)/.test(path)) return false;
  if (permittedRoute(method, path)) return true;
  if (method === 'GET') return reads.some(pattern => pattern.test(path));
  return writesEnabled && writes.some(([allowedMethod, pattern]) => method === allowedMethod && pattern.test(path));
}
