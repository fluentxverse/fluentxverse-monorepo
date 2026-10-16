import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
export const lessonNotesLabels = {
    words: 'Words and phrases learned in this lesson',
    vocabulary: 'Vocabulary',
    grammar: 'Grammar',
    pronunciation: 'Pronunciation',
    studentFeedback: 'Student feedback',
    tutorHandoff: 'Tutor handoff'
} as const;
