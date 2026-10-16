export const LAB_ORIGIN = 'http://127.0.0.1:5177';
export const LAB_COOKIE = 'fxvSolidTutorAuth';
const auth = new Set(['GET /tutor/me', 'POST /tutor/login', 'POST /tutor/logout', 'POST /tutor/refresh']);
const reads = [
  /^\/tutor\/(profile|performance|user\/personal-info)\/?$/,
  /^\/tutor\/(student|lesson-notes|lesson-notes-edit-window|classroom-lesson-notes|classroom-material-progress|classroom-notes|classroom-exercise-marks)\/[^/]+(?:\/lesson-request)?\/?$/,
  /^\/schedule\/(week|tutor-lesson\/[^/]+(?:\/(chat-log|trouble-report))?)\/?$/,
  /^\/lesson-workflow\/tutor\/(pending|[^/]+)(?:\/continuations)?\/?$/,
  /^\/proof\/tutor-certification\/me\/?$/,
  /^\/exam\/(?:speaking\/)?(?:status|active\/[^/]+|result\/[^/]+\/[^/]+)\/?$/,
  /^\/interview\/(available|my-booking)\/?$/,
  /^\/notifications(?:\/(?:unread-count))?\/?$/,
  /^\/inbox\/(messages|stats|unread-count)(?:\/[^/]+)?\/?$/,
  /^\/lesson(?:\/(?:published\/[^/]+|meta\/[^/]+|files\/.+|[^/]+(?:\/(?:tutor|student))?))?\/?$/,
  /^\/lesson-materials\/(published|view|public|checkpoint)\/[^/]+\/?$/,
  /^\/dispatch(?:\/(?:archives|[^/]+)(?:\/[^/]+)*)?\/?$/,
  /^\/young-learners(?:\/(?:published|[^/]+)(?:\/[^/]+)*)?\/?$/,
];
export function permittedRoute(method: string, path: string) {
  return auth.has(`${method} ${path}`) || method === 'GET' && reads.some(pattern => pattern.test(path));
}
export function incomingCookie(raw: string | null) {
  const cookie = raw?.split(';').map(part => part.trim()).find(part => part.startsWith(LAB_COOKIE + '='));
  return cookie ? 'tutorAuth=' + cookie.slice(LAB_COOKIE.length + 1) : '';
}
export function outgoingCookie(raw: string) {
  return raw.startsWith('tutorAuth=') ? raw.replace(/^tutorAuth=/, LAB_COOKIE + '=').replace(/;\s*Domain=[^;]+/gi, '') : null;
}
