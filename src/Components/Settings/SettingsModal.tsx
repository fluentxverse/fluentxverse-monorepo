import { useState } from 'preact/hooks';
import { JSX } from 'preact';
import './SettingsModal.css';
import { useAuthContext } from '../../context/AuthContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal = ({ isOpen, onClose }: SettingsModalProps): JSX.Element | null => {
  const { logout, user } = useAuthContext();

  const handleLogout = () => {
    logout();
    onClose();
    window.location.href = '/';
  };

  if (!isOpen) return null;

  console.log(user)
  // Extract user info
  const firstName = user?.firstName || '';
  const lastName = user?.lastName || '';
  const storedFullName = typeof window !== 'undefined' ? localStorage.getItem('fxv_user_fullname') || '' : '';
  const displayName = (firstName || lastName)
    ? `${firstName} ${lastName}`.trim()
    : (storedFullName || (user?.email?.split('@')[0] || 'User'));
  const tutorId = (user?.userId || user?.id || (typeof window !== 'undefined' ? localStorage.getItem('fxv_user_id') || '' : '')).toString().slice(0, 6) || '570063';
  const email = user?.email || 'user@example.com';
  const walletAddress = user?.walletAddress || '';
  const shortWallet = walletAddress
    ? walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4)
    : '';
  const copyWallet = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress).catch(() => {});
  };

  // Local state for avatar preview & upload status
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const onSelectAvatar = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
    // Placeholder upload logic
    try {
      setUploading(true);
      // TODO: Implement backend upload endpoint
      await new Promise(r => setTimeout(r, 800));
      setUploading(false);
    } catch (err) {
      setUploading(false);
      setUploadError('Upload failed');
    }
  };

  const viewAvatar = () => {
    if (!avatarPreview) return;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(`<title>Avatar Preview</title><img style="max-width:100%;display:block;margin:0 auto" src="${avatarPreview}" />`);
    }
  };

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <button className="settings-modal-close" onClick={onClose} aria-label="Close settings">
          ×
        </button>

        {/* User Profile Section */}
        <div className="settings-profile">
          <div className="settings-avatar">
            <img
              src={avatarPreview || '/assets/img/logo/icon_logo.png'}
              alt="User Avatar"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/120/0245ae/ffffff?text=' + displayName.charAt(0).toUpperCase();
              }}
            />
            <div className="avatar-overlay">
              <label className="avatar-btn" title="Upload new avatar">
                <input
                  type="file"
                  accept="image/*"
                  onChange={onSelectAvatar}
                  style={{ display: 'none' }}
                />
                {uploading ? 'Uploading...' : 'Upload'}
              </label>
              <button
                type="button"
                className="avatar-btn secondary"
                disabled={!avatarPreview}
                onClick={viewAvatar}
              >
                View
              </button>
            </div>
          </div>
          {uploadError && <div style={{color:'#dc2626', fontSize:'0.75rem', marginTop:'0.5rem'}}>{uploadError}</div>}
          <h3 className="settings-name">{displayName}</h3>
          <div className="settings-tutor-id">
            <span className="settings-label">TUTOR ID:</span>
            <span className="settings-value">{tutorId}</span>
          </div>
          <div className="settings-email">
            <i className="fi fi-rr-envelope"></i>
            <span>{email}</span>
          </div>

          {/* Wallet Address */}
          {walletAddress && (
            <div className="settings-wallet">
              <span className="settings-wallet-label">Wallet Address:</span>
              <span className="settings-wallet-value">{shortWallet}</span>
              <button
                type="button"
                onClick={copyWallet}
                className="settings-copy-btn"
                aria-label="Copy wallet address"
              >
                COPY
              </button>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="settings-actions">
          <button className="settings-action-btn" onClick={() => alert('Update Email - Coming Soon')}>
            <div className="settings-action-icon update-email">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M22 6L12 13L2 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <span>Update Email</span>
          </button>

          <button className="settings-action-btn" onClick={() => alert('Update Password - Coming Soon')}>
            <div className="settings-action-icon update-password">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="11" width="18" height="11" rx="2" stroke="white" stroke-width="2"/>
                <path d="M7 11V7C7 4.79086 8.79086 3 11 3H13C15.2091 3 17 4.79086 17 7V11" stroke="white" stroke-width="2" stroke-linecap="round"/>
                <circle cx="12" cy="16" r="1.5" fill="white"/>
              </svg>
            </div>
            <span>Update Password</span>
          </button>

          <button className="settings-action-btn" onClick={() => alert('Update Personal Info - Coming Soon')}>
            <div className="settings-action-icon update-info">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="8" r="4" stroke="white" stroke-width="2"/>
                <path d="M6 21C6 17.134 8.68629 14 12 14C15.3137 14 18 17.134 18 21" stroke="white" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <span>Update My Personal Information</span>
          </button>

          <button className="settings-action-btn logout-btn" onClick={handleLogout}>
            <div className="settings-action-icon logout-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H9" stroke="white" stroke-width="2" stroke-linecap="round"/>
                <path d="M16 17L21 12L16 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M21 12H9" stroke="white" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
