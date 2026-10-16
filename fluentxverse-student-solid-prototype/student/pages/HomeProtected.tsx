import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { useAuthContext } from '@/context/AuthContext';
import HomePage from './HomePage';
const HomeProtected = () => {
    const _state0 = useAuthContext();
    createEffect(on(() => [_state0.initialLoading, _state0.isAuthenticated, _state0.sessionExpired], () => {
        const _cleanup1 = untrack(() => {
            if (!_state0.initialLoading && !_state0.isAuthenticated && !_state0.sessionExpired) {
                window.location.href = '/';
            }
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    return createMemo(() => {
        if (_state0.initialLoading)
            return null;
        if (!_state0.isAuthenticated)
            return null;
        return <HomePage />;
    }) as unknown as JSX.Element;
};
export default HomeProtected;
