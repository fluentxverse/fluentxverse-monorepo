import { test, expect } from 'bun:test';
import { acknowledge, evaluate, EXPECTED_CONTAINERS, initialState, parseTelemetry, snapshot } from './src/policy';
import type { AlertTelemetry } from '../../shared/operationalAlerts';
const start = Date.parse('2026-10-24T10:00:00Z');
function telemetry(at: number): AlertTelemetry {
  return { version: 1, sampledAt: new Date(at).toISOString(), host: { diskUsedPercent: 30, diskAvailableBytes: 40 * 1024 ** 3 },
    containers: EXPECTED_CONTAINERS.map((name, index) => ({ name, id: index.toString(16).padStart(64, '0'), state: 'running', restartCount: 0, health: 'healthy' })),
    recordings: { failed: 0, overdue: 0 }, proofs: { pending: 0, oldestAt: null, missingTimestamp: 0 } };
}
const tick = (s: ReturnType<typeof initialState>, minute: number, alter?: (v: AlertTelemetry) => void, up = true) => {
  const t = telemetry(start + minute * 60000); alter?.(t);
  return evaluate(s, up, up ? t : null, start + minute * 60000, () => crypto.randomUUID());
};
const active = (s: ReturnType<typeof initialState>) => s.incidents.filter(i => !i.resolvedAt);

test('availability opens once after three failures and recovers after two real healthy observations', () => {
  const s = initialState(); tick(s, 0, undefined, false); tick(s, 1, undefined, false); expect(active(s)).toHaveLength(0);
  tick(s, 2, undefined, false); tick(s, 3, undefined, false); expect(active(s)).toHaveLength(1);
  const id = active(s)[0]!.id; acknowledge(s, id, 'ops-admin', start + 190000); acknowledge(s, id, 'other-admin', start + 190001);
  expect(s.incidents[0]!.events.filter(e => e.action === 'acknowledged')).toHaveLength(1);
  expect(s.incidents[0]!.acknowledgedBy).toBe('ops-admin');
  tick(s, 4); expect(active(s)).toHaveLength(1); tick(s, 5); expect(active(s)).toHaveLength(0);
  expect(s.incidents[0]!.events.at(-1)!.action).toBe('resolved');
  expect(() => acknowledge(s, id, 'ops-admin', start + 400000)).toThrow();
  tick(s, 6, undefined, false); tick(s, 7, undefined, false); tick(s, 8, undefined, false);
  expect(active(s)[0]!.id).not.toBe(id);
});
test('disk thresholds have hysteresis, escalate acknowledged incidents and never recover from missing data', () => {
  const s = initialState(), full = (t: AlertTelemetry) => t.host!.diskUsedPercent = 86;
  tick(s, 0, full); tick(s, 1, full); const incident = active(s)[0]!;
  acknowledge(s, incident.id, 'ops', start + 61000);
  tick(s, 2, t => t.host!.diskUsedPercent = 96);
  expect(incident.severity).toBe('critical'); expect(incident.acknowledgedAt).toBeNull();
  tick(s, 3, t => t.host = null); tick(s, 4, t => t.host = null); expect(incident.resolvedAt).toBeNull();
  tick(s, 5, t => t.host!.diskUsedPercent = 81); expect(incident.resolvedAt).toBeNull();
  tick(s, 6); tick(s, 7); expect(incident.resolvedAt).not.toBeNull();
});
test('real restart deltas are scoped to a container generation; missing and unhealthy services are detected', () => {
  const s = initialState(); tick(s, 0);
  tick(s, 1, t => t.containers![0]!.restartCount = 3); tick(s, 2, t => t.containers![0]!.restartCount = 3);
  expect(active(s)[0]!.message).toContain('1 have restarted');
  tick(s, 3, t => { t.containers![0]!.id = 'f'.repeat(64); t.containers![0]!.restartCount = 20; });
  tick(s, 4, t => { t.containers![0]!.id = 'f'.repeat(64); t.containers![0]!.restartCount = 20; });
  expect(active(s)).toHaveLength(0);
  tick(s, 5, t => t.containers!.pop()); tick(s, 6, t => t.containers!.pop());
  expect(active(s)[0]!.severity).toBe('critical');
});
test('proofs and recordings alert only from aggregate data and missing metadata fails visibly', () => {
  const s = initialState();
  for (let m = 0; m < 2; m++) tick(s, m, t => { t.proofs = { pending: 2, oldestAt: new Date(start - 3600000).toISOString(), missingTimestamp: 0 }; t.recordings = { failed: 1, overdue: 1 }; });
  expect(active(s).map(i => i.key).sort()).toEqual(['proofs','recordings']);
  tick(s, 2, t => { t.proofs = null; t.recordings = null; }); tick(s, 3, t => { t.proofs = null; t.recordings = null; });
  expect(active(s).map(i => i.key).sort()).toEqual(['proofs','recordings','telemetry']);
  expect(JSON.stringify(snapshot(s))).not.toMatch(/privateKey|encryptedEvidence|studentId|tutorId/);
});
test('missing proof timestamps use observed age; duplicate ticks and long gaps do not invent consecutive failures', () => {
  const s = initialState(), pending = (t: AlertTelemetry) => t.proofs = { pending: 1, oldestAt: null, missingTimestamp: 1 };
  tick(s, 0, pending); tick(s, 29, pending); expect(active(s)).toHaveLength(0);
  tick(s, 30, pending); tick(s, 30, pending); expect(active(s)).toHaveLength(0);
  tick(s, 31, pending); expect(active(s)[0]!.key).toBe('proofs');
  const s2 = initialState(); tick(s2, 0, undefined, false); tick(s2, 10, undefined, false); tick(s2, 11, undefined, false); expect(active(s2)).toHaveLength(0);
});
test('telemetry rejects stale, malformed and unapproved container names', () => {
  for (const mutate of [
    (t: any) => t.version = 2,
    (t: any) => t.sampledAt = new Date(start - 200000).toISOString(),
    (t: any) => t.host.diskUsedPercent = 200,
    (t: any) => t.containers[0].name = 'unrelated-tenant',
    (t: any) => t.containers[0].restartCount = -1,
    (t: any) => t.proofs.oldestAt = 'not-a-date',
    (t: any) => t.recordings = undefined,
  ]) { const t = telemetry(start); mutate(t); expect(() => parseTelemetry(t, start)).toThrow(); }
  expect(parseTelemetry(telemetry(start), start).version).toBe(1);
});

test('history retention respects storage budget without deleting older active incidents', () => {
  const s = initialState(); tick(s, 0, undefined, false); tick(s, 1, undefined, false); tick(s, 2, undefined, false);
  const open = active(s)[0]!;
  for (let i = 0; i < 250; i++) s.incidents.push({ ...structuredClone(open), id: crypto.randomUUID(),
    openedAt: new Date(start + 200000 + i).toISOString(), message: 'x'.repeat(1000), resolvedAt: new Date(start + 250000 + i).toISOString() });
  tick(s, 3, undefined, false);
  expect(s.incidents.some(i => i.id === open.id && !i.resolvedAt)).toBe(true);
  expect(s.incidents.length).toBeLessThanOrEqual(200);
  expect(new TextEncoder().encode(JSON.stringify(s)).byteLength).toBeLessThanOrEqual(100000);
});
