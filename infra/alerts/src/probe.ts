import { parseTelemetry } from './policy';
import type { AlertTelemetry } from '../../../shared/operationalAlerts';

export async function boundedJSON(response: Response) {
  const reader = response.body?.getReader(); if (!reader) throw Error('Empty response');
  const parts: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length; if (size > 65536) throw Error('Response too large'); parts.push(value);
    }
  } finally { await reader.cancel(); }
  const all = new Uint8Array(size); let offset = 0;
  for (const part of parts) { all.set(part, offset); offset += part.length; }
  return JSON.parse(new TextDecoder().decode(all));
}

export async function collectMonitorSample(key: string, fetcher: typeof fetch = fetch) {
  let apiAvailable = false, telemetry: AlertTelemetry | null = null;
  // Workers supports manual/follow, not redirect:error. A redirect is a failed
  // probe, not permission to send the monitoring credential to another URL.
  try {
    const response = await fetcher('https://api.fluentxverse.com/health/detailed', {
      redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { 'cache-control': 'no-cache' },
    });
    if (response.ok) apiAvailable = (await boundedJSON(response)).status === 'ok';
    else await response.body?.cancel();
  } catch { /* An invalid or unavailable health response remains a failure. */ }
  if (apiAvailable) try {
    const response = await fetcher('https://api.fluentxverse.com/internal/operational-alerts/telemetry', {
      redirect: 'manual', signal: AbortSignal.timeout(15000), headers: { 'x-fxv-monitor-key': key },
    });
    if (response.ok) telemetry = parseTelemetry(await boundedJSON(response), Date.now());
    else await response.body?.cancel();
  } catch { /* Missing telemetry never resolves existing incidents. */ }
  return { apiAvailable, telemetry };
}
