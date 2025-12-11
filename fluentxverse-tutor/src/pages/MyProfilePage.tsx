import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { useAuthContext } from '../context/AuthContext';
import { getPersonalInfo, PersonalInfoData } from '../api/auth.api';
import { client } from '../api/utils';
import SideBar from '../Components/IndexOne/SideBar';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import SettingsModal from '../Components/Settings/SettingsModal';
import ImageCropper from '../Components/Common/ImageCropper';
import VideoPlayer from '../Components/Common/VideoPlayer';
import './MyProfilePage.css';

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
}

export const MyProfilePage = () => {
  const { user } = useAuthContext();
  const [profileData, setProfileData] = useState<TutorProfileData | null>(null);
  const [personalInfo, setPersonalInfo] = useState<PersonalInfoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'about' | 'stats' | 'settings'>('about');
  const [uploading, setUploading] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cropperImage, setCropperImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'My Profile | FluentXVerse';
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      
      // Load tutor's own profile data (bio, introduction, etc.)
      try {
        const profileResponse = await client.get('/tutor/profile');
        if (profileResponse.data.success && profileResponse.data.data) {
          setProfileData(profileResponse.data.data);
        }
      } catch (err) {
        console.error('Failed to load tutor profile:', err);
      }
      
      // Load personal info (education, qualifications from Settings)
      const personalData = await getPersonalInfo();
      console.log('Personal info loaded:', personalData);
      if (personalData) {
        setPersonalInfo(personalData);
      }
    } catch (error) {
      console.error('Failed to load personal info:', error);
    } finally {
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
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Image must be less than 10MB');
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
        // Update local state immediately with cache-busted URL
        const newUrl = response.data.url + '?t=' + Date.now();
        setAvatarUrl(newUrl);
        setProfileData(prev => prev ? { ...prev, profilePicture: newUrl } : { profilePicture: newUrl } as TutorProfileData);
      } else {
        throw new Error(response.data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image');
    } finally {
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
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      alert('Please select a video file');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      alert('Video must be less than 100MB');
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
        const newUrl = response.data.url + '?t=' + Date.now();
        setProfileData(prev => prev ? { ...prev, videoIntroUrl: newUrl } : { videoIntroUrl: newUrl } as TutorProfileData);
        alert('Video uploaded successfully!');
      } else {
        throw new Error(response.data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Video upload error:', error);
      alert('Failed to upload video');
    } finally {
      setVideoUploading(false);
      target.value = '';
    }
  };

  const handleDeleteVideo = async () => {
    if (!confirm('Are you sure you want to delete your introduction video?')) return;

    try {
      const response = await client.delete('/tutor/intro-video');
      if (response.data.success) {
        setProfileData(prev => prev ? { ...prev, videoIntroUrl: undefined } : null);
      } else {
        throw new Error(response.data.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Delete video error:', error);
      alert('Failed to delete video');
    }
  };

  const startEditing = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue || '');
  };

  const cancelEditing = () => {
    setEditingField(null);
    setEditValue('');
  };

  const viewAvatar = () => {
    const currentAvatarUrl = avatarUrl || profileData?.profilePicture || user?.profilePicture;
    if (!currentAvatarUrl) return;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(`<title>Profile Picture</title><img style="max-width:100%;display:block;margin:0 auto" src="${currentAvatarUrl}" />`);
    }
  };

  const saveField = async () => {
    if (!editingField) return;
    
    setSaving(true);
    try {
      const response = await client.patch('/tutor/profile', { [editingField]: editValue });

      if (response.data.success) {
        setProfileData(prev => {
          if (prev) {
            return { ...prev, [editingField]: editValue };
          }
          // Create a minimal profile data object if none exists
          return { 
            firstName: user?.firstName || '', 
            lastName: user?.lastName || '', 
            email: user?.email || '',
            [editingField]: editValue 
          } as TutorProfileData;
        });
        cancelEditing();
      } else {
        throw new Error(response.data.error || 'Failed to save');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <SideBar />
        <div className="main-content">
          <DashboardHeader />
          <div className="my-profile-loading">
            <div className="spinner"></div>
            <p>Loading your profile...</p>
          </div>
        </div>
      </>
    );
  }

  const displayName = user?.firstName && user?.lastName 
    ? `${user.firstName} ${user.lastName}`.trim()
    : profileData?.displayName 
      || `${profileData?.firstName || ''} ${profileData?.lastName || ''}`.trim() 
      || user?.email?.split('@')[0] 
      || 'Tutor';
  const initials = `${user?.firstName?.[0] || profileData?.firstName?.[0] || ''}${user?.lastName?.[0] || profileData?.lastName?.[0] || ''}`.toUpperCase() || 'T';
  
  // Use avatarUrl state first, then fallback to profileData or user
  const currentAvatar = avatarUrl || profileData?.profilePicture || user?.profilePicture;

  return (
    <>
      <SideBar />
      <div className="main-content">
        <DashboardHeader />
        <div className="my-profile-page">
          <div className="profile-container">
            {/* Hero Section */}
            <div className="profile-hero">
              <div className="profile-hero-content">
                {/* Left: Avatar */}
                <div className="profile-header-left">
                  <div className="profile-avatar-wrapper">
                    {uploading ? (
                      <div className="profile-avatar-large profile-avatar-uploading">
                        <div className="upload-spinner"></div>
                      </div>
                    ) : currentAvatar ? (
                      <img 
                        src={currentAvatar} 
                        alt={displayName} 
                        className="profile-avatar-large" 
                      />
                    ) : (
                      <div className="profile-avatar-large profile-avatar-placeholder">{initials}</div>
                    )}
                    <div className="avatar-overlay">
                      <label className="avatar-btn" title="Upload new avatar">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          style={{ display: 'none' }}
                        />
                        {uploading ? 'Uploading...' : 'Upload'}
                      </label>
                      <button
                        type="button"
                        className="avatar-btn secondary"
                        disabled={!currentAvatar}
                        onClick={viewAvatar}
                      >
                        View
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right: Details */}
                <div className="profile-header-right">
                  <div className="profile-title-row">
                    <h1 className="profile-name">{displayName}</h1>
                    {profileData?.isVerified && (
                      <div className="verified-badge">
                        <i className="fi-sr-badge-check"></i>
                        <span>Verified</span>
                      </div>
                    )}
                  </div>

                  {/* Quick Stats - Only show rating when available */}
                  {profileData?.rating && (profileData?.totalReviews ?? 0) > 0 && (
                    <div className="profile-quick-stats">
                      <div className="stat-item">
                        <i className="fi-sr-star"></i>
                        <span className="stat-value">{profileData.rating.toFixed(1)}</span>
                        <span className="stat-label">({profileData?.totalReviews} reviews)</span>
                      </div>
                    </div>
                  )}

                  {/* Languages & Country */}
                  <div className="profile-meta">
                    {profileData?.languages && profileData.languages.length > 0 && (
                      <div className="meta-item">
                        <i className="fi-sr-globe"></i>
                        <span>Speaks: {profileData.languages.join(', ')}</span>
                      </div>
                    )}
                    {profileData?.country && (
                      <div className="meta-item">
                        <i className="fi-sr-marker"></i>
                        <span>{profileData.country}</span>
                      </div>
                    )}
                  </div>

                  {/* Short Bio */}
                  <div className="profile-bio-row">
                    <p className="profile-bio-short">
                      {profileData?.bio 
                        ? (profileData.bio.length > 150 ? `${profileData.bio.substring(0, 150)}...` : profileData.bio)
                        : 'Add a short bio to help students learn about you.'}
                    </p>
                    <button className="btn-edit-inline" onClick={() => startEditing('bio', profileData?.bio || '')}>
                      <i className="fas fa-pencil-alt"></i>
                    </button>
                  </div>

                  {/* Specializations Tags */}
                  {profileData?.specializations && profileData.specializations.length > 0 && (
                    <div className="profile-tags">
                      {profileData.specializations.slice(0, 5).map((spec, idx) => (
                        <span key={idx} className="tag">{spec}</span>
                      ))}
                      {profileData.specializations.length > 5 && (
                        <span className="tag tag-more">+{profileData.specializations.length - 5} more</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Video Introduction - Inside Hero Card */}
              <div className="hero-video-section">
                {profileData?.videoIntroUrl ? (
                  <div className="hero-video-container">
                    <VideoPlayer src={profileData.videoIntroUrl} hideBigPlayButton={true} />
                    <label className="video-replace-overlay">
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleVideoUpload}
                        style={{ display: 'none' }}
                        ref={videoInputRef}
                      />
                      <div className="video-replace-btn">
                        <i className="fi-sr-refresh"></i>
                        <span>{videoUploading ? 'Uploading...' : 'Replace Video'}</span>
                      </div>
                    </label>
                  </div>
                ) : (
                  <div className="hero-video-placeholder">
                    <div className="video-placeholder-content">
                      <i className="fi-sr-video-plus"></i>
                      <span>Add intro video</span>
                    </div>
                    <label className="btn-video-action">
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleVideoUpload}
                        style={{ display: 'none' }}
                        ref={videoInputRef}
                      />
                      <i className="fi-sr-plus"></i>
                      {videoUploading ? 'Uploading...' : 'Upload Video'}
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Tabs Navigation */}
            <div className="profile-tabs">
              <button 
                className={`tab-btn ${activeTab === 'about' ? 'active' : ''}`}
                onClick={() => setActiveTab('about')}
              >
                <i className="fi-sr-user"></i>
                About
              </button>
              <button 
                className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
                onClick={() => setActiveTab('stats')}
              >
                <i className="fi-sr-chart-histogram"></i>
                Stats
              </button>
              <button 
                className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                <i className="fi-sr-settings"></i>
                Settings
              </button>
            </div>

            {/* Tab Content */}
            <div className="profile-content">
              {activeTab === 'about' && (
                <div className="tab-content">
                  {/* About Me */}
                  <section className="content-section">
                    <h2 className="section-title">
                      <i className="fi-sr-user"></i>
                      About Me
                    </h2>
                    <div className="section-content">
                      <p>{profileData?.introduction || profileData?.bio || 'Tell students about yourself, your teaching philosophy, and what makes your lessons unique.'}</p>
                    </div>
                  </section>

                  {/* Education */}
                  {(personalInfo?.schoolAttended || (profileData?.education && profileData.education.length > 0)) && (
                    <section className="content-section">
                      <h2 className="section-title">
                        <i className="fi-sr-graduation-cap"></i>
                        Education
                      </h2>
                      <div className="section-content">
                        <div className="education-info">
                          {personalInfo?.schoolAttended ? (
                            <>
                              <div className="education-row">
                                <i className="fi-sr-school"></i>
                                <span className="education-label">University:</span>
                                <strong>{personalInfo.schoolAttended}</strong>
                              </div>
                              {personalInfo.major && (
                                <div className="education-row">
                                  <i className="fi-sr-diploma"></i>
                                  <span className="education-label">Degree:</span>
                                  <strong>{personalInfo.major}</strong>
                                </div>
                              )}
                            </>
                          ) : (
                            profileData?.education?.map((edu, idx) => (
                              <div key={idx} className="education-row">
                                <div className="education-details">
                                  <i className="fi-sr-school"></i>
                                  <strong>{edu}</strong>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </section>
                  )}

                  {/* Areas of Expertise */}
                  {profileData?.specializations && profileData.specializations.length > 0 && (
                    <section className="content-section">
                      <h2 className="section-title">
                        <i className="fi-sr-bulb"></i>
                        Areas of Expertise
                      </h2>
                      <div className="section-content">
                        <div className="specializations-grid">
                          {profileData.specializations.map((spec, idx) => (
                            <div key={idx} className="specialization-card">
                              <i className="fi-sr-check"></i>
                              <span>{spec}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
                  )}
                </div>
              )}

              {activeTab === 'stats' && (
                <div className="tab-content">
                  <section className="content-section">
                    <h2 className="section-title">
                      <i className="fi-sr-chart-histogram"></i>
                      Your Performance
                    </h2>
                    <div className="stats-grid">
                      <div className="stat-card">
                        <div className="stat-card-icon">
                          <i className="fi-sr-video-camera-alt"></i>
                        </div>
                        <div className="stat-card-value">{profileData?.totalSessions || 0}</div>
                        <div className="stat-card-label">Total Lessons</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-card-icon">
                          <i className="fi-sr-star"></i>
                        </div>
                        <div className="stat-card-value">{profileData?.rating?.toFixed(1) || '-'}</div>
                        <div className="stat-card-label">Average Rating</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-card-icon">
                          <i className="fi-sr-comment"></i>
                        </div>
                        <div className="stat-card-value">{profileData?.totalReviews || 0}</div>
                        <div className="stat-card-label">Total Reviews</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-card-icon">
                          <i className="fi-sr-dollar"></i>
                        </div>
                        <div className="stat-card-value">₱{profileData?.hourlyRate || 0}</div>
                        <div className="stat-card-label">Hourly Rate</div>
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="tab-content">
                  <section className="content-section">
                    <h2 className="section-title">
                      <i className="fi-sr-settings"></i>
                      Quick Settings
                    </h2>
                    <div className="settings-links">
                      <a href="/availability" className="settings-link">
                        <i className="fi-sr-calendar"></i>
                        <div className="settings-link-content">
                          <span className="settings-link-title">Manage Availability</span>
                          <span className="settings-link-desc">Set your teaching hours</span>
                        </div>
                        <i className="fi-sr-angle-small-right"></i>
                      </a>
                      <a href="/wallet" className="settings-link">
                        <i className="fi-sr-wallet"></i>
                        <div className="settings-link-content">
                          <span className="settings-link-title">Wallet & Earnings</span>
                          <span className="settings-link-desc">View your balance and payouts</span>
                        </div>
                        <i className="fi-sr-angle-small-right"></i>
                      </a>
                      <button className="settings-link" onClick={() => setSettingsOpen(true)}>
                        <i className="fi-sr-user-gear"></i>
                        <div className="settings-link-content">
                          <span className="settings-link-title">Account Settings</span>
                          <span className="settings-link-desc">Email, password, and preferences</span>
                        </div>
                        <i className="fi-sr-angle-small-right"></i>
                      </button>
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingField && (
        <div className="edit-modal-overlay" onClick={cancelEditing}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-modal-header">
              <h3>Edit {editingField.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h3>
              <button className="edit-modal-close" onClick={cancelEditing}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="edit-modal-body">
              {editingField === 'bio' || editingField === 'introduction' || editingField === 'teachingStyle' ? (
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue((e.target as HTMLTextAreaElement).value)}
                  placeholder={`Enter your ${editingField.replace(/([A-Z])/g, ' $1').toLowerCase()}...`}
                  rows={5}
                />
              ) : (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue((e.target as HTMLInputElement).value)}
                  placeholder={`Enter ${editingField.replace(/([A-Z])/g, ' $1').toLowerCase()}...`}
                />
              )}
            </div>
            <div className="edit-modal-footer">
              <button className="btn-cancel" onClick={cancelEditing}>Cancel</button>
              <button className="btn-save" onClick={saveField} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Cropper Modal */}
      {cropperImage && (
        <ImageCropper
          imageSrc={cropperImage}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}

      {/* Settings Modal for editing personal info */}
      <SettingsModal isOpen={settingsOpen} onClose={handleSettingsClose} />
    </>
  );
};

export default MyProfilePage;
