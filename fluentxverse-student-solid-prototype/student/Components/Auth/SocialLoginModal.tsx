import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import { usePrivyIntegration } from '../../context/PrivyContext';
import StudentDialog from '../Common/StudentDialog';
import { X, CircleAlert } from "lucide-solid";
import './SocialLoginModal.css';
interface SocialLoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    onNeedsRegistration?: (walletAddress: string) => void;
    onIncompleteProfile?: (walletAddress: string, missingFields: string[]) => void;
}
type SocialProvider = 'twitter' | 'google' | 'apple';
export function SocialLoginModal(_props0: SocialLoginModalProps) {
    const [connectingProvider, setConnectingProvider] = createSignal<SocialProvider | null>(null);
    const [lastUsedProvider, setLastUsedProvider] = createSignal<SocialProvider | null>(null);
    const [loginError, setLoginError] = createSignal<string | null>(null);
    const _state1 = usePrivyIntegration();
    const isConnecting = createMemo(() => !_state1.ready || _state1.loading || Boolean(connectingProvider()));
    createEffect(on(() => [_state1.error], () => {
        const _cleanup2 = untrack(() => {
            if (_state1.error) {
                setLoginError(_state1.error);
                setConnectingProvider(null);
            }
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    createEffect(on(() => [_props0["isOpen"]], () => {
        const _cleanup3 = untrack(() => {
            if (!_props0["isOpen"])
                return;
            setLoginError(sessionStorage.getItem('fxv_privy_auth_error'));
            const storedProvider = localStorage.getItem('fxv_last_auth_provider');
            setLastUsedProvider(storedProvider === 'twitter' || storedProvider === 'google' || storedProvider === 'apple'
                ? storedProvider
                : null);
        });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    const handleSocialLogin = createMemo(on(() => [_state1.initOAuth, _state1.configured], () => async (provider: SocialProvider) => {
        setConnectingProvider(provider);
        setLoginError(null);
        if (!_state1.configured) {
            setLoginError('Social sign-in is not configured for this environment.');
            setConnectingProvider(null);
            return;
        }
        try {
            sessionStorage.setItem('fxv_privy_login_pending', 'true');
            sessionStorage.setItem('fxv_pending_auth_provider', provider);
            await _state1.initOAuth(provider);
        }
        catch (error: any) {
            sessionStorage.removeItem('fxv_privy_login_pending');
            sessionStorage.removeItem('fxv_pending_auth_provider');
            console.error('Privy OAuth login error:', error);
            setLoginError(error?.message || 'Social sign-in failed. Please try again.');
            setConnectingProvider(null);
        }
    }));
    return createMemo(() => {
        if (!_props0["isOpen"])
            return null;
        const buttonContent = (provider: SocialProvider, label: string, icon: any) => (connectingProvider() === provider ? (<div class="btn-loading">
        <div class="spinner"></div>
        <span>Redirecting...</span>
      </div>) : <>
      <span class="social-icon-slot">{icon}</span>
      <span class="social-btn-label">{label}</span>
      <span class="social-btn-end">{lastUsedProvider() === provider && <span class="last-used-badge">Last used</span>}</span>
    </>);
        return (<StudentDialog className="social-login-dialog" label="Sign in or register" onClose={_props0["onClose"]} busy={Boolean(connectingProvider())}>
      <div class="social-login-modal" onMouseDown={(event) => event.stopPropagation()}>
        <button class="student-dialog-close" onClick={_props0["onClose"]} disabled={Boolean(connectingProvider())} aria-label="Close sign in"><X size={18}/></button>

        <div class="social-brand">
          <div class="modal-logo"><img src="/assets/img/logo/icon_logo.webp" alt="" width="88" height="100"/></div>
          <div class="modal-brand-text">Fluent<span class="brand-x">X</span>Verse</div>
        </div>

        <div class="login-title">
          <h2>Sign in or create an account</h2>
          <p>Register or sign in with your preferred account</p>
        </div>

        <div class="social-login-buttons">
          <button class="social-btn google-btn" onClick={() => handleSocialLogin()('google')} disabled={isConnecting()}>
            {buttonContent('google', 'Continue with Google', <svg class="google-mark" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.33 2.98-7.39Z"/>
              <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.63-2.38l-3.24-2.53c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.61A10 10 0 0 0 12 22Z"/>
              <path fill="#FBBC05" d="M6.39 13.92A6.02 6.02 0 0 1 6.08 12c0-.67.11-1.32.31-1.92V7.47H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.53l3.35-2.61Z"/>
              <path fill="#EA4335" d="M12 5.95c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.47l3.35 2.61C7.18 7.71 9.39 5.95 12 5.95Z"/>
            </svg>)}
          </button>

          <button class="social-btn apple-btn" onClick={() => handleSocialLogin()('apple')} disabled={isConnecting()}>
            {buttonContent('apple', 'Continue with Apple', <svg class="apple-mark" viewBox="8 3 14 17" aria-hidden="true"><path d="M18.71 12.07c.02 2.16 1.9 2.88 1.92 2.89-.02.05-.3 1.03-.99 2.05-.6.88-1.22 1.75-2.2 1.77-.96.02-1.27-.57-2.37-.57-1.1 0-1.45.55-2.36.59-.94.04-1.66-.94-2.27-1.82-1.24-1.8-2.19-5.08-.92-7.29a3.52 3.52 0 0 1 3-1.82c.94-.02 1.82.63 2.39.63.57 0 1.63-.78 2.75-.66.47.02 1.79.19 2.64 1.43-.07.04-1.57.91-1.59 2.8ZM16.93 6.66c.5-.61.84-1.45.75-2.29-.73.03-1.61.49-2.13 1.1-.47.54-.88 1.39-.77 2.21.81.06 1.64-.41 2.15-1.02Z"/></svg>)}
          </button>

          <button class="social-btn x-btn" onClick={() => handleSocialLogin()('twitter')} disabled={isConnecting()}>
            {buttonContent('twitter', 'Continue with X', <svg class="x-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817-5.967 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"/></svg>)}
          </button>
        </div>

        {loginError() && <div class="login-error" role="alert"><CircleAlert size={18}/><span>{loginError()}</span></div>}

        <div class="social-legal">
          <p>By continuing, you agree to our <a href="/terms-of-service">Terms of Service</a> and <a href="/privacy-policy">Privacy Policy</a></p>
        </div>
      </div>
    </StudentDialog>);
    }) as unknown as JSX.Element;
}
export default SocialLoginModal;
