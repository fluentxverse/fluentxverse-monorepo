import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import TutorArt from '../Common/TutorArt';
import TutorIcon from '../Common/TutorIcon';
import { useAuthContext } from '../../context/AuthContext';
export default function NotFound() {
    const _state0 = useAuthContext();
    return <main class="tutor-not-found">
    <TutorArt name="home" size={80}/>
    <p class="tutor-not-found-code">404</p>
    <h1>Page not found</h1>
    <p>This page is unavailable or has moved.</p>
    <div class="tutor-not-found-actions">
      <a href={_state0.isAuthenticated ? '/home' : '/'}><TutorIcon name="fa-home"/>Back to home</a>
      <a href="/contact"><TutorIcon name="fa-envelope"/>Contact support</a>
    </div>
  </main>;
}
