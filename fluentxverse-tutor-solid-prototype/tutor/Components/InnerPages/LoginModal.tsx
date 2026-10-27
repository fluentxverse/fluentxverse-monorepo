import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component } from "solid-js";
import { Portal } from "solid-js/web";
import BrandWordmark from '../../../../shared/ui/BrandWordmark';
import { cssStyle, Fragment } from "../../utils/cssStyle";
import TutorDialog from '../Common/TutorDialog';
import TutorIcon from '../Common/TutorIcon';
import { JSX } from "solid-js";
import './LoginModal.css';
import { useAuthContext } from '../../context/AuthContext';
import { useLocation } from "../../routing";
interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
}
const LoginModal: Component<LoginModalProps> = (_props0) => {
    const [email, setEmail] = createSignal('');
    const [password, setPassword] = createSignal('');
    const [error, setError] = createSignal('');
    const _state1 = useAuthContext();
    const location = useLocation();
    const [loading, setLoading] = createSignal(false);
    const handleSubmit = async (e: SubmitEvent) => {
        e.preventDefault();
        if (!email() || !password()) {
            setError('Please enter both email and password.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            await _state1.login(email(), password());
            _props0["onClose"]();
            // Use client-side navigation instead of full page reload
            location.route('/home');
        }
        catch (err: any) {
            setLoading(false);
            setError(err.message || 'Invalid credentials');
        }
    };
    return createMemo(() => {
        if (!_props0["isOpen"])
            return null;
        return (<TutorDialog label="Sign in to your account" className="tutor-login-dialog" onClose={_props0["onClose"]} busy={loading()}>
      <div class="login-modal" onClick={e => e.stopPropagation()}>
        <div class="tutor-login-header">
          <div class="modal-logo">
            <img src="/assets/img/logo/icon_logo.png" alt="" width="40" height="40"/>
            <div class="modal-brand-text"><BrandWordmark /></div>
          </div>
          <button type="button" class="modal-close" onClick={_props0["onClose"]} aria-label="Close login modal" disabled={loading()}><TutorIcon name="fa-times"/></button>
        </div>
        <h2 class="modal-title">Login to Your Account</h2>
        <p class="modal-subtitle">Welcome back! Log in to continue teaching.</p>
        <form class="modal-form" onSubmit={handleSubmit}>
          <label for="tutor-login-email">Email</label>
          <input id="tutor-login-email" autocomplete="email" type="email" placeholder="Email" value={email()} onInput={e => setEmail((e.target as HTMLInputElement).value)} class="modal-input" required/>
          <label for="tutor-login-password">Password</label>
          <input id="tutor-login-password" autocomplete="current-password" type="password" placeholder="Password" value={password()} onInput={e => setPassword((e.target as HTMLInputElement).value)} class="modal-input" required/>
          {error() && <div class="modal-error" role="alert">{error()}</div>}
          <button type="submit" class="modal-btn" disabled={loading()}>{loading() ? 'Logging in...' : 'Login'}</button>
        </form>
        <div class="tutor-login-footer">
          <span>
            Don’t have an account yet?{' '}
            <button type="button" class="modal-link" onClick={() => {
                window.location.href = '/register';
            }}>
              Apply for an account
            </button>
          </span>
        </div>
      </div>
    </TutorDialog>);
    }) as unknown as JSX.Element;
};
export default LoginModal;
