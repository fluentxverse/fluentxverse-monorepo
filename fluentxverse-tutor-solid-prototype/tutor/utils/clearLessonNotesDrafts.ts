import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "./cssStyle";
export function clearLessonNotesDrafts(sessionId: string) {
    try {
        const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index));
        for (const key of keys) {
            if (key && (key === `fxv-tutor-lesson-notes-editor:${sessionId}` ||
                key === `fxv-tutor-classroom-summary:${sessionId}` ||
                key.startsWith(`fxv-tutor-classroom-notes:${sessionId}:`)))
                localStorage.removeItem(key);
        }
    }
    catch { /* Server-side absence still prevents saved notes from being recreated. */ }
}
