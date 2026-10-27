import type { AlertCategory, AlertSeverity, AlertSnapshot, AlertTelemetry, OperationalIncident } from '../../../shared/operationalAlerts';

export const EXPECTED_CONTAINERS = ['fluentxverse-server', 'budol-gmr-engine-1', 'budol-gmr-vault-1',
  'fluentxverse-memgraph', 'fluentxverse-postgres', 'fluentxverse-redis', 'budol-gmr-engine-memgraph-1',
  'budol-gmr-vault-memgraph-1', 'fluentxverse-seaweed-master', 'fluentxverse-seaweed-volume', 'fluentxverse-seaweed-filer'];
interface Condition { key: string; category: AlertCategory; severity: AlertSeverity; bad: boolean | null; title: string; message: string; href: string; failures?: number }
interface RuleState { bad: number; good: number; incident: string | null }
interface RestartSample { at: number; id: string; count: number }
export interface MonitorState {
  checkedAt: string | null; apiAvailable: boolean | null; rules: Record<string, RuleState>;
  restarts: Record<string, RestartSample[]>; pendingSince: number | null; incidents: OperationalIncident[];
}
export const initialState = (): MonitorState => ({ checkedAt: null, apiAvailable: null, rules: {}, restarts: {}, pendingSince: null, incidents: [] });
const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 1_000_000_000;
export function parseTelemetry(value: unknown, now: number): AlertTelemetry {
  const v = value as AlertTelemetry;
  if (!v || v.version !== 1 || !Number.isFinite(Date.parse(v.sampledAt)) || Math.abs(now - Date.parse(v.sampledAt)) > 120000) throw Error('Stale telemetry');
  if (v.host !== null && (!v.host || !Number.isFinite(v.host.diskUsedPercent) || v.host.diskUsedPercent < 0 || v.host.diskUsedPercent > 100 || !Number.isSafeInteger(v.host.diskAvailableBytes) || v.host.diskAvailableBytes < 0)) throw Error('Invalid host telemetry');
  if (v.containers !== null && (!Array.isArray(v.containers) || v.containers.length > 64 || new Set(v.containers.map(c => c.name)).size !== v.containers.length || v.containers.some(c => !/^[a-f0-9]{64}$/.test(c.id) || !EXPECTED_CONTAINERS.includes(c.name)
    || !['created','running','paused','restarting','removing','exited','dead'].includes(c.state)
    || c.restartCount !== null && !count(c.restartCount) || ![null,'none','healthy','unhealthy','starting'].includes(c.health)))) throw Error('Invalid container telemetry');
  if (v.recordings !== null && (!v.recordings || !count(v.recordings.failed) || !count(v.recordings.overdue))) throw Error('Invalid archive telemetry');
  if (v.proofs !== null && (!v.proofs || !count(v.proofs.pending) || !count(v.proofs.missingTimestamp)
    || v.proofs.missingTimestamp > v.proofs.pending || v.proofs.oldestAt !== null && (!Number.isFinite(Date.parse(v.proofs.oldestAt)) || Date.parse(v.proofs.oldestAt) > now + 5000))) throw Error('Invalid proof telemetry');
  return v;
}

