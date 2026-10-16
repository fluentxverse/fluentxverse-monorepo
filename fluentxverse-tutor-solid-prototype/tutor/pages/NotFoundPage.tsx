import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import NotFound from '@/Components/NotFound/NotFound';
const NotFoundPage = () => {
    createEffect(on(() => [], () => {
        const _cleanup0 = untrack(() => {
            document.title = '404 Not Found | FluentXVerse';
        });
        if (typeof _cleanup0 === "function")
            onCleanup(_cleanup0);
    }));
    return <NotFound />;
};
export default NotFoundPage;
