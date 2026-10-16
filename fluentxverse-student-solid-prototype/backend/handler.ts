import { LAB_ORIGIN, permittedRoute, studentCookieForLab, labCookieFromStudent } from './policy';

export function createLabHandler(student: (request: Request) => Promise<Response>, options: {
  permittedRoute?: (method: string, path: string) => boolean;
  cookieName?: string;
  publicRead?: (path: string) => boolean;
  publicReadOrigins?: string[];
  health?: Record<string, unknown>;
} = {}) {
  const permitted = options.permittedRoute || permittedRoute;
  return async (request: Request): Promise<Response> => {
    const path = new URL(request.url).pathname;
    const origin = request.headers.get('Origin');
    const publicRead = options.publicRead?.(path) && permitted('GET', path)
      && (request.method === 'GET' || (request.method === 'OPTIONS' && request.headers.get('Access-Control-Request-Method') === 'GET'))
      && (!origin || options.publicReadOrigins?.includes(origin));
    const headers = new Headers({ 'Cache-Control': 'no-store', Vary: 'Origin' });
    if (origin === LAB_ORIGIN || (origin && publicRead)) {
      headers.set('Access-Control-Allow-Origin', origin!);
      if (origin === LAB_ORIGIN) headers.set('Access-Control-Allow-Credentials', 'true');
      headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma');
    }
    if (path === '/lab/health' && request.method === 'GET') {
      return Response.json({ service: 'solid-auth-lab', originAllowed: origin === LAB_ORIGIN, allowedOrigin: LAB_ORIGIN, accountRegistration: false, ...options.health }, { headers });
    }
    if (origin !== LAB_ORIGIN && !publicRead) return Response.json({ error: `This local auth API accepts only ${LAB_ORIGIN}.` }, { status: 403, headers });
    if (request.method === 'OPTIONS') {
      if (!permitted(request.headers.get('Access-Control-Request-Method') || '', path)) return new Response(null, { status: 403, headers });
      return new Response(null, { status: 204, headers });
    }
    if (!permitted(request.method, path)) return Response.json({ error: 'This route is unavailable in this local test API. Student mutations require an isolated test database and LAB_ENABLE_APP_MUTATIONS=1.' }, { status: 404, headers });
    const incoming = new Headers(request.headers);
    const cookies = (request.headers.get('Cookie') || '').split(';').map(cookie => cookie.trim()).filter(cookie => cookie.startsWith((options.cookieName || 'fxvSolidLabAuth') + '=')).map(cookie => options.cookieName ? cookie.replace(options.cookieName + '=', 'fxvSolidLabAuth=') : cookie).join('; ');
    incoming.set('Cookie', studentCookieForLab(cookies));
    incoming.set('X-Forwarded-For', '127.0.0.1');
    incoming.delete('X-Real-IP');
    try {
      const response = await student(new Request(request, { headers: incoming }));
      for (const [key, value] of response.headers) {
        if (key.toLowerCase() === 'set-cookie' || key.toLowerCase().startsWith('access-control-')) continue;
        if (key.toLowerCase() === 'vary') headers.set(key, `Origin, ${value}`);
        else headers.set(key, value);
      }
      for (const cookie of response.headers.getSetCookie()) {
        const prototype = labCookieFromStudent(cookie);
        if (prototype) headers.append('Set-Cookie', options.cookieName ? prototype.replace(/^fxvSolidLabAuth=/, options.cookieName + '=') : prototype);
      }
      return new Response(response.body, { status: response.status, headers });
    } catch {
      return Response.json({ error: 'Local authentication handler failed. Check the auth harness terminal.' }, { status: 503, headers });
    }
  };
}
