import React, { useState } from 'react';
import './LoginModal.css';
import { useAuthContext } from '../../context/AuthContext';


interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuthContext();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setError('');
    setLoading(true);
    
    try {
      await login(email, password);
      // Small delay to ensure state is fully updated before navigation
      await new Promise(resolve => setTimeout(resolve, 200));
      onClose();
      // Use replace to prevent back button issues
      window.location.replace('/home');
    } catch (err: any) {
      console.error('Login error:', err);
      setLoading(false);
      setError(err.message || 'Invalid credentials');
    }
  };

  if (!isOpen) return



  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="login-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close login modal">×</button>
        <div className="modal-logo">
          <img src= "/assets/img/logo/icon_logo.png" alt="FluentXVerse" />
          <div className="modal-brand-text">FLUENTXVERSE</div>
        </div>
        <h2 className="modal-title">Login to Your Account</h2>
        <p className="modal-subtitle">Unlock your farm’s secrets and log in to get growing!</p>
        <form className="modal-form" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail((e.target as HTMLInputElement).value)}
            className="modal-input"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword((e.target as HTMLInputElement).value)}
            className="modal-input"
            required
          />
          {error && <div className="modal-error">{error}</div>}
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
                window.location.href = '/';
              }}
            >
              Apply for an account
            </button>
          </span>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
