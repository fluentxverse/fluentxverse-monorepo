import { useState, useCallback } from 'preact/hooks';
import { connectWallet } from '../../config/wallet';
import { useAuthContext } from '../../context/AuthContext';
import { requestWalletNonce } from '../../api/auth.api';
import './SocialLoginModal.css';

interface SocialLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onNeedsRegistration?: (walletAddress: string) => void;
  onIncompleteProfile?: (walletAddress: string, missingFields: string[]) => void;
}

export function SocialLoginModal({ isOpen, onClose, onSuccess, onNeedsRegistration,onIncompleteProfile }: SocialLoginModalProps) {
  const { loginByWallet } = useAuthContext();
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const isConnecting = Boolean(connectingProvider);

  const handleWalletLogin = useCallback(async () => {
    setConnectingProvider('wallet');
    setLoginError(null);
    
    try {
      const account = await connectWallet();
      const walletAddress = account.address;
      
      if (!walletAddress || !account) {
        throw new Error('Failed to get wallet address. Please try again.');
      }

      const nonceResponse = await requestWalletNonce(walletAddress);
      
      if (!nonceResponse.success || !nonceResponse.message) {
        throw new Error('Failed to get authentication nonce. Please try again.');
      }

      const signature = await account.signMessage({ message: nonceResponse.message });
      
      if (!signature) {
        throw new Error('Failed to sign authentication message. Please try again.');
      }

      const result = await loginByWallet({
        walletAddress,
        signature,
        message: nonceResponse.message
      });
      
      if (result.status === 'not_found') {
        // Wallet doesn't exist - redirect to registration
        // Store signature info for registration
        localStorage.setItem('fxv_pending_wallet', walletAddress);
        localStorage.setItem('fxv_pending_signature', signature);
        localStorage.setItem('fxv_pending_message', nonceResponse.message);
        onClose();
        onNeedsRegistration?.(walletAddress);
        return;
      }

      if (result.status === 'incomplete_registration') {
        // Wallet exists but profile incomplete
        localStorage.setItem('fxv_pending_wallet', walletAddress);
        localStorage.setItem('fxv_pending_signature', signature);
        localStorage.setItem('fxv_pending_message', nonceResponse.message);
        onClose();
        onIncompleteProfile?.(walletAddress, result.missingFields || []);
        return;
      }

      // Full authentication successful
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('wallet login error:', err);
      setLoginError(err?.message || 'Failed to sign in with wallet. Please try again.');
    } finally {
      setConnectingProvider(null);
    }
  }, [onClose, onSuccess, onNeedsRegistration, onIncompleteProfile, loginByWallet]);

  const handleOverlayClick = useCallback((e: MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('social-login-overlay')) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="social-login-overlay" onMouseDown={handleOverlayClick}>
      <div className="social-login-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
          <i className="fas fa-times"></i>
        </button>

        {/* Header */}
        <div className="modal-header">
          <div className="modal-logo">
            <img src="/assets/img/logo/icon_logo.webp" alt="FluentXVerse" />
          </div>
          <div className="modal-brand-text">Fluent<span className="brand-x">X</span>Verse</div>
        </div>

        {/* Title */}
        <div className="login-title">
          <h2>Welcome Back</h2>
          <p>Register or login using the options below</p>
        </div>

        {/* Wallet Login Button */}
        <div className="social-login-buttons">
          <button
            className="social-btn google-btn"
            onClick={handleWalletLogin}
            disabled={isConnecting}
          >
            {connectingProvider === "wallet" ? (
              <div className="btn-loading">
                <div className="spinner"></div>
                <span>Connecting...</span>
              </div>
            ) : (
              <>
                <div className="social-icon">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                    <path d="M3 7.5A3.5 3.5 0 0 1 6.5 4h11A3.5 3.5 0 0 1 21 7.5v9a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 16.5v-9Zm3.5-1A1.5 1.5 0 0 0 5 8v8.5A1.5 1.5 0 0 0 6.5 18h11a1.5 1.5 0 0 0 1.5-1.5V14h-4.25A2.75 2.75 0 0 1 12 11.25v-.5A2.75 2.75 0 0 1 14.75 8H19v-.5A1.5 1.5 0 0 0 17.5 6h-11Zm8.25 4a.75.75 0 0 0-.75.75v.5c0 .414.336.75.75.75H19v-2h-4.25Z"/>
                  </svg>
                </div>
                <span>Connect Wallet</span>
              </>
            )}
          </button>
        </div>

        {/* Error Message */}
        {loginError && (
          <div className="login-error">
            <i className="fas fa-exclamation-circle"></i>
            <span>{loginError}</span>
          </div>
        )}

        {/* Footer */}
        <div className="modal-footer">
          <p>
            By continuing, you agree to our{' '}
            <a href="/terms-of-service">Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy-policy">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default SocialLoginModal;
