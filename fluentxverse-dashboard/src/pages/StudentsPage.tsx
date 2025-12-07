import { useState, useEffect } from 'preact/hooks';
import { adminApi, StudentListItem } from '../api/admin.api';
import './StudentsPage.css';

type StudentStatus = 'all' | 'active' | 'inactive';

const StudentsPage = () => {
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<StudentStatus>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 12;

  useEffect(() => {
    loadStudents();
  }, [page, filter]);

  const loadStudents = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await adminApi.getStudents({
        page,
        limit,
        status: filter,
        search: searchQuery || undefined,
      });
      setStudents(result.students);
      setTotal(result.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: Event) => {
    e.preventDefault();
    setPage(1);
    loadStudents();
  };

  const handleFilterChange = (newFilter: StudentStatus) => {
    setFilter(newFilter);
    setPage(1);
  };

  const stats = {
    total: total,
    active: students.filter(s => s.status === 'active').length,
    totalRevenue: students.reduce((sum, s) => sum + s.totalSpent, 0),
    totalSessions: students.reduce((sum, s) => sum + s.totalSessions, 0)
  };

  const totalPages = Math.ceil(total / limit);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="students-page">
      <div className="page-header">
        <div className="header-content">
          <h1>Students Management</h1>
          <p>View and manage student accounts</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="quick-stats">
        <div className="quick-stat">
          <div className="stat-icon blue">
            <i className="ri-group-line"></i>
          </div>
          <div className="stat-info">
            <span className="stat-number">{total}</span>
            <span className="stat-label">Total Students</span>
          </div>
        </div>
        <div className="quick-stat">
          <div className="stat-icon green">
            <i className="ri-user-follow-line"></i>
          </div>
          <div className="stat-info">
            <span className="stat-number">{stats.active}</span>
            <span className="stat-label">Active Students</span>
          </div>
        </div>
        <div className="quick-stat">
          <div className="stat-icon purple">
            <i className="ri-calendar-check-line"></i>
          </div>
          <div className="stat-info">
            <span className="stat-number">{stats.totalSessions}</span>
            <span className="stat-label">Total Sessions</span>
          </div>
        </div>
        <div className="quick-stat">
          <div className="stat-icon yellow">
            <i className="ri-money-dollar-circle-line"></i>
          </div>
          <div className="stat-info">
            <span className="stat-number">${stats.totalRevenue.toLocaleString()}</span>
            <span className="stat-label">Total Revenue</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <i className="ri-error-warning-line"></i>
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="filters-bar">
        <form className="search-box" onSubmit={handleSearch}>
          <i className="ri-search-line"></i>
          <input 
            type="text" 
            placeholder="Search students..." 
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
            All Students
          </button>
          <button 
            className={`filter-tab ${filter === 'active' ? 'active' : ''}`}
            onClick={() => handleFilterChange('active')}
          >
            Active
          </button>
          <button 
            className={`filter-tab ${filter === 'inactive' ? 'active' : ''}`}
            onClick={() => handleFilterChange('inactive')}
          >
            Inactive
          </button>
        </div>
      </div>

      {/* Students Grid */}
      {loading ? (
        <div className="loading-state">
          <i className="ri-loader-4-line spinning"></i>
          <span>Loading students...</span>
        </div>
      ) : (
        <div className="students-grid">
          {students.map(student => (
            <div className="student-card" key={student.id}>
              <div className="student-header">
                <div className="student-avatar">
                  <span>{student.name?.charAt(0) || 'S'}</span>
                  <span className={`status-dot ${student.status}`}></span>
                </div>
                <div className="student-info">
                  <h3>{student.name}</h3>
                  <p>{student.email}</p>
                </div>
              </div>
              
              <div className="student-stats">
                <div className="stat-item">
                  <span className="stat-value">{student.totalSessions}</span>
                  <span className="stat-label">Sessions</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">${student.totalSpent.toFixed(2)}</span>
                  <span className="stat-label">Spent</span>
                </div>
              </div>

              <div className="student-meta">
                <span className="joined-date">
                  <i className="ri-calendar-line"></i>
                  Joined {formatDate(student.joinedAt)}
                </span>
              </div>

              <div className="student-footer">
                <span className="last-active">
                  <i className="ri-time-line"></i> {student.lastActive}
                </span>
                <div className="actions">
                  <button className="action-btn" title="View Profile">
                    <i className="ri-eye-line"></i>
                  </button>
                  <button className="action-btn" title="Message">
                    <i className="ri-mail-line"></i>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && students.length === 0 && (
        <div className="empty-state">
          <i className="ri-user-search-line"></i>
          <p>No students found matching your criteria</p>
        </div>
      )}

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

export default StudentsPage;
