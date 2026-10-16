import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "./cssStyle";
export const CLASSROOM_WRAP_UP_MS = 3 * 60000;
export function canJoinClassroom(status: string, startsAt: number, endsAt: number, now = Date.now()) {
    return ['confirmed', 'completed'].includes(status) && Number.isFinite(startsAt) && Number.isFinite(endsAt)
        && now >= startsAt - 5 * 60000 && now < endsAt + CLASSROOM_WRAP_UP_MS;
}
