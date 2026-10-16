import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
export function useCurrentTime() {
    const [now, setNow] = createSignal(Date.now());
    createEffect(on(() => [], () => {
        const _cleanup0 = untrack(() => {
            const refresh = () => setNow(Date.now());
            const timer = window.setInterval(refresh, 1000);
            window.addEventListener('focus', refresh);
            document.addEventListener('visibilitychange', refresh);
            return () => {
                window.clearInterval(timer);
                window.removeEventListener('focus', refresh);
                document.removeEventListener('visibilitychange', refresh);
            };
        });
        if (typeof _cleanup0 === "function")
            onCleanup(_cleanup0);
    }));
    return () => now();
}
