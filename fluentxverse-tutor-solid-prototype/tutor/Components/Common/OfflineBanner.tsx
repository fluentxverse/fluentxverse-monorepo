import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import TutorIcon from ".//TutorIcon";
import './OfflineBanner.css';
export const OfflineBanner = () => {
    const [isOffline, setIsOffline] = createSignal(false);
    const [wasOffline, setWasOffline] = createSignal(false);
    const [showReconnected, setShowReconnected] = createSignal(false);
    createEffect(on(() => [wasOffline()], () => {
        const _cleanup0 = untrack(() => {
            // Check initial state
            setIsOffline(!navigator.onLine);
            const handleOnline = () => {
                setIsOffline(false);
                if (wasOffline()) {
                    setShowReconnected(true);
                    // Hide the "reconnected" message after 3 seconds
                    setTimeout(() => setShowReconnected(false), 3000);
                }
            };
            const handleOffline = () => {
                setIsOffline(true);
                setWasOffline(true);
            };
            window.addEventListener('online', handleOnline);
            window.addEventListener('offline', handleOffline);
            return () => {
                window.removeEventListener('online', handleOnline);
                window.removeEventListener('offline', handleOffline);
            };
        });
        if (typeof _cleanup0 === "function")
            onCleanup(_cleanup0);
    }));
    return createMemo(() => {
        if (!isOffline() && !showReconnected())
            return null;
        return (<div class={`offline-banner ${isOffline() ? 'offline' : 'reconnected'}`}>
      <div class="offline-banner-content">
        {isOffline() ? (<>
            <TutorIcon name="ri-wifi-off-line"/>
            <span>You're offline. Some features may not work.</span>
          </>) : (<>
            <TutorIcon name="ri-wifi-line"/>
            <span>You're back online!</span>
          </>)}
      </div>
    </div>);
    }) as unknown as JSX.Element;
};
export default OfflineBanner;
