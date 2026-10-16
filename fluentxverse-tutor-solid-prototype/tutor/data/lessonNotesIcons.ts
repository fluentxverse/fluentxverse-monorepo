import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
export const lessonNotesIcons = {
    notes: 'fas fa-newspaper',
    words: 'fi fi-sr-book-alt',
    vocabulary: 'fi fi-sr-book-alt',
    grammar: 'fi fi-sr-text',
    pronunciation: 'fi fi-sr-microphone',
    studentFeedback: 'fas fa-comment-dots',
    tutorHandoff: 'fas fa-sticky-note',
    assessment: 'fi fi-sr-chart-histogram',
    progress: 'fi fi-sr-bookmark',
    completed: 'fi fi-sr-check',
    inProgress: 'fi fi-sr-hourglass-end'
} as const;
export function lessonMaterialNotesIcon(materialType?: string | null): string {
    return materialType === 'business-english' ? 'fas fa-briefcase'
        : materialType === 'conversational-skills' ? 'fas fa-comments'
            : lessonNotesIcons.notes;
}
