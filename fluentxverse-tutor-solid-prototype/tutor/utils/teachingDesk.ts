import type { WeekSchedule } from '../api/schedule.api';
import type { LessonWorkflow } from '../api/lessonWorkflow.api';

export type PendingLessonNote = LessonWorkflow & { bookingId: string; studentName: string };
export function teachingSlotTime(slot: Pick<WeekSchedule['slots'][number], 'date' | 'time'>) {
    const match = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i.exec(slot.time.trim());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(slot.date) || !match) return NaN;
    let hour = Number(match[1]);
    if (Number(match[2]) > 59 || (match[3] ? hour < 1 || hour > 12 : hour > 23)) return NaN;
    if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
    return Date.parse(`${slot.date}T${String(hour).padStart(2, '0')}:${match[2]}:00+08:00`);
}

export function upcomingTeachingSlots(weeks: WeekSchedule[], now: number) {
    const seen = new Set<string>();
    return weeks.flatMap(week => week.slots).filter(slot => {
        if (slot.status !== 'booked' || !slot.bookingId || seen.has(slot.bookingId)) return false;
        const start = teachingSlotTime(slot);
        if (!Number.isFinite(start) || start + 25 * 60000 <= now || start > now + 7 * 86400000) return false;
        seen.add(slot.bookingId);
        return true;
    }).sort((a, b) => teachingSlotTime(a) - teachingSlotTime(b));
}

export function noteTaskStatus(note: PendingLessonNote, now: number) {
    if (note.closed || !note.canEdit || now > Date.parse(note.editableUntil)) return 'closed';
    return now >= Date.parse(note.endsAt) ? 'due' : 'upcoming';
}

export function activeSchedulingBlock(weeks: WeekSchedule[], now: number) {
    return weeks.map(week => week.schedulingBlock).find(block => block?.active && (!block.expiresAt || Date.parse(block.expiresAt) > now)) || null;
}
