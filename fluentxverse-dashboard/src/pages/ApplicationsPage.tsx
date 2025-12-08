import { useState, useEffect } from 'preact/hooks';
import { adminApi, PendingTutor } from '../api/admin.api';
import './ApplicationsPage.css';

const ApplicationsPage = () => {
  const [applications, setApplications] = useState<PendingTutor[]>([]);
  const [certifiedCount, setCertifiedCount] = useState(0);
  const [pendingProfileCount, setPendingProfileCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadApplications();
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
          <p>Review and process tutor applications</p>
        </div>
      </div>

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
    </div>
  );
};

export default ApplicationsPage;
