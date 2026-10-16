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
    createEffect(on(() => [_state0.isAuthenticated, _state0.initialLoading, _state1.route], () => {
        const _cleanup2 = untrack(() => {
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
      <Header showThemeSwitch={false}/>
      <IndexOne />
      <Footer />
    </>);
    }) as unknown as JSX.Element;
};
export default Home;
