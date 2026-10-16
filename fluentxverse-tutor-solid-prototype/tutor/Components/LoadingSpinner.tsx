import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { JSX } from "solid-js";
import './LoadingSpinner.css';
export const LoadingSpinner = (): JSX.Element => {
    return (<div class="fxv-spinner-wrapper" aria-label="Loading">
      <div class="fxv-spinner"/>
    </div>);
};
export default LoadingSpinner;
