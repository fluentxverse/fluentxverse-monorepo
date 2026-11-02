import { resolveMediaUrl } from '../../../shared/lessonMedia';
import { API_BASE_URL } from '../config/api';

export function mediaUrl(value?: string | null, apiBase = API_BASE_URL): string | undefined {
  return resolveMediaUrl(value, apiBase);
}

/** Use the uncached stream path so the CDN forwards browser byte-range requests. */
export function videoMediaUrl(value?: string | null, apiBase = API_BASE_URL): string | undefined {
  const source = mediaUrl(value, apiBase);
  if (!source) return source;
  try {
    const url = new URL(source);
    if (url.origin === new URL(apiBase).origin && /^\/lesson\/files\/user\/[^/]+\/video\/[^/]+$/.test(url.pathname)) url.pathname += '/stream';
    return url.toString();
  } catch { return source; }
}
