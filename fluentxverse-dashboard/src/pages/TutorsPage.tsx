import { useState, useEffect } from 'preact/hooks';
import { adminApi, TutorListItem, SuspensionHistoryItem } from '../api/admin.api';
import './TutorsPage.css';

type TabType = 'certified' | 'all' | 'suspended';

const TutorsPage = () => {
  const [tutors, setTutors] = useState<TutorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
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
  
  // View profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [viewingTutor, setViewingTutor] = useState<TutorListItem | null>(null);
  
  // Suspension history modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyTutor, setHistoryTutor] = useState<TutorListItem | null>(null);
  const [suspensionHistory, setSuspensionHistory] = useState<SuspensionHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  const limit = 15;

  useEffect(() => {
    loadTutors();
  }, [page, activeTab]);

  const loadTutors = async () => {
    try {
      setLoading(true);
      setError('');
      const statusMap: Record<TabType, string> = {
        'certified': 'certified',
        'all': 'all',
        'suspended': 'suspended'
      };
      const result = await adminApi.getTutors({
        page,
        limit,
        status: statusMap[activeTab] as any,
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
      setSuccessMessage(`${suspendingTutor.name} has been suspended successfully.`);
      setTimeout(() => setSuccessMessage(''), 5000);
      loadTutors(); // Refresh list
    } catch (err: any) {
      setError(err.message || 'Failed to suspend tutor');
    } finally {
      setSuspendLoading(false);
    }
  };

  const handleUnsuspendTutor = async (tutor: TutorListItem) => {
    try {
      await adminApi.unsuspendTutor(tutor.id);
      setSuccessMessage(`${tutor.name} has been unsuspended successfully.`);
      setTimeout(() => setSuccessMessage(''), 5000);
      loadTutors(); // Refresh list
    } catch (err: any) {
      setError(err.message || 'Failed to unsuspend tutor');
    }
  };

  const openProfileModal = (tutor: TutorListItem) => {
    setViewingTutor(tutor);
    setShowProfileModal(true);
  };

  const closeProfileModal = () => {
    setShowProfileModal(false);
    setViewingTutor(null);
  };

  const openHistoryModal = async (tutor: TutorListItem) => {
    setHistoryTutor(tutor);
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const history = await adminApi.getTutorSuspensionHistory(tutor.id);
      setSuspensionHistory(history);
    } catch (err: any) {
      setError(err.message || 'Failed to load suspension history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setHistoryTutor(null);
    setSuspensionHistory([]);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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
        <button
          className={`tutor-tab ${activeTab === 'suspended' ? 'active' : ''}`}
          onClick={() => handleTabChange('suspended')}
        >
          <i className="ri-forbid-line"></i>
          Suspended
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
            <span className="stat-label">
              {activeTab === 'certified' ? 'Total Certified' : activeTab === 'suspended' ? 'Suspended Tutors' : 'Total Tutors'}
            </span>
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

      {successMessage && (
        <div className="alert alert-success">
          <i className="ri-check-line"></i>
          {successMessage}
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
                <tr key={tutor.id} className={tutor.isSuspended ? 'suspended-row' : ''}>
                  <td className="tutor-cell">
                    <div className="tutor-info">
                      <div className={`tutor-avatar ${tutor.isSuspended ? 'suspended' : ''}`}>
                        <span>{tutor.name?.charAt(0) || 'T'}</span>
                      </div>
                      <div className="tutor-details">
                        <span className="tutor-name">
                          {tutor.name}
                          {tutor.isSuspended && (
                            <span className="suspended-badge" title={`Suspended until ${formatDate(tutor.suspendedUntil!)}\nReason: ${tutor.suspendedReason}`}>
                              <i className="ri-forbid-line"></i> Suspended
                            </span>
                          )}
                        </span>
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
                      <button 
                        className="action-btn view" 
                        title="View Profile"
                        onClick={() => openProfileModal(tutor)}
                      >
                        <i className="ri-eye-line"></i>
                      </button>
                      <button 
                        className="action-btn history" 
                        title="Suspension History"
                        onClick={() => openHistoryModal(tutor)}
                      >
                        <i className="ri-history-line"></i>
                      </button>
                      <button className="action-btn edit" title="Edit">
                        <i className="ri-edit-line"></i>
                      </button>
                      {tutor.isSuspended ? (
                        <button 
                          className="action-btn unsuspend" 
                          title="Unsuspend Tutor"
                          onClick={() => handleUnsuspendTutor(tutor)}
                        >
                          <i className="ri-checkbox-circle-line"></i>
                        </button>
                      ) : (
                        <button 
                          className="action-btn suspend" 
                          title="Suspend Tutor"
                          onClick={() => openSuspendModal(tutor)}
                        >
                          <i className="ri-forbid-line"></i>
                        </button>
                      )}
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

      {/* View Profile Modal */}
      {showProfileModal && viewingTutor && (
        <div className="modal-overlay" onClick={closeProfileModal}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><i className="ri-user-line"></i> Tutor Profile</h3>
              <button className="modal-close" onClick={closeProfileModal}>
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="profile-header">
                <div className={`profile-avatar ${viewingTutor.isSuspended ? 'suspended' : ''}`}>
                  <span>{viewingTutor.name?.charAt(0) || 'T'}</span>
                </div>
                <div className="profile-info">
                  <h2>{viewingTutor.name}</h2>
                  <p>{viewingTutor.email}</p>
                  {viewingTutor.isSuspended && (
                    <span className="profile-suspended-badge">
                      <i className="ri-forbid-line"></i> Suspended until {formatDate(viewingTutor.suspendedUntil!)}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="profile-section">
                <h4>Status & Certification</h4>
                <div className="profile-grid">
                  <div className="profile-item">
                    <span className="label">Status</span>
                    <span className={`value status-${viewingTutor.status}`}>
                      {viewingTutor.status.charAt(0).toUpperCase() + viewingTutor.status.slice(1)}
                    </span>
                  </div>
                  <div className="profile-item">
                    <span className="label">Registered</span>
                    <span className="value">{formatDate(viewingTutor.registeredAt)}</span>
                  </div>
                </div>
              </div>
              
              <div className="profile-section">
                <h4>Exam Results</h4>
                <div className="profile-grid">
                  <div className="profile-item">
                    <span className="label">Written Exam</span>
                    <span className={`value ${viewingTutor.writtenExamPassed ? 'passed' : 'failed'}`}>
                      {viewingTutor.writtenExamScore !== undefined ? `${viewingTutor.writtenExamScore}%` : 'Not taken'}
                      {viewingTutor.writtenExamPassed && <i className="ri-check-line"></i>}
                    </span>
                  </div>
                  <div className="profile-item">
                    <span className="label">Speaking Exam</span>
                    <span className={`value ${viewingTutor.speakingExamPassed ? 'passed' : 'failed'}`}>
                      {viewingTutor.speakingExamScore !== undefined ? `${viewingTutor.speakingExamScore}%` : 'Not taken'}
                      {viewingTutor.speakingExamPassed && <i className="ri-check-line"></i>}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="profile-section">
                <h4>Teaching Stats</h4>
                <div className="profile-grid">
                  <div className="profile-item">
                    <span className="label">Total Sessions</span>
                    <span className="value">{viewingTutor.totalSessions}</span>
                  </div>
                  <div className="profile-item">
                    <span className="label">Rating</span>
                    <span className="value rating">
                      {viewingTutor.rating > 0 ? (
                        <><i className="ri-star-fill"></i> {viewingTutor.rating.toFixed(1)}</>
                      ) : (
                        'No ratings yet'
                      )}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="profile-section">
                <h4>Languages</h4>
                <div className="language-tags">
                  {(viewingTutor.languages || []).map((lang, i) => (
                    <span key={i} className="language-tag">{lang}</span>
                  ))}
                </div>
              </div>
              
              {viewingTutor.isSuspended && (
                <div className="profile-section suspension-section">
                  <h4><i className="ri-error-warning-line"></i> Suspension Details</h4>
                  <div className="suspension-details">
                    <div className="suspension-item">
                      <span className="label">Suspended Until</span>
                      <span className="value">{formatDate(viewingTutor.suspendedUntil!)}</span>
                    </div>
                    <div className="suspension-item">
                      <span className="label">Reason</span>
                      <span className="value reason">{viewingTutor.suspendedReason}</span>
                    </div>
                    {viewingTutor.suspendedAt && (
                      <div className="suspension-item">
                        <span className="label">Suspended On</span>
                        <span className="value">{formatDate(viewingTutor.suspendedAt)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={closeProfileModal}>
                Close
              </button>
              {viewingTutor.isSuspended ? (
                <button 
                  className="btn-unsuspend" 
                  onClick={() => {
                    handleUnsuspendTutor(viewingTutor);
                    closeProfileModal();
                  }}
                >
                  <i className="ri-checkbox-circle-line"></i> Unsuspend Tutor
                </button>
              ) : (
                <button 
                  className="btn-suspend" 
                  onClick={() => {
                    closeProfileModal();
                    openSuspendModal(viewingTutor);
                  }}
                >
                  <i className="ri-forbid-line"></i> Suspend Tutor
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Suspension History Modal */}
      {showHistoryModal && historyTutor && (
        <div className="modal-overlay" onClick={closeHistoryModal}>
          <div className="modal-content history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><i className="ri-history-line"></i> Suspension History</h3>
              <button className="modal-close" onClick={closeHistoryModal}>
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="history-user-info">
                <div className="history-avatar">
                  <span>{historyTutor.name?.charAt(0) || 'T'}</span>
                </div>
                <div className="history-details">
                  <span className="history-name">{historyTutor.name}</span>
                  <span className="history-email">{historyTutor.email}</span>
                </div>
              </div>
              
              {historyLoading ? (
                <div className="history-loading">
                  <i className="ri-loader-4-line spinning"></i>
                  <span>Loading history...</span>
                </div>
              ) : suspensionHistory.length === 0 ? (
                <div className="history-empty">
                  <i className="ri-shield-check-line"></i>
                  <p>No suspension history for this tutor</p>
                </div>
              ) : (
                <div className="history-timeline">
                  {suspensionHistory.map((item, index) => (
                    <div key={item.id} className={`history-item ${item.action}`}>
                      <div className="history-icon">
                        {item.action === 'suspended' && <i className="ri-forbid-line"></i>}
                        {item.action === 'unsuspended' && <i className="ri-checkbox-circle-line"></i>}
                        {item.action === 'auto-unsuspended' && <i className="ri-time-line"></i>}
                      </div>
                      <div className="history-content">
                        <div className="history-action">
                          {item.action === 'suspended' && 'Suspended'}
                          {item.action === 'unsuspended' && 'Unsuspended'}
                          {item.action === 'auto-unsuspended' && 'Auto-Unsuspended'}
                        </div>
                        <div className="history-date">{formatDate(item.createdAt)}</div>
                        <div className="history-reason">{item.reason}</div>
                        {item.until && item.action === 'suspended' && (
                          <div className="history-until">
                            <i className="ri-calendar-line"></i> Until: {formatDate(item.until)}
                          </div>
                        )}
                        {item.suspendedBy && (
                          <div className="history-by">
                            <i className="ri-user-line"></i> By: {item.suspendedBy}
                          </div>
                        )}
                        {item.unsuspendedBy && (
                          <div className="history-by">
                            <i className="ri-user-line"></i> By: {item.unsuspendedBy}
                          </div>
                        )}
                      </div>
                      {index < suspensionHistory.length - 1 && <div className="history-line"></div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={closeHistoryModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TutorsPage;
