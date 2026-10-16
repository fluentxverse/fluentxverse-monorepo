import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "./cssStyle";
export type SchedulePeriod = 'morning' | 'afternoon' | 'evening';
const manilaHourFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    hourCycle: 'h23'
});
export const getSchedulePeriod = (timestamp: number): SchedulePeriod => {
    const hour = Number(manilaHourFormatter.format(new Date(timestamp)));
    if (hour < 12)
        return 'morning';
    if (hour < 18)
        return 'afternoon';
    return 'evening';
};
