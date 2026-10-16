import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const RETRY_INTERVAL_MS = 30 * 1000;
export function useClassroomSessionRefresh(active: Accessor<boolean>, renew: () => Promise<unknown>, onRenewed: () => void) {
    const callbacks = { current: { renew, onRenewed } } as {
        current: any;
    };
    callbacks.current = { renew, onRenewed };
    createEffect(on(() => [active()], () => {
        const _cleanup0 = untrack(() => {
            if (!active())
                return;
            let disposed = false;
            let inFlight = false;
            let stopped = false;
            let nextAttemptAt = 0;
            let timer: ReturnType<typeof setTimeout> | undefined;
            const refresh = async () => {
                if (disposed || stopped || inFlight || Date.now() < nextAttemptAt)
                    return;
                if (timer)
                    clearTimeout(timer);
                inFlight = true;
                let delay = REFRESH_INTERVAL_MS;
                try {
                    await callbacks.current.renew();
                    if (!disposed)
                        callbacks.current.onRenewed();
                }
                catch (error: any) {
                    // Network failures are retried quietly; invalid logins are not prolonged.
                    if (error?.response?.status === 401 || error?.response?.status === 403)
                        stopped = true;
                    delay = RETRY_INTERVAL_MS;
                }
                finally {
                    inFlight = false;
                    nextAttemptAt = Date.now() + delay;
                    if (!disposed && !stopped)
                        timer = setTimeout(() => { void refresh(); }, delay);
                }
            };
            const onWake = () => { void refresh(); };
            const onVisible = () => { if (document.visibilityState === 'visible')
                onWake(); };
            window.addEventListener('focus', onWake);
            window.addEventListener('online', onWake);
            document.addEventListener('visibilitychange', onVisible);
            void refresh();
            return () => {
                disposed = true;
                if (timer)
                    clearTimeout(timer);
                window.removeEventListener('focus', onWake);
                window.removeEventListener('online', onWake);
                document.removeEventListener('visibilitychange', onVisible);
            };
        });
        if (typeof _cleanup0 === "function")
            onCleanup(_cleanup0);
    }));
}
