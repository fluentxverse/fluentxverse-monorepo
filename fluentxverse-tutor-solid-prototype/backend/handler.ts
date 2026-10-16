import { LAB_ORIGIN, permittedRoute, incomingCookie, outgoingCookie } from './policy';
export function createHandler(app: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    const path = new URL(request.url).pathname;
    const origin = request.headers.get('Origin');
    const headers = new Headers({ 'Cache-Control': 'no-store', Vary: 'Origin' });
    if (origin === LAB_ORIGIN) {
      headers.set('Access-Control-Allow-Origin', LAB_ORIGIN);
      headers.set('Access-Control-Allow-Credentials', 'true');
      headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma');
    }
    if (path === '/lab/health') return Response.json({ service: 'solid-tutor-lab', allowedOrigin: LAB_ORIGIN, appMutations: false, classroomSignaling: false }, { headers });
    if (origin !== LAB_ORIGIN) return Response.json({ error: 'Origin not allowed' }, { status: 403, headers });
    const method = request.method === 'OPTIONS' ? request.headers.get('Access-Control-Request-Method') || '' : request.method;
    if (!permittedRoute(method, path)) return Response.json({ error: 'Writes and live classroom signaling are disabled in the tutor compatibility API.' }, { status: 403, headers });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const incoming = new Headers(request.headers);
    incoming.set('Cookie', incomingCookie(request.headers.get('Cookie')));
    incoming.delete('Authorization');
    incoming.set('X-Forwarded-For', '127.0.0.1');
    try {
      const response = await app(new Request(request, { headers: incoming }));
      for (const [key, value] of response.headers) if (key.toLowerCase() !== 'set-cookie' && !key.toLowerCase().startsWith('access-control-')) headers.set(key, value);
      for (const cookie of response.headers.getSetCookie()) { const mapped = outgoingCookie(cookie); if (mapped) headers.append('Set-Cookie', mapped); }
      return new Response(response.body, { status: response.status, headers });
    } catch { return Response.json({ error: 'Local tutor API unavailable. Check the harness terminal.' }, { status: 503, headers }); }
  };
}