export function evaluate(state: MonitorState, apiAvailable: boolean, telemetry: AlertTelemetry | null, now: number, newId: () => string) {
  if (state.checkedAt && now - Date.parse(state.checkedAt) < 45000) return state;
  // Missed monitor intervals must not count as consecutive observations.
  if (state.checkedAt && now - Date.parse(state.checkedAt) > 150000) for (const rule of Object.values(state.rules)) { rule.bad = 0; rule.good = 0; }
  state.checkedAt = new Date(now).toISOString(); state.apiAvailable = apiAvailable;
  const conditions: Condition[] = [
    { key: 'api', category: 'availability', severity: 'critical', bad: !apiAvailable, failures: 3, title: 'API is unavailable', message: 'The external watchdog could not confirm a healthy API response. Check the API, tunnel and server connectivity.', href: '/server-health' },
    { key: 'telemetry', category: 'monitoring', severity: 'warning', bad: apiAvailable ? !telemetry || !telemetry.host || !telemetry.containers || telemetry.containers.some(c => c.restartCount === null || c.health === null) || !telemetry.recordings || !telemetry.proofs : null,
      title: 'Operational telemetry is incomplete', message: 'One or more monitoring sources are unavailable or stale. Existing incidents remain open until their source recovers.', href: '/server-health' },
  ];
  const diskOpen = state.incidents.some(i => i.key === 'disk' && !i.resolvedAt);
  const disk = telemetry?.host;
  conditions.push({ key: 'disk', category: 'disk', severity: disk && (disk.diskUsedPercent >= 95 || disk.diskAvailableBytes < 1024 ** 3) ? 'critical' : 'warning', bad: disk ? disk.diskUsedPercent >= (diskOpen ? 80 : 85) || disk.diskAvailableBytes < 1024 ** 3 : null,
    title: 'Server disk space is low', message: disk ? `${disk.diskUsedPercent.toFixed(1)}% of disk capacity is used; ${(disk.diskAvailableBytes / 1024 ** 3).toFixed(1)} GiB remains available. Review recordings, backups and logs.` : '', href: '/server-health' });
  const containers = telemetry?.containers;
  let restarts = 0, unhealthy = 0, unknown = false;
  if (containers) for (const name of EXPECTED_CONTAINERS) {
    const c = containers.find(c => c.name === name);
    if (!c || c.state !== 'running' || c.health === 'unhealthy') unhealthy++;
    if (!c || c.restartCount === null) { unknown = true; continue; }
    let samples = state.restarts[name] || [];
    if (samples.at(-1)?.id !== c.id || samples.at(-1)!.count > c.restartCount) samples = [];
    samples.push({ at: now, id: c.id, count: c.restartCount });
    // Retain a baseline just before the window, plus bounded minute samples.
    while (samples.length > 2 && samples[1]!.at < now - 600000) samples.shift();
    state.restarts[name] = samples.slice(-12);
    if (c.restartCount - samples[0]!.count >= 3) restarts++;
    if (c.health === null) unknown = true;
  }
  conditions.push({ key: 'containers', category: 'containers', severity: unhealthy ? 'critical' : 'warning', bad: containers ? unhealthy > 0 || restarts > 0 ? true : unknown ? null : false : null,
    title: 'Container service needs attention', message: `${unhealthy} required services are missing, unhealthy or not running; ${restarts} have restarted at least 3 times within 10 minutes.`, href: '/stats' });
  const archives = telemetry?.recordings;
  conditions.push({ key: 'recordings', category: 'recordings', severity: 'warning', bad: archives ? archives.failed > 0 || archives.overdue > 0 : null,
    title: 'Recording archives need attention', message: archives ? `${archives.failed} recordings have archive errors or repeated retries; ${archives.overdue} uploaded recordings have remained unarchived for over 30 minutes.` : '', href: '/recordings' });
  const proofs = telemetry?.proofs;
  if (proofs) state.pendingSince = proofs.pending ? state.pendingSince ?? now : null;
  const oldest = proofs?.oldestAt ? Date.parse(proofs.oldestAt) : state.pendingSince;
  conditions.push({ key: 'proofs', category: 'proofs', severity: 'warning', bad: proofs ? proofs.pending > 0 && oldest !== null && now - oldest >= 1800000 : null,
    title: 'Proof verification has remained pending', message: proofs ? `${proofs.pending} application proof workflows are awaiting submission reconciliation or receipt verification. Inspect the original operation; do not resubmit a paid proof merely to clear this alert.` : '', href: '/alerts' });
  for (const c of conditions) {
    const rule = state.rules[c.key] ||= { bad: 0, good: 0, incident: null };
    if (c.bad === null) { rule.bad = 0; rule.good = 0; continue; }
    rule.bad = c.bad ? rule.bad + 1 : 0; rule.good = c.bad ? 0 : rule.good + 1;
    let incident = state.incidents.find(i => i.id === rule.incident && !i.resolvedAt);
    if (!incident && rule.bad >= (c.failures || 2)) {
      incident = { id: newId(), key: c.key, category: c.category, severity: c.severity, title: c.title, message: c.message, href: c.href,
        openedAt: state.checkedAt, lastSeenAt: state.checkedAt, resolvedAt: null, acknowledgedAt: null, acknowledgedBy: null, events: [{ at: state.checkedAt, action: 'opened' }] };
      state.incidents.unshift(incident); rule.incident = incident.id;
    }
    if (incident && c.bad) {
      incident.lastSeenAt = state.checkedAt; incident.message = c.message;
      if (c.severity === 'critical' && incident.severity !== 'critical') {
        incident.severity = 'critical'; incident.acknowledgedAt = null; incident.acknowledgedBy = null;
        incident.events.push({ at: state.checkedAt, action: 'escalated' });
      }
    }
    if (incident && rule.good >= 2) { incident.resolvedAt = state.checkedAt; incident.events.push({ at: state.checkedAt, action: 'resolved' }); rule.incident = null; }
  }
  const open = state.incidents.filter(i => !i.resolvedAt);
  state.incidents = [...open, ...state.incidents.filter(i => i.resolvedAt && now - Date.parse(i.resolvedAt) < 90 * 86400000).slice(0, 200 - open.length)]
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  // Keep the persisted object below the conservative KV value budget, without
  // dropping active incidents or their acknowledgement history.
  while (new TextEncoder().encode(JSON.stringify(state)).byteLength > 100000) {
    const oldestResolved = state.incidents.findLastIndex(i => !!i.resolvedAt);
    if (oldestResolved < 0) break;
    state.incidents.splice(oldestResolved, 1);
  }
  return state;
}

export function acknowledge(state: MonitorState, id: string, actor: string, now: number) {
  const incident = state.incidents.find(i => i.id === id);
  if (!incident || incident.resolvedAt) throw Error('Active incident not found');
  if (!incident.acknowledgedAt) {
    incident.acknowledgedAt = new Date(now).toISOString(); incident.acknowledgedBy = actor;
    incident.events.push({ at: incident.acknowledgedAt, action: 'acknowledged', actor });
  }
  return state;
}
export function snapshot(state: MonitorState): AlertSnapshot {
  return { version: 1, checkedAt: state.checkedAt, apiAvailable: state.apiAvailable, incidents: state.incidents, notifications: { browser: true, external: false } };
}
