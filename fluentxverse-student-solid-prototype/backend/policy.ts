export const LAB_ORIGIN = 'http://127.0.0.1:5176';
export const LAB_COOKIE = 'fxvSolidLabAuth';
const routes = new Set([
  'GET /student/me', 'POST /student/login', 'POST /student/logout',
  'POST /student/refresh', 'POST /student/auth/privy',
  'POST /student/auth/wallet/nonce', 'POST /student/auth/wallet',
]);

export function permittedRoute(method: string, path: string): boolean {
  return routes.has(`${method} ${path}`);
}

export function studentCookieForLab(raw: string | null): string {
  // Never read a real studentAuth cookie into the prototype's authentication handler.
  const prototype = raw?.split(';').map(part => part.trim()).find(part => part.startsWith(`${LAB_COOKIE}=`));
  return prototype ? `studentAuth=${prototype.slice(LAB_COOKIE.length + 1)}` : '';
}

export function labCookieFromStudent(raw: string): string | null {
  return raw.startsWith('studentAuth=') ? `${LAB_COOKIE}${raw.slice('studentAuth'.length)}` : null;
}
