import TutorDialog from '../Common/TutorDialog';
import TutorIcon from '../Common/TutorIcon';
import { useState } from 'preact/hooks';
import type { FunctionComponent, JSX } from 'preact';
import './LoginModal.css';
import { useAuthContext } from '../../context/AuthContext';
import { useLocation } from 'preact-iso';


interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LoginModal: FunctionComponent<LoginModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuthContext();
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: JSX.TargetedEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setError('');
    setLoading(true);
    
    try {
      await login(email, password);
      onClose();
      // Use client-side navigation instead of full page reload
      location.route('/home');
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Invalid credentials');
    }
  };

  if (!isOpen) return null;



  return (
    <TutorDialog label="Sign in to your account" className="tutor-login-dialog" onClose={onClose} busy={loading}>
      <div className="login-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close login modal" disabled={loading}><TutorIcon name="fa-times" /></button>
        <div className="modal-logo">
          <img src= "/assets/img/logo/icon_logo.png" alt="FluentXVerse" />
          <div className="modal-brand-text">Fluent<span className="brand-x">X</span>Verse</div>
        </div>
        <h2 className="modal-title">Login to Your Account</h2>
        <p className="modal-subtitle">Welcome back! Log in to continue teaching.</p>
        <form className="modal-form" onSubmit={handleSubmit}>
          <label htmlFor="tutor-login-email">Email</label>
          <input
            id="tutor-login-email"
            autoComplete="email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail((e.target as HTMLInputElement).value)}
            className="modal-input"
            required
          />
          <label htmlFor="tutor-login-password">Password</label>
          <input
            id="tutor-login-password"
            autoComplete="current-password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword((e.target as HTMLInputElement).value)}
            className="modal-input"
            required
          />
          {error && <div className="modal-error" role="alert">{error}</div>}
          <button type="submit" className="modal-btn" disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
          <div style={{ marginTop:'12px', fontSize:'12px', color:'#718096', textAlign:'center' }}>

          </div>
        </form>
        <div className="standard-blog-content p">
          <span>
            Don’t have an account yet?{' '}
            <button
              type="button"
              className="modal-link"
              onClick={() => {
                window.location.href = '/register';
              }}
            >
              Apply for an account
            </button>
          </span>
        </div>
      </div>
    </TutorDialog>
  );
};

export default LoginModal;
