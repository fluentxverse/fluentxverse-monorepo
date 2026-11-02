export interface FirstLessonProgress {
    slotsPublished: boolean;
    completed: boolean;
}

export function firstLessonProgress(value: unknown): FirstLessonProgress {
    const data = value as { slots?: { bookable?: unknown }; lessons?: { attended?: unknown } } | null;
    const slots = data?.slots?.bookable;
    const attended = data?.lessons?.attended;
    if (typeof slots !== 'number' || !Number.isSafeInteger(slots) || slots < 0 ||
        typeof attended !== 'number' || !Number.isSafeInteger(attended) || attended < 0) {
        throw new Error('First-lesson progress is unavailable');
    }
    return { slotsPublished: slots > 0, completed: attended > 0 };
}
