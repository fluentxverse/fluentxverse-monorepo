import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
// Axios API root for client usage
// Uses the shared, HTTPS-safe API_BASE_URL from config
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
export const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true
});
