import { useState, useEffect } from 'preact/hooks';
import { adminApi, TutorListItem } from '../api/admin.api';
import './TutorsPage.css';

type TabType = 'certified' | 'all';

const TutorsPage = () => {
  const [tutors, setTutors] = useState<TutorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<TabType>('certified');
  
  // Suspend modal state
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendingTutor, setSuspendingTutor] = useState<TutorListItem | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendUntil, setSuspendUntil] = useState('');
  const [suspendLoading, setSuspendLoading] = useState(false);
  
  const limit = 15;

  useEffect(() => {
    loadTutors();
  }, [page, activeTab]);

  const loadTutors = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await adminApi.getTutors({
        page,
        limit,
        status: activeTab === 'certified' ? 'certified' : 'all',
        search: searchQuery || undefined,
      });
      setTutors(result.tutors);
      setTotal(result.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load tutors');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setPage(1);
  };

  const openSuspendModal = (tutor: TutorListItem) => {
    setSuspendingTutor(tutor);
    setSuspendReason('');
    setSuspendUntil('');
    setShowSuspendModal(true);
  };

  const closeSuspendModal = () => {
    setShowSuspendModal(false);
    setSuspendingTutor(null);
    setSuspendReason('');
    setSuspendUntil('');
  };

  const handleSuspendTutor = async () => {
    if (!suspendingTutor || !suspendReason.trim() || !suspendUntil) return;
    
    try {
      setSuspendLoading(true);
      await adminApi.suspendTutor(suspendingTutor.id, suspendReason.trim(), suspendUntil);
      closeSuspendModal();
      loadTutors(); // Refresh list
    } catch (err: any) {
      setError(err.message || 'Failed to suspend tutor');
    } finally {
      setSuspendLoading(false);
    }
  };

  const handleSearch = (e: Event) => {
    e.preventDefault();
    setPage(1);
    loadTutors();
  };

  const getStatusBadge = (tutor: TutorListItem) => {
    if (tutor.status === 'certified') {
      return <span className="status-badge certified"><i className="ri-shield-check-line"></i> Certified</span>;
    } else if (tutor.status === 'processing') {
      return <span className="status-badge processing"><i className="ri-loader-4-line"></i> Processing</span>;
    } else if (tutor.status === 'failed') {
      return <span className="status-badge failed"><i className="ri-close-circle-line"></i> Failed</span>;
    } else {
      if (!tutor.writtenExamPassed) {
        return <span className="status-badge pending"><i className="ri-file-text-line"></i> Pending Written</span>;
      } else {
        return <span className="status-badge pending-speaking"><i className="ri-mic-line"></i> Pending Speaking</span>;
      }
    }
  };

  const totalPages = Math.ceil(total / limit);

  // Calculate stats from the tutors list
  const avgRating = tutors.length > 0 
    ? (tutors.reduce((sum, t) => sum + (t.rating || 0), 0) / tutors.length).toFixed(1)
    : '0.0';
  const totalSessions = tutors.reduce((sum, t) => sum + (t.totalSessions || 0), 0);

  return (
    <div className="tutors-page">
      <div className="page-header">
        <div className="header-content">
          <h1>Tutors Management</h1>
          <p>View and manage platform tutors</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tutor-tabs">
        <button
          className={`tutor-tab ${activeTab === 'certified' ? 'active' : ''}`}
          onClick={() => handleTabChange('certified')}
        >
          <i className="ri-shield-check-line"></i>
          Certified Tutors
        </button>
        <button
          className={`tutor-tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => handleTabChange('all')}
        >
          <i className="ri-group-line"></i>
          All Tutors
        </button>
      </div>

      {/* Quick Stats */}
      <div className="quick-stats">
        <div className="quick-stat">
          <div className="stat-icon blue">
            <i className="ri-user-star-line"></i>
          </div>
          <div className="stat-info">
            <span className="stat-number">{total}</span>
            <span className="stat-label">{activeTab === 'certified' ? 'Total Certified' : 'Total Tutors'}</span>
          </div>
        </div>
        <div className="quick-stat">
          <div className="stat-icon green">
            <i className="ri-star-line"></i>
          </div>
          <div className="stat-info">
            <span className="stat-number">{avgRating}</span>
            <span className="stat-label">Avg Rating</span>
          </div>
        </div>
        <div className="quick-stat">
          <div className="stat-icon purple">
            <i className="ri-video-chat-line"></i>
          </div>
          <div className="stat-info">
            <span className="stat-number">{totalSessions}</span>
            <span className="stat-label">Total Sessions</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <i className="ri-error-warning-line"></i>
          {error}
        </div>
      )}

      {/* Search */}
      <div className="filters-bar">
        <form className="search-box" onSubmit={handleSearch}>
          <i className="ri-search-line"></i>
          <input 
            type="text" 
            placeholder={activeTab === 'certified' ? 'Search certified tutors...' : 'Search all tutors...'}
            value={searchQuery}
            onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
          />
          <button type="submit" className="btn-search">Search</button>
        </form>
      </div>

      {/* Tutors Table */}
      <div className="tutors-table-card">
        {loading ? (
          <div className="loading-state">
            <i className="ri-loader-4-line spinning"></i>
            <span>Loading tutors...</span>
          </div>
        ) : (
          <table className="tutors-table">
            <thead>
              <tr>
                <th>Tutor</th>
                <th>Languages</th>
                <th>Written Exam</th>
                <th>Speaking Exam</th>
                <th>Status</th>
                <th>Sessions</th>
                <th>Rating</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tutors.map(tutor => (
                <tr key={tutor.id}>
                  <td className="tutor-cell">
                    <div className="tutor-info">
                      <div className="tutor-avatar">
                        <span>{tutor.name?.charAt(0) || 'T'}</span>
                      </div>
                      <div className="tutor-details">
                        <span className="tutor-name">{tutor.name}</span>
                        <span className="tutor-email">{tutor.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="language-tags">
                      {(tutor.languages || []).slice(0, 2).map((lang, i) => (
                        <span key={i} className="language-tag">{lang}</span>
                      ))}
                      {(tutor.languages || []).length > 2 && (
                        <span className="language-tag more">+{tutor.languages.length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {tutor.writtenExamScore !== undefined ? (
                      <span className={`exam-score ${tutor.writtenExamPassed ? 'passed' : 'failed'}`}>
                        {tutor.writtenExamScore}%
                      </span>
                    ) : (
                      <span className="not-taken">Not taken</span>
                    )}
                  </td>
                  <td>
                    {tutor.speakingExamScore !== undefined ? (
                      <span className={`exam-score ${tutor.speakingExamPassed ? 'passed' : 'failed'}`}>
                        {tutor.speakingExamScore}%
                      </span>
                    ) : tutor.status === 'processing' ? (
                      <span className="processing-text"><i className="ri-loader-4-line"></i> Processing</span>
                    ) : (
                      <span className="not-taken">Not taken</span>
                    )}
                  </td>
                  <td>{getStatusBadge(tutor)}</td>
                  <td className="sessions-cell">{tutor.totalSessions}</td>
                  <td>
                    {tutor.rating > 0 ? (
                      <div className="rating">
                        <i className="ri-star-fill"></i>
                        <span>{tutor.rating.toFixed(1)}</span>
                      </div>
                    ) : (
                      <span className="no-rating">—</span>
                    )}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="action-btn view" title="View Profile">
                        <i className="ri-eye-line"></i>
                      </button>
                      <button className="action-btn edit" title="Edit">
                        <i className="ri-edit-line"></i>
                      </button>
                      <button 
                        className="action-btn suspend" 
                        title="Suspend Tutor"
                        onClick={() => openSuspendModal(tutor)}
                      >
                        <i className="ri-forbid-line"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && tutors.length === 0 && (
          <div className="empty-state">
            <i className="ri-user-search-line"></i>
            <p>No tutors found matching your criteria</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            <i className="ri-arrow-left-s-line"></i>
            Previous
          </button>
          <div className="pagination-info">
            Page {page} of {totalPages}
          </div>
          <button
            className="pagination-btn"
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Next
            <i className="ri-arrow-right-s-line"></i>
          </button>
        </div>
      )}

      {/* Suspend Modal */}
      {showSuspendModal && suspendingTutor && (
        <div className="modal-overlay" onClick={closeSuspendModal}>
          <div className="suspend-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><i className="ri-forbid-line"></i> Suspend Tutor</h3>
              <button className="modal-close" onClick={closeSuspendModal}>
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="suspend-tutor-info">
                <div className="tutor-avatar">
                  <span>{suspendingTutor.name?.charAt(0) || 'T'}</span>
                </div>
                <div className="tutor-details">
                  <span className="tutor-name">{suspendingTutor.name}</span>
                  <span className="tutor-email">{suspendingTutor.email}</span>
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="suspendReason">Suspension Reason *</label>
                <textarea
                  id="suspendReason"
                  placeholder="Enter the reason for suspension..."
                  value={suspendReason}
                  onInput={(e) => setSuspendReason((e.target as HTMLTextAreaElement).value)}
                  rows={4}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="suspendUntil">Suspend Until *</label>
                <input
                  type="date"
                  id="suspendUntil"
                  value={suspendUntil}
                  onInput={(e) => setSuspendUntil((e.target as HTMLInputElement).value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={closeSuspendModal}>
                Cancel
              </button>
              <button 
                className="btn-suspend" 
                onClick={handleSuspendTutor}
                disabled={!suspendReason.trim() || !suspendUntil || suspendLoading}
              >
                {suspendLoading ? (
                  <><i className="ri-loader-4-line spinning"></i> Suspending...</>
                ) : (
                  <><i className="ri-forbid-line"></i> Suspend Tutor</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TutorsPage;
