import { useState, useRef } from 'preact/hooks';
import { JSX } from 'preact';
import './SettingsModal.css';
import './SettingsModal.extra.css';
import './SettingsModal.align.css';
import { useAuthContext } from '../../context/AuthContext';
import { listRegions, PSGCRegion, PSGCProvince, PSGCCity } from '../../data/ph_psgc';
import { updatePersonalInfo, updateEmail, updatePassword } from '../../api/auth.api';

// Helper type alias for municipalities (same as PSGCCity)

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsView = 'main' | 'update-password' | 'update-email' | 'update-info';

const SettingsModal = ({ isOpen, onClose }: SettingsModalProps): JSX.Element | null => {
  const { logout, user, getUserId } = useAuthContext();
  const [currentView, setCurrentView] = useState<SettingsView>('main');

  // Reset to main view when modal closes
  const handleClose = () => {
    setCurrentView('main');
    onClose();
  };
  
  // Password update form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Email update form state
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [showEmailPassword, setShowEmailPassword] = useState(false);

  // Personal info form state - initialize phone from user data
  const [phoneNumber, setPhoneNumber] = useState(user?.mobileNumber || '');
  // Address fields
  const [country, setCountry] = useState('Philippines');
  const [region, setRegion] = useState(''); // stores region code
  const [province, setProvince] = useState(''); // stores province code
  const [city, setCity] = useState(''); // stores city code
  const regionsData: PSGCRegion[] = listRegions();
  const selectedRegion = regionsData.find(r => r.code === region);
  const provincesForRegion: PSGCProvince[] = selectedRegion?.provinces || [];
  const municipalitiesForRegion: PSGCCity[] = selectedRegion?.municipalities || [];
  const selectedProvince = provincesForRegion.find(p => p.code === province);
  const municipalitiesForProvince: PSGCCity[] = selectedProvince?.municipalities || [];
  const [zipCode, setZipCode] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [sameAsPermanent, setSameAsPermanent] = useState(false);
  // Learning Preferences
  const [currentProficiency, setCurrentProficiency] = useState('');
  const [learningGoals, setLearningGoals] = useState<string[]>([]);
  const [preferredLearningStyle, setPreferredLearningStyle] = useState('');
  const [availability, setAvailability] = useState<string[]>([]);
  // Form state
  const [infoError, setInfoError] = useState('');
  const [infoSuccess, setInfoSuccess] = useState('');
  const [infoLoading, setInfoLoading] = useState(false);

  const handleLogout = () => {
    logout();
    onClose();
    window.location.href = '/';
  };

  const handleBack = () => {
    setCurrentView('main');
    // Reset password form states
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordSuccess('');
    // Reset email form states
    setNewEmail('');
    setConfirmEmail('');
    setEmailPassword('');
    setEmailError('');
    setEmailSuccess('');
    // Reset personal info form states
    setInfoError('');
    setInfoSuccess('');
  };

  const handleUpdatePassword = async (e: Event) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please fill in all fields');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from current password');
      return;
    }

    setPasswordLoading(true);
    try {
      await updatePassword(currentPassword, newPassword);
      
      setPasswordSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Return to main view after success
      setTimeout(() => {
        setCurrentView('main');
        setPasswordSuccess('');
      }, 2000);
    } catch (err: any) {
      setPasswordError(err?.response?.data?.message || err?.message || 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleUpdateEmail = async (e: Event) => {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');

    // Validation
    if (!newEmail || !confirmEmail || !emailPassword) {
      setEmailError('Please fill in all fields');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    if (newEmail !== confirmEmail) {
      setEmailError('Email addresses do not match');
      return;
    }
    if (newEmail.toLowerCase() === email.toLowerCase()) {
      setEmailError('New email must be different from current email');
      return;
    }

    setEmailLoading(true);
    try {
      await updateEmail(newEmail, emailPassword);
      
      setEmailSuccess('Email updated successfully!');
      setNewEmail('');
      setConfirmEmail('');
      setEmailPassword('');
      
      // Return to main view after success
      setTimeout(() => {
        setCurrentView('main');
        setEmailSuccess('');
      }, 2000);
    } catch (err: any) {
      setEmailError(err?.response?.data?.message || err?.message || 'Failed to update email');
    } finally {
      setEmailLoading(false);
    }
  };

  // Philippine regions data
  const philippineRegions = [
    'NCR - National Capital Region',
    'CAR - Cordillera Administrative Region',
    'Region 1 - Ilocos Region',
    'Region 2 - Cagayan Valley',
    'Region 3 - Central Luzon',
    'Region 4A - CALABARZON',
    'Region 4B - MIMAROPA',
    'Region 5 - Bicol Region',
    'Region 6 - Western Visayas',
    'Region 7 - Central Visayas',
    'Region 8 - Eastern Visayas',
    'Region 9 - Zamboanga Peninsula',
    'Region 10 - Northern Mindanao',
    'Region 11 - Davao Region',
    'Region 12 - SOCCSKSARGEN',
    'Region 13 - Caraga',
    'BARMM - Bangsamoro'
  ];

  const proficiencyLevels = [
    'Beginner (A1)',
    'Elementary (A2)',
    'Intermediate (B1)',
    'Upper Intermediate (B2)',
    'Advanced (C1)',
    'Proficient (C2)'
  ];

  const learningGoalOptions = [
    'Conversational fluency',
    'Business communication',
    'Academic writing',
    'Test preparation (IELTS/TOEFL)',
    'Travel preparation',
    'Career advancement',
    'Personal enrichment'
  ];

  const learningStyleOptions = [
    'Visual (pictures, diagrams)',
    'Auditory (listening, speaking)',
    'Reading/Writing (texts, notes)',
    'Kinesthetic (hands-on activities)',
    'Mixed approach'
  ];

  const availabilityOptions = [
    'Weekday mornings',
    'Weekday afternoons',
    'Weekday evenings',
    'Weekend mornings',
    'Weekend afternoons',
    'Weekend evenings',
    'Flexible schedule'
  ];

  const toggleLearningGoal = (goal: string) => {
    setLearningGoals(prev =>
      prev.includes(goal)
        ? prev.filter(g => g !== goal)
        : [...prev, goal]
    );
  };

  const toggleAvailability = (time: string) => {
    setAvailability(prev =>
      prev.includes(time)
        ? prev.filter(t => t !== time)
        : [...prev, time]
    );
  };

  const handleUpdateInfo = async (e: Event) => {
    e.preventDefault();
    setInfoError('');
    setInfoSuccess('');

    // Basic validation
    if (phoneNumber && !/^[\d\s\-+()]{7,20}$/.test(phoneNumber)) {
      setInfoError('Please enter a valid phone number');
      return;
    }

    setInfoLoading(true);
    try {
      // Get region, province, and city names for storing readable values
      const regionName = selectedRegion?.name || '';
      const provinceName = selectedProvince?.name || '';
      const cityName = selectedRegion?.municipalities
        ? selectedRegion.municipalities.find(m => m.code === city)?.name || ''
        : municipalitiesForProvince.find(m => m.code === city)?.name || '';

      await updatePersonalInfo({
        phoneNumber,
        country,
        region,
        regionName,
        province,
        provinceName,
        city,
        cityName,
        zipCode,
        addressLine,
        sameAsPermanent,
        currentProficiency,
        learningGoals,
        preferredLearningStyle,
        availability
      });
      
      setInfoSuccess('Personal information updated successfully!');
      
      // Return to main view after success
      setTimeout(() => {
        setCurrentView('main');
        setInfoSuccess('');
      }, 2000);
    } catch (err: any) {
      setInfoError(err?.message || 'Failed to update personal information');
    } finally {
      setInfoLoading(false);
    }
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
  const studentId = (getUserId() || (typeof window !== 'undefined' ? localStorage.getItem('fxv_user_id') || '' : '')).toString().slice(0, 6) || '570063';
  const email = user?.email || 'user@example.com';
  const walletAddress = user?.walletAddress || '';
  const shortWallet = walletAddress
    ? walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4)
    : '';
  // Copy wallet animation state
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);

  const copyWallet = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress).then(() => {
      // Trigger animation state
      setCopied(true);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
      }, 1600); // ~1.6s visible
    }).catch(() => {});
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
    <div className="settings-modal-overlay" onClick={handleClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        {/* Back button for sub-views */}
        {currentView !== 'main' && (
          <button className="settings-modal-back" onClick={handleBack} aria-label="Go back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
        )}
        
        <button className="settings-modal-close" onClick={handleClose} aria-label="Close settings">
          ×
        </button>

        {/* Main Settings View */}
        {currentView === 'main' && (
          <>
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
                <span className="settings-label">STUDENT ID:</span>
                <span className="settings-value">{studentId}</span>
              </div>
              <div className="settings-email">
                <i className="fi fi-sr-envelope"></i>
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
                    className={`settings-copy-btn ${copied ? 'copied' : ''}`}
                    aria-label="Copy wallet address"
                    disabled={copied}
                  >
                    {copied ? <><i className="fas fa-check"></i> COPIED</> : 'COPY'}
                  </button>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="settings-actions">
              <button className="settings-action-btn" onClick={() => setCurrentView('update-email')}>
                <div className="settings-action-icon update-email">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M22 6L12 13L2 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
                <span>Update Email</span>
              </button>

              <button className="settings-action-btn" onClick={() => setCurrentView('update-password')}>
                <div className="settings-action-icon update-password">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="11" width="18" height="11" rx="2" stroke="white" stroke-width="2"/>
                    <path d="M7 11V7C7 4.79086 8.79086 3 11 3H13C15.2091 3 17 4.79086 17 7V11" stroke="white" stroke-width="2" stroke-linecap="round"/>
                    <circle cx="12" cy="16" r="1.5" fill="white"/>
                  </svg>
                </div>
                <span>Update Password</span>
              </button>

              <button className="settings-action-btn" onClick={() => setCurrentView('update-info')}>
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
          </>
        )}

        {/* Update Password View */}
        {currentView === 'update-password' && (
          <div className="settings-subview">
            <div className="settings-subview-header">
              <div className="settings-subview-icon update-password">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="11" width="18" height="11" rx="2" stroke="white" stroke-width="2"/>
                  <path d="M7 11V7C7 4.79086 8.79086 3 11 3H13C15.2091 3 17 4.79086 17 7V11" stroke="white" stroke-width="2" stroke-linecap="round"/>
                  <circle cx="12" cy="16" r="1.5" fill="white"/>
                </svg>
              </div>
              <h2 className="settings-subview-title">Update Password</h2>
              <p className="settings-subview-subtitle">Enter your current password and choose a new one</p>
            </div>

            <form className="settings-form" onSubmit={handleUpdatePassword}>
              <div className="settings-form-group">
                <label className="settings-form-label">Current Password</label>
                <div className="settings-input-wrapper">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword((e.target as HTMLInputElement).value)}
                    className="settings-form-input"
                    placeholder="Enter your current password"
                  />
                  <button
                    type="button"
                    className="settings-input-toggle"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="settings-form-group">
                <label className="settings-form-label">New Password</label>
                <div className="settings-input-wrapper">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword((e.target as HTMLInputElement).value)}
                    className="settings-form-input"
                    placeholder="Enter your new password"
                  />
                  <button
                    type="button"
                    className="settings-input-toggle"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
                <span className="settings-form-hint">Must be at least 8 characters</span>
              </div>

              <div className="settings-form-group">
                <label className="settings-form-label">Confirm New Password</label>
                <div className="settings-input-wrapper">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword((e.target as HTMLInputElement).value)}
                    className="settings-form-input"
                    placeholder="Confirm your new password"
                  />
                  <button
                    type="button"
                    className="settings-input-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {passwordError && (
                <div className="settings-form-error">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="settings-form-success">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  {passwordSuccess}
                </div>
              )}

              <button
                type="submit"
                className="settings-form-submit"
                disabled={passwordLoading}
              >
                {passwordLoading ? (
                  <>
                    <span className="settings-spinner"></span>
                    Updating...
                  </>
                ) : (
                  'Update Password'
                )}
              </button>
            </form>
          </div>
        )}

        {/* Update Email View */}
        {currentView === 'update-email' && (
          <div className="settings-subview">
            <div className="settings-subview-header">
              <div className="settings-subview-icon update-email">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M22 6L12 13L2 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <h2 className="settings-subview-title">Update Email</h2>
              <p className="settings-subview-subtitle">Enter your new email address</p>
            </div>

            {/* Current email display */}
            <div className="settings-current-value">
              <span className="settings-current-label">Current Email</span>
              <span className="settings-current-text">{email}</span>
            </div>

            <form className="settings-form" onSubmit={handleUpdateEmail}>
              <div className="settings-form-group">
                <label className="settings-form-label">New Email Address</label>
                <div className="settings-input-wrapper">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail((e.target as HTMLInputElement).value)}
                    className="settings-form-input settings-form-input-no-toggle"
                    placeholder="Enter your new email"
                  />
                </div>
              </div>

              <div className="settings-form-group">
                <label className="settings-form-label">Confirm New Email</label>
                <div className="settings-input-wrapper">
                  <input
                    type="email"
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail((e.target as HTMLInputElement).value)}
                    className="settings-form-input settings-form-input-no-toggle"
                    placeholder="Confirm your new email"
                  />
                </div>
              </div>

              <div className="settings-form-group">
                <label className="settings-form-label">Current Password</label>
                <div className="settings-input-wrapper">
                  <input
                    type={showEmailPassword ? 'text' : 'password'}
                    value={emailPassword}
                    onChange={(e) => setEmailPassword((e.target as HTMLInputElement).value)}
                    className="settings-form-input"
                    placeholder="Enter your password to confirm"
                  />
                  <button
                    type="button"
                    className="settings-input-toggle"
                    onClick={() => setShowEmailPassword(!showEmailPassword)}
                  >
                    {showEmailPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
                <span className="settings-form-hint">Required for security verification</span>
              </div>

              {emailError && (
                <div className="settings-form-error">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {emailError}
                </div>
              )}

              {emailSuccess && (
                <div className="settings-form-success">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  {emailSuccess}
                </div>
              )}

              <button
                type="submit"
                className="settings-form-submit"
                disabled={emailLoading}
              >
                {emailLoading ? (
                  <>
                    <span className="settings-spinner"></span>
                    Updating...
                  </>
                ) : (
                  'Update Email'
                )}
              </button>
            </form>
          </div>
        )}

        {/* Update Personal Info View */}
        {currentView === 'update-info' && (
          <div className="settings-subview settings-subview-scrollable">
            <div className="settings-subview-header">
              <div className="settings-subview-icon update-info">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="8" r="4" stroke="white" stroke-width="2"/>
                  <path d="M6 21C6 17.134 8.68629 14 12 14C15.3137 14 18 17.134 18 21" stroke="white" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </div>
              <h2 className="settings-subview-title">Update Personal Information</h2>
              <p className="settings-subview-subtitle">Update your contact details, address, and learning preferences</p>
            </div>

            <form className="settings-form" onSubmit={handleUpdateInfo}>
              {/* Phone Number Section */}
              <div className="settings-form-section">
                <h3 className="settings-form-section-title">Contact Information</h3>
                <div className="settings-form-group">
                  <label className="settings-form-label">Phone Number</label>
                  <div className="settings-input-wrapper">
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber((e.target as HTMLInputElement).value)}
                      className="settings-form-input settings-form-input-no-toggle"
                      placeholder="+63 XXX XXX XXXX"
                    />
                  </div>
                </div>
              </div>

              {/* Current Address Section */}
              <div className="settings-form-section">
                <h3 className="settings-form-section-title">Current Address</h3>
                
                <div className="settings-form-group">
                  <label className="settings-form-label">Country</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry((e.target as HTMLSelectElement).value)}
                    className="settings-form-select"
                  >
                    <option value="Philippines">Philippines</option>
                  </select>
                </div>

                <div className="settings-form-group">
                  <label className="settings-form-label">Region</label>
                  <select
                    value={region}
                    onChange={(e) => {
                      const val = (e.target as HTMLSelectElement).value;
                      setRegion(val);
                      // Reset downstream
                      setProvince('');
                      setCity('');
                    }}
                    className="settings-form-select"
                  >
                    <option value="">Select Region</option>
                    {regionsData.map(r => (
                      <option key={r.code} value={r.code}>{r.name}</option>
                    ))}
                  </select>
                </div>

                {/* Province selector (hidden for NCR which has direct municipalities) */}
                {selectedRegion && !selectedRegion.municipalities && (
                  <div className="settings-form-group">
                    <label className="settings-form-label">Province</label>
                    <select
                      value={province}
                      onChange={(e) => {
                        const val = (e.target as HTMLSelectElement).value;
                        setProvince(val);
                        setCity('');
                      }}
                      className="settings-form-select"
                    >
                      <option value="">Select Province</option>
                      {provincesForRegion.map(p => (
                        <option key={p.code} value={p.code}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="settings-form-group">
                  <label className="settings-form-label">City / Municipality</label>
                  <select
                    value={city}
                    onChange={(e) => setCity((e.target as HTMLSelectElement).value)}
                    className="settings-form-select"
                    disabled={!selectedRegion || (!selectedRegion.municipalities && !selectedProvince)}
                  >
                    <option value="">Select City / Municipality</option>
                    {(selectedRegion?.municipalities ? selectedRegion.municipalities : municipalitiesForProvince).map((m: PSGCCity) => (
                      <option key={m.code} value={m.code}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div className="settings-form-group">
                  <label className="settings-form-label">ZIP Code</label>
                  <input
                    type="text"
                    value={zipCode}
                    onChange={(e) => setZipCode((e.target as HTMLInputElement).value)}
                    className="settings-form-input settings-form-input-no-toggle"
                    placeholder="Enter ZIP code"
                  />
                </div>

                <div className="settings-form-group">
                  <label className="settings-form-label">Address Line</label>
                  <textarea
                    value={addressLine}
                    onChange={(e) => setAddressLine((e.target as HTMLTextAreaElement).value)}
                    className="settings-form-textarea"
                    placeholder="House/Unit No., Street, Barangay"
                    rows={3}
                  />
                </div>

                <label className="settings-form-checkbox">
                  <input
                    type="checkbox"
                    checked={sameAsPermanent}
                    onChange={(e) => setSameAsPermanent((e.target as HTMLInputElement).checked)}
                  />
                  <span>Check if permanent address is the same with your current address</span>
                </label>
              </div>

              {/* Learning Preferences Section */}
              <div className="settings-form-section">
                <h3 className="settings-form-section-title">Learning Preferences</h3>
                
                <div className="settings-form-group">
                  <label className="settings-form-label">Current English Proficiency</label>
                  <select
                    value={currentProficiency}
                    onChange={(e) => setCurrentProficiency((e.target as HTMLSelectElement).value)}
                    className="settings-form-select"
                  >
                    <option value="">Select your level</option>
                    {proficiencyLevels.map(level => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                  <span className="settings-form-hint">This helps us match you with the right tutors</span>
                </div>

                <div className="settings-form-group">
                  <label className="settings-form-label">Learning Goals</label>
                  <div className="settings-checkbox-group">
                    {learningGoalOptions.map(goal => (
                      <label key={goal} className="settings-checkbox-item">
                        <input
                          type="checkbox"
                          checked={learningGoals.includes(goal)}
                          onChange={() => toggleLearningGoal(goal)}
                        />
                        <span>{goal}</span>
                      </label>
                    ))}
                  </div>
                  <span className="settings-form-hint">Select all that apply</span>
                </div>

                <div className="settings-form-group">
                  <label className="settings-form-label">Preferred Learning Style</label>
                  <select
                    value={preferredLearningStyle}
                    onChange={(e) => setPreferredLearningStyle((e.target as HTMLSelectElement).value)}
                    className="settings-form-select"
                  >
                    <option value="">Select your preference</option>
                    {learningStyleOptions.map(style => (
                      <option key={style} value={style}>{style}</option>
                    ))}
                  </select>
                  <span className="settings-form-hint">How do you learn best?</span>
                </div>

                <div className="settings-form-group">
                  <label className="settings-form-label">Availability for Lessons</label>
                  <div className="settings-checkbox-group">
                    {availabilityOptions.map(time => (
                      <label key={time} className="settings-checkbox-item">
                        <input
                          type="checkbox"
                          checked={availability.includes(time)}
                          onChange={() => toggleAvailability(time)}
                        />
                        <span>{time}</span>
                      </label>
                    ))}
                  </div>
                  <span className="settings-form-hint">When are you typically available?</span>
                </div>
              </div>

              {infoError && (
                <div className="settings-form-error">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {infoError}
                </div>
              )}

              {infoSuccess && (
                <div className="settings-form-success">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  {infoSuccess}
                </div>
              )}

              <button
                type="submit"
                className="settings-form-submit"
                disabled={infoLoading}
              >
                {infoLoading ? (
                  <>
                    <span className="settings-spinner"></span>
                    Updating...
                  </>
                ) : (
                  'Update'
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsModal;
