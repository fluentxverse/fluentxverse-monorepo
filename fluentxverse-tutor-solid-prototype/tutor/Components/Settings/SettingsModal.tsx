import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import TutorDialog from "../Common/TutorDialog";
import TutorIcon from "../Common/TutorIcon";
import { JSX, Show } from "solid-js";
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
const SettingsModal = (_props0: SettingsModalProps): JSX.Element | null => {
    const _state1 = useAuthContext();
    const [currentView, setCurrentView] = createSignal<SettingsView>('main');
    // Reset to main view when modal closes
    const handleClose = () => {
        if (emailLoading() || passwordLoading() || infoLoading() || uploading() || _state1.logoutLoading)
            return;
        setCurrentView('main');
        _props0["onClose"]();
    };
    // Password update form state
    const [currentPassword, setCurrentPassword] = createSignal('');
    const [newPassword, setNewPassword] = createSignal('');
    const [confirmPassword, setConfirmPassword] = createSignal('');
    const [passwordError, setPasswordError] = createSignal('');
    const [passwordSuccess, setPasswordSuccess] = createSignal('');
    const [passwordLoading, setPasswordLoading] = createSignal(false);
    const [showCurrentPassword, setShowCurrentPassword] = createSignal(false);
    const [showNewPassword, setShowNewPassword] = createSignal(false);
    const [showConfirmPassword, setShowConfirmPassword] = createSignal(false);
    // Email update form state
    const [newEmail, setNewEmail] = createSignal('');
    const [confirmEmail, setConfirmEmail] = createSignal('');
    const [emailPassword, setEmailPassword] = createSignal('');
    const [emailError, setEmailError] = createSignal('');
    const [emailSuccess, setEmailSuccess] = createSignal('');
    const [emailLoading, setEmailLoading] = createSignal(false);
    const [showEmailPassword, setShowEmailPassword] = createSignal(false);
    // Personal info form state - initialize phone from user data
    const [phoneNumber, setPhoneNumber] = createSignal(_state1.user?.mobileNumber || '');
    // Address fields
    const [country, setCountry] = createSignal('Philippines');
    const [region, setRegion] = createSignal(''); // stores region code
    const [province, setProvince] = createSignal(''); // stores province code
    const [city, setCity] = createSignal(''); // stores city code
    const [regionsData, setRegionsData] = createSignal<PSGCRegion[]>([]);
    const selectedRegion = createMemo(() => regionsData().find(r => r.code === region()));
    const provincesForRegion: Accessor<PSGCProvince[]> = createMemo(() => selectedRegion()?.provinces || []);
    const municipalitiesForRegion: Accessor<PSGCCity[]> = createMemo(() => selectedRegion()?.municipalities || []);
    const selectedProvince = createMemo(() => provincesForRegion().find(p => p.code === province()));
    const municipalitiesForProvince: Accessor<PSGCCity[]> = createMemo(() => selectedProvince()?.municipalities || []);
    const [zipCode, setZipCode] = createSignal('');
    const [addressLine, setAddressLine] = createSignal('');
    const [sameAsPermanent, setSameAsPermanent] = createSignal(false);
    // Qualifications
    const [schoolAttended, setSchoolAttended] = createSignal('');
    const [schoolSearchQuery, setSchoolSearchQuery] = createSignal('');
    const [showSchoolDropdown, setShowSchoolDropdown] = createSignal(false);
    const [educationalAttainment, setEducationalAttainment] = createSignal('');
    const [major, setMajor] = createSignal('');
    const [teachingExperience, setTeachingExperience] = createSignal('');
    const [teachingQualifications, setTeachingQualifications] = createSignal<string[]>([]);
    // Universities list (lazy-loaded)
    const [universities, setUniversities] = createSignal<{
        text: string;
        value: string;
    }[]>([]);
    // Lazy-load PSGC regions and university data when modal opens
    createEffect(on(() => [_props0["isOpen"]], () => {
        const _cleanup2 = untrack(() => {
            if (!_props0["isOpen"])
                return;
            listRegions().then(setRegionsData);
            import('../../data/univ.json').then(m => setUniversities(m.default.universitiesAndColleges));
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    const filteredUniversities = createMemo(() => {
        if (!schoolSearchQuery().trim())
            return universities().slice(0, 50); // Show first 50 by default
        const query = schoolSearchQuery().toLowerCase();
        return universities().filter(u => u.text.toLowerCase().includes(query)).slice(0, 50);
    });
    // Form state
    const [infoError, setInfoError] = createSignal('');
    const [infoSuccess, setInfoSuccess] = createSignal('');
    const [infoLoading, setInfoLoading] = createSignal(false);
    const [infoDataLoading, setInfoDataLoading] = createSignal(false);
    // Load personal info when switching to update-info view
    createEffect(on(() => [currentView()], () => {
        const _cleanup3 = untrack(() => {
            if (currentView() === 'update-info') {
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
                    }
                    catch (err) {
                        console.error('Failed to load personal info:', err);
                    }
                    finally {
                        setInfoDataLoading(false);
                    }
                };
                loadPersonalInfo();
            }
        });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    // Profile picture upload state
    const [profileUploading, setProfileUploading] = createSignal(false);
    const [profileError, setProfileError] = createSignal('');
    const fileInputRef = { current: null } as {
        current: HTMLInputElement | null;
    };
    const handleLogout = async () => {
        await _state1.logout();
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
        if (!file)
            return;
        setProfileError('');
        setProfileUploading(true);
        try {
            const url = await tutorApi.uploadProfilePicture(file);
            // Optimistically update user profile picture in context if available
            if (_state1.user) {
                // @ts-ignore mutate local user object for immediate UI feedback
                _state1.user.profilePicture = url;
            }
        }
        catch (err: any) {
            setProfileError(err?.message || 'Failed to upload image');
        }
        finally {
            setProfileUploading(false);
            if (fileInputRef.current)
                fileInputRef.current.value = '';
        }
    };
    const handleUpdatePassword = async (e: Event) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess('');
        // Validation
        if (!currentPassword() || !newPassword() || !confirmPassword()) {
            setPasswordError('Please fill in all fields');
            return;
        }
        if (newPassword().length < 8) {
            setPasswordError('New password must be at least 8 characters');
            return;
        }
        if (newPassword() !== confirmPassword()) {
            setPasswordError('New passwords do not match');
            return;
        }
        if (currentPassword() === newPassword()) {
            setPasswordError('New password must be different from current password');
            return;
        }
        setPasswordLoading(true);
        try {
            await updatePassword(currentPassword(), newPassword());
            setPasswordSuccess('Password updated successfully!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            // Return to main view after success
            setTimeout(() => {
                setCurrentView('main');
                setPasswordSuccess('');
            }, 2000);
        }
        catch (err: any) {
            setPasswordError(err?.response?.data?.message || err?.message || 'Failed to update password');
        }
        finally {
            setPasswordLoading(false);
        }
    };
    const handleUpdateEmail = async (e: Event) => {
        e.preventDefault();
        setEmailError('');
        setEmailSuccess('');
        // Validation
        if (!newEmail() || !confirmEmail() || !emailPassword()) {
            setEmailError('Please fill in all fields');
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail())) {
            setEmailError('Please enter a valid email address');
            return;
        }
        if (newEmail() !== confirmEmail()) {
            setEmailError('Email addresses do not match');
            return;
        }
        if (newEmail().toLowerCase() === email().toLowerCase()) {
            setEmailError('New email must be different from current email');
            return;
        }
        setEmailLoading(true);
        try {
            await updateEmail(newEmail(), emailPassword());
            setEmailSuccess('Email updated successfully!');
            setNewEmail('');
            setConfirmEmail('');
            setEmailPassword('');
            // Return to main view after success
            setTimeout(() => {
                setCurrentView('main');
                setEmailSuccess('');
            }, 2000);
        }
        catch (err: any) {
            setEmailError(err?.response?.data?.message || err?.message || 'Failed to update email');
        }
        finally {
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
        setTeachingQualifications(prev => prev.includes(qual)
            ? prev.filter(q => q !== qual)
            : [...prev, qual]);
    };
    const handleUpdateInfo = async (e: Event) => {
        e.preventDefault();
        setInfoError('');
        setInfoSuccess('');
        // Basic validation
        if (phoneNumber() && !/^[\d\s\-+()]{7,20}$/.test(phoneNumber())) {
            setInfoError('Please enter a valid phone number');
            return;
        }
        setInfoLoading(true);
        try {
            // Get region, province, and city names for storing readable values
            const regionName = selectedRegion()?.name || '';
            const provinceName = selectedProvince()?.name || '';
            const cityName = selectedRegion()?.municipalities
                ? selectedRegion().municipalities.find(m => m.code === city())?.name || ''
                : municipalitiesForProvince().find(m => m.code === city())?.name || '';
            await updatePersonalInfo({
                get phoneNumber() {
                    return phoneNumber();
                },
                get country() {
                    return country();
                },
                get region() {
                    return region();
                },
                regionName,
                get province() {
                    return province();
                },
                provinceName,
                get city() {
                    return city();
                },
                cityName,
                get zipCode() {
                    return zipCode();
                },
                get addressLine() {
                    return addressLine();
                },
                get sameAsPermanent() {
                    return sameAsPermanent();
                },
                get schoolAttended() {
                    return schoolAttended();
                },
                get educationalAttainment() {
                    return educationalAttainment();
                },
                get major() {
                    return major();
                },
                get teachingExperience() {
                    return teachingExperience();
                },
                get teachingQualifications() {
                    return teachingQualifications();
                }
            });
            setInfoSuccess('Personal information updated successfully!');
            // Return to main view after success
            setTimeout(() => {
                setCurrentView('main');
                setInfoSuccess('');
            }, 2000);
        }
        catch (err: any) {
            setInfoError(err?.message || 'Failed to update personal information');
        }
        finally {
            setInfoLoading(false);
        }
    };
    // Extract user info
    const firstName = createMemo(() => _state1.user?.firstName || '');
    const lastName = createMemo(() => _state1.user?.lastName || '');
    const storedFullName = typeof window !== 'undefined' ? localStorage.getItem('fxv_user_fullname') || '' : '';
    const displayName = createMemo(() => (firstName() || lastName())
        ? `${firstName()} ${lastName()}`.trim()
        : (storedFullName || (_state1.user?.email?.split('@')[0] || 'User')));
    const tutorId = createMemo(() => (_state1.getUserId() || (typeof window !== 'undefined' ? localStorage.getItem('fxv_user_id') || '' : '')).toString().slice(0, 6) || '570063');
    const email = createMemo(() => _state1.user?.email || 'user@example.com');
    const walletAddress = createMemo(() => _state1.user?.walletAddress || '');
    const shortWallet = createMemo(() => walletAddress() ? walletAddress().slice(0, 6) + '...' + walletAddress().slice(-4)
        : '');
    // Copy wallet animation state
    const [copied, setCopied] = createSignal(false);
    const copyTimeoutRef = { current: null } as {
        current: (number | null) | null;
    };
    const copyWallet = () => {
        if (!walletAddress())
            return;
        navigator.clipboard.writeText(walletAddress()).then(() => {
            // Trigger animation state
            setCopied(true);
            if (copyTimeoutRef.current) {
                clearTimeout(copyTimeoutRef.current);
            }
            copyTimeoutRef.current = window.setTimeout(() => {
                setCopied(false);
            }, 1600); // ~1.6s visible
        }).catch(() => { });
    };
    // Local state for avatar preview & upload status
    const [avatarPreview, setAvatarPreview] = createSignal<string | null>(_state1.user?.profilePicture || null);
    const [uploading, setUploading] = createSignal(false);
    const [uploadError, setUploadError] = createSignal<string | null>(null);
    // Update avatar preview when user profile picture changes
    createEffect(on(() => [_state1.user?.profilePicture], () => {
        const _cleanup4 = untrack(() => {
            if (_state1.user?.profilePicture) {
                setAvatarPreview(_state1.user.profilePicture);
            }
        });
        if (typeof _cleanup4 === "function")
            onCleanup(_cleanup4);
    }));
    const onSelectAvatar = async (e: Event) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file)
            return;
        setUploadError(null);
        if (!file.type.startsWith('image/')) {
            setUploadError('Please select an image file');
            return;
        }
        const MAX_BYTES = 5 * 1024 * 1024; // 5MB
        if (file.size > MAX_BYTES) {
            setUploadError(`File too large. Max ${(MAX_BYTES / (1024 * 1024)).toFixed(1)}MB`);
            target.value = '';
            return;
        }
        try {
            setUploading(true);
            const url = await tutorApi.uploadProfilePicture(file);
            setAvatarPreview(url);
            // Optimistically update user.profilePicture
            if (_state1.user) {
                // @ts-ignore
                _state1.user.profilePicture = url;
            }
        }
        catch (err: any) {
            setUploadError(err?.message || 'Upload failed');
        }
        finally {
            setUploading(false);
            // reset input value to allow re-selecting same file
            target.value = '';
        }
    };
    const viewAvatar = () => {
        if (!avatarPreview())
            return;
        const w = window.open('', '_blank');
        if (w) {
            const image = w.document.createElement('img');
            image.src = mediaUrl(avatarPreview())!;
            image.alt = 'Avatar Preview';
            image.style.cssText = 'max-width:100%;display:block;margin:0 auto';
            w.document.title = 'Avatar Preview';
            w.document.body.appendChild(image);
        }
    };
    return (<Show when={_props0.isOpen}><TutorDialog label="Account settings" className="tutor-settings-dialog" onClose={handleClose} busy={emailLoading() || passwordLoading() || infoLoading() || uploading() || _state1.logoutLoading}>
      <div class="settings-modal" onClick={(e) => e.stopPropagation()}>
        {/* Back button for sub-views */}
        {currentView() !== 'main' && (<button class="settings-modal-back" disabled={emailLoading() || passwordLoading() || infoLoading()} onClick={handleBack} aria-label="Go back">
            <TutorIcon name="fa-arrow-left" size={20}/>
          </button>)}
        
        <button class="settings-modal-close" disabled={emailLoading() || passwordLoading() || infoLoading() || uploading() || _state1.logoutLoading} onClick={handleClose} aria-label="Close settings">
          ×
        </button>

        {/* Main Settings View */}
        {currentView() === 'main' && (<>
            {/* User Profile Section */}
            <div class="settings-profile">
              <div class="settings-avatar">
                <ProfileAvatar src={avatarPreview()} alt="User Avatar" fallback={displayName().charAt(0).toUpperCase()} style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', objectFit: 'cover', fontSize: '36px', fontWeight: 700, color: '#fff' }}/>
                <div class="avatar-overlay">
                  <label class="avatar-btn" title="Upload new avatar">
                    <input type="file" accept="image/*" onChange={onSelectAvatar} style={cssStyle({ display: 'none' })}/>
                    {uploading() ? 'Uploading...' : 'Upload'}
                  </label>
                  <button type="button" class="avatar-btn secondary" disabled={!avatarPreview()} onClick={viewAvatar}>
                    View
                  </button>
                </div>
              </div>
              {uploadError() && <div style={cssStyle({ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.5rem' })}>{uploadError()}</div>}
              <h3 class="settings-name">{displayName()}</h3>
              <div class="settings-tutor-id">
                <span class="settings-label">TUTOR ID:</span>
                <span class="settings-value">{tutorId()}</span>
              </div>
              <div class="settings-email">
                <TutorIcon name="fi fi-sr-envelope"/>
                <span>{email()}</span>
              </div>

              {/* Wallet Address */}
              {walletAddress() && (<div class="settings-wallet">
                  <span class="settings-wallet-label">Wallet Address:</span>
                  <span class="settings-wallet-value">{shortWallet()}</span>
                  <button type="button" onClick={copyWallet} class={`settings-copy-btn ${copied() ? 'copied' : ''}`} aria-label="Copy wallet address" disabled={copied()}>
                    {copied() ? <><TutorIcon name="fas fa-check"/> COPIED</> : 'COPY'}
                  </button>
                </div>)}
            </div>

            {/* Action Buttons */}
            <div class="settings-actions">
              <button class="settings-action-btn" onClick={() => setCurrentView('update-email')}>
                <div class="settings-action-icon update-email">
                  <TutorIcon name="fa-envelope" size={20}/>
                </div>
                <span>Update Email</span>
              </button>

              <button class="settings-action-btn" onClick={() => setCurrentView('update-password')}>
                <div class="settings-action-icon update-password">
                  <TutorIcon name="fa-lock" size={20}/>
                </div>
                <span>Update Password</span>
              </button>

              <button class="settings-action-btn" onClick={() => setCurrentView('update-info')}>
                <div class="settings-action-icon update-info">
                  <TutorIcon name="fa-user" size={20}/>
                </div>
                <span>Update My Personal Information</span>
              </button>

              <button class="settings-action-btn logout-btn" onClick={handleLogout} disabled={_state1.logoutLoading}>
                <div class="settings-action-icon logout-icon">
                  <TutorIcon name="fa-sign-out-alt" size={20}/>
                </div>
                <span>{_state1.logoutLoading ? 'Signing out...' : 'Logout'}</span>
              </button>
              {_state1.logoutError && <p class="settings-form-error" role="alert">{_state1.logoutError}</p>}
            </div>
          </>)}

        {/* Update Password View */}
        {currentView() === 'update-password' && (<div class="settings-subview">
            <div class="settings-subview-header">
              <div class="settings-subview-icon update-password">
                <TutorIcon name="fa-lock" size={20}/>
              </div>
              <h2 class="settings-subview-title">Update Password</h2>
              <p class="settings-subview-subtitle">Enter your current password and choose a new one</p>
            </div>

            <form class="settings-form" onSubmit={handleUpdatePassword}>
              <div class="settings-form-group">
                <label class="settings-form-label">Current Password</label>
                <div class="settings-input-wrapper">
                  <input type={showCurrentPassword() ? 'text' : 'password'} value={currentPassword()} onInput={(e) => setCurrentPassword((e.target as HTMLInputElement).value)} class="settings-form-input" placeholder="Enter your current password"/>
                  <button type="button" class="settings-input-toggle" onClick={() => setShowCurrentPassword(!showCurrentPassword())}>
                    {showCurrentPassword() ? (<TutorIcon name="fa-eye-slash" size={20}/>) : (<TutorIcon name="fa-eye" size={20}/>)}
                  </button>
                </div>
              </div>

              <div class="settings-form-group">
                <label class="settings-form-label">New Password</label>
                <div class="settings-input-wrapper">
                  <input type={showNewPassword() ? 'text' : 'password'} value={newPassword()} onInput={(e) => setNewPassword((e.target as HTMLInputElement).value)} class="settings-form-input" placeholder="Enter your new password"/>
                  <button type="button" class="settings-input-toggle" onClick={() => setShowNewPassword(!showNewPassword())}>
                    {showNewPassword() ? (<TutorIcon name="fa-eye-slash" size={20}/>) : (<TutorIcon name="fa-eye" size={20}/>)}
                  </button>
                </div>
                <span class="settings-form-hint">Must be at least 8 characters</span>
              </div>

              <div class="settings-form-group">
                <label class="settings-form-label">Confirm New Password</label>
                <div class="settings-input-wrapper">
                  <input type={showConfirmPassword() ? 'text' : 'password'} value={confirmPassword()} onInput={(e) => setConfirmPassword((e.target as HTMLInputElement).value)} class="settings-form-input" placeholder="Confirm your new password"/>
                  <button type="button" class="settings-input-toggle" onClick={() => setShowConfirmPassword(!showConfirmPassword())}>
                    {showConfirmPassword() ? (<TutorIcon name="fa-eye-slash" size={20}/>) : (<TutorIcon name="fa-eye" size={20}/>)}
                  </button>
                </div>
              </div>

              {passwordError() && (<div class="settings-form-error">
                  <TutorIcon name="fa-info-circle" size={20}/>
                  {passwordError()}
                </div>)}

              {passwordSuccess() && (<div class="settings-form-success">
                  <TutorIcon name="fa-check-circle" size={20}/>
                  {passwordSuccess()}
                </div>)}

              <button type="submit" class="settings-form-submit" disabled={passwordLoading()}>
                {passwordLoading() ? (<>
                    <span class="settings-spinner"></span>
                    Updating...
                  </>) : ('Update Password')}
              </button>
            </form>
          </div>)}

        {/* Update Email View */}
        {currentView() === 'update-email' && (<div class="settings-subview">
            <div class="settings-subview-header">
              <div class="settings-subview-icon update-email">
                <TutorIcon name="fa-envelope" size={20}/>
              </div>
              <h2 class="settings-subview-title">Update Email</h2>
              <p class="settings-subview-subtitle">Enter your new email address</p>
            </div>

            {/* Current email display */}
            <div class="settings-current-value">
              <span class="settings-current-label">Current Email</span>
              <span class="settings-current-text">{email()}</span>
            </div>

            <form class="settings-form" onSubmit={handleUpdateEmail}>
              <div class="settings-form-group">
                <label class="settings-form-label">New Email Address</label>
                <div class="settings-input-wrapper">
                  <input type="email" value={newEmail()} onInput={(e) => setNewEmail((e.target as HTMLInputElement).value)} class="settings-form-input settings-form-input-no-toggle" placeholder="Enter your new email"/>
                </div>
              </div>

              <div class="settings-form-group">
                <label class="settings-form-label">Confirm New Email</label>
                <div class="settings-input-wrapper">
                  <input type="email" value={confirmEmail()} onInput={(e) => setConfirmEmail((e.target as HTMLInputElement).value)} class="settings-form-input settings-form-input-no-toggle" placeholder="Confirm your new email"/>
                </div>
              </div>

              <div class="settings-form-group">
                <label class="settings-form-label">Current Password</label>
                <div class="settings-input-wrapper">
                  <input type={showEmailPassword() ? 'text' : 'password'} value={emailPassword()} onInput={(e) => setEmailPassword((e.target as HTMLInputElement).value)} class="settings-form-input" placeholder="Enter your password to confirm"/>
                  <button type="button" class="settings-input-toggle" onClick={() => setShowEmailPassword(!showEmailPassword())}>
                    {showEmailPassword() ? (<TutorIcon name="fa-eye-slash" size={20}/>) : (<TutorIcon name="fa-eye" size={20}/>)}
                  </button>
                </div>
                <span class="settings-form-hint">Required for security verification</span>
              </div>

              {emailError() && (<div class="settings-form-error">
                  <TutorIcon name="fa-info-circle" size={20}/>
                  {emailError()}
                </div>)}

              {emailSuccess() && (<div class="settings-form-success">
                  <TutorIcon name="fa-check-circle" size={20}/>
                  {emailSuccess()}
                </div>)}

              <button type="submit" class="settings-form-submit" disabled={emailLoading()}>
                {emailLoading() ? (<>
                    <span class="settings-spinner"></span>
                    Updating...
                  </>) : ('Update Email')}
              </button>
            </form>
          </div>)}

        {/* Update Personal Info View */}
        {currentView() === 'update-info' && (<div class="settings-subview settings-subview-scrollable">
            <div class="settings-subview-header">
              <div class="settings-subview-icon update-info">
                <TutorIcon name="fa-user" size={20}/>
              </div>
              <h2 class="settings-subview-title">Update Personal Information</h2>
              <p class="settings-subview-subtitle">Update your phone, address, and qualifications</p>
            </div>

            <form class="settings-form" onSubmit={handleUpdateInfo}>
              {/* Phone Number Section */}
              <div class="settings-form-section">
                <h3 class="settings-form-section-title">Contact Information</h3>
                <div class="settings-form-group">
                  <label class="settings-form-label">Phone Number</label>
                  <div class="settings-input-wrapper">
                    <input type="tel" value={phoneNumber()} onInput={(e) => setPhoneNumber((e.target as HTMLInputElement).value)} class="settings-form-input settings-form-input-no-toggle" placeholder="+63 XXX XXX XXXX"/>
                  </div>
                </div>
              </div>

              {/* Current Address Section */}
              <div class="settings-form-section">
                <h3 class="settings-form-section-title">Current Address</h3>
                
                <div class="settings-form-group">
                  <label class="settings-form-label">Country</label>
                  <select value={country()} onChange={(e) => setCountry((e.target as HTMLSelectElement).value)} class="settings-form-select">
                    <option value="Philippines">Philippines</option>
                  </select>
                </div>

                <div class="settings-form-group">
                  <label class="settings-form-label">Region</label>
                  <select value={region()} onChange={(e) => {
                const val = (e.target as HTMLSelectElement).value;
                setRegion(val);
                // Reset downstream
                setProvince('');
                setCity('');
            }} class="settings-form-select">
                    <option value="">Select Region</option>
                    {regionsData().map(r => (<option value={r.code}>{r.name}</option>))}
                  </select>
                </div>

                {/* Province selector (hidden for NCR which has direct municipalities) */}
                {selectedRegion() && !selectedRegion().municipalities && (<div class="settings-form-group">
                    <label class="settings-form-label">Province</label>
                    <select value={province()} onChange={(e) => {
                    const val = (e.target as HTMLSelectElement).value;
                    setProvince(val);
                    setCity('');
                }} class="settings-form-select">
                      <option value="">Select Province</option>
                      {provincesForRegion().map(p => (<option value={p.code}>{p.name}</option>))}
                    </select>
                  </div>)}

                <div class="settings-form-group">
                  <label class="settings-form-label">City / Municipality</label>
                  <select value={city()} onChange={(e) => setCity((e.target as HTMLSelectElement).value)} class="settings-form-select" disabled={!selectedRegion() || (!selectedRegion().municipalities && !selectedProvince())}>
                    <option value="">Select City / Municipality</option>
                    {(selectedRegion()?.municipalities ? selectedRegion().municipalities : municipalitiesForProvince()).map((m: PSGCCity) => (<option value={m.code}>{m.name}</option>))}
                  </select>
                </div>

                <div class="settings-form-group">
                  <label class="settings-form-label">ZIP Code</label>
                  <input type="text" value={zipCode()} onInput={(e) => setZipCode((e.target as HTMLInputElement).value)} class="settings-form-input settings-form-input-no-toggle" placeholder="Enter ZIP code"/>
                </div>

                <div class="settings-form-group">
                  <label class="settings-form-label">Address Line</label>
                  <textarea value={addressLine()} onInput={(e) => setAddressLine((e.target as HTMLTextAreaElement).value)} class="settings-form-textarea" placeholder="House/Unit No., Street, Barangay" rows={3}/>
                </div>

                <label class="settings-form-checkbox">
                  <input type="checkbox" checked={sameAsPermanent()} onChange={(e) => setSameAsPermanent((e.target as HTMLInputElement).checked)}/>
                  <span>Check if permanent address is the same with your current address</span>
                </label>
              </div>

              {/* Qualifications Section */}
              <div class="settings-form-section">
                <h3 class="settings-form-section-title">Qualifications</h3>
                
                <div class="settings-form-group">
                  <label class="settings-form-label">School Attended</label>
                  <div class="school-dropdown-container">
                    <div class="school-dropdown-trigger" onClick={() => setShowSchoolDropdown(!showSchoolDropdown())}>
                      <span class={schoolAttended() ? '' : 'placeholder'}>
                        {schoolAttended() || 'Select your school'}
                      </span>
                      <TutorIcon name={`fas fa-chevron-down dropdown-arrow ${showSchoolDropdown() ? 'open' : ''}`}/>
                    </div>
                    {showSchoolDropdown() && (<>
                        <div class="school-dropdown-backdrop" onClick={() => {
                    setShowSchoolDropdown(false);
                    setSchoolSearchQuery('');
                }}/>
                        <div class="school-dropdown-panel">
                          <div class="school-dropdown-search">
                            <TutorIcon name="fas fa-search"/>
                            <input type="text" value={schoolSearchQuery()} onInput={(e) => setSchoolSearchQuery((e.target as HTMLInputElement).value)} placeholder="Search schools..." autofocus/>
                          </div>
                          <div class="school-dropdown-list">
                            {filteredUniversities().length > 0 ? (filteredUniversities().map(uni => (<div class={`school-dropdown-item ${schoolAttended() === uni.text ? 'selected' : ''}`} onClick={() => {
                        setSchoolAttended(uni.text);
                        setSchoolSearchQuery('');
                        setShowSchoolDropdown(false);
                    }}>
                                  {uni.text}
                                </div>))) : (<div class="school-dropdown-empty">No schools found</div>)}
                          </div>
                        </div>
                      </>)}
                  </div>
                </div>

                <div class="settings-form-group">
                  <label class="settings-form-label">Educational Attainment</label>
                  <select value={educationalAttainment()} onChange={(e) => setEducationalAttainment((e.target as HTMLSelectElement).value)} class="settings-form-select">
                    <option value="">Select attainment</option>
                    {educationalAttainments.map(ea => (<option value={ea}>{ea}</option>))}
                  </select>
                </div>

                <div class="settings-form-row">
                  <div class="settings-form-group settings-form-group-half">
                    <label class="settings-form-label">Major</label>
                    <input type="text" value={major()} onInput={(e) => setMajor((e.target as HTMLInputElement).value)} class="settings-form-input settings-form-input-no-toggle" placeholder="Enter major"/>
                  </div>
                  <div class="settings-form-group settings-form-group-half">
                    <label class="settings-form-label">Teaching Experience</label>
                    <select value={teachingExperience()} onChange={(e) => setTeachingExperience((e.target as HTMLSelectElement).value)} class="settings-form-select">
                      <option value="">Select experience</option>
                      {teachingExperienceOptions.map(te => (<option value={te}>{te}</option>))}
                    </select>
                  </div>
                </div>

                <div class="settings-form-group">
                  <label class="settings-form-label">Teaching Qualifications</label>
                  <div class="settings-checkbox-group">
                    {qualificationOptions.map(qual => (<label class="settings-checkbox-item">
                        <input type="checkbox" checked={teachingQualifications().includes(qual)} onChange={() => toggleQualification(qual)}/>
                        <span>{qual}</span>
                      </label>))}
                  </div>
                </div>
              </div>

              {infoError() && (<div class="settings-form-error">
                  <TutorIcon name="fa-info-circle" size={20}/>
                  {infoError()}
                </div>)}

              {infoSuccess() && (<div class="settings-form-success">
                  <TutorIcon name="fa-check-circle" size={20}/>
                  {infoSuccess()}
                </div>)}

              <button type="submit" class="settings-form-submit" disabled={infoLoading()}>
                {infoLoading() ? (<>
                    <span class="settings-spinner"></span>
                    Updating...
                  </>) : ('Update')}
              </button>
            </form>
          </div>)}
      </div>
    </TutorDialog></Show>);
};
export default SettingsModal;
