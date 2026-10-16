import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "./cssStyle";
export function canCancelLesson(status: string, startsAt: number, now = Date.now()) {
    return status === 'confirmed' && Number.isFinite(startsAt) && now < startsAt - 5 * 60000;
}
