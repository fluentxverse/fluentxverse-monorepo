import { API_BASE_URL } from '../config/api';

export function mediaUrl(value?: string | null, apiBase = API_BASE_URL): string | undefined {
  if (!value) return undefined;
  const base = apiBase.replace(/\/+$/, '');
  if (value.startsWith('/user/')) return `${base}/lesson/files${value}`;
  if (value.startsWith('/lesson/files/')) return `${base}${value}`;
  try {
    const url = new URL(value);
    const ownedApi = ['api.fluentxverse.xyz', 'api.fluentxverse.com'].includes(url.hostname)
      && ['http:', 'https:'].includes(url.protocol) && !url.port && !url.username && !url.password;
    if (ownedApi && url.pathname.startsWith('/lesson/files/user/')) return `${base}${url.pathname}${url.search}${url.hash}`;
    if (ownedApi && url.pathname.startsWith('/user/')) return `${base}/lesson/files${url.pathname}${url.search}${url.hash}`;
    const internalFiler = ['fluentxverse-seaweed-filer', 'seaweed-filer'].includes(url.hostname)
      || (['localhost', '127.0.0.1'].includes(url.hostname) && url.port === '8888');
    if (internalFiler && url.pathname.startsWith('/user/')) return `${base}/lesson/files${url.pathname}${url.search}`;
  } catch {
    // Relative app assets and upload previews do not need proxying.
  }
  return value;
}
