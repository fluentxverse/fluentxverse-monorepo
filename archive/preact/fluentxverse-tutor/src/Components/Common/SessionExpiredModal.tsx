import TutorDialog from "./TutorDialog";
import TutorIcon from ".//TutorIcon";
import { useAuthContext } from '../../context/AuthContext';
import './SessionExpiredModal.css';

export const SessionExpiredModal = () => {
  const { sessionExpired, sessionExpiredMessage, clearSessionExpired } = useAuthContext();

  if (!sessionExpired) return null;

  const handleLoginRedirect = () => {
    clearSessionExpired();
    // Redirect to home/login page
    window.location.href = '/';
  };

  return (
    <TutorDialog label="Session expired" className="tutor-session-dialog" onClose={() => {}} busy={true}>
      <div className="session-expired-modal">
        <div className="session-expired-icon">
          <TutorIcon name="ri-time-line" />
        </div>
        <h2>Session Expired</h2>
        <p>{sessionExpiredMessage || 'Your session has expired. Please log in again to continue.'}</p>
        <button 
          type="button"
          className="session-expired-btn"
          onClick={handleLoginRedirect}
        >
          <TutorIcon name="ri-login-box-line" />
          Go to Login
        </button>
      </div>
    </TutorDialog>
  );
};

export default SessionExpiredModal;
