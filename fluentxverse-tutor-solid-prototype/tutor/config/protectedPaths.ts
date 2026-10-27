import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
// Central list of protected paths (prefix match)
export const PROTECTED_PATHS = ['/home', '/schedule', '/student', '/classroom', '/application'];
