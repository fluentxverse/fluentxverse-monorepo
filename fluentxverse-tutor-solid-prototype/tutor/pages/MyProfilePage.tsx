import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorDialog from "../Components/Common/TutorDialog";
import TutorIcon from "../Components/Common/TutorIcon";
import TutorArt from "../Components/Common/TutorArt";
import { useAuthContext } from '../context/AuthContext';
import type { TutorProfileData } from '../types/tutorProfile.types';
import { tutorProfileCache } from '../utils/tutorProfileCache';
import StatusPanel from '../../../shared/ui/StatusPanel';
import { client } from '../api/utils';
import { getTutorPerformance, type TutorPerformance } from '../api/performance.api';
import SideBar from '../Components/IndexOne/SideBar';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import SettingsModal from '../Components/Settings/SettingsModal';
import ImageCropper from '../Components/Common/ImageCropper';
import VideoPlayer from '../Components/Common/VideoPlayer';
import QualificationsFields, { emptyQualifications, type Qualifications } from '../Components/Common/QualificationsFields';
import ProfileAvatar from '../Components/Common/ProfileAvatar';
import { mediaUrl } from '../utils/mediaUrl';
import { checkIntroVideo } from '../utils/introVideo';
import { validateProfilePhoto } from '../utils/profilePhoto';
import ProfileGuidelines from '../Components/Common/ProfileGuidelines';
import ProfileMediaUploadDialog from '../Components/Common/ProfileMediaUploadDialog';
import { tutorPublicName, validateTutorNickname } from '../../../shared/tutorPublicName';
import { Pencil } from 'lucide-solid';
import { isAxiosError } from 'axios';
import { getErrorMessage } from '../utils/errorUtils';
import { validateProfileInterests } from '../../../shared/profileGuidelines';
import { toast, toastConfirm } from '../Components/Common/Toast';
import './MyProfilePage.css';
import { proofApi } from '../api/proof.api';
import { hasTeachingAccess } from '../utils/teachingAccess';
import { useLocation } from '../routing';
const profileErrorMessage = (error: unknown): string => {
    if (isAxiosError(error)) {
        const message = error.response?.data?.error || error.response?.data?.message;
        if (error.response && error.response.status < 500 && typeof message === 'string') return message;
        return getErrorMessage(error);
    }
    return error instanceof Error ? error.message : 'Could not save changes. Please try again.';
};
export const MyProfilePage = () => {
    const _state0 = useAuthContext();
    const location = useLocation();
    const applicationProfile = createMemo(() => location.path === '/application/profile');
    const [checkingStatsAccess, setCheckingStatsAccess] = createSignal(false);
    let statsAccessRequest = 0;
    onCleanup(() => { statsAccessRequest++; });
    const openStats = async () => {
        const id = _state0.user?.userId, request = ++statsAccessRequest;
        setCheckingStatsAccess(true);
        try {
            const result = await proofApi.getTutorCertificationStatus();
            if (request !== statsAccessRequest || _state0.user?.userId !== id) return;
            if (hasTeachingAccess(result)) setActiveTab('stats');
            else location.route('/home?certification=required');
        } catch {
            if (request === statsAccessRequest) toast.error('Could not verify certification. Please try again.');
        } finally { if (request === statsAccessRequest) setCheckingStatsAccess(false); }
    };
    const initialProfile = _state0.user?.userId ? tutorProfileCache.read(_state0.user.userId) : null;
    const [profileData, setProfileData] = createSignal<TutorProfileData | null>(initialProfile);
    const [loading, setLoading] = createSignal(!initialProfile);
    const [loadError, setLoadError] = createSignal('');
    let profileRequest = 0;
    let profileController: AbortController | undefined;
    onCleanup(() => { profileRequest++; profileController?.abort(); });
    const [activeTab, setActiveTab] = createSignal<'about' | 'stats' | 'settings'>('about');
    const [performance, setPerformance] = createSignal<TutorPerformance | null>(null);
    const [performanceError, setPerformanceError] = createSignal('');
    createEffect(on(() => [activeTab()], () => {
        const _cleanup1 = untrack(() => {
            if (activeTab() !== 'stats' || performance())
                return;
            const controller = new AbortController();
            getTutorPerformance('all', undefined, 1, controller.signal).then(data => { if (!controller.signal.aborted) { setPerformance(data); setPerformanceError(''); } })
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
    const [editError, setEditError] = createSignal('');
    const [photoError, setPhotoError] = createSignal('');
    const [videoError, setVideoError] = createSignal('');
    const [educationValues, setEducationValues] = createSignal<Qualifications>(emptyQualifications());
    const profileApproved = () => profileData()?.profileStatus === 'approved';
    const [interestChips, setInterestChips] = createSignal<string[]>([]);
    const [newInterest, setNewInterest] = createSignal<string>('');
    const [settingsOpen, setSettingsOpen] = createSignal(false);
    createEffect(() => {
        if (!profileApproved()) {
            if (activeTab() === 'settings') setActiveTab('about');
            setSettingsOpen(false);
        }
    });
    const [saving, setSaving] = createSignal(false);
    const [cropperImage, setCropperImage] = createSignal<string | null>(null);
    const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
    const [avatarUrl, setAvatarUrl] = createSignal<string | null>(null);
    const [videoUploading, setVideoUploading] = createSignal(false);
    const [mediaUpload, setMediaUpload] = createSignal<'photo' | 'video' | null>(null);
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
    createEffect(on(() => _state0.user?.userId, () => {
        const _cleanup3 = untrack(() => {
            document.title = applicationProfile() ? 'Application Profile | FluentXVerse' : 'My Profile | FluentXVerse';
            const cached = _state0.user?.userId ? tutorProfileCache.read(_state0.user.userId) : null;
            setProfileData(cached); setAvatarUrl(cached?.profilePicture || null); setLoadError(''); setActiveTab('about'); setPerformance(null); setPerformanceError('');
            loadProfile();
            return () => { profileRequest++; profileController?.abort(); };
        });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    const loadProfile = async (force = false) => {
        const userId = _state0.user?.userId;
        if (!userId) return;
        const cached = !force && tutorProfileCache.read(userId);
        if (cached) { setProfileData(cached); setAvatarUrl(cached.profilePicture || null); setLoading(false); return; }
        const request = ++profileRequest;
        profileController?.abort();
        const controller = profileController = new AbortController();
        const revision = tutorProfileCache.revision;
        try {
            setLoading(!profileData()); setLoadError('');
            const response = await client.get('/tutor/profile', { signal: controller.signal });
            if (request !== profileRequest || controller.signal.aborted || _state0.user?.userId !== userId) return;
            if (!response.data.success || !response.data.data || typeof response.data.data !== 'object' || Array.isArray(response.data.data)) throw new Error('Profile unavailable');
            const data = response.data.data as TutorProfileData;
            if (data.userId && data.userId !== userId) throw new Error('Profile account mismatch');
            if (!tutorProfileCache.write(userId, data, revision)) return;
            setProfileData(data);
            setAvatarUrl(data.profilePicture || null);
        }
        catch (error) {
            if (request === profileRequest && !controller.signal.aborted) setLoadError('Could not load your profile');
        }
        finally {
            if (request === profileRequest) setLoading(false);
        }
    };
    const handleSettingsClose = () => {
        setSettingsOpen(false);
        // Unchanged settings reuse memory; successful writes invalidate it in the client.
        loadProfile();
    };
    const handleAvatarClick = () => {
        setPhotoError('');
        setMediaUpload('photo');
    };
    const handleFileChange = async (e: Event) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file)
            return;
        setPhotoError('');
        try { await validateProfilePhoto(file); } catch (error) { setPhotoError(profileErrorMessage(error)); target.value = ''; return; }
        setMediaUpload(null);
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
            await validateProfilePhoto(croppedBlob);
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
            setPhotoError(profileErrorMessage(error));
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
        setVideoError('');
        if (!file.type.startsWith('video/')) {
            setVideoError('Please select a video file.');
            target.value = '';
            return;
        }
        if (file.size > 100 * 1024 * 1024) {
            setVideoError('Video must be less than 100MB.');
            target.value = '';
            return;
        }
        setVideoUploading(true);
        try {
            await checkIntroVideo(file);
            const formData = new FormData();
            formData.append('file', file);
            const response = await client.post('/tutor/intro-video', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            if (response.data.success) {
                setMediaUpload(null);
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
            setVideoError(profileErrorMessage(error));
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
        setEditError('');
        setEditingField(field);
        setEditValue(currentValue || '');
        if (field === 'education') {
            const profile = profileData();
            setEducationValues({ schoolAttended: profile?.schoolAttended || '', major: profile?.major || '', educationalAttainment: profile?.educationalAttainment || '', teachingExperience: profile?.teachingExperience || '', teachingQualifications: profile?.teachingQualifications || [] });
        }
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
        try { validateProfileInterests([...interestChips(), trimmed]); } catch (error) { setEditError(profileErrorMessage(error)); return; }
        setEditError('');
        if (trimmed && interestChips().length < 5 && !interestChips().some(interest => interest.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
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
        if (!editingField() || saving())
            return;
        setSaving(true);
        setEditError('');
        try {
            // Handle interests field - use interestChips array
            let valueToSend: string | string[] = editValue();
            if (editingField() === 'interests') {
                valueToSend = validateProfileInterests(newInterest().trim() ? [...interestChips(), newInterest().trim()] : interestChips());
            }
            if (editingField() === 'nickname') valueToSend = validateTutorNickname(editValue());
            const updates = editingField() === 'education'
                ? { ...educationValues(), schoolAttended: educationValues().schoolAttended.trim(), major: educationValues().major.trim() }
                : { [editingField()]: valueToSend };
            if (editingField() === 'education' && (!educationValues().schoolAttended.trim() || !educationValues().major.trim())) {
                throw new Error('Enter your school and degree or field of study.');
            }
            const response = await client.patch('/tutor/profile', updates);
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
                            return { ...prev, ...updates };
                        }
                        // Create a minimal profile data object if none exists
                        return {
                            firstName: _state0.user?.firstName || '',
                            lastName: _state0.user?.lastName || '',
                            email: _state0.user?.email || '',
                            ...updates
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
            setEditError(profileErrorMessage(error));
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
        if (!profileData() && loadError()) return <><SideBar/><div class="main-content"><DashboardHeader/><div class="my-profile-loading"><StatusPanel kind="error" title={loadError()} onRetry={() => void loadProfile(true)}/></div></div></>;
        const displayName = createMemo(() => tutorPublicName(profileData() || _state0.user || {}));
        const initials = createMemo(() => displayName().split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase());
        // Use avatarUrl state first, then fallback to profileData or user
        const currentAvatar = createMemo(() => avatarUrl() || profileData()?.profilePicture || _state0.user?.profilePicture);
        // Calculate profile completeness
        const profileFields = createMemo(() => [
            { name: 'Preferred nickname', complete: !!profileData()?.nickname },
            { name: 'Bio', complete: !!(profileData()?.bio && profileData().bio.length > 10) },
            { name: 'Profile Picture', complete: !!currentAvatar() },
            { name: 'Introduction Video', complete: !!profileData()?.videoIntroUrl },
            { name: 'Education', complete: !!((profileData()?.schoolAttended && profileData()?.major) || (profileData()?.education && profileData().education.length > 0)) },
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
            {loadError() && <StatusPanel compact kind="error" title={loadError()} onRetry={() => void loadProfile(true)}/>}
            {applicationProfile() && !profileApproved() && <aside class="profile-guidelines-reminder" aria-label="Profile guidelines reminder">
              <TutorArt name="interviewGuide" size={36}/>
              <div>
                <h2>Before you submit your profile</h2>
                <p>Review the guidelines for your nickname, bio, profile photo, introduction video, and interests. Make sure each section meets the requirements before submitting your profile for review.</p>
              </div>
            </aside>}
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
                      <input ref={element => fileInputRef.current = element} type="file" accept="image/jpeg,.jpg,.jpeg" onChange={handleFileChange} style={cssStyle({ display: 'none' })}/>
                      <button type="button" class="avatar-btn" title="Upload new avatar" onClick={handleAvatarClick} disabled={uploading()}>
                        {uploading() ? 'Uploading...' : 'Upload'}
                      </button>
                      <button type="button" class="avatar-btn secondary" disabled={!currentAvatar()} onClick={viewAvatar}>
                        View
                      </button>
                    </div>
                  </div>
                  {photoError() && <p role="alert" class="profile-field-error">{photoError()}</p>}
                </div>

                {/* Right: Details */}
                <div class="profile-header-right">
                  <div class="profile-nickname-heading">
                    <h1 class="profile-name">{displayName()}</h1>
                    <button type="button" class="btn-edit-name" aria-label="Edit preferred nickname" title="Edit preferred nickname" onClick={() => startEditing('nickname', profileData()?.nickname || '')}><Pencil size={17}/></button>
                  </div>
                  <div class="profile-nickname-note">{profileData()?.nickname ? 'Public nickname' : 'Preferred nickname required'}</div>
                  {profileData()?.profileItemStatuses?.nickname?.status === 'rejected' && <p role="status" class="profile-nickname-feedback">Nickname needs revision: {profileData()?.profileItemStatuses?.nickname?.rejectionReason || 'Choose a clear, professional nickname.'}</p>}

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
                  <TutorArt name="video" size={28}/>
                  Introduction Video
                </h3>
                {videoError() && <p role="alert" class="profile-field-error">{videoError()}</p>}
                {profileData()?.videoIntroUrl ? (<div class="hero-video-container">
                    <VideoPlayer src={mediaUrl(profileData().videoIntroUrl)!} hideBigPlayButton={true}/>
                    <div class="video-replace-overlay">
                      <input type="file" accept="video/*" onChange={handleVideoUpload} style={cssStyle({ display: 'none' })} ref={_element => videoInputRef.current = _element}/>
                      <button type="button" class="video-replace-btn" onClick={() => { setVideoError(''); setMediaUpload('video'); }} disabled={videoUploading()}>
                        <TutorIcon name="fi-sr-refresh"/>
                        <span>{videoUploading() ? 'Uploading...' : 'Replace Video'}</span>
                      </button>
                    </div>
                  </div>) : (<div class="hero-video-placeholder">
                    <div class="video-placeholder-content">
                      <TutorIcon name="fi-sr-video-plus"/>
                      <span>Add intro video</span>
                    </div>
                    <div>
                      <input type="file" accept="video/*" onChange={handleVideoUpload} style={cssStyle({ display: 'none' })} ref={_element => videoInputRef.current = _element}/>
                    <button type="button" class="btn-video-action" onClick={() => { setVideoError(''); setMediaUpload('video'); }} disabled={videoUploading()}>
                      <TutorIcon name="fi-sr-plus"/>
                      {videoUploading() ? 'Uploading...' : 'Upload Video'}
                    </button>
                    </div>
                  </div>)}
              </div>
            </div>

            {/* Profile Completeness Indicator */}
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
                      {incompleteFields().map((field, idx) => (field.name === 'Education' || field.name === 'Preferred nickname' ? <button type="button" class="missing-item" onClick={() => startEditing(field.name === 'Education' ? 'education' : 'nickname', '')}>
                          <TutorIcon name="fi-sr-plus-small"/> {field.name}
                        </button> : <span class="missing-item">
                          <TutorIcon name="fi-sr-plus-small"/>
                          {field.name}
                        </span>))}
                    </div>
                  </div>)}
              </div>)}

            {/* Profile Status Card - Show when profile is 100% complete or has a status */}
            {(profileData()?.profileStatus === 'pending_review' || profileData()?.profileStatus === 'rejected' || (profileApproved() ? profileData()?.hasPendingChanges : completionPercent() === 100)) && (<div class={`profile-status-card status-${profileData()?.profileStatus || 'ready'}`}>
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
                    <div class="status-content">
                      
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
                                'nickname': 'Preferred nickname',
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
              {!applicationProfile() && <button class={`tab-btn ${activeTab() === 'stats' ? 'active' : ''}`} onClick={openStats} disabled={checkingStatsAccess()} aria-busy={checkingStatsAccess()}>
                <TutorIcon name="fi-sr-chart-histogram"/>
                Stats
              </button>}
              {profileApproved() && <button class={`tab-btn ${activeTab() === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
                <TutorIcon name="fi-sr-settings"/>
                Settings
              </button>}
            </div>

            {/* Tab Content */}
            <div class="profile-content">
              {activeTab() === 'about' && (<div class="tab-content">
                  {/* About Me */}
                  <section class="profile-tab-section">
                    <h2 class="profile-tab-title">
                      <TutorArt name="profile" size={32}/>
                      About Me
                    </h2>
                    <div class="profile-tab-body">
                      <p>{profileData()?.introduction || profileData()?.bio || 'Tell students about yourself, your teaching philosophy, and what makes your lessons unique.'}</p>
                    </div>
                  </section>

                  {/* Education */}
                  <section class="profile-tab-section profile-education-section">
                    <div class="profile-tab-title-row">
                      <h2 class="profile-tab-title">
                        <TutorArt name="training" size={32}/>
                        Education
                      </h2>
                      <button type="button" class="btn-edit-inline" aria-label="Edit education" title="Edit education" onClick={() => startEditing('education', '')}>
                        <TutorIcon name="fas fa-pencil-alt"/>
                      </button>
                    </div>
                      <div class="profile-tab-body">
                        <div class="education-info">
                          {profileData()?.schoolAttended || profileData()?.major ? (<>
                              <div class="education-row">
                                <TutorIcon name="fi-sr-school"/>
                                <span class="education-label">University:</span>
                                <strong>{profileData().schoolAttended}</strong>
                              </div>
                              {profileData().major && (<div class="education-row">
                                  <TutorIcon name="fi-sr-diploma"/>
                                  <span class="education-label">Degree:</span>
                                  <strong>{profileData().major}</strong>
                                </div>)}
                            </>) : profileData()?.education?.length ? (profileData()?.education?.map((edu, idx) => (<div class="education-row">
                                <div class="education-details">
                                  <TutorIcon name="fi-sr-school"/>
                                  <strong>{edu}</strong>
                                </div>
                              </div>))) : <p class="education-empty">Add your school and degree or field of study.</p>}
                          {profileData()?.educationalAttainment && <div class="education-row"><span class="education-label">Educational attainment:</span><strong>{profileData().educationalAttainment}</strong></div>}
                          <div class="education-row"><span class="education-label">Teaching experience:</span><strong>{profileData()?.teachingExperience || 'Not added yet'}</strong></div>
                          {!!profileData()?.teachingQualifications?.length && <div class="education-row"><span class="education-label">Teaching qualifications:</span><strong>{profileData().teachingQualifications.join(', ')}</strong></div>}
                        </div>
                      </div>
                    </section>

                  {/* Interests */}
                  <section class="profile-tab-section">
                    <div class="profile-tab-title-row">
                      <h2 class="profile-tab-title">
                        <TutorArt name="interests" size={32}/>
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
                        <TutorArt name="certificate" size={32}/>
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

              {profileApproved() && activeTab() === 'settings' && (<div class="tab-content">
                  <section class="profile-tab-section">
                    <h2 class="profile-tab-title">
                      <TutorIcon name="fi-sr-settings"/>
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
              <h3>{editingField() === 'nickname' ? 'Edit preferred nickname' : `Edit ${editingField().replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}`}</h3>
              <button class="edit-modal-close" aria-label="Close profile editor" disabled={saving()} onClick={cancelEditing}>
                <TutorIcon name="fas fa-times"/>
              </button>
            </div>
            <div class="edit-modal-body" hidden={editingField() === 'education'}>
              {editingField() === 'nickname' && <>
                <label for="preferred-nickname">Preferred nickname</label>
              </>}
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
                </div>) : (<input id={editingField() === 'nickname' ? 'preferred-nickname' : undefined} type="text" maxLength={editingField() === 'nickname' ? 24 : undefined} autocomplete={editingField() === 'nickname' ? 'nickname' : 'off'} value={editValue()} onInput={(e) => setEditValue((e.target as HTMLInputElement).value)} placeholder={editingField() === 'nickname' ? 'e.g. Alex or Mary Ann' : `Enter ${editingField().replace(/([A-Z])/g, ' $1').toLowerCase()}...`}/>)}
              {editingField() === 'nickname' && <ProfileGuidelines kind="nickname"/>}
              {editingField() === 'bio' && <ProfileGuidelines kind="bio" expanded/>}
              {editingField() === 'interests' && <ProfileGuidelines kind="interests"/>}
            </div>
            {editingField() === 'education' && <div class="edit-modal-body education-editor">
              <QualificationsFields id="profile-qualifications" value={educationValues()} onChange={setEducationValues}/>
            </div>}
            <div class="edit-modal-footer">
              {editError() && <p id="profile-edit-error" role="alert" class="profile-field-error">{editError()}</p>}
              <button class="btn-cancel" disabled={saving()} onClick={cancelEditing}>Cancel</button>
              <button class="btn-save" onClick={saveField} disabled={saving()}>
                {saving() ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </TutorDialog>)}

      {/* Image Cropper Modal */}
      {mediaUpload() && <ProfileMediaUploadDialog kind={mediaUpload()!} busy={mediaUpload() === 'video' ? videoUploading() : uploading()} error={mediaUpload() === 'photo' ? photoError() : videoError()} onClose={() => setMediaUpload(null)} onChoose={() => (mediaUpload() === 'photo' ? fileInputRef.current : videoInputRef.current)?.click()}/>}
      {cropperImage() && (<ImageCropper imageSrc={cropperImage()} onCropComplete={handleCropComplete} onCancel={handleCropCancel}/>)}

      {/* Settings Modal for editing personal info */}
      <SettingsModal isOpen={settingsOpen()} onClose={handleSettingsClose}/>
    </>);
    }) as unknown as JSX.Element;
};
export default MyProfilePage;
