import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { tutorApi, type LessonNotesEditWindow } from '../api/tutor.api';
export function useLessonNotesEditWindow(sessionId: Accessor<string>) {
    const [windowInfo, setWindowInfo] = createSignal<LessonNotesEditWindow | null>(null);
    const [error, setError] = createSignal(false);
    const [revision, setRevision] = createSignal(0);
    const [clock, setClock] = createSignal({ offset: 0, now: Date.now() });
    createEffect(on(() => [sessionId(), revision()], () => {
        const _cleanup0 = untrack(() => {
            const controller = new AbortController();
            setError(false);
            tutorApi
                .getLessonNotesEditWindow(sessionId(), controller.signal)
                .then((data) => {
                if (controller.signal.aborted)
                    return;
                setClock({ offset: Date.parse(data.serverNow) - Date.now(), now: Date.now() });
                setWindowInfo(data);
            })
                .catch(() => {
                if (!controller.signal.aborted)
                    setError(true);
            });
            return () => controller.abort();
        });
        if (typeof _cleanup0 === "function")
            onCleanup(_cleanup0);
    }));
    createEffect(on(() => [], () => {
        const _cleanup1 = untrack(() => {
            const refresh = () => setRevision((value) => value + 1);
            const timer = window.setInterval(() => setClock((value) => ({ ...value, now: Date.now() })), 1000);
            window.addEventListener('focus', refresh);
            return () => {
                window.clearInterval(timer);
                window.removeEventListener('focus', refresh);
            };
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    const now = createMemo(() => clock().now + clock().offset);
    const canEdit = createMemo(() => Boolean(!error() && windowInfo() &&
        windowInfo().reason !== 'cancelled' &&
        now() >= Date.parse(windowInfo().startsAt) &&
        now() < Date.parse(windowInfo().editableUntil)));
    return { get windowInfo() {
            return windowInfo();
        }, get canEdit() {
            return canEdit();
        }, get error() {
            return error();
        }, retry: () => setRevision((value) => value + 1) };
}
