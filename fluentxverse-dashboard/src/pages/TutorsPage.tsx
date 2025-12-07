import { useState, useEffect } from 'preact/hooks';
import { adminApi, TutorListItem } from '../api/admin.api';
import './TutorsPage.css';

type TutorStatus = 'all' | 'certified' | 'pending' | 'processing' | 'failed';

const TutorsPage = () => {
  const [tutors, setTutors] = useState<TutorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<TutorStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 15;

  useEffect(() => {
    loadTutors();
  }, [page, filter]);

  const loadTutors = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await adminApi.getTutors({
        page,
        limit,
        status: filter,
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

  const handleSearch = (e: Event) => {
    e.preventDefault();
    setPage(1);
    loadTutors();
  };

  const handleFilterChange = (newFilter: TutorStatus) => {
    setFilter(newFilter);
    setPage(1);
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

  const stats = {
    total: total,
    certified: tutors.filter(t => t.status === 'certified').length,
    pending: tutors.filter(t => t.status === 'pending' || t.status === 'processing').length,
    failed: tutors.filter(t => t.status === 'failed').length
  };

  return (
    <div className="tutors-page">
      <div className="page-header">
        <div className="header-content">
          <h1>Tutors Management</h1>
          <p>Manage tutor accounts and certification status</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="quick-stats">
        <div className={`quick-stat ${filter === 'all' ? 'active' : ''}`} onClick={() => handleFilterChange('all')}>
          <span className="stat-number">{total}</span>
          <span className="stat-label">Total Tutors</span>
        </div>
        <div className={`quick-stat certified ${filter === 'certified' ? 'active' : ''}`} onClick={() => handleFilterChange('certified')}>
          <span className="stat-number">{stats.certified}</span>
          <span className="stat-label">Certified</span>
        </div>
        <div className={`quick-stat pending ${filter === 'pending' ? 'active' : ''}`} onClick={() => handleFilterChange('pending')}>
          <span className="stat-number">{stats.pending}</span>
          <span className="stat-label">Pending</span>
        </div>
        <div className={`quick-stat failed ${filter === 'failed' ? 'active' : ''}`} onClick={() => handleFilterChange('failed')}>
          <span className="stat-number">{stats.failed}</span>
          <span className="stat-label">Failed</span>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <i className="ri-error-warning-line"></i>
          {error}
        </div>
      )}

      {/* Filters & Search */}
      <div className="filters-bar">
        <form className="search-box" onSubmit={handleSearch}>
          <i className="ri-search-line"></i>
          <input 
            type="text" 
            placeholder="Search tutors..." 
            value={searchQuery}
            onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
          />
          <button type="submit" className="btn-search">Search</button>
        </form>
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => handleFilterChange('all')}
          >
            All
          </button>
          <button 
            className={`filter-tab ${filter === 'certified' ? 'active' : ''}`}
            onClick={() => handleFilterChange('certified')}
          >
            Certified
          </button>
          <button 
            className={`filter-tab ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => handleFilterChange('pending')}
          >
            Pending
          </button>
          <button 
            className={`filter-tab ${filter === 'processing' ? 'active' : ''}`}
            onClick={() => handleFilterChange('processing')}
          >
            Processing
          </button>
          <button 
            className={`filter-tab ${filter === 'failed' ? 'active' : ''}`}
            onClick={() => handleFilterChange('failed')}
          >
            Failed
          </button>
        </div>
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
    </div>
  );
};

export default TutorsPage;
