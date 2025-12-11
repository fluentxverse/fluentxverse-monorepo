import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { useAuthContext } from '../context/AuthContext';
import { getPersonalInfo, PersonalInfoData } from '../api/auth.api';
import SideBar from '../Components/IndexOne/SideBar';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import SettingsModal from '../Components/Settings/SettingsModal';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'My Profile | FluentXVerse';
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
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

  const handleFileChange = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch(
        `${import.meta.env.VITE_SEAWEED_URL || 'http://localhost:8888'}/profile-pictures/${user?.userId}_${Date.now()}_${file.name}`,
        { method: 'POST', body: formData }
      );

      if (!uploadResponse.ok) throw new Error('Upload failed');

      const result = await uploadResponse.json();
      const imageUrl = `${import.meta.env.VITE_SEAWEED_URL || 'http://localhost:8888'}${result.name}`;

      const saveResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/tutors/profile-picture`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ profilePicture: imageUrl })
      });

      if (saveResponse.ok) {
        setProfileData(prev => prev ? { ...prev, profilePicture: imageUrl } : null);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image');
    } finally {
      setUploading(false);
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
    const avatarUrl = profileData?.profilePicture || user?.profilePicture;
    if (!avatarUrl) return;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(`<title>Profile Picture</title><img style="max-width:100%;display:block;margin:0 auto" src="${avatarUrl}" />`);
    }
  };

  const saveField = async () => {
    if (!editingField) return;
    
    setSaving(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/tutors/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [editingField]: editValue })
      });

      if (response.ok) {
        setProfileData(prev => prev ? { ...prev, [editingField]: editValue } : null);
        cancelEditing();
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
                    ) : profileData?.profilePicture || user?.profilePicture ? (
                      <img 
                        src={profileData?.profilePicture || user?.profilePicture} 
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
                        disabled={!(profileData?.profilePicture || user?.profilePicture)}
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
                    <div className="section-header">
                      <h2 className="section-title">
                        <i className="fi-sr-user"></i>
                        About Me
                      </h2>
                      <button className="btn-edit-section" onClick={() => startEditing('introduction', profileData?.introduction || '')}>
                        <i className="fas fa-pencil-alt"></i>
                        Edit
                      </button>
                    </div>
                    <div className="section-content">
                      <p>{profileData?.introduction || profileData?.bio || 'Tell students about yourself, your teaching philosophy, and what makes your lessons unique.'}</p>
                    </div>
                  </section>

                  {/* Education */}
                  <section className="content-section">
                    <div className="section-header">
                      <h2 className="section-title">
                        <i className="fi-sr-trophy"></i>
                        Education
                      </h2>
                      <button className="btn-edit-section" onClick={() => setSettingsOpen(true)}>
                        <i className="fas fa-pencil-alt"></i>
                        Edit
                      </button>
                    </div>
                    <div className="section-content">
                      {personalInfo?.schoolAttended ? (
                        <div className="education-info">
                          <div className="education-row">
                            <div className="education-details">
                              <i className="fi-sr-school"></i>
                              <span className="education-label">University:</span>
                              <strong>{personalInfo.schoolAttended}</strong>
                            </div>
                          </div>
                          {personalInfo.major && (
                            <div className="education-row">
                              <div className="education-details">
                                <i className="fi-sr-diploma"></i>
                                <span className="education-label">Degree:</span>
                                <strong>{personalInfo.major}</strong>
                              </div>
                            </div>
                          )}
                          {/* Teaching Qualifications - only show if available */}
                          {personalInfo.teachingQualifications && personalInfo.teachingQualifications.length > 0 && (
                            <div className="education-row qualifications-row">
                              <div className="education-details">
                                <span className="education-label">Teaching Qualifications:</span>
                                <div className="qualifications-list">
                                  {personalInfo.teachingQualifications.map((qual, idx) => (
                                    <span key={idx} className="qualification-badge">{qual}</span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="empty-state">Add your educational background to build trust with students.</p>
                      )}
                    </div>
                  </section>

                  {/* Areas of Expertise */}
                  {profileData?.specializations && profileData.specializations.length > 0 && (
                    <section className="content-section">
                      <div className="section-header">
                        <h2 className="section-title">
                          <i className="fi-sr-bulb"></i>
                          Areas of Expertise
                        </h2>
                        <button className="btn-edit-section" onClick={() => alert('Specializations editing coming soon!')}>
                          <i className="fas fa-pencil-alt"></i>
                          Edit
                        </button>
                      </div>
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

      {/* Settings Modal for editing personal info */}
      <SettingsModal isOpen={settingsOpen} onClose={handleSettingsClose} />
    </>
  );
};

export default MyProfilePage;
