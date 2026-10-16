import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorDialog from "../Components/Common/TutorDialog";
import TutorIcon from "../Components/Common/TutorIcon";
import TutorArt from "../Components/Common/TutorArt";
import { useAuthContext } from '../context/AuthContext';
import { getPersonalInfo, PersonalInfoData } from '../api/auth.api';
import { client } from '../api/utils';
import { getTutorPerformance, type TutorPerformance } from '../api/performance.api';
import SideBar from '../Components/IndexOne/SideBar';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import SettingsModal from '../Components/Settings/SettingsModal';
import ImageCropper from '../Components/Common/ImageCropper';
import VideoPlayer from '../Components/Common/VideoPlayer';
import ProfileAvatar from '../Components/Common/ProfileAvatar';
import { mediaUrl } from '../utils/mediaUrl';
import { toast, toastConfirm } from '../Components/Common/Toast';
import './MyProfilePage.css';
import ScreeningCredential from '../Components/Common/ScreeningCredential';
interface ProfileItemStatus {
    status: 'pending' | 'approved' | 'rejected';
    rejectionReason?: string;
    reviewedAt?: string;
}
interface ProfileItemStatuses {
    profilePicture?: ProfileItemStatus;
    videoIntro?: ProfileItemStatus;
    bio?: ProfileItemStatus;
    education?: ProfileItemStatus;
    interests?: ProfileItemStatus;
}
interface PendingProfileChange {
    itemKey: string;
    fieldKey?: string;
    newValue: any;
    status: 'pending' | 'approved' | 'rejected';
    rejectionReason?: string;
    submittedAt: string;
}
interface TutorProfileData {
    firstName: string;
    lastName: string;
    displayName?: string;
    email: string;
    phoneNumber?: string;
    country?: string;
    bio?: string;
    introduction?: string;
    teachingStyle?: string;
    languages?: string[];
    specializations?: string[];
    interests?: string[];
    education?: string[];
    certifications?: string[];
    experienceYears?: number;
    hourlyRate?: number;
    rating?: number;
    totalReviews?: number;
    totalSessions?: number;
    isVerified?: boolean;
    isAvailable?: boolean;
    profilePicture?: string;
    videoIntroUrl?: string;
    profileStatus?: 'incomplete' | 'pending_review' | 'approved' | 'rejected';
    profileSubmittedAt?: string;
    profileItemStatuses?: ProfileItemStatuses;
    profileRejectionReason?: string;
    pendingProfileChanges?: PendingProfileChange[];
    hasPendingChanges?: boolean;
}
export const MyProfilePage = () => {
    const _state0 = useAuthContext();
    const [profileData, setProfileData] = createSignal<TutorProfileData | null>(null);
    const [personalInfo, setPersonalInfo] = createSignal<PersonalInfoData | null>(null);
    const [loading, setLoading] = createSignal(true);
    const [activeTab, setActiveTab] = createSignal<'about' | 'stats' | 'settings'>('about');
    const [performance, setPerformance] = createSignal<TutorPerformance | null>(null);
    const [performanceError, setPerformanceError] = createSignal('');
    createEffect(on(() => [activeTab()], () => {
        const _cleanup1 = untrack(() => {
            if (activeTab() !== 'stats')
                return;
            const controller = new AbortController();
            getTutorPerformance('all', undefined, 1, controller.signal).then(data => { setPerformance(data); setPerformanceError(''); })
                .catch(() => {
                if (!controller.signal.aborted)
                    setPerformanceError('Could not load performance metrics.');
            });
            return () => controller.abort();
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    const [uploading, setUploading] = createSignal(false);
    const [editingField, setEditingField] = createSignal<string | null>(null);
    const [editValue, setEditValue] = createSignal<string>('');
    const [interestChips, setInterestChips] = createSignal<string[]>([]);
    const [newInterest, setNewInterest] = createSignal<string>('');
    const [settingsOpen, setSettingsOpen] = createSignal(false);
    const [saving, setSaving] = createSignal(false);
    const [cropperImage, setCropperImage] = createSignal<string | null>(null);
    const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
    const [avatarUrl, setAvatarUrl] = createSignal<string | null>(null);
    const [videoUploading, setVideoUploading] = createSignal(false);
    const [showVideoModal, setShowVideoModal] = createSignal(false);
    const [submittingProfile, setSubmittingProfile] = createSignal(false);
    const [toastMessage, setToastMessage] = createSignal<{
        text: string;
        type: 'success' | 'info' | 'error';
    } | null>(null);
    const videoInputRef = { current: null } as {
        current: HTMLInputElement | null;
    };
    const fileInputRef = { current: null } as {
        current: HTMLInputElement | null;
    };
    // Auto-hide toast after 5 seconds
    createEffect(on(() => [toastMessage()], () => {
        const _cleanup2 = untrack(() => {
            if (toastMessage()) {
                const timer = setTimeout(() => setToastMessage(null), 5000);
                return () => clearTimeout(timer);
            }
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    createEffect(on(() => [], () => {
        const _cleanup3 = untrack(() => {
            document.title = 'My Profile | FluentXVerse';
            loadProfile();
        });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    const loadProfile = async () => {
        try {
            setLoading(true);
            // Load tutor's own profile data (bio, introduction, etc.)
            try {
                const profileResponse = await client.get('/tutor/profile');
                if (profileResponse.data.success && profileResponse.data.data) {
                    const data = profileResponse.data.data as TutorProfileData;
                    setProfileData(data);
                    // Keep avatarUrl in sync with the currently approved profile picture
                    if (data.profilePicture) {
                        setAvatarUrl(data.profilePicture);
                    }
                }
            }
            catch (err) {
                console.error('Failed to load tutor profile:', err);
            }
            // Load personal info (education, qualifications from Settings)
            const personalData = await getPersonalInfo();
            if (personalData) {
                setPersonalInfo(personalData);
            }
        }
        catch (error) {
            console.error('Failed to load personal info:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const handleSettingsClose = () => {
        setSettingsOpen(false);
        // Reload personal info after settings modal closes
        loadProfile();
    };
    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };
    const handleFileChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file)
            return;
        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast.error('Image must be less than 10MB');
            return;
        }
        // Store the file and open cropper
        setSelectedFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => {
            setCropperImage(ev.target?.result as string);
        };
        reader.readAsDataURL(file);
        // Reset the input so the same file can be selected again
        target.value = '';
    };
    const handleCropComplete = async (croppedBlob: Blob) => {
        setCropperImage(null);
        setSelectedFile(null);
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', croppedBlob, 'profile.jpg');
            // Use the server endpoint which handles both upload and saving
            const response = await client.post('/tutor/profile-picture', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            if (response.data.success) {
                // Check if changes are pending review (for approved profiles)
                if (response.data.hasPendingChanges) {
                    // Don't update avatarUrl or profileData - keep showing current approved photo
                    // Just show message that it's pending review
                    setToastMessage({
                        text: 'Photo submitted for review. Your current photo remains visible until approved.',
                        type: 'info'
                    });
                    // Don't reload profile here - it would reset state unnecessarily
                    // The pending changes will be visible in the profile status section
                }
                else {
                    // Update local state immediately with cache-busted URL
                    const newUrl = response.data.url + '?t=' + Date.now();
                    setAvatarUrl(newUrl);
                    setProfileData(prev => prev ? { ...prev, profilePicture: newUrl } : { profilePicture: newUrl } as TutorProfileData);
                    setToastMessage({ text: 'Profile photo updated successfully!', type: 'success' });
                }
            }
            else {
                throw new Error(response.data.error || 'Upload failed');
            }
        }
        catch (error) {
            console.error('Upload error:', error);
            setToastMessage({ text: 'Failed to upload image', type: 'error' });
        }
        finally {
            setUploading(false);
        }
    };
    const handleCropCancel = () => {
        setCropperImage(null);
        setSelectedFile(null);
    };
    const handleVideoUpload = async (e: Event) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file)
            return;
        if (!file.type.startsWith('video/')) {
            setToastMessage({ text: 'Please select a video file', type: 'error' });
            return;
        }
        if (file.size > 100 * 1024 * 1024) {
            setToastMessage({ text: 'Video must be less than 100MB', type: 'error' });
            return;
        }
        setVideoUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await client.post('/tutor/intro-video', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            if (response.data.success) {
                // Check if changes are pending review (for approved profiles)
                if (response.data.hasPendingChanges) {
                    setToastMessage({
                        text: 'Video submitted for review. Your current video remains visible until approved.',
                        type: 'info'
                    });
                    // Don't reload - keep current state
                }
                else {
                    const newUrl = response.data.url + '?t=' + Date.now();
                    setProfileData(prev => prev ? { ...prev, videoIntroUrl: newUrl } : { videoIntroUrl: newUrl } as TutorProfileData);
                    setToastMessage({ text: 'Video uploaded successfully!', type: 'success' });
                }
            }
            else {
                throw new Error(response.data.error || 'Upload failed');
            }
        }
        catch (error) {
            console.error('Video upload error:', error);
            setToastMessage({ text: 'Failed to upload video', type: 'error' });
        }
        finally {
            setVideoUploading(false);
            target.value = '';
        }
    };
    const handleDeleteVideo = async () => {
        if (!await toastConfirm('Are you sure you want to delete your introduction video?', 'Delete Video'))
            return;
        try {
            const response = await client.delete('/tutor/intro-video');
            if (response.data.success) {
                setProfileData(prev => prev ? { ...prev, videoIntroUrl: undefined } : null);
            }
            else {
                throw new Error(response.data.error || 'Delete failed');
            }
        }
        catch (error) {
            console.error('Delete video error:', error);
            toast.error('Failed to delete video');
        }
    };
    const startEditing = (field: string, currentValue: string) => {
        setEditingField(field);
        setEditValue(currentValue || '');
        // Initialize interest chips when editing interests
        if (field === 'interests') {
            const existingInterests = profileData()?.interests || [];
            setInterestChips(existingInterests);
            setNewInterest('');
        }
    };
    const cancelEditing = () => {
        setEditingField(null);
        setEditValue('');
        setInterestChips([]);
        setNewInterest('');
    };
    const addInterest = () => {
        const trimmed = newInterest().trim();
        if (trimmed && interestChips().length < 5 && !interestChips().includes(trimmed)) {
            setInterestChips([...interestChips(), trimmed]);
            setNewInterest('');
        }
    };
    const removeInterest = (index: number) => {
        setInterestChips(interestChips().filter((_, i) => i !== index));
    };
    const handleInterestKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addInterest();
        }
    };
    const viewAvatar = () => {
        const currentAvatarUrl = mediaUrl(avatarUrl() || profileData()?.profilePicture || _state0.user?.profilePicture);
        if (!currentAvatarUrl)
            return;
        const w = window.open('', '_blank');
        if (w) {
            const image = w.document.createElement('img');
            image.src = currentAvatarUrl;
            image.alt = 'Profile Picture';
            image.style.cssText = 'max-width:100%;display:block;margin:0 auto';
            w.document.title = 'Profile Picture';
            w.document.body.appendChild(image);
        }
    };
    const saveField = async () => {
        if (!editingField())
            return;
        setSaving(true);
        try {
            // Handle interests field - use interestChips array
            let valueToSend: string | string[] = editValue();
            let valueToStore: string | string[] = editValue();
            if (editingField() === 'interests') {
                valueToSend = interestChips();
                valueToStore = interestChips();
            }
            const response = await client.patch('/tutor/profile', { [editingField()]: valueToSend });
            if (response.data.success) {
                // Check if changes are pending review (for approved profiles)
                if (response.data.hasPendingChanges) {
                    setToastMessage({
                        text: 'Changes submitted for review. Your current profile remains visible until approved.',
                        type: 'info'
                    });
                    // Don't reload - keep current state
                }
                else {
                    // Update local state immediately
                    setProfileData(prev => {
                        if (prev) {
                            return { ...prev, [editingField()]: valueToStore };
                        }
                        // Create a minimal profile data object if none exists
                        return {
                            firstName: _state0.user?.firstName || '',
                            lastName: _state0.user?.lastName || '',
                            email: _state0.user?.email || '',
                            [editingField()]: valueToStore
                        } as TutorProfileData;
                    });
                    setToastMessage({ text: 'Profile updated successfully!', type: 'success' });
                }
                cancelEditing();
            }
            else {
                throw new Error(response.data.error || 'Failed to save');
            }
        }
        catch (error) {
            console.error('Save error:', error);
            setToastMessage({ text: 'Failed to save changes', type: 'error' });
        }
        finally {
            setSaving(false);
        }
    };
    const handleSubmitForReview = async () => {
        if (submittingProfile())
            return;
        if (!await toastConfirm('Are you sure you want to submit your profile for review? Once submitted, you cannot edit your profile until it is reviewed.', 'Submit Profile')) {
            return;
        }
        setSubmittingProfile(true);
        try {
            const response = await client.post('/tutor/profile/submit');
            if (response.data.success) {
                setProfileData(prev => prev ? {
                    ...prev,
                    profileStatus: 'pending_review',
                    profileSubmittedAt: new Date().toISOString()
                } : null);
                toast.success('Your profile has been submitted for review! An admin will review it shortly.');
            }
            else {
                throw new Error(response.data.error || 'Failed to submit profile');
            }
        }
        catch (error: any) {
            console.error('Submit error:', error);
            toast.error(error.response?.data?.error || error.message || 'Failed to submit profile for review');
        }
        finally {
            setSubmittingProfile(false);
        }
    };
    return createMemo(() => {
        if (loading()) {
            return (<>
        <SideBar />
        <div class="main-content">
          <DashboardHeader />
          <div class="my-profile-loading">
            <div class="spinner"></div>
            <p>Loading your profile...</p>
          </div>
        </div>
      </>);
        }
        const displayName = createMemo(() => _state0.user?.firstName && _state0.user?.lastName
            ? `${_state0.user.firstName} ${_state0.user.lastName}`.trim()
            : profileData()?.displayName
                || `${profileData()?.firstName || ''} ${profileData()?.lastName || ''}`.trim()
                || _state0.user?.email?.split('@')[0]
                || 'Tutor');
        const initials = createMemo(() => `${_state0.user?.firstName?.[0] || profileData()?.firstName?.[0] || ''}${_state0.user?.lastName?.[0] || profileData()?.lastName?.[0] || ''}`.toUpperCase() || 'T');
        // Use avatarUrl state first, then fallback to profileData or user
        const currentAvatar = createMemo(() => avatarUrl() || profileData()?.profilePicture || _state0.user?.profilePicture);
        // Calculate profile completeness
        const profileFields = createMemo(() => [
            { name: 'Bio', complete: !!(profileData()?.bio && profileData().bio.length > 10) },
            { name: 'Profile Picture', complete: !!currentAvatar() },
            { name: 'Introduction Video', complete: !!profileData()?.videoIntroUrl },
            { name: 'Education', complete: !!((personalInfo()?.schoolAttended && personalInfo()?.major) || (profileData()?.education && profileData().education.length > 0)) },
            { name: 'Interests', complete: !!(profileData()?.interests && profileData().interests.length > 0) },
        ]);
        const completedCount = createMemo(() => profileFields().filter(f => f.complete).length);
        const completionPercent = createMemo(() => Math.round((completedCount() / profileFields().length) * 100));
        const incompleteFields = createMemo(() => profileFields().filter(f => !f.complete));
        return (<>
      {/* Toast Notification - outside main-content to float independently */}
      {toastMessage() && (<div class={`toast-notification toast-${toastMessage().type}`}>
          <TutorIcon name={`fi-sr-${toastMessage().type === 'success' ? 'check-circle' : toastMessage().type === 'info' ? 'info' : 'exclamation'}`}/>
          <span>{toastMessage().text}</span>
          <button class="toast-close" onClick={() => setToastMessage(null)}>
            <TutorIcon name="fi-sr-cross-small"/>
          </button>
        </div>)}
      
      <SideBar />
      <div class="main-content">
        <DashboardHeader />
        
        <div class="my-profile-page">
          <div class="profile-container">
            {/* Hero Section */}
            <div class="profile-hero">
              <div class="profile-hero-content">
                {/* Left: Avatar */}
                <div class="profile-header-left">
                  <div class="profile-avatar-wrapper">
                    {uploading() ? (<div class="profile-avatar-large profile-avatar-uploading">
                        <div class="upload-spinner"></div>
                      </div>) : (<ProfileAvatar src={currentAvatar()} alt={displayName()} className="profile-avatar-large" fallbackClassName="profile-avatar-placeholder" fallback={initials()}/>)}
                    <div class="avatar-overlay">
                      <label class="avatar-btn" title="Upload new avatar">
                        <input type="file" accept="image/*" onChange={handleFileChange} style={cssStyle({ display: 'none' })}/>
                        {uploading() ? 'Uploading...' : 'Upload'}
                      </label>
                      <button type="button" class="avatar-btn secondary" disabled={!currentAvatar()} onClick={viewAvatar}>
                        View
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right: Details */}
                <div class="profile-header-right">
                  <h1 class="profile-name">{displayName()}</h1>

                  {/* Star Rating */}
                  <div class="profile-rating-row">
                    <div class="star-rating" role="img" aria-label={`Rated ${(profileData()?.rating || 0).toFixed(1)} out of 5`}>
                      {[1, 2, 3, 4, 5].map((star) => (<TutorIcon name="fi-sr-star" className={star <= Math.round(profileData()?.rating || 0) ? 'filled' : 'empty'}/>))}
                    </div>
                    <span class="rating-score">{(profileData()?.rating || 0).toFixed(1)}</span>
                    <span class="rating-count">({profileData()?.totalReviews || 0} {profileData()?.totalReviews === 1 ? 'review' : 'reviews'})</span>
                    {profileData()?.isVerified && (<div class="verified-badge">
                        <TutorIcon name="fi-sr-check"/>
                        <span>Verified</span>
                      </div>)}
                  </div>

                  {/* Languages & Country */}
                  <div class="profile-meta">
                    {profileData()?.languages && profileData().languages.length > 0 && (<div class="meta-item">
                        <TutorIcon name="fi-sr-globe"/>
                        <span>Speaks: {profileData().languages.join(', ')}</span>
                      </div>)}
                  </div>

                  {/* Short Bio */}
                  <div class="profile-bio-row">
                    <p class="profile-bio-short">
                      {profileData()?.bio
                ? (profileData().bio.length > 150 ? `${profileData().bio.substring(0, 150)}...` : profileData().bio)
                : 'Add a short bio to help students learn about you.'}
                    </p>
                    <button class="btn-edit-inline" onClick={() => startEditing('bio', profileData()?.bio || '')}>
                      <TutorIcon name="fas fa-pencil-alt"/>
                    </button>
                  </div>

                  {/* Specializations Tags */}
                  {profileData()?.specializations && profileData().specializations.length > 0 && (<div class="profile-tags">
                      {profileData().specializations.slice(0, 5).map((spec, idx) => (<span class="tag">{spec}</span>))}
                      {profileData().specializations.length > 5 && (<span class="tag tag-more">+{profileData().specializations.length - 5} more</span>)}
                    </div>)}
                </div>
              </div>

              {/* Video Introduction - Inside Hero Card */}
              <div class="hero-video-section">
                <h3 class="video-section-title">
                  <TutorIcon name="fi-sr-play"/>
                  Introduction Video
                </h3>
                {profileData()?.videoIntroUrl ? (<div class="hero-video-container">
                    <VideoPlayer src={mediaUrl(profileData().videoIntroUrl)!} hideBigPlayButton={true}/>
                    <label class="video-replace-overlay">
                      <input type="file" accept="video/*" onChange={handleVideoUpload} style={cssStyle({ display: 'none' })} ref={_element => videoInputRef.current = _element}/>
                      <div class="video-replace-btn">
                        <TutorIcon name="fi-sr-refresh"/>
                        <span>{videoUploading() ? 'Uploading...' : 'Replace Video'}</span>
                      </div>
                    </label>
                  </div>) : (<div class="hero-video-placeholder">
                    <div class="video-placeholder-content">
                      <TutorIcon name="fi-sr-video-plus"/>
                      <span>Add intro video</span>
                    </div>
                    <label class="btn-video-action">
                      <input type="file" accept="video/*" onChange={handleVideoUpload} style={cssStyle({ display: 'none' })} ref={_element => videoInputRef.current = _element}/>
                      <TutorIcon name="fi-sr-plus"/>
                      {videoUploading() ? 'Uploading...' : 'Upload Video'}
                    </label>
                  </div>)}
              </div>
            </div>

            {/* Profile Completeness Indicator */}
            <ScreeningCredential />
            {completionPercent() < 100 && (<div class="profile-completeness-card">
                <div class="completeness-header">
                  <div class="completeness-title">
                    <TutorIcon name="fi-sr-chart-pie-alt"/>
                    <span>Profile Completeness</span>
                  </div>
                  <div class="completeness-percent">{completionPercent()}%</div>
                </div>
                <div class="completeness-bar">
                  <div class="completeness-bar-fill" style={cssStyle({ get width() {
                        return `${completionPercent()}%`;
                    } })}></div>
                </div>
                {incompleteFields().length > 0 && (<div class="completeness-missing">
                    <span class="missing-label">Complete your profile:</span>
                    <div class="missing-items">
                      {incompleteFields().slice(0, 3).map((field, idx) => (<span class="missing-item">
                          <TutorIcon name="fi-sr-plus-small"/>
                          {field.name}
                        </span>))}
                      {incompleteFields().length > 3 && (<span class="missing-item more">+{incompleteFields().length - 3} more</span>)}
                    </div>
                  </div>)}
              </div>)}

            {/* Profile Status Card - Show when profile is 100% complete or has a status */}
            {(completionPercent() === 100 || profileData()?.profileStatus) && (<div class={`profile-status-card status-${profileData()?.profileStatus || 'ready'}`}>
                {profileData()?.profileStatus === 'pending_review' && (<>
                    <div class="status-icon pending">
                      <TutorIcon name="fi-sr-time-half-past"/>
                    </div>
                    <div class="status-content">
                      <h3>Profile Under Review</h3>
                      <p>Your profile has been submitted and is awaiting admin review. You'll be notified once it's approved.</p>
                      {profileData().profileItemStatuses && (<div class="review-progress">
                          <div class="progress-label">
                            Review Progress: {Object.values(profileData().profileItemStatuses).filter(s => s?.status === 'approved').length}/5 items approved
                          </div>
                          <div class="progress-bar-container">
                            <div class="progress-bar-fill" style={cssStyle({ get width() {
                                return `${(Object.values(profileData().profileItemStatuses).filter(s => s?.status === 'approved').length / 5) * 100}%`;
                            } })}/>
                          </div>
                        </div>)}
                      {profileData().profileSubmittedAt && (<span class="status-date">
                          Submitted on {new Date(profileData().profileSubmittedAt).toLocaleDateString()}
                        </span>)}
                    </div>
                  </>)}
                {profileData()?.profileStatus === 'approved' && (<>
                    <div class="status-icon approved">
                      <TutorIcon name="fi-sr-check"/>
                    </div>
                    <div class="status-content">
                      <h3>Profile Approved</h3>
                      <p>Your profile has been reviewed and approved! Students can now find and book sessions with you.</p>
                      
                      {/* Show pending changes if any */}
                      {profileData().hasPendingChanges && profileData().pendingProfileChanges && profileData().pendingProfileChanges.length > 0 && (<div class="pending-changes-notice">
                          <div class="pending-changes-header">
                            <TutorIcon name="fi-sr-time-half-past"/>
                            <span>Pending Updates ({profileData().pendingProfileChanges.length})</span>
                          </div>
                          <p class="pending-changes-desc">
                            You have changes awaiting admin review. Your current approved profile remains visible to students until changes are approved.
                          </p>
                          <div class="pending-changes-list">
                            {profileData().pendingProfileChanges.map((change, idx) => {
                            const itemLabels: Record<string, string> = {
                                'bio': 'Bio',
                                'profilePicture': 'Profile Photo',
                                'videoIntro': 'Introduction Video',
                                'education': 'Education',
                                'interests': 'Interests'
                            };
                            return (<div class="pending-change-item">
                                  <span class="change-label">{itemLabels[change.itemKey] || change.itemKey}</span>
                                  <span class="change-status pending">
                                    <TutorIcon name="fi-sr-clock"/> Pending Review
                                  </span>
                                </div>);
                        })}
                          </div>
                        </div>)}
                    </div>
                  </>)}
                {profileData()?.profileStatus === 'rejected' && (<>
                    <div class="status-icon rejected">
                      <TutorIcon name="fi-sr-cross-circle"/>
                    </div>
                    <div class="status-content">
                      <h3>Profile Needs Revision</h3>
                      <p>Some items in your profile were not approved. Please review the feedback below and make the necessary changes.</p>
                      
                      {/* Show item-level feedback */}
                      {profileData().profileItemStatuses && (<div class="rejection-feedback">
                          {profileData().profileItemStatuses.profilePicture?.status === 'rejected' && (<div class="feedback-item">
                              <span class="feedback-label"><TutorIcon name="fi-sr-picture"/> Profile Photo:</span>
                              <span class="feedback-reason">{profileData().profileItemStatuses.profilePicture.rejectionReason || 'Needs improvement'}</span>
                            </div>)}
                          {profileData().profileItemStatuses.bio?.status === 'rejected' && (<div class="feedback-item">
                              <span class="feedback-label"><TutorIcon name="fi-sr-document"/> Bio:</span>
                              <span class="feedback-reason">{profileData().profileItemStatuses.bio.rejectionReason || 'Needs improvement'}</span>
                            </div>)}
                          {profileData().profileItemStatuses.education?.status === 'rejected' && (<div class="feedback-item">
                              <span class="feedback-label"><TutorIcon name="fi-sr-graduation-cap"/> Education:</span>
                              <span class="feedback-reason">{profileData().profileItemStatuses.education.rejectionReason || 'Needs improvement'}</span>
                            </div>)}
                          {profileData().profileItemStatuses.interests?.status === 'rejected' && (<div class="feedback-item">
                              <span class="feedback-label"><TutorIcon name="fi-sr-heart"/> Interests:</span>
                              <span class="feedback-reason">{profileData().profileItemStatuses.interests.rejectionReason || 'Needs improvement'}</span>
                            </div>)}
                          {profileData().profileItemStatuses.videoIntro?.status === 'rejected' && (<div class="feedback-item">
                              <span class="feedback-label"><TutorIcon name="fi-sr-play-circle"/> Video Intro:</span>
                              <span class="feedback-reason">{profileData().profileItemStatuses.videoIntro.rejectionReason || 'Needs improvement'}</span>
                            </div>)}
                        </div>)}
                      
                      {/* Show approved items */}
                      {profileData().profileItemStatuses && Object.values(profileData().profileItemStatuses).some(s => s?.status === 'approved') && (<div class="approved-items">
                          <span class="approved-label">Approved items:</span>
                          <div class="approved-badges">
                            {profileData().profileItemStatuses.profilePicture?.status === 'approved' && (<span class="approved-badge"><TutorIcon name="fi-sr-check"/> Photo</span>)}
                            {profileData().profileItemStatuses.bio?.status === 'approved' && (<span class="approved-badge"><TutorIcon name="fi-sr-check"/> Bio</span>)}
                            {profileData().profileItemStatuses.education?.status === 'approved' && (<span class="approved-badge"><TutorIcon name="fi-sr-check"/> Education</span>)}
                            {profileData().profileItemStatuses.interests?.status === 'approved' && (<span class="approved-badge"><TutorIcon name="fi-sr-check"/> Interests</span>)}
                            {profileData().profileItemStatuses.videoIntro?.status === 'approved' && (<span class="approved-badge"><TutorIcon name="fi-sr-check"/> Video</span>)}
                          </div>
                        </div>)}
                      
                      <button class="btn-submit-profile" onClick={handleSubmitForReview} disabled={submittingProfile() || completionPercent() < 100}>
                        {submittingProfile() ? 'Submitting...' : 'Resubmit for Review'}
                      </button>
                    </div>
                  </>)}
                {(!profileData()?.profileStatus || profileData().profileStatus === 'incomplete') && completionPercent() === 100 && (<>
                    <div class="status-icon ready">
                      <TutorIcon name="fi-sr-rocket-lunch"/>
                    </div>
                    <div class="status-content">
                      <h3>Profile Complete!</h3>
                      <p>Your profile is 100% complete. Submit it for review to start teaching on FluentXVerse.</p>
                      <button class="btn-submit-profile" onClick={handleSubmitForReview} disabled={submittingProfile()}>
                        {submittingProfile() ? (<>
                            <span class="btn-spinner"></span>
                            Submitting...
                          </>) : (<>
                            <TutorIcon name="fi-sr-paper-plane"/>
                            Submit for Review
                          </>)}
                      </button>
                    </div>
                  </>)}
              </div>)}

            {/* Tabs Navigation */}
            <div class="profile-tabs">
              <button class={`tab-btn ${activeTab() === 'about' ? 'active' : ''}`} onClick={() => setActiveTab('about')}>
                <TutorIcon name="fi-sr-user"/>
                About
              </button>
              <button class={`tab-btn ${activeTab() === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>
                <TutorIcon name="fi-sr-chart-histogram"/>
                Stats
              </button>
              <button class={`tab-btn ${activeTab() === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
                <TutorIcon name="fi-sr-settings"/>
                Settings
              </button>
            </div>

            {/* Tab Content */}
            <div class="profile-content">
              {activeTab() === 'about' && (<div class="tab-content">
                  {/* About Me */}
                  <section class="profile-tab-section">
                    <h2 class="profile-tab-title">
                      <TutorArt name="community" size={32}/>
                      About Me
                    </h2>
                    <div class="profile-tab-body">
                      <p>{profileData()?.introduction || profileData()?.bio || 'Tell students about yourself, your teaching philosophy, and what makes your lessons unique.'}</p>
                    </div>
                  </section>

                  {/* Education */}
                  {(personalInfo()?.schoolAttended || (profileData()?.education && profileData().education.length > 0)) && (<section class="profile-tab-section">
                      <h2 class="profile-tab-title">
                        <TutorArt name="training" size={32}/>
                        Education
                      </h2>
                      <div class="profile-tab-body">
                        <div class="education-info">
                          {personalInfo()?.schoolAttended ? (<>
                              <div class="education-row">
                                <TutorIcon name="fi-sr-school"/>
                                <span class="education-label">University:</span>
                                <strong>{personalInfo().schoolAttended}</strong>
                              </div>
                              {personalInfo().major && (<div class="education-row">
                                  <TutorIcon name="fi-sr-diploma"/>
                                  <span class="education-label">Degree:</span>
                                  <strong>{personalInfo().major}</strong>
                                </div>)}
                            </>) : (profileData()?.education?.map((edu, idx) => (<div class="education-row">
                                <div class="education-details">
                                  <TutorIcon name="fi-sr-school"/>
                                  <strong>{edu}</strong>
                                </div>
                              </div>)))}
                        </div>
                      </div>
                    </section>)}

                  {/* Interests */}
                  <section class="profile-tab-section">
                    <div class="profile-tab-title-row">
                      <h2 class="profile-tab-title">
                        <TutorArt name="community" size={32}/>
                        Interests
                      </h2>
                      <button class="btn-edit-inline" onClick={() => startEditing('interests', profileData()?.interests?.join(', ') || '')}>
                        <TutorIcon name="fas fa-pencil-alt"/>
                      </button>
                    </div>
                    <div class="profile-tab-body">
                      {profileData()?.interests && profileData().interests.length > 0 ? (<div class="interests-grid">
                          {profileData().interests.map((interest, idx) => (<div class="interest-tag">
                              <TutorIcon name="fi-sr-star"/>
                              <span>{interest}</span>
                            </div>))}
                        </div>) : (<p class="empty-state">Share your hobbies and interests to help students connect with you.</p>)}
                    </div>
                  </section>

                  {/* Areas of Expertise */}
                  {profileData()?.specializations && profileData().specializations.length > 0 && (<section class="profile-tab-section">
                      <h2 class="profile-tab-title">
                        <TutorArt name="community" size={32}/>
                        Areas of Expertise
                      </h2>
                      <div class="profile-tab-body">
                        <div class="specializations-grid">
                          {profileData().specializations.map((spec, idx) => (<div class="specialization-card">
                              <TutorIcon name="fi-sr-check"/>
                              <span>{spec}</span>
                            </div>))}
                        </div>
                      </div>
                    </section>)}
                </div>)}

              {activeTab() === 'stats' && (<div class="tab-content">
                  <section class="profile-tab-section">
                    <h2 class="profile-tab-title">
                      <TutorArt name="growth" size={32}/>
                      Your Performance
                    </h2>
                    {performanceError() && <p role="alert">{performanceError()}</p>}
                    <div class="stats-grid">
                      <a href="/performance-metrics?period=all#lessons" class="profile-stat-card profile-stat-card-clickable">
                        <div class="profile-stat-card-icon">
                          <TutorIcon name="fi-sr-book-alt"/>
                        </div>
                        <div class="profile-stat-card-value">{performance()?.lessons.total ?? '-'}</div>
                        <div class="profile-stat-card-label">Booked Lessons</div>
                      </a>
                      <a href="/performance-metrics?period=all#rating" class="profile-stat-card profile-stat-card-clickable">
                        <div class="profile-stat-card-icon">
                          <TutorIcon name="fi-sr-star"/>
                        </div>
                        <div class="profile-stat-card-value">{performance()?.rating.average?.toFixed(1) ?? '-'}</div>
                        <div class="profile-stat-card-label">Average Rating</div>
                      </a>
                      <a href="/performance-metrics?period=all#rating" class="profile-stat-card profile-stat-card-clickable">
                        <div class="profile-stat-card-icon">
                          <TutorIcon name="fi-sr-comment"/>
                        </div>
                        <div class="profile-stat-card-value">{performance()?.rating.totalReviews ?? '-'}</div>
                        <div class="profile-stat-card-label">Total Reviews</div>
                      </a>
                      <a href="/performance-metrics?period=all#reliability" class="profile-stat-card profile-stat-card-clickable">
                        <div class="profile-stat-card-icon">
                          <TutorIcon name="fi-sr-shield-check"/>
                        </div>
                        <div class="profile-stat-card-value">{performance() ? performance().reliability.score === null ? 'No data' : `${performance().reliability.score}%` : '-'}</div>
                        <div class="profile-stat-card-label">Reliability</div>
                      </a>
                    </div>
                  </section>
                </div>)}

              {activeTab() === 'settings' && (<div class="tab-content">
                  <section class="profile-tab-section">
                    <h2 class="profile-tab-title">
                      <TutorArt name="community" size={32}/>
                      Quick Settings
                    </h2>
                    <div class="profile-settings-links">
                      <a href="/schedule" class="profile-settings-link">
                        <TutorIcon name="fi-sr-calendar"/>
                        <div class="profile-settings-link-content">
                          <span class="profile-settings-link-title">Manage Availability</span>
                          <span class="profile-settings-link-desc">Set your teaching hours</span>
                        </div>
                        <TutorIcon name="fi-sr-angle-small-right"/>
                      </a>
                      <a href="/performance-metrics" class="profile-settings-link">
                        <TutorIcon name="fas fa-wallet"/>
                        <div class="profile-settings-link-content">
                          <span class="profile-settings-link-title">Performance Metrics</span>
                          <span class="profile-settings-link-desc">Lessons, attendance, and feedback</span>
                        </div>
                        <TutorIcon name="fi-sr-angle-small-right"/>
                      </a>
                      <button class="profile-settings-link" onClick={() => setSettingsOpen(true)}>
                        <TutorIcon name="fas fa-user-cog"/>
                        <div class="profile-settings-link-content">
                          <span class="profile-settings-link-title">Account Settings</span>
                          <span class="profile-settings-link-desc">Email, password, and preferences</span>
                        </div>
                        <TutorIcon name="fi-sr-angle-small-right"/>
                      </button>
                    </div>
                  </section>
                </div>)}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingField() && (<TutorDialog label="Edit profile" className="tutor-profile-edit-dialog" onClose={cancelEditing} busy={saving()}>
          <div class="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div class="edit-modal-header">
              <h3>Edit {editingField().replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h3>
              <button class="edit-modal-close" aria-label="Close profile editor" disabled={saving()} onClick={cancelEditing}>
                <TutorIcon name="fas fa-times"/>
              </button>
            </div>
            <div class="edit-modal-body">
              {editingField() === 'bio' || editingField() === 'introduction' || editingField() === 'teachingStyle' ? (<textarea value={editValue()} onInput={(e) => setEditValue((e.target as HTMLTextAreaElement).value)} placeholder={`Enter your ${editingField().replace(/([A-Z])/g, ' $1').toLowerCase()}...`} rows={5}/>) : editingField() === 'interests' ? (<div class="interests-editor">
                  <div class="interests-chips">
                    {interestChips().map((interest, idx) => (<div class="interest-chip">
                        <span>{interest}</span>
                        <button type="button" class="chip-remove" onClick={() => removeInterest(idx)} aria-label={`Remove ${interest}`}>
                          <TutorIcon name="fas fa-times"/>
                        </button>
                      </div>))}
                  </div>
                  {interestChips().length < 5 && (<div class="interest-input-row">
                      <input type="text" value={newInterest()} onInput={(e) => setNewInterest((e.target as HTMLInputElement).value)} onKeyDown={handleInterestKeyDown} placeholder="Type an interest and press Enter..." maxLength={30}/>
                      <button type="button" class="btn-add-interest" onClick={addInterest} disabled={!newInterest().trim()}>
                        <TutorIcon name="fas fa-plus"/>
                        Add
                      </button>
                    </div>)}
                  <p class="input-hint">
                    {interestChips().length}/5 interests added. {interestChips().length < 5 ? 'Press Enter or click Add to add more.' : 'Maximum reached.'}
                  </p>
                </div>) : (<input type="text" value={editValue()} onInput={(e) => setEditValue((e.target as HTMLInputElement).value)} placeholder={`Enter ${editingField().replace(/([A-Z])/g, ' $1').toLowerCase()}...`}/>)}
            </div>
            <div class="edit-modal-footer">
              <button class="btn-cancel" disabled={saving()} onClick={cancelEditing}>Cancel</button>
              <button class="btn-save" onClick={saveField} disabled={saving()}>
                {saving() ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </TutorDialog>)}

      {/* Image Cropper Modal */}
      {cropperImage() && (<ImageCropper imageSrc={cropperImage()} onCropComplete={handleCropComplete} onCancel={handleCropCancel}/>)}

      {/* Settings Modal for editing personal info */}
      <SettingsModal isOpen={settingsOpen()} onClose={handleSettingsClose}/>
    </>);
    }) as unknown as JSX.Element;
};
export default MyProfilePage;
