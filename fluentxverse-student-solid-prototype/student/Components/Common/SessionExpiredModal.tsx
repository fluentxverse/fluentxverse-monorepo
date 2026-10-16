import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import { useAuthContext } from '../../context/AuthContext';
import StudentDialog from './StudentDialog';
import { LogIn } from "lucide-solid";
export const SessionExpiredModal = () => {
    const _state0 = useAuthContext();
    return createMemo(() => {
        if (!_state0.sessionExpired)
            return null;
        const handleLoginRedirect = () => {
            _state0.clearSessionExpired();
            // Redirect to home/login page
            window.location.href = '/';
        };
        return (<StudentDialog label="Session expired" onClose={handleLoginRedirect}>
      <div class="session-expired-modal">
        <img class="student-dialog-art" src="/assets/img/home-icons/home-v1.webp" alt=""/>
        <h2>Session Expired</h2>
        <p>{_state0.sessionExpiredMessage || 'Your session has expired. Please log in again to continue.'}</p>

        <div class="student-dialog-actions"><button type="button" class="primary" onClick={handleLoginRedirect}>
          <LogIn size={16}/>
          Go to Login
        </button></div>
      </div>
    </StudentDialog>);
    }) as unknown as JSX.Element;
};
export default SessionExpiredModal;
