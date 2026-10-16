import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import { ArrowLeft, House } from "lucide-solid";
import { useLocation } from "../../routing";
import { useAuthContext } from '../../context/AuthContext';
import './NotFound.css';
export default function NotFound() {
    const _state0 = useLocation();
    const _state1 = useAuthContext();
    const home = createMemo(() => _state1.isAuthenticated ? '/home' : '/');
    return <main class="student-not-found"><img src="/assets/img/home-icons/home-v1.webp" alt="" width="96" height="96"/><p>404</p><h1>Page not found</h1><p>This page may have moved or is no longer available.</p><div><button onClick={() => window.history.length > 1 ? window.history.back() : _state0.route(home())}><ArrowLeft size={18}/>Go back</button><a href={home()}><House size={18}/>Home</a></div><a href="/contact">Contact support</a></main>;
}
