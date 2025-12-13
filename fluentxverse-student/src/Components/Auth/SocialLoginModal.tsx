import { useState, useCallback } from 'preact/hooks';
import { useConnect } from "thirdweb/react";
import { inAppWallet } from "thirdweb/wallets";
import { thirdwebClient } from '../../index';
import { useAuthContext } from '../../context/AuthContext';
import { requestWalletNonce } from '../../api/auth.api';
import './SocialLoginModal.css';
import { arbitrumSepolia, baseSepolia } from 'thirdweb/chains';

interface SocialLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onNeedsRegistration?: (walletAddress: string) => void;
  onIncompleteProfile?: (walletAddress: string, missingFields: string[]) => void;
}

const wallet = inAppWallet({
  auth: {
    options: ["google", "apple", "line", "tiktok", "telegram"],
  },
  executionMode: {
    mode: "EIP7702",
    sponsorGas: true,
  },
});

export function SocialLoginModal({ isOpen, onClose, onSuccess, onNeedsRegistration,onIncompleteProfile }: SocialLoginModalProps) {
  const { connect, isConnecting, error } = useConnect();
  const { loginByWallet } = useAuthContext();
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleSocialLogin = useCallback(async (strategy: "google" | "apple" | "line" | "tiktok" | "telegram") => {
    setConnectingProvider(strategy);
    setLoginError(null);
    
    try {
      // Step 1: Connect wallet via Thirdweb OAuth
      await connect(async () => {
        await wallet.connect({
          client: thirdwebClient,
          strategy,
          chain: arbitrumSepolia
        });
        return wallet;
      });

      // Step 2: Get wallet address from the connected wallet
      const account = wallet.getAccount();
      const walletAddress = account?.address;
      
      if (!walletAddress || !account) {
        throw new Error('Failed to get wallet address. Please try again.');
      }

      console.log('Connected wallet address:', walletAddress);

      // Step 3: Request nonce from backend (SIWE flow)
      console.log('Requesting nonce for SIWE...');
      const nonceResponse = await requestWalletNonce(walletAddress);
      
      if (!nonceResponse.success || !nonceResponse.message) {
        throw new Error('Failed to get authentication nonce. Please try again.');
      }

      // Step 4: Sign the message with the wallet
      console.log('Signing message with wallet...');
      const signature = await account.signMessage({ message: nonceResponse.message });
      
      if (!signature) {
        throw new Error('Failed to sign authentication message. Please try again.');
      }

      console.log('Message signed successfully');

      // Step 5: Authenticate with backend using signature
      const result = await loginByWallet({
        walletAddress,
        signature,
        message: nonceResponse.message
      });
      
      if (result.status === 'not_found') {
        // Wallet doesn't exist - redirect to registration
        // Store signature info for registration
        console.log('Wallet not found, needs registration');
        localStorage.setItem('fxv_pending_wallet', walletAddress);
        localStorage.setItem('fxv_pending_signature', signature);
        localStorage.setItem('fxv_pending_message', nonceResponse.message);
        onClose();
        onNeedsRegistration?.(walletAddress);
        return;
      }

      if (result.status === 'incomplete_registration') {
        // Wallet exists but profile incomplete
        console.log('Incomplete registration, missing fields:', result.missingFields);
        localStorage.setItem('fxv_pending_wallet', walletAddress);
        localStorage.setItem('fxv_pending_signature', signature);
        localStorage.setItem('fxv_pending_message', nonceResponse.message);
        onClose();
        onIncompleteProfile?.(walletAddress, result.missingFields || []);
        return;
      }

      // Full authentication successful
      console.log('Wallet login successful:', result.user);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error(`${strategy} login error:`, err);
      setLoginError(err?.message || `Failed to sign in with ${strategy}. Please try again.`);
    } finally {
      setConnectingProvider(null);
    }
  }, [connect, onClose, onSuccess, onNeedsRegistration, onIncompleteProfile, loginByWallet]);

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
            <img src="/assets/img/logo/icon_logo.png" alt="FluentXVerse" />
          </div>
          <div className="modal-brand-text">FluentXVerse</div>
        </div>

        {/* Title */}
        <div className="login-title">
          <h2>Welcome Back</h2>
          <p>Sign in to continue your learning journey</p>
        </div>

        {/* Social Login Buttons */}
        <div className="social-login-buttons">
          {/* Google */}
          <button
            className="social-btn google-btn"
            onClick={() => handleSocialLogin("google")}
            disabled={isConnecting}
          >
            {connectingProvider === "google" ? (
              <div className="btn-loading">
                <div className="spinner"></div>
                <span>Connecting...</span>
              </div>
            ) : (
              <>
                <div className="social-icon">
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {/* Apple */}
          <button
            className="social-btn apple-btn"
            onClick={() => handleSocialLogin("apple")}
            disabled={isConnecting}
          >
            {connectingProvider === "apple" ? (
              <div className="btn-loading">
                <div className="spinner"></div>
                <span>Connecting...</span>
              </div>
            ) : (
              <>
                <div className="social-icon">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                </div>
                <span>Continue with Apple</span>
              </>
            )}
          </button>

          {/* LINE */}
          <button
            className="social-btn line-btn"
            onClick={() => handleSocialLogin("line")}
            disabled={isConnecting}
          >
            {connectingProvider === "line" ? (
              <div className="btn-loading">
                <div className="spinner spinner-white"></div>
                <span>Connecting...</span>
              </div>
            ) : (
              <>
                <div className="social-icon">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.349 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                  </svg>
                </div>
                <span>Continue with LINE</span>
              </>
            )}
          </button>

          {/* TikTok */}
          <button
            className="social-btn tiktok-btn"
            onClick={() => handleSocialLogin("tiktok")}
            disabled={isConnecting}
          >
            {connectingProvider === "tiktok" ? (
              <div className="btn-loading">
                <div className="spinner spinner-white"></div>
                <span>Connecting...</span>
              </div>
            ) : (
              <>
                <div className="social-icon">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                  </svg>
                </div>
                <span>Continue with TikTok</span>
              </>
            )}
          </button>

          {/* Telegram */}
          <button
            className="social-btn telegram-btn"
            onClick={() => handleSocialLogin("telegram")}
            disabled={isConnecting}
          >
            {connectingProvider === "telegram" ? (
              <div className="btn-loading">
                <div className="spinner spinner-white"></div>
                <span>Connecting...</span>
              </div>
            ) : (
              <>
                <div className="social-icon">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                </div>
                <span>Continue with Telegram</span>
              </>
            )}
          </button>
        </div>

        {/* Error Message */}
        {(loginError || error) && (
          <div className="login-error">
            <i className="fas fa-exclamation-circle"></i>
            <span>{loginError || error?.message || 'An error occurred. Please try again.'}</span>
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
