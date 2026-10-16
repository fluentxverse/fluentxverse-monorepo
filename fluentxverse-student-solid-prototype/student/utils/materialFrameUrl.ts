import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "./cssStyle";
export function materialFrameUrl(url: string, theme: 'light' | 'dark', origin: string): string {
    const parsed = new URL(url, origin);
    if (/^\/(business-english|conversational-skills)-preview\//.test(parsed.pathname)) {
        parsed.searchParams.set('theme', theme);
        return parsed.href;
    }
    return url;
}
