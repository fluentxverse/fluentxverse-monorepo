import { describe, expect, test } from 'bun:test';
import { firstLessonProgress } from '../tutor/utils/firstLessonGuide';

describe('first-lesson guide progress', () => {
    test('starts with opening slots for a new tutor', () => {
        expect(firstLessonProgress({ slots: { bookable: 0 }, lessons: { attended: 0 } })).toEqual({ slotsPublished: false, completed: false });
    });
    test('keeps the guide after opening slots and until a taught lesson ends', () => {
        expect(firstLessonProgress({ slots: { bookable: 3 }, lessons: { attended: 0, upcoming: 1, ongoing: 1, cancelled: 2, tutor_absent: 1 } })).toEqual({ slotsPublished: true, completed: false });
    });
    test('hides after the first taught lesson, even if no old slots remain', () => {
        expect(firstLessonProgress({ slots: { bookable: 0 }, lessons: { attended: 1 } })).toEqual({ slotsPublished: false, completed: true });
    });
    test('does not infer beginner status from failed or malformed reads', () => {
        for (const value of [null, {}, [], { slots: { bookable: 0 }, lessons: {} }, { slots: { bookable: -1 }, lessons: { attended: 0 } },
            { slots: { bookable: 0 }, lessons: { attended: '0' } }, { slots: { bookable: 0 }, lessons: { attended: NaN } },
            { slots: { bookable: 0.5 }, lessons: { attended: 0 } }]) expect(() => firstLessonProgress(value)).toThrow('unavailable');
    });
});
