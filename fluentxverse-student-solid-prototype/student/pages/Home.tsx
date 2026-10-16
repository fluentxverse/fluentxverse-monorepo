import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { useLocation } from "../routing";
import Footer from '../Components/Footer/Footer';
import Header from '../Components/Header/Header';
import IndexOne from '../Components/IndexOne/IndexOne';
import { useAuthContext } from '../context/AuthContext';
const Home = () => {
    const _state0 = useAuthContext();
    const _state1 = useLocation();
    const logoutRetryRef = { current: false } as {
        current: any;
    };
    createEffect(on(() => [_state0.isAuthenticated, _state0.initialLoading, _state0.logout, _state1.route], () => {
        const _cleanup2 = untrack(() => {
            // Check if we just attempted logout but cookie wasn't cleared
            const pendingLogout = sessionStorage.getItem('fxv_pending_logout');
            if (!_state0.initialLoading && pendingLogout === 'true') {
                // Clear the flag first to prevent infinite loops
                sessionStorage.removeItem('fxv_pending_logout');
                if (_state0.isAuthenticated) {
                    // Cookie still exists - retry logout
                    if (!logoutRetryRef.current) {
                        logoutRetryRef.current = true;
                        _state0.logout();
                    }
                    return;
                }
            }
            if (!_state0.initialLoading && _state0.isAuthenticated) {
                _state1.route('/home');
            }
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    return createMemo(() => {
        if (_state0.isAuthenticated)
            return null;
        return (<>
      <div class="main-content no-sidebar">
        <Header />
        <IndexOne />
        {/* <CallToAction /> */}
        <Footer />
      </div>
    </>);
    }) as unknown as JSX.Element;
};
export default Home;
