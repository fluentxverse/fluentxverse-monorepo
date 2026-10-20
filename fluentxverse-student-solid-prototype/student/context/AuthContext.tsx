import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
// Only allow students to log in to student app
const allowedRole = 'student';
import { createContext } from "solid-js";
import { loginUser, logoutUser, getMe, ensureStudentSession, loginWithWallet, registerWithWallet, loginWithPrivy, registerWithPrivy, type PrivyProfile, type PrivyRegisterParams, type WalletRegisterParams } from '../api/auth.api';
import { PROTECTED_PATHS } from '../config/protectedPaths';
import { registerUnauthorizedHandler, registerSessionRecoveryHandler, setLoginInProgress, forceAuthCleanup } from '../api/utils';
import { clearSessionDrafts } from '../../../shared/sessionDraft';
import { appWallet } from '../config/wallet';
import { scheduleApi } from '../api/schedule.api';
import { usePrivyIntegration } from './PrivyContext';
interface AuthUser {
    userId: string;
    email: string;
    givenName: string;
    familyName?: string;
    firstName?: string;
    lastName?: string;
    birthDate?: string;
    mobileNumber?: string;
    smartWalletAddress?: string;
    tier?: number;
    walletAddress?: string;
    role?: string;
}
interface WalletLoginResult {
    status: 'authenticated' | 'incomplete_registration' | 'not_found' | 'error';
    user: AuthUser | null;
    missingFields?: string[];
}
interface WalletAuthParams {
    walletAddress: string;
    signature: string;
    message: string;
}
interface AuthContextValue {
    user: AuthUser | null;
    isAuthenticated: boolean;
    initialLoading: boolean; // initial /me check
    loginLoading: boolean; // active login attempt
    sessionExpired: boolean;
    sessionExpiredMessage: string | null;
    login: (email: string, password: string) => Promise<void>;
    loginByWallet: (params: WalletAuthParams) => Promise<WalletLoginResult>;
    registerByWallet: (params: WalletRegisterParams) => Promise<void>;
    registerByPrivy: (params: PrivyRegisterParams) => Promise<void>;
    privyProfile: PrivyProfile | null;
    isPrivyAuthenticated: boolean;
    logout: () => Promise<void>;
    getUserId: () => string | undefined;
    clearSessionExpired: () => void;
    ensureSession: () => Promise<AuthUser>;
}
const AuthContext = createContext<AuthContextValue | undefined>(undefined);
export const AuthProvider = (_props0: {
    children: any;
}) => {
    const [user, setUser] = createSignal<AuthUser | null>(null);
    const [initialLoading, setInitialLoading] = createSignal(true);
    const [loginLoading, setLoginLoading] = createSignal(false);
    const [sessionExpired, setSessionExpired] = createSignal(false);
    const [sessionExpiredMessage, setSessionExpiredMessage] = createSignal<string | null>(null);
    const [privyProfile, setPrivyProfile] = createSignal<PrivyProfile | null>(null);
    const [socialAuthError, setSocialAuthError] = createSignal<string | null>(null);
    const privyAttemptRef = { current: null } as {
        current: (string | null) | null;
    };
    const loggingOutRef = { current: false } as {
        current: any;
    };
    const exchangeRef = { current: null } as {
        current: (Promise<void> | null) | null;
    };
    const authGenerationRef = { current: 0 } as {
        current: any;
    };
    const recoveryRef = { current: null } as {
        current: ({
            generation: number;
            promise: Promise<AuthUser>;
        } | null) | null;
    };
    const _state1 = usePrivyIntegration();
    const sessionStateRef = { current: { get user() {
                return user();
            }, get privyReady() {
                return _state1.ready;
            }, get isPrivyAuthenticated() {
                return _state1.authenticated;
            }, get getAccessToken() {
                return _state1.getAccessToken;
            } } } as {
        current: any;
    };
    sessionStateRef.current = { get user() {
            return user();
        }, get privyReady() {
            return _state1.ready;
        }, get isPrivyAuthenticated() {
            return _state1.authenticated;
        }, get getAccessToken() {
            return _state1.getAccessToken;
        } };
    // Clear session expired state
    const clearSessionExpired = () => {
        setSessionExpired(false);
        setSessionExpiredMessage(null);
    };
    const ensureSession = (): Promise<AuthUser> => {
        const generation = authGenerationRef.current;
        if (loggingOutRef.current || sessionStorage.getItem('fxv_pending_logout') === 'true') {
            return Promise.reject(new Error('Sign-out is in progress.'));
        }
        if (recoveryRef.current?.generation === generation)
            return recoveryRef.current.promise;
        const state = sessionStateRef.current;
        const promise = (async () => {
            await exchangeRef.current;
            const restoredUser = await ensureStudentSession(state.privyReady && state.isPrivyAuthenticated ? state.getAccessToken : undefined, state.user?.userId) as AuthUser;
            if (generation !== authGenerationRef.current || loggingOutRef.current) {
                throw new Error('The sign-in session changed. Please try again.');
            }
            setUser(restoredUser);
            clearSessionExpired();
            return restoredUser;
        })().catch((error: any) => {
            if (error?.response?.status === 401 && generation === authGenerationRef.current
                && !loggingOutRef.current && sessionStateRef.current.user) {
                forceAuthCleanup();
                setUser(null);
                setSessionExpired(true);
                setSessionExpiredMessage('Your session has expired. Please log in again to continue.');
            }
            throw error;
        });
        const pending = { generation, promise };
        recoveryRef.current = pending;
        void promise.finally(() => {
            if (recoveryRef.current === pending)
                recoveryRef.current = null;
        }).catch(() => { });
        return promise;
    };
    createEffect(on(() => [], () => {
        const _cleanup3 = untrack(() => registerSessionRecoveryHandler(async () => {
            try {
                await ensureSession();
                return true;
            }
            catch (error: any) {
                if (error?.response?.status === 401)
                    return false;
                throw error;
            }
        }));
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    createEffect(on(() => [], () => {
        const _cleanup4 = untrack(() => {
            // Check if user is authenticated on mount
            const checkAuth = async () => {
                const generation = authGenerationRef.current;
                try {
                    const restoredUser = await ensureStudentSession() as AuthUser;
                    if (generation === authGenerationRef.current && !loggingOutRef.current) {
                        setUser(restoredUser);
                        clearSessionExpired();
                        try {
                            if (restoredUser.userId)
                                localStorage.setItem('fxv_user_id', restoredUser.userId);
                        }
                        catch {
                            // Browser storage is optional; the server session is authoritative.
                        }
                    }
                }
                catch (err) {
                    if (generation !== authGenerationRef.current || loggingOutRef.current)
                        return;
                    // Not authenticated or session expired
                    setUser(null);
                    forceAuthCleanup();
                }
                finally {
                    setInitialLoading(false);
                }
            };
            checkAuth();
        });
        if (typeof _cleanup4 === "function")
            onCleanup(_cleanup4);
    }));
    createEffect(on(() => [initialLoading(), _state1.ready, _state1.authenticated, _state1.userId, user(), sessionExpired()], () => {
        const _cleanup5 = untrack(() => {
            if (loggingOutRef.current || sessionStorage.getItem('fxv_pending_logout') === 'true')
                return;
            if (!_state1.authenticated)
                privyAttemptRef.current = null;
            if (initialLoading() || sessionExpired() || !_state1.ready || !_state1.authenticated || !_state1.userId || user())
                return;
            if (privyAttemptRef.current === _state1.userId)
                return;
            privyAttemptRef.current = _state1.userId;
            const generation = ++authGenerationRef.current;
            setSocialAuthError(null);
            setLoginLoading(true);
            setLoginInProgress(true);
            const exchangePrivySession = async () => {
                try {
                    const accessToken = await _state1.getAccessToken();
                    if (!accessToken)
                        throw new Error('Privy session is unavailable');
                    const response = await loginWithPrivy(accessToken);
                    if (generation !== authGenerationRef.current || loggingOutRef.current)
                        return;
                    if (response.status === 'authenticated' && response.user) {
                        const loggedInUser = await ensureStudentSession(undefined, response.user.userId) as AuthUser;
                        if (generation !== authGenerationRef.current || loggingOutRef.current)
                            return;
                        setUser(loggedInUser);
                        clearSessionExpired();
                        setPrivyProfile(null);
                        sessionStorage.removeItem('fxv_privy_auth_error');
                        sessionStorage.removeItem('fxv_pending_privy_profile');
                        const fullName = `${loggedInUser.givenName || ''} ${loggedInUser.familyName || ''}`.trim();
                        if (fullName)
                            localStorage.setItem('fxv_user_fullname', fullName);
                        if (loggedInUser.userId)
                            localStorage.setItem('fxv_user_id', loggedInUser.userId);
                        const authProvider = sessionStorage.getItem('fxv_pending_auth_provider');
                        if (authProvider === 'twitter' || authProvider === 'google' || authProvider === 'apple') {
                            localStorage.setItem('fxv_last_auth_provider', authProvider);
                        }
                        sessionStorage.removeItem('fxv_pending_auth_provider');
                        if (sessionStorage.getItem('fxv_privy_login_pending') === 'true') {
                            sessionStorage.removeItem('fxv_privy_login_pending');
                            window.location.replace('/home');
                        }
                        return;
                    }
                    if (response.status === 'registration_required' && response.profile) {
                        const profile = response.profile as PrivyProfile;
                        setPrivyProfile(profile);
                        sessionStorage.setItem('fxv_pending_privy_profile', JSON.stringify(profile));
                        sessionStorage.removeItem('fxv_privy_login_pending');
                        if (window.location.pathname !== '/register') {
                            window.location.assign('/register?auth=privy');
                        }
                        return;
                    }
                    throw new Error(response.error || 'Unable to sign in with Privy');
                }
                catch (error: any) {
                    if (generation !== authGenerationRef.current || loggingOutRef.current)
                        return;
                    console.error('Privy session exchange failed:', error);
                    const message = error?.response?.status === 429
                        ? error?.response?.data?.error || 'Too many sign-in attempts. Please try again later.'
                        : 'Sign-in could not be completed. Please open Login and try again.';
                    sessionStorage.setItem('fxv_privy_auth_error', message);
                    setSocialAuthError(message);
                    sessionStorage.removeItem('fxv_privy_login_pending');
                    sessionStorage.removeItem('fxv_pending_auth_provider');
                }
                finally {
                    if (generation === authGenerationRef.current) {
                        setLoginLoading(false);
                        setLoginInProgress(false);
                    }
                }
            };
            exchangeRef.current = exchangePrivySession();
        });
        if (typeof _cleanup5 === "function")
            onCleanup(_cleanup5);
    }));
    // Preload dashboard data when user is authenticated
    createEffect(on(() => [user(), initialLoading()], () => {
        const _cleanup6 = untrack(() => {
            if (user() && !initialLoading()) {
                // Warm the cache for upcoming lesson data in the background
                // Don't await - let it run in background without blocking UI
                scheduleApi.preloadDashboardData()
                    .catch((err) => console.warn('Failed to preload dashboard data:', err));
            }
        });
        if (typeof _cleanup6 === "function")
            onCleanup(_cleanup6);
    }));
    // Redirect away from protected routes if session expired
    createEffect(on(() => [initialLoading(), user(), loginLoading(), sessionExpired(), _state1.ready, _state1.authenticated, socialAuthError()], () => {
        const _cleanup7 = untrack(() => {
            if (typeof window === 'undefined')
                return;
            if (initialLoading())
                return;
            if (sessionExpired() || !_state1.ready || (_state1.authenticated && !socialAuthError()))
                return;
            if (user() || loginLoading())
                return; // avoid redirect mid-login attempt
            const path = window.location.pathname;
            if (PROTECTED_PATHS.some(p => path.startsWith(p))) {
                window.location.href = '/';
            }
        });
        if (typeof _cleanup7 === "function")
            onCleanup(_cleanup7);
    }));
    // Register 401 handler for axios interceptor
    createEffect(on(() => [], () => {
        const _cleanup8 = untrack(() => {
            return registerUnauthorizedHandler(() => {
                // Prevent clearing user during active login request
                if (loggingOutRef.current || !sessionStateRef.current.user)
                    return;
                forceAuthCleanup();
                setUser(null);
                // Show session expired modal instead of immediate redirect
                setSessionExpired(true);
                setSessionExpiredMessage('Your session has expired. Please log in again to continue.');
            });
        });
        if (typeof _cleanup8 === "function")
            onCleanup(_cleanup8);
    }));
    const login = async (email: string, password: string) => {
        authGenerationRef.current += 1;
        // Set both local state and global flag to prevent 401 handler interference
        setLoginLoading(true);
        setLoginInProgress(true);
        // Clear any stale client-side auth state before attempting login
        forceAuthCleanup();
        try {
            const data = await loginUser(email, password);
            // Check for server-provided error message first
            if (data?.success === false || data?.error) {
                throw new Error(data.error || 'Invalid email or password. Please try again.');
            }
            if (data?.user) {
                // /login returns full user data from RegisteredParams
                const loggedInUser = data.user as AuthUser;
                if (loggedInUser.role && loggedInUser.role !== allowedRole) {
                    setUser(null);
                    throw new Error('You are not allowed to log in to the student app.');
                }
                setUser(loggedInUser);
                // Persist name for cases where /me returns minimal fields
                const first = loggedInUser.givenName || '';
                const last = loggedInUser.familyName || '';
                if (first || last) {
                    localStorage.setItem('fxv_user_fullname', `${first} ${last}`.trim());
                }
                if (loggedInUser.userId) {
                    localStorage.setItem('fxv_user_id', loggedInUser.userId);
                }
                // Small delay to ensure cookie is fully set before /me call
                await new Promise(resolve => setTimeout(resolve, 150));
                // Immediately refresh from /me to pull cookie-derived fields (walletAddress)
                // This is optional - don't let it break the login flow
                try {
                    const me = await getMe();
                    if (me?.user) {
                        if (me.user.role && me.user.role !== allowedRole) {
                            setUser(null);
                            throw new Error('You are not allowed to log in to the student app.');
                        }
                        setUser(prev => ({ ...prev, ...me.user }));
                    }
                }
                catch (e) {
                    console.warn('Post-login /me refresh failed - continuing without extra fields:', e);
                    // Don't throw - login was successful, just /me failed
                }
            }
            else {
                throw new Error('Unable to sign in. Please check your credentials and try again.');
            }
        }
        catch (err: any) {
            // Clear any partial state on error
            setUser(null);
            // Extract user-friendly error message from Axios error response
            let errorMessage = 'Login failed. Please try again.';
            // Check for server-provided error message in response data
            if (err?.response?.data?.error) {
                errorMessage = err.response.data.error;
            }
            else if (err?.response?.data?.message) {
                errorMessage = err.response.data.message;
            }
            else if (err?.message && !err.message.includes('status code')) {
                // Use error.message only if it's not the generic Axios message
                errorMessage = err.message;
            }
            throw new Error(errorMessage);
        }
        finally {
            setLoginLoading(false);
            setLoginInProgress(false);
        }
    };
    // Helper to get user ID
    const getUserId = () => {
        return user()?.userId;
    };
    /**
     * Login by wallet address with signature verification (SIWE)
     * Returns status to indicate if user needs registration or has incomplete profile
     */
    const loginByWallet = async (_props2: WalletAuthParams): Promise<WalletLoginResult> => {
        authGenerationRef.current += 1;
        setLoginLoading(true);
        setLoginInProgress(true);
        forceAuthCleanup();
        try {
            const response = await loginWithWallet(_props2["walletAddress"], _props2["signature"], _props2["message"]);
            if (response.status === 'error') {
                throw new Error(response.message || 'Authentication failed');
            }
            if (response.status === 'not_found') {
                // User doesn't exist - needs registration
                return { status: 'not_found', user: null };
            }
            if (response.status === 'incomplete_registration') {
                // User exists but profile incomplete
                return {
                    status: 'incomplete_registration',
                    user: response.user as AuthUser,
                    missingFields: response.missingFields
                };
            }
            // Full authentication
            if (response.user) {
                const loggedInUser = response.user as AuthUser;
                if (loggedInUser.role && loggedInUser.role !== allowedRole) {
                    setUser(null);
                    throw new Error('You are not allowed to log in to the student app.');
                }
                setUser(loggedInUser);
                // Persist name for cases where /me returns minimal fields
                const first = loggedInUser.givenName || '';
                const last = loggedInUser.familyName || '';
                if (first || last) {
                    localStorage.setItem('fxv_user_fullname', `${first} ${last}`.trim());
                }
                if (loggedInUser.userId) {
                    localStorage.setItem('fxv_user_id', loggedInUser.userId);
                }
                return { status: 'authenticated', user: loggedInUser };
            }
            throw new Error('Unable to sign in with wallet. Please try again.');
        }
        catch (err: any) {
            setUser(null);
            throw new Error(err?.message || 'Wallet login failed');
        }
        finally {
            setLoginLoading(false);
            setLoginInProgress(false);
        }
    };
    /**
     * Register a new user with wallet address
     */
    const registerByWallet = async (params: WalletRegisterParams): Promise<void> => {
        authGenerationRef.current += 1;
        setLoginLoading(true);
        setLoginInProgress(true);
        forceAuthCleanup();
        try {
            const response = await registerWithWallet(params);
            if (response.success && response.user) {
                const newUser = response.user as AuthUser;
                if (newUser.role && newUser.role !== allowedRole) {
                    setUser(null);
                    throw new Error('You are not allowed to log in to the student app.');
                }
                setUser(newUser);
                const first = newUser.givenName || '';
                const last = newUser.familyName || '';
                if (first || last) {
                    localStorage.setItem('fxv_user_fullname', `${first} ${last}`.trim());
                }
                if (newUser.userId) {
                    localStorage.setItem('fxv_user_id', newUser.userId);
                }
            }
            else {
                throw new Error(response.message || 'Registration failed');
            }
        }
        catch (err: any) {
            setUser(null);
            throw new Error(err?.message || 'Wallet registration failed');
        }
        finally {
            setLoginLoading(false);
            setLoginInProgress(false);
        }
    };
    const registerByPrivy = async (params: PrivyRegisterParams): Promise<void> => {
        authGenerationRef.current += 1;
        setLoginLoading(true);
        setLoginInProgress(true);
        try {
            const accessToken = await _state1.getAccessToken();
            if (!accessToken) {
                throw new Error('Your social sign-in session expired. Please sign in again.');
            }
            const response = await registerWithPrivy(accessToken, params);
            if (!response.success || !response.user) {
                throw new Error(response.error || 'Registration failed');
            }
            setUser(await ensureStudentSession(undefined, response.user.userId) as AuthUser);
            clearSessionExpired();
            setPrivyProfile(null);
            sessionStorage.removeItem('fxv_pending_privy_profile');
            const authProvider = sessionStorage.getItem('fxv_pending_auth_provider');
            if (authProvider === 'twitter' || authProvider === 'google' || authProvider === 'apple') {
                localStorage.setItem('fxv_last_auth_provider', authProvider);
            }
            sessionStorage.removeItem('fxv_pending_auth_provider');
        }
        catch (error: any) {
            throw new Error(error?.response?.data?.error || error?.message || 'Registration failed');
        }
        finally {
            setLoginLoading(false);
            setLoginInProgress(false);
        }
    };
    const logout = async () => {
        if (loggingOutRef.current)
            return;
        loggingOutRef.current = true;
        try { clearSessionDrafts(sessionStorage); } catch {}
        authGenerationRef.current += 1;
        setLoginLoading(true);
        // IMPORTANT: Clear local state FIRST to prevent race conditions
        // This ensures checkAuth won't find a session and auto-login won't trigger
        setUser(null);
        // Clear all cached auth data BEFORE calling server
        forceAuthCleanup();
        // Set a flag so the landing page knows we're attempting logout
        // If the cookie doesn't get cleared, the landing page will retry
        try {
            // Finish any request that can set the cookie before deleting that cookie.
            await exchangeRef.current;
            await recoveryRef.current?.promise.catch(() => { });
            sessionStorage.removeItem('fxv_privy_login_pending');
            sessionStorage.removeItem('fxv_pending_auth_provider');
            sessionStorage.removeItem('fxv_pending_privy_profile');
            sessionStorage.setItem('fxv_pending_logout', 'true');
        }
        catch (e) { }
        // Mark that we're intentionally logging out
        setLoginInProgress(true);
        try {
            // Disconnect browser wallet state first to clear the local wallet session
            try {
                await appWallet.disconnect();
            }
            catch (walletErr) {
                console.warn('Failed to disconnect wallet:', walletErr);
            }
            try {
                await _state1.logout();
            }
            catch (privyError) {
                console.warn('Failed to clear Privy session:', privyError);
            }
            // Call server to clear cookie
            await logoutUser();
            // CRITICAL: Wait for browser to process the Set-Cookie header before navigating.
            // Without this delay, navigation can occur before the cookie is actually deleted,
            // causing the user to be "logged back in" on the next page load.
            await new Promise(resolve => setTimeout(resolve, 150));
            // Clear the pending logout flag on success
            try {
                sessionStorage.removeItem('fxv_pending_logout');
            }
            catch (e) { }
        }
        catch (err) {
            console.error('Logout error:', err);
            // Continue with logout even if server call fails
            // Keep the pending flag so landing page can retry
        }
        finally {
            setLoginInProgress(false);
            // Force a full page reload to clear all state and prevent any race conditions
            // Use replace to prevent back button from going to authenticated page
            if (typeof window !== 'undefined') {
                window.location.replace('/');
            }
        }
    };
    const isAuthenticated = createMemo(() => !!user());
    const resolvedInitialLoading = createMemo(() => initialLoading() || (!loggingOutRef.current && sessionStorage.getItem('fxv_pending_logout') !== 'true'
        && !user() && !sessionExpired() && !socialAuthError() && !privyProfile() && (!_state1.ready || _state1.authenticated)));
    return (<AuthContext.Provider value={{
            get user() {
                return user();
            },
            get isAuthenticated() {
                return isAuthenticated();
            },
            get initialLoading() {
                return resolvedInitialLoading();
            },
            get loginLoading() {
                return loginLoading();
            },
            get sessionExpired() {
                return sessionExpired();
            },
            get sessionExpiredMessage() {
                return sessionExpiredMessage();
            },
            login,
            loginByWallet,
            registerByWallet,
            registerByPrivy,
            get privyProfile() {
                return privyProfile();
            },
            get isPrivyAuthenticated() {
                return _state1.authenticated;
            },
            logout,
            getUserId,
            clearSessionExpired,
            ensureSession
        }}>
      {_props0["children"]}
      {socialAuthError() && <div role="alert" style={cssStyle({ position: 'fixed', bottom: '16px', left: '16px', right: '16px', zIndex: 100001, padding: '16px', background: '#fff', color: '#b42318', border: '1px solid #b42318', borderRadius: '8px' })}>{socialAuthError()}</div>}
    </AuthContext.Provider>);
};
export const useAuthContext = () => {
    const ctx = useContext(AuthContext);
    if (!ctx)
        throw new Error('useAuthContext must be used within AuthProvider');
    return ctx;
};
