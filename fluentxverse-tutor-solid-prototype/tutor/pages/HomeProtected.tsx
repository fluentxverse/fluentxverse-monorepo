import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import HomePage from './HomePage';
// HomeProtected is wrapped by withProtected HOC which handles auth checks
// So we just render HomePage directly
const HomeProtected = () => {
    return <HomePage />;
};
export default HomeProtected;
