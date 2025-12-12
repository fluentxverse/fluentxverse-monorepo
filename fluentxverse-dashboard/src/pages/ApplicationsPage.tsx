import { useState, useEffect } from 'preact/hooks';
import { adminApi, PendingTutor, PendingProfileReview } from '../api/admin.api';
import './ApplicationsPage.css';

const ApplicationsPage = () => {
  const [activeTab, setActiveTab] = useState<'applications' | 'profiles'>('applications');
  const [applications, setApplications] = useState<PendingTutor[]>([]);
  const [pendingProfiles, setPendingProfiles] = useState<PendingProfileReview[]>([]);
  const [certifiedCount, setCertifiedCount] = useState(0);
  const [pendingProfileCount, setPendingProfileCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState<PendingProfileReview | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    loadApplications();
    loadPendingProfiles();
    loadStats();
  }, []);

  const loadApplications = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await adminApi.getPendingTutors(50);
      setApplications(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const stats = await adminApi.getStats();
      setCertifiedCount(stats.certifiedTutors);
      setPendingProfileCount(stats.pendingTutors);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const loadPendingProfiles = async () => {
    try {
      const data = await adminApi.getPendingProfiles(50);
      setPendingProfiles(data);
    } catch (err) {
      console.error('Failed to load pending profiles:', err);
    }
  };

  const handleApproveProfile = async (tutorId: string) => {
    try {
      setReviewingId(tutorId);
      await adminApi.reviewProfile(tutorId, 'approve');
      setPendingProfiles(prev => prev.filter(p => p.id !== tutorId));
      setShowProfileModal(null);
    } catch (err: any) {
      setError(err.message || 'Failed to approve profile');
    } finally {
      setReviewingId(null);
    }
  };

  const handleRejectProfile = async (tutorId: string) => {
    if (!rejectReason.trim()) {
      setError('Please provide a reason for rejection');
      return;
    }
    try {
      setReviewingId(tutorId);
      await adminApi.reviewProfile(tutorId, 'reject', rejectReason);
      setPendingProfiles(prev => prev.filter(p => p.id !== tutorId));
      setShowProfileModal(null);
      setRejectReason('');
    } catch (err: any) {
      setError(err.message || 'Failed to reject profile');
    } finally {
      setReviewingId(null);
    }
  };

  const getStatusInfo = (app: PendingTutor) => {
    // Check interview result first
    if (app.interviewResult === 'pass') {
      return { label: 'Interview Passed', class: 'interview-pass', icon: 'ri-check-double-line' };
    }
    if (app.interviewResult === 'fail') {
      return { label: 'Interview Failed', class: 'interview-fail', icon: 'ri-close-circle-line' };
    }
    if (app.status === 'processing') {
      return { label: 'Interview Processing', class: 'processing', icon: 'ri-loader-4-line' };
    }
    if (!app.writtenExamPassed) {
      return { label: 'Pending Written Exam', class: 'pending-written', icon: 'ri-file-text-line' };
    }
    if (!app.speakingExamPassed) {
      return { label: 'Pending Speaking Exam', class: 'pending-speaking', icon: 'ri-mic-line' };
    }
    return { label: 'Under Review', class: 'review', icon: 'ri-search-line' };
  };

  const filteredApplications = applications.filter(app => {
    if (filter === 'all') return true;
    if (filter === 'pending_written') return !app.writtenExamPassed;
    if (filter === 'pending_speaking') return app.writtenExamPassed && !app.speakingExamPassed;
    if (filter === 'processing') return app.status === 'processing';
    if (filter === 'interview_passed') return app.interviewResult === 'pass';
    if (filter === 'interview_failed') return app.interviewResult === 'fail';
    return true;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const stats = {
    total: applications.length,
    pendingWritten: applications.filter(a => !a.writtenExamPassed).length,
    pendingSpeaking: applications.filter(a => a.writtenExamPassed && !a.speakingExamPassed).length,
    processing: applications.filter(a => a.status === 'processing').length,
    interviewPassed: applications.filter(a => a.interviewResult === 'pass').length,
    interviewFailed: applications.filter(a => a.interviewResult === 'fail').length,
  };

  return (
    <div className="applications-page">
      <div className="page-header">
        <div className="header-content">
          <h1>Tutor Applications</h1>
          <p>Review and process tutor applications and profile submissions</p>
        </div>
        <div className="page-tabs">
          <button 
            className={`tab-btn ${activeTab === 'applications' ? 'active' : ''}`}
            onClick={() => setActiveTab('applications')}
          >
            <i className="ri-file-user-line"></i>
            Exam Applications
            <span className="tab-badge">{applications.length}</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'profiles' ? 'active' : ''}`}
            onClick={() => setActiveTab('profiles')}
          >
            <i className="ri-user-settings-line"></i>
            Profile Reviews
            <span className="tab-badge">{pendingProfiles.length}</span>
          </button>
        </div>
      </div>

      {activeTab === 'applications' && (
        <>
          {/* Stats Cards */}
          <div className="stats-grid">
        <div className={`stat-card ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          <div className="stat-icon total">
            <i className="ri-file-user-line"></i>
          </div>
          <div className="stat-content">
            <span className="stat-number">{stats.total}</span>
            <span className="stat-label">Total Applications</span>
          </div>
        </div>
        <div className={`stat-card ${filter === 'pending_written' ? 'active' : ''}`} onClick={() => setFilter('pending_written')}>
          <div className="stat-icon pending-written">
            <i className="ri-file-text-line"></i>
          </div>
          <div className="stat-content">
            <span className="stat-number">{stats.pendingWritten}</span>
            <span className="stat-label">Pending Written</span>
          </div>
        </div>
        <div className={`stat-card ${filter === 'pending_speaking' ? 'active' : ''}`} onClick={() => setFilter('pending_speaking')}>
          <div className="stat-icon pending-speaking">
            <i className="ri-mic-line"></i>
          </div>
          <div className="stat-content">
            <span className="stat-number">{stats.pendingSpeaking}</span>
            <span className="stat-label">Pending Speaking</span>
          </div>
        </div>
        <div className={`stat-card ${filter === 'processing' ? 'active' : ''}`} onClick={() => setFilter('processing')}>
          <div className="stat-icon processing">
            <i className="ri-loader-4-line"></i>
          </div>
          <div className="stat-content">
            <span className="stat-number">{stats.processing}</span>
            <span className="stat-label">Processing</span>
          </div>
        </div>
        <div className={`stat-card ${filter === 'interview_passed' ? 'active' : ''}`} onClick={() => setFilter('interview_passed')}>
          <div className="stat-icon interview-pass">
            <i className="ri-check-double-line"></i>
          </div>
          <div className="stat-content">
            <span className="stat-number">{stats.interviewPassed}</span>
            <span className="stat-label">Interview Passed</span>
          </div>
        </div>
        <div className={`stat-card ${filter === 'interview_failed' ? 'active' : ''}`} onClick={() => setFilter('interview_failed')}>
          <div className="stat-icon interview-fail">
            <i className="ri-close-circle-line"></i>
          </div>
          <div className="stat-content">
            <span className="stat-number">{stats.interviewFailed}</span>
            <span className="stat-label">Interview Failed</span>
          </div>
        </div>
        <div className="stat-card info-card">
          <div className="stat-icon pending-profile">
            <i className="ri-user-settings-line"></i>
          </div>
          <div className="stat-content">
            <span className="stat-number">{pendingProfileCount}</span>
            <span className="stat-label">Pending Profile</span>
          </div>
        </div>
        <div className="stat-card info-card">
          <div className="stat-icon certified">
            <i className="ri-verified-badge-line"></i>
          </div>
          <div className="stat-content">
            <span className="stat-number">{certifiedCount}</span>
            <span className="stat-label">Certified</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <i className="ri-error-warning-line"></i>
          {error}
        </div>
      )}

      {/* Applications List */}
      <div className="applications-container">
        <div className="container-header">
          <h2>Applications ({filteredApplications.length})</h2>
          <button className="btn-refresh" onClick={loadApplications}>
            <i className="ri-refresh-line"></i>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="loading-state">
            <i className="ri-loader-4-line spinning"></i>
            <span>Loading applications...</span>
          </div>
        ) : (
          <div className="applications-list">
            {filteredApplications.map(app => {
              const statusInfo = getStatusInfo(app);
              return (
                <div className="application-card" key={app.id}>
                  <div className="card-main">
                    <div className="applicant-info">
                      <div className="applicant-avatar">
                        {app.name?.charAt(0) || 'T'}
                      </div>
                      <div className="applicant-details">
                        <h3 className="applicant-name">{app.name}</h3>
                        <p className="applicant-email">{app.email}</p>
                        <span className="applied-date">
                          <i className="ri-calendar-line"></i>
                          Applied {formatDate(app.registeredAt)}
                        </span>
                      </div>
                    </div>

                    <div className="exam-progress">
                      <div className={`exam-step ${app.writtenExamPassed ? 'completed' : 'pending'}`}>
                        <div className="step-icon">
                          <i className={app.writtenExamPassed ? 'ri-check-line' : 'ri-file-text-line'}></i>
                        </div>
                        <span className="step-label">Written</span>
                      </div>
                      <div className="step-connector"></div>
                      <div className={`exam-step ${app.speakingExamPassed ? 'completed' : app.writtenExamPassed ? 'current' : 'pending'}`}>
                        <div className="step-icon">
                          <i className={app.speakingExamPassed ? 'ri-check-line' : 'ri-mic-line'}></i>
                        </div>
                        <span className="step-label">Speaking</span>
                      </div>
                      <div className="step-connector"></div>
                      <div className={`exam-step ${app.writtenExamPassed && app.speakingExamPassed ? 'completed' : 'pending'}`}>
                        <div className="step-icon">
                          <i className="ri-shield-check-line"></i>
                        </div>
                        <span className="step-label">Certified</span>
                      </div>
                    </div>
                  </div>

                  <div className="card-footer">
                    <span className={`status-badge ${statusInfo.class}`}>
                      <i className={statusInfo.icon}></i>
                      {statusInfo.label}
                    </span>
                    <div className="card-actions">
                      <button className="btn-action view">
                        <i className="ri-eye-line"></i>
                        View
                      </button>
                      {app.writtenExamPassed && !app.speakingExamPassed && app.status !== 'processing' && (
                        <a href="/interviews" className="btn-action schedule">
                          <i className="ri-calendar-schedule-line"></i>
                          Schedule Interview
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && filteredApplications.length === 0 && (
          <div className="empty-state">
            <i className="ri-file-search-line"></i>
            <p>No applications found</p>
          </div>
        )}
      </div>
        </>
      )}

      {activeTab === 'profiles' && (
        <div className="profiles-container">
          <div className="container-header">
            <h2>Profile Reviews ({pendingProfiles.length})</h2>
            <button className="btn-refresh" onClick={loadPendingProfiles}>
              <i className="ri-refresh-line"></i>
              Refresh
            </button>
          </div>

          {pendingProfiles.length === 0 ? (
            <div className="empty-state">
              <i className="ri-user-settings-line"></i>
              <p>No pending profile reviews</p>
              <span className="empty-hint">Tutors who complete their profile will appear here for review</span>
            </div>
          ) : (
            <div className="profiles-grid">
              {pendingProfiles.map(profile => (
                <div key={profile.id} className="profile-review-card">
                  <div className="profile-card-header">
                    <div className="profile-avatar-wrapper">
                      {profile.profilePicture ? (
                        <img src={profile.profilePicture} alt={profile.name} className="profile-avatar" />
                      ) : (
                        <div className="profile-avatar placeholder">
                          {profile.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="profile-info">
                      <h3 className="profile-name">{profile.name}</h3>
                      <p className="profile-email">{profile.email}</p>
                      <span className="profile-submitted">
                        <i className="ri-time-line"></i>
                        Submitted {formatDate(profile.submittedAt)}
                      </span>
                    </div>
                  </div>

                  <div className="profile-details">
                    <div className="detail-row">
                      <span className="detail-label">Bio:</span>
                      <span className={`detail-value ${profile.bio ? '' : 'missing'}`}>
                        {profile.bio ? (profile.bio.length > 100 ? `${profile.bio.substring(0, 100)}...` : profile.bio) : 'Not provided'}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Education:</span>
                      <span className={`detail-value ${profile.schoolAttended ? '' : 'missing'}`}>
                        {profile.schoolAttended ? `${profile.schoolAttended}${profile.major ? ` - ${profile.major}` : ''}` : 'Not provided'}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Interests:</span>
                      <span className={`detail-value ${profile.interests?.length ? '' : 'missing'}`}>
                        {profile.interests?.length ? profile.interests.join(', ') : 'Not provided'}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Video:</span>
                      <span className={`detail-value ${profile.videoIntroUrl ? 'has-video' : 'missing'}`}>
                        {profile.videoIntroUrl ? (
                          <a href={profile.videoIntroUrl} target="_blank" rel="noopener noreferrer">
                            <i className="ri-video-line"></i> View Video
                          </a>
                        ) : 'Not uploaded'}
                      </span>
                    </div>
                  </div>

                  <div className="profile-card-actions">
                    <button 
                      className="btn-action approve"
                      onClick={() => handleApproveProfile(profile.id)}
                      disabled={reviewingId === profile.id}
                    >
                      {reviewingId === profile.id ? (
                        <i className="ri-loader-4-line spinning"></i>
                      ) : (
                        <i className="ri-check-line"></i>
                      )}
                      Approve
                    </button>
                    <button 
                      className="btn-action view"
                      onClick={() => setShowProfileModal(profile)}
                    >
                      <i className="ri-eye-line"></i>
                      Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Profile Review Modal */}
      {showProfileModal && (
        <div className="modal-overlay" onClick={() => setShowProfileModal(null)}>
          <div className="profile-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Review Profile</h2>
              <button className="modal-close" onClick={() => setShowProfileModal(null)}>
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-profile-header">
                {showProfileModal.profilePicture ? (
                  <img src={showProfileModal.profilePicture} alt={showProfileModal.name} className="modal-avatar" />
                ) : (
                  <div className="modal-avatar placeholder">{showProfileModal.name.charAt(0)}</div>
                )}
                <div>
                  <h3>{showProfileModal.name}</h3>
                  <p>{showProfileModal.email}</p>
                </div>
              </div>

              <div className="modal-section">
                <h4>Bio</h4>
                <p>{showProfileModal.bio || 'Not provided'}</p>
              </div>

              <div className="modal-section">
                <h4>Education</h4>
                <p>
                  {showProfileModal.schoolAttended 
                    ? `${showProfileModal.schoolAttended}${showProfileModal.major ? ` - ${showProfileModal.major}` : ''}`
                    : 'Not provided'}
                </p>
              </div>

              <div className="modal-section">
                <h4>Interests</h4>
                {showProfileModal.interests?.length ? (
                  <div className="interests-chips">
                    {showProfileModal.interests.map((interest, idx) => (
                      <span key={idx} className="interest-chip">{interest}</span>
                    ))}
                  </div>
                ) : (
                  <p className="missing">Not provided</p>
                )}
              </div>

              {showProfileModal.videoIntroUrl && (
                <div className="modal-section">
                  <h4>Introduction Video</h4>
                  <video src={showProfileModal.videoIntroUrl} controls className="modal-video" />
                </div>
              )}

              <div className="modal-section reject-section">
                <h4>Rejection Reason (if rejecting)</h4>
                <textarea 
                  value={rejectReason}
                  onChange={e => setRejectReason((e.target as HTMLTextAreaElement).value)}
                  placeholder="Provide reason for rejection..."
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-reject"
                onClick={() => handleRejectProfile(showProfileModal.id)}
                disabled={reviewingId === showProfileModal.id}
              >
                <i className="ri-close-circle-line"></i>
                Reject
              </button>
              <button 
                className="btn-approve"
                onClick={() => handleApproveProfile(showProfileModal.id)}
                disabled={reviewingId === showProfileModal.id}
              >
                {reviewingId === showProfileModal.id ? (
                  <i className="ri-loader-4-line spinning"></i>
                ) : (
                  <i className="ri-check-double-line"></i>
                )}
                Approve Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicationsPage;
