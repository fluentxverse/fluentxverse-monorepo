import TutorDialog from "../Common/TutorDialog";
import TutorIcon from "../Common/TutorIcon";
import { useState, useRef, useMemo, useEffect } from 'preact/hooks';
import { JSX } from 'preact';
import './SettingsModal.css';
import './SettingsModal.extra.css';
import './SettingsModal.align.css';
import { useAuthContext } from '../../context/AuthContext';
import { listRegions, type PSGCRegion, type PSGCProvince, type PSGCCity } from '../../data/ph_psgc';
import { updatePersonalInfo, updateEmail, updatePassword, getPersonalInfo } from '../../api/auth.api';
import { tutorApi } from '../../api/tutor.api';
import ProfileAvatar from '../Common/ProfileAvatar';
import { mediaUrl } from '../../utils/mediaUrl';

// Helper type alias for municipalities (same as PSGCCity)

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsView = 'main' | 'update-password' | 'update-email' | 'update-info';

const SettingsModal = ({ isOpen, onClose }: SettingsModalProps): JSX.Element | null => {
  const { logout, logoutLoading, logoutError, user, getUserId } = useAuthContext();
  const [currentView, setCurrentView] = useState<SettingsView>('main');

  // Reset to main view when modal closes
  const handleClose = () => {
    if (emailLoading || passwordLoading || infoLoading || uploading || logoutLoading) return;
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
  const [regionsData, setRegionsData] = useState<PSGCRegion[]>([]);
  const selectedRegion = regionsData.find(r => r.code === region);
  const provincesForRegion: PSGCProvince[] = selectedRegion?.provinces || [];
  const municipalitiesForRegion: PSGCCity[] = selectedRegion?.municipalities || [];
  const selectedProvince = provincesForRegion.find(p => p.code === province);
  const municipalitiesForProvince: PSGCCity[] = selectedProvince?.municipalities || [];
  const [zipCode, setZipCode] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [sameAsPermanent, setSameAsPermanent] = useState(false);
  // Qualifications
  const [schoolAttended, setSchoolAttended] = useState('');
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('');
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);
  const [educationalAttainment, setEducationalAttainment] = useState('');
  const [major, setMajor] = useState('');
  const [teachingExperience, setTeachingExperience] = useState('');
  const [teachingQualifications, setTeachingQualifications] = useState<string[]>([]);

  // Universities list (lazy-loaded)
  const [universities, setUniversities] = useState<{ text: string; value: string }[]>([]);

  // Lazy-load PSGC regions and university data when modal opens
  useEffect(() => {
    if (!isOpen) return;
    listRegions().then(setRegionsData);
    import('../../data/univ.json').then(m => setUniversities(m.default.universitiesAndColleges));
  }, [isOpen]);
  const filteredUniversities = useMemo(() => {
    if (!schoolSearchQuery.trim()) return universities.slice(0, 50); // Show first 50 by default
    const query = schoolSearchQuery.toLowerCase();
    return universities.filter(u => u.text.toLowerCase().includes(query)).slice(0, 50);
  }, [schoolSearchQuery, universities]);

  // Form state
  const [infoError, setInfoError] = useState('');
  const [infoSuccess, setInfoSuccess] = useState('');
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoDataLoading, setInfoDataLoading] = useState(false);

  // Load personal info when switching to update-info view
  useEffect(() => {
    if (currentView === 'update-info') {
      const loadPersonalInfo = async () => {
        try {
          setInfoDataLoading(true);
          const data = await getPersonalInfo();
          if (data) {
            setPhoneNumber(data.phoneNumber || '');
            setCountry(data.country || 'Philippines');
            setRegion(data.region || '');
            setProvince(data.province || '');
            setCity(data.city || '');
            setZipCode(data.zipCode || '');
            setAddressLine(data.addressLine || '');
            setSameAsPermanent(data.sameAsPermanent || false);
            setSchoolAttended(data.schoolAttended || '');
            setEducationalAttainment(data.educationalAttainment || '');
            setMajor(data.major || '');
            setTeachingExperience(data.teachingExperience || '');
            setTeachingQualifications(data.teachingQualifications || []);
          }
        } catch (err) {
          console.error('Failed to load personal info:', err);
        } finally {
          setInfoDataLoading(false);
        }
      };
      loadPersonalInfo();
    }
  }, [currentView]);

  // Profile picture upload state
  const [profileUploading, setProfileUploading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogout = async () => {
    await logout();
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
    setProfileError('');
  };

  const handleProfileFileChange = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    setProfileError('');
    setProfileUploading(true);
    try {
      const url = await tutorApi.uploadProfilePicture(file);
      // Optimistically update user profile picture in context if available
      if (user) {
        // @ts-ignore mutate local user object for immediate UI feedback
        user.profilePicture = url;
      }
    } catch (err: any) {
      setProfileError(err?.message || 'Failed to upload image');
    } finally {
      setProfileUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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

  const educationalAttainments = [
    'High school or equivalent',
    'Some college',
    'Associate degree',
    "Bachelor's degree",
    "Master's degree",
    'Doctoral degree'
  ];

  const teachingExperienceOptions = [
    'No experience',
    'Less than 1 year',
    '1 to 3 years',
    '3 to 5 years',
    '5 to 10 years',
    'More than 10 years'
  ];

  const qualificationOptions = [
    'COTE Certified',
    'FLT Certified',
    'RSA-CELTA Certified',
    'TEFL/TESL Certified',
    'Education major',
    'Professionally trained'
  ];

  const toggleQualification = (qual: string) => {
    setTeachingQualifications(prev =>
      prev.includes(qual)
        ? prev.filter(q => q !== qual)
        : [...prev, qual]
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
        schoolAttended,
        educationalAttainment,
        major,
        teachingExperience,
        teachingQualifications
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

  // Extract user info
  const firstName = user?.firstName || '';
  const lastName = user?.lastName || '';
  const storedFullName = typeof window !== 'undefined' ? localStorage.getItem('fxv_user_fullname') || '' : '';
  const displayName = (firstName || lastName)
    ? `${firstName} ${lastName}`.trim()
    : (storedFullName || (user?.email?.split('@')[0] || 'User'));
  const tutorId = (getUserId() || (typeof window !== 'undefined' ? localStorage.getItem('fxv_user_id') || '' : '')).toString().slice(0, 6) || '570063';
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
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.profilePicture || null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Update avatar preview when user profile picture changes
  useEffect(() => {
    if (user?.profilePicture) {
      setAvatarPreview(user.profilePicture);
    }
  }, [user?.profilePicture]);

  const onSelectAvatar = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file');
      return;
    }
    const MAX_BYTES = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_BYTES) {
      setUploadError(`File too large. Max ${(MAX_BYTES / (1024*1024)).toFixed(1)}MB`);
      target.value = '';
      return;
    }
    try {
      setUploading(true);
      const url = await tutorApi.uploadProfilePicture(file);
      setAvatarPreview(url);
      // Optimistically update user.profilePicture
      if (user) {
        // @ts-ignore
        user.profilePicture = url;
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
      // reset input value to allow re-selecting same file
      target.value = '';
    }
  };

  const viewAvatar = () => {
    if (!avatarPreview) return;
    const w = window.open('', '_blank');
    if (w) {
      const image = w.document.createElement('img');
      image.src = mediaUrl(avatarPreview)!;
      image.alt = 'Avatar Preview';
      image.style.cssText = 'max-width:100%;display:block;margin:0 auto';
      w.document.title = 'Avatar Preview';
      w.document.body.appendChild(image);
    }
  };

  return (
    <TutorDialog label="Account settings" className="tutor-settings-dialog" onClose={handleClose} busy={emailLoading || passwordLoading || infoLoading || uploading || logoutLoading}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        {/* Back button for sub-views */}
        {currentView !== 'main' && (
          <button className="settings-modal-back" disabled={emailLoading || passwordLoading || infoLoading} onClick={handleBack} aria-label="Go back">
            <TutorIcon name="fa-arrow-left" size={20} />
          </button>
        )}
        
        <button className="settings-modal-close" disabled={emailLoading || passwordLoading || infoLoading || uploading || logoutLoading} onClick={handleClose} aria-label="Close settings">
          ×
        </button>

        {/* Main Settings View */}
        {currentView === 'main' && (
          <>
            {/* User Profile Section */}
            <div className="settings-profile">
              <div className="settings-avatar">
                <ProfileAvatar
                  src={avatarPreview}
                  alt="User Avatar"
                  fallback={displayName.charAt(0).toUpperCase()}
                  style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', objectFit: 'cover', fontSize: '36px', fontWeight: 700, color: '#fff' }}
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
                <TutorIcon name="fi fi-sr-envelope" />
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
                    {copied ? <><TutorIcon name="fas fa-check" /> COPIED</> : 'COPY'}
                  </button>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="settings-actions">
              <button className="settings-action-btn" onClick={() => setCurrentView('update-email')}>
                <div className="settings-action-icon update-email">
                  <TutorIcon name="fa-envelope" size={20} />
                </div>
                <span>Update Email</span>
              </button>

              <button className="settings-action-btn" onClick={() => setCurrentView('update-password')}>
                <div className="settings-action-icon update-password">
                  <TutorIcon name="fa-lock" size={20} />
                </div>
                <span>Update Password</span>
              </button>

              <button className="settings-action-btn" onClick={() => setCurrentView('update-info')}>
                <div className="settings-action-icon update-info">
                  <TutorIcon name="fa-user" size={20} />
                </div>
                <span>Update My Personal Information</span>
              </button>

              <button className="settings-action-btn logout-btn" onClick={handleLogout} disabled={logoutLoading}>
                <div className="settings-action-icon logout-icon">
                  <TutorIcon name="fa-sign-out-alt" size={20} />
                </div>
                <span>{logoutLoading ? 'Signing out...' : 'Logout'}</span>
              </button>
              {logoutError && <p className="settings-form-error" role="alert">{logoutError}</p>}
            </div>
          </>
        )}

        {/* Update Password View */}
        {currentView === 'update-password' && (
          <div className="settings-subview">
            <div className="settings-subview-header">
              <div className="settings-subview-icon update-password">
                <TutorIcon name="fa-lock" size={20} />
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
                      <TutorIcon name="fa-eye-slash" size={20} />
                    ) : (
                      <TutorIcon name="fa-eye" size={20} />
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
                      <TutorIcon name="fa-eye-slash" size={20} />
                    ) : (
                      <TutorIcon name="fa-eye" size={20} />
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
                      <TutorIcon name="fa-eye-slash" size={20} />
                    ) : (
                      <TutorIcon name="fa-eye" size={20} />
                    )}
                  </button>
                </div>
              </div>

              {passwordError && (
                <div className="settings-form-error">
                  <TutorIcon name="fa-info-circle" size={20} />
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="settings-form-success">
                  <TutorIcon name="fa-check-circle" size={20} />
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
                <TutorIcon name="fa-envelope" size={20} />
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
                      <TutorIcon name="fa-eye-slash" size={20} />
                    ) : (
                      <TutorIcon name="fa-eye" size={20} />
                    )}
                  </button>
                </div>
                <span className="settings-form-hint">Required for security verification</span>
              </div>

              {emailError && (
                <div className="settings-form-error">
                  <TutorIcon name="fa-info-circle" size={20} />
                  {emailError}
                </div>
              )}

              {emailSuccess && (
                <div className="settings-form-success">
                  <TutorIcon name="fa-check-circle" size={20} />
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
                <TutorIcon name="fa-user" size={20} />
              </div>
              <h2 className="settings-subview-title">Update Personal Information</h2>
              <p className="settings-subview-subtitle">Update your phone, address, and qualifications</p>
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

              {/* Qualifications Section */}
              <div className="settings-form-section">
                <h3 className="settings-form-section-title">Qualifications</h3>
                
                <div className="settings-form-group">
                  <label className="settings-form-label">School Attended</label>
                  <div className="school-dropdown-container">
                    <div 
                      className="school-dropdown-trigger"
                      onClick={() => setShowSchoolDropdown(!showSchoolDropdown)}
                    >
                      <span className={schoolAttended ? '' : 'placeholder'}>
                        {schoolAttended || 'Select your school'}
                      </span>
                      <TutorIcon name={`fas fa-chevron-down dropdown-arrow ${showSchoolDropdown ? 'open' : ''}`} />
                    </div>
                    {showSchoolDropdown && (
                      <>
                        <div 
                          className="school-dropdown-backdrop" 
                          onClick={() => {
                            setShowSchoolDropdown(false);
                            setSchoolSearchQuery('');
                          }}
                        />
                        <div className="school-dropdown-panel">
                          <div className="school-dropdown-search">
                            <TutorIcon name="fas fa-search" />
                            <input
                              type="text"
                              value={schoolSearchQuery}
                              onInput={(e) => setSchoolSearchQuery((e.target as HTMLInputElement).value)}
                              placeholder="Search schools..."
                              autoFocus
                            />
                          </div>
                          <div className="school-dropdown-list">
                            {filteredUniversities.length > 0 ? (
                              filteredUniversities.map(uni => (
                                <div
                                  key={uni.value}
                                  className={`school-dropdown-item ${schoolAttended === uni.text ? 'selected' : ''}`}
                                  onClick={() => {
                                    setSchoolAttended(uni.text);
                                    setSchoolSearchQuery('');
                                    setShowSchoolDropdown(false);
                                  }}
                                >
                                  {uni.text}
                                </div>
                              ))
                            ) : (
                              <div className="school-dropdown-empty">No schools found</div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="settings-form-group">
                  <label className="settings-form-label">Educational Attainment</label>
                  <select
                    value={educationalAttainment}
                    onChange={(e) => setEducationalAttainment((e.target as HTMLSelectElement).value)}
                    className="settings-form-select"
                  >
                    <option value="">Select attainment</option>
                    {educationalAttainments.map(ea => (
                      <option key={ea} value={ea}>{ea}</option>
                    ))}
                  </select>
                </div>

                <div className="settings-form-row">
                  <div className="settings-form-group settings-form-group-half">
                    <label className="settings-form-label">Major</label>
                    <input
                      type="text"
                      value={major}
                      onChange={(e) => setMajor((e.target as HTMLInputElement).value)}
                      className="settings-form-input settings-form-input-no-toggle"
                      placeholder="Enter major"
                    />
                  </div>
                  <div className="settings-form-group settings-form-group-half">
                    <label className="settings-form-label">Teaching Experience</label>
                    <select
                      value={teachingExperience}
                      onChange={(e) => setTeachingExperience((e.target as HTMLSelectElement).value)}
                      className="settings-form-select"
                    >
                      <option value="">Select experience</option>
                      {teachingExperienceOptions.map(te => (
                        <option key={te} value={te}>{te}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="settings-form-group">
                  <label className="settings-form-label">Teaching Qualifications</label>
                  <div className="settings-checkbox-group">
                    {qualificationOptions.map(qual => (
                      <label key={qual} className="settings-checkbox-item">
                        <input
                          type="checkbox"
                          checked={teachingQualifications.includes(qual)}
                          onChange={() => toggleQualification(qual)}
                        />
                        <span>{qual}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {infoError && (
                <div className="settings-form-error">
                  <TutorIcon name="fa-info-circle" size={20} />
                  {infoError}
                </div>
              )}

              {infoSuccess && (
                <div className="settings-form-success">
                  <TutorIcon name="fa-check-circle" size={20} />
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
    </TutorDialog>
  );
};

export default SettingsModal;
