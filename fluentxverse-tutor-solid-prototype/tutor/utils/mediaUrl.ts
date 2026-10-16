import { resolveMediaUrl } from '../../../shared/lessonMedia';
import { API_BASE_URL } from '../config/api';

export function mediaUrl(value?: string | null, apiBase = API_BASE_URL): string | undefined {
  return resolveMediaUrl(value, apiBase);
}
