import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { isLessonMediaRequest, normalizeLessonMedia } from '../../../shared/lessonMedia';
import { getErrorMessage } from '../utils/errorUtils';
import { shouldRetryRead, readRetryDelay } from '../../../shared/readRetry';
let unauthorizedHandler: (() => void) | null = null;
let isLoginInProgress = false;
let authGeneration = 0;
const requestGenerations = new WeakMap<object, number>();
let sessionRecoveryHandler: (() => Promise<boolean>) | null = null;
let sessionRecovery: {
    generation: number;
    promise: Promise<boolean>;
} | null = null;
/**
 * Extract a user-friendly error message from an error object
 * Re-exported from errorUtils for convenience
 */
export { getErrorMessage } from '../utils/errorUtils';
/**
 * Create a user-friendly error from any error type
 * Useful for throwing friendlier errors from API functions
 */
export const createFriendlyError = (error: unknown): Error => {
    const message = getErrorMessage(error);
    return new Error(message);
};
export const registerUnauthorizedHandler = (fn: () => void) => {
    unauthorizedHandler = fn;
    return () => {
        if (unauthorizedHandler === fn)
            unauthorizedHandler = null;
    };
};
export const registerSessionRecoveryHandler = (fn: () => Promise<boolean>) => {
    sessionRecoveryHandler = fn;
    return () => {
        if (sessionRecoveryHandler === fn)
            sessionRecoveryHandler = null;
    };
};
export const setLoginInProgress = (inProgress: boolean) => {
    if (inProgress)
        authGeneration += 1;
    isLoginInProgress = inProgress;
};
// Clear client-side auth state (localStorage only, don't call server)
// Server cookie will be overwritten on next successful login
export const forceAuthCleanup = () => {
    try {
        localStorage.removeItem('fxv_user_fullname');
        localStorage.removeItem('fxv_user_id');
        localStorage.removeItem('fxv_logged_out'); // Clear logout flag on cleanup before login
    }
    catch (e) { }
};
// Configure Axios client to send cookies with requests
export const client = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    timeout: 30000,
    headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache'
    }
});
// Request interceptor to add cache-busting for auth requests
client.interceptors.request.use((config) => {
    requestGenerations.set(config, authGeneration);
    // Add timestamp to prevent caching of auth-related requests
    if (config.url === '/me' || config.url === '/student/me' || config.url === '/login' || config.url === '/logout' || config.url === '/refresh' || config.url === '/student/refresh') {
        config.params = { ...config.params, _t: Date.now() };
        if (!config.headers)
            config.headers = {} as any;
        (config.headers as any)['Cache-Control'] = 'no-store, no-cache, must-revalidate';
        (config.headers as any)['Pragma'] = 'no-cache';
    }
    return config;
}, (error) => Promise.reject(error));
// Response interceptor for 401 handling
let last401 = 0;
client.interceptors.response.use((response) => {
    if (isLessonMediaRequest(response.config.url)) response.data = normalizeLessonMedia(response.data, API_BASE_URL);
    return response;
}, async (error) => {
    const failed = error?.config;
    if (failed && requestGenerations.get(failed) === authGeneration && navigator.onLine !== false && !failed.url?.startsWith('/notifications') && shouldRetryRead({
        method: failed.method, status: error?.response?.status, aborted: failed.signal?.aborted, code: error.code, retried: failed._fxvReadRetry,
    })) {
        await new Promise(resolve => setTimeout(resolve, readRetryDelay(error.response?.headers?.['retry-after'])));
        if (failed.signal?.aborted || requestGenerations.get(failed) !== authGeneration) return Promise.reject(error);
        return client.request({ ...failed, _fxvReadRetry: true } as any);
    }
    if (error?.response?.status === 401) {
        // Don't trigger unauthorized handler during login process
        // or for login/logout endpoints themselves
        const url = error?.config?.url || '';
        const isAuthEndpoint = url.includes('/login') || url.includes('/logout') || url.includes('/register')
            || url === '/student/me' || url === '/student/refresh' || url === '/student/auth/privy';
        const now = Date.now();
        const config = error.config;
        const generation = authGeneration;
        if (!isLoginInProgress && !isAuthEndpoint && config
            && requestGenerations.get(config) === generation && !config._fxvSessionRetry) {
            try {
                if (sessionRecoveryHandler) {
                    if (!sessionRecovery || sessionRecovery.generation !== generation) {
                        const pending = { generation, promise: sessionRecoveryHandler() };
                        sessionRecovery = pending;
                        void pending.promise.finally(() => {
                            if (sessionRecovery === pending)
                                sessionRecovery = null;
                        }).catch(() => { });
                    }
                    const recovered = await sessionRecovery.promise;
                    if (generation !== authGeneration)
                        return Promise.reject(error);
                    // The server rejected the request before mutation. Replay it only once.
                    if (recovered)
                        return client.request({ ...config, _fxvSessionRetry: true } as any);
                }
                if (unauthorizedHandler && now - last401 > 500) {
                    last401 = now;
                    unauthorizedHandler();
                }
            }
            catch {
                // Network and server errors are not evidence of an expired session.
            }
        }
    }
    return Promise.reject(error);
});
