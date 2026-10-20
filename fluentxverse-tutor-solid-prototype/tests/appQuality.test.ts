import { describe, expect, test } from 'bun:test';
import { shouldRetryRead, readRetryDelay } from '../../shared/readRetry';
import { clearSessionDrafts, readSessionDraft, saveSessionDraft, sessionDraftKey } from '../../shared/sessionDraft';
import { activeSchedulingBlock, noteTaskStatus, teachingSlotTime, upcomingTeachingSlots, type PendingLessonNote } from '../tutor/utils/teachingDesk';
import type { WeekSchedule } from '../tutor/api/schedule.api';

describe('safe read recovery', () => {
    for (const status of [undefined, 408, 425, 429, 502, 503, 504]) test(`retries temporary GET ${status} once`, () => {
        expect(shouldRetryRead({ method: 'get', status })).toBe(true);
        expect(shouldRetryRead({ method: 'get', status, retried: true })).toBe(false);
    });
    for (const method of ['post', 'put', 'patch', 'delete']) test(`never retries ${method}`, () => expect(shouldRetryRead({ method, status: 503 })).toBe(false));
    for (const status of [400, 401, 403, 404, 409, 422, 500]) test(`does not mask HTTP ${status}`, () => expect(shouldRetryRead({ method: 'get', status })).toBe(false));
    test('cancellation, aborted work and backoff bounds', () => {
        expect(shouldRetryRead({ status: 503, aborted: true })).toBe(false);
        expect(shouldRetryRead({ code: 'ERR_CANCELED' })).toBe(false);
        expect(readRetryDelay('120')).toBe(3000);
        expect(readRetryDelay('0')).toBe(500);
        expect(readRetryDelay('invalid')).toBe(500);
        expect(readRetryDelay('Thu, 01 Jan 2026 00:00:02 GMT', Date.parse('2026-01-01T00:00:00Z'))).toBe(2000);
    });
});

describe('tab-local non-credential drafts', () => {
    const createStorage = () => {
        const data = new Map<string, string>();
        return { get length() { return data.size; }, key: (index: number) => [...data.keys()][index] || null,
            getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); }, clear: () => data.clear() } as Storage;
    };
    const valid = (value: unknown): value is { text: string } => typeof (value as any)?.text === 'string';
    test('scopes by account and record; restores only validated, unexpired drafts', () => {
        const storage = createStorage(), key = sessionDraftKey('student-one', 'issue', 'lesson-one');
        expect(saveSessionDraft(storage, key, { text: 'Connection was lost.' }, 1000)).toBe(true);
        expect(readSessionDraft(storage, key, valid, 2000)).toEqual({ text: 'Connection was lost.' });
        expect(readSessionDraft(storage, sessionDraftKey('student-two', 'issue', 'lesson-one'), valid, 2000)).toBeNull();
        expect(readSessionDraft(storage, key, valid, 1000 + 5 * 3600000)).toBeNull();
        expect(storage.getItem(key)).toBeNull();
    });
    test('rejects oversized drafts and does not remove unrelated storage during sign-out', () => {
        const storage = createStorage(), key = sessionDraftKey('one', 'issue', 'lesson');
        expect(saveSessionDraft(storage, key, { text: 'x'.repeat(13000) })).toBe(false);
        saveSessionDraft(storage, key, { text: 'Draft' }); storage.setItem('theme-storage', 'dark');
        clearSessionDrafts(storage);
        expect(storage.getItem(key)).toBeNull(); expect(storage.getItem('theme-storage')).toBe('dark');
    });
    test('blocked storage does not crash forms', () => {
        const storage = { getItem: () => { throw new Error('Blocked'); }, setItem: () => { throw new Error('Blocked'); } } as unknown as Storage;
        expect(readSessionDraft(storage, 'key', valid)).toBeNull();
        expect(saveSessionDraft(storage, 'key', {})).toBe(false);
    });
});

describe('teaching desk tasks', () => {
    const now = Date.parse('2026-10-17T06:00:00Z');
    const week = (slots: WeekSchedule['slots']): WeekSchedule => ({ weekStart: '2026-10-12', weekEnd: '2026-10-18', slots });
    test('PHT is explicit, accepts legacy AM/PM and rejects invalid times', () => {
        expect(teachingSlotTime({ date: '2026-10-17', time: '2:00 PM' })).toBe(now);
        expect(teachingSlotTime({ date: '2026-10-17', time: '14:00' })).toBe(now);
        expect(Number.isNaN(teachingSlotTime({ date: '2026-10-17', time: '25:00' }))).toBe(true);
    });
    test('merges weeks, deduplicates bookings, excludes past/open slots, and sorts by time', () => {
        const near = { date: '2026-10-17', time: '14:25', status: 'booked' as const, bookingId: 'near' };
        const future = { date: '2026-10-19', time: '10:00', status: 'booked' as const, bookingId: 'future' };
        const old = { ...near, time: '13:00', bookingId: 'old' };
        const open = { ...near, status: 'open' as const, bookingId: 'open' };
        expect(upcomingTeachingSlots([week([future, old, open, near]), week([future])], now).map(slot => slot.bookingId)).toEqual(['near', 'future']);
    });
    test('expired blocks disappear and closed note windows are never presented as editable', () => {
        expect(activeSchedulingBlock([{ ...week([]), schedulingBlock: { active: true, expiresAt: new Date(now - 1).toISOString() } }], now)).toBeNull();
        expect(activeSchedulingBlock([{ ...week([]), schedulingBlock: { active: true, expiresAt: null } }], now)?.active).toBe(true);
        const note = { endsAt: new Date(now - 1000).toISOString(), editableUntil: new Date(now + 10000).toISOString(), canEdit: true, closed: false } as PendingLessonNote;
        expect(noteTaskStatus(note, now)).toBe('due');
        expect(noteTaskStatus({ ...note, closed: true }, now)).toBe('closed');
        expect(noteTaskStatus({ ...note, canEdit: false }, now)).toBe('closed');
    });
});
