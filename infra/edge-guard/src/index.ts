import { edgeProtected, requestPolicy } from '../../../shared/requestDefense';

interface RateBinding { limit(options: { key: string }): Promise<{ success: boolean }> }
interface Env {
  EDGE_SHARED_SECRET: string;
  GENERAL: RateBinding;
  AUTH: RateBinding;
  UPLOAD: RateBinding;
  COMPUTE: RateBinding;
  PUBLIC_PROOF: RateBinding;
}

function reject(request: Request, status: number, error: string, retry?: number) {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'X-FXV-Edge-Guard': 'active', Vary: 'Origin' });
  if (retry) headers.set('Retry-After', String(retry));
  const origin = request.headers.get('origin'), path = new URL(request.url).pathname;
  const allowed = path.startsWith('/student/') ? /^https:\/\/student\.fluentxverse\.(com|xyz)$/ : /^https:\/\/(?:student|tutor|dashboard|engine)\.fluentxverse\.(com|xyz)$/;
  if (origin && allowed.test(origin)) { headers.set('Access-Control-Allow-Origin', origin); headers.set('Access-Control-Allow-Credentials', 'true'); headers.set('Access-Control-Expose-Headers', 'Retry-After'); }
  return new Response(JSON.stringify({ success: false, error }), { status, headers });
}

export async function handle(request: Request, env: Env, originFetch: typeof fetch = fetch): Promise<Response> {
  const url = new URL(request.url);
  if (url.hostname !== 'api.fluentxverse.com') return reject(request, 404, 'Not found.');
  if (!env.EDGE_SHARED_SECRET || env.EDGE_SHARED_SECRET.length < 32) return reject(request, 503, 'Edge protection is temporarily unavailable.', 5);
  const headers = new Headers(request.headers);
  headers.delete('x-fxv-edge-token'); headers.delete('x-forwarded-for'); headers.delete('x-real-ip');
  const ip = request.headers.get('cf-connecting-ip');
  if (!ip || ip.length > 64 || !/^[0-9a-fA-F:.]+$/.test(ip)) return reject(request, 400, 'Invalid client address.');
  headers.set('x-real-ip', ip); headers.set('x-forwarded-for', ip); headers.set('x-fxv-edge-token', env.EDGE_SHARED_SECRET);
  if (request.method !== 'OPTIONS') {
    try {
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.EDGE_SHARED_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip));
      const identity = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      if (!(await env.GENERAL.limit({ key: identity })).success) return reject(request, 429, 'Request limit reached. Please retry shortly.', 60);
      const policy = requestPolicy(url.pathname, request.method, request.headers.get('content-type') || '');
      const binding = ['auth', 'privy'].includes(policy.category) ? env.AUTH : policy.category === 'publicProof' ? env.PUBLIC_PROOF : ['proof', 'ai'].includes(policy.category) ? env.COMPUTE : ['upload', 'assessment'].includes(policy.category) ? env.UPLOAD : null;
      if (binding && !(await binding.limit({ key: identity + ':' + policy.category })).success) return reject(request, 429, 'This operation has reached its request limit.', 60);
      const length = request.headers.get('content-length');
      if (length !== null && (!/^(0|[1-9][0-9]*)$/.test(length) || !Number.isSafeInteger(Number(length)))) return reject(request, 400, 'Invalid request length.');
      if (length !== null && Number(length) > policy.maxBytes) return reject(request, 413, 'Request body exceeds this endpoint limit.');
      if (edgeProtected(url.pathname, request.method) && policy.roles) {
        const cookie = request.headers.get('cookie') || '';
        const names = policy.roles.includes('admin') ? ['adminAuth', ...(policy.roles.includes('tutor') ? ['tutorAuth'] : []), ...(policy.roles.includes('student') ? ['studentAuth'] : [])] : policy.roles.includes('tutor') ? ['tutorAuth'] : ['studentAuth'];
        if (!names.some(name => new RegExp('(?:^|;\\s*)' + name + '=[^;]+').test(cookie))) return reject(request, 401, 'Authentication required.');
      }
    } catch { return reject(request, 503, 'Edge protection is temporarily unavailable.', 5); }
  }
  // On a Workers Route, fetch(request) passes to the existing Tunnel origin.
  // Cookie signatures and fine-grained permissions remain the origin's responsibility.
  const response = await originFetch(new Request(request, { headers }));
  const result = new Response(response.body, response);
  result.headers.set('X-FXV-Edge-Guard', 'active');
  return result;
}

export default { fetch(request: Request, env: Env) { return handle(request, env); } };
