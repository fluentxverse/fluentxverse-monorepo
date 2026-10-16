import { useAuthContext } from '../../context/AuthContext';
import StudentDialog from './StudentDialog';
import { LogIn } from 'lucide-preact';

export const SessionExpiredModal = () => {
  const { sessionExpired, sessionExpiredMessage, clearSessionExpired } = useAuthContext();

  if (!sessionExpired) return null;

  const handleLoginRedirect = () => {
    clearSessionExpired();
    // Redirect to home/login page
    window.location.href = '/';
  };

  return (
    <StudentDialog label="Session expired" onClose={handleLoginRedirect}>
      <div className="session-expired-modal">
        <img className="student-dialog-art" src="/assets/img/home-icons/home-v1.webp" alt="" />
        <h2>Session Expired</h2>
        <p>{sessionExpiredMessage || 'Your session has expired. Please log in again to continue.'}</p>

        <div className="student-dialog-actions"><button
          type="button"
          className="primary"
          onClick={handleLoginRedirect}
        >
          <LogIn size={16} />
          Go to Login
        </button></div>
      </div>
    </StudentDialog>
  );
};

export default SessionExpiredModal;
