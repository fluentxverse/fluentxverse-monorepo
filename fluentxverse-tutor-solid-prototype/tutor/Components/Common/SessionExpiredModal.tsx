import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import TutorDialog from "./TutorDialog";
import TutorIcon from ".//TutorIcon";
import { useAuthContext } from '../../context/AuthContext';
import './SessionExpiredModal.css';
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
        return (<TutorDialog label="Session expired" className="tutor-session-dialog" onClose={() => { }} busy={true}>
      <div class="session-expired-modal">
        <div class="session-expired-icon">
          <TutorIcon name="ri-time-line"/>
        </div>
        <h2>Session Expired</h2>
        <p>{_state0.sessionExpiredMessage || 'Your session has expired. Please log in again to continue.'}</p>
        <button type="button" class="session-expired-btn" onClick={handleLoginRedirect}>
          <TutorIcon name="ri-login-box-line"/>
          Go to Login
        </button>
      </div>
    </TutorDialog>);
    }) as unknown as JSX.Element;
};
export default SessionExpiredModal;
