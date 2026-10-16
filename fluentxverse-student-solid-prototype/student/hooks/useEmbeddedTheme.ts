import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
export function getEmbeddedTheme(): 'light' | 'dark' | null {
    try {
        if (typeof window === 'undefined' || window.self === window.top)
            return null;
        const theme = window.parent.document.documentElement.dataset.theme;
        return theme === 'dark' || theme === 'light' ? theme : null;
    }
    catch {
        return null;
    }
}
export function useEmbeddedTheme() {
    const [theme, setTheme] = createSignal(getEmbeddedTheme());
    createEffect(on(() => [], () => {
        const _cleanup0 = untrack(() => {
            if (getEmbeddedTheme() === null)
                return;
            const observer = new MutationObserver(() => setTheme(getEmbeddedTheme()));
            observer.observe(window.parent.document.documentElement, {
                attributes: true, attributeFilter: ['data-theme']
            });
            return () => observer.disconnect();
        });
        if (typeof _cleanup0 === "function")
            onCleanup(_cleanup0);
    }));
    return () => theme();
}
