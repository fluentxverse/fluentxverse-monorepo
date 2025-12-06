import { h } from 'preact';
import { useState } from 'preact/hooks';
import './StudentsPage.css';

interface Student {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  joinedAt: string;
  totalSessions: number;
  totalSpent: number;
  status: 'active' | 'inactive';
  lastActive: string;
  languages: string[];
}

const StudentsPage = () => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filter, setFilter] = useState<string>('all');

  // Mock data
  const students: Student[] = [
    {
      id: '1',
      name: 'Alex Thompson',
      email: 'alex@example.com',
      joinedAt: '2024-01-05',
      totalSessions: 45,
      totalSpent: 675.00,
      status: 'active',
      lastActive: '2 hours ago',
      languages: ['Spanish', 'French']
    },
    {
      id: '2',
      name: 'Jessica Lee',
      email: 'jessica@example.com',
      joinedAt: '2024-01-08',
      totalSessions: 28,
      totalSpent: 420.00,
      status: 'active',
      lastActive: '1 day ago',
      languages: ['Mandarin']
    },
    {
      id: '3',
      name: 'Daniel Kim',
      email: 'daniel@example.com',
      joinedAt: '2023-12-15',
      totalSessions: 67,
      totalSpent: 1005.00,
      status: 'active',
      lastActive: '5 minutes ago',
      languages: ['Japanese', 'Korean']
    },
    {
      id: '4',
      name: 'Emma Williams',
      email: 'emma@example.com',
      joinedAt: '2023-11-20',
      totalSessions: 12,
      totalSpent: 180.00,
      status: 'inactive',
      lastActive: '2 weeks ago',
      languages: ['German']
    },
    {
      id: '5',
      name: 'Ryan Martinez',
      email: 'ryan@example.com',
      joinedAt: '2024-01-12',
      totalSessions: 8,
      totalSpent: 120.00,
      status: 'active',
      lastActive: '3 hours ago',
      languages: ['Portuguese', 'Spanish']
    }
  ];

  const filteredStudents = students.filter(student => {
    const matchesFilter = filter === 'all' || student.status === filter;
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          student.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: students.length,
    active: students.filter(s => s.status === 'active').length,
    totalRevenue: students.reduce((sum, s) => sum + s.totalSpent, 0),
    totalSessions: students.reduce((sum, s) => sum + s.totalSessions, 0)
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
            <i className="fas fa-users"></i>
          </div>
          <div className="stat-info">
            <span className="stat-number">{stats.total}</span>
            <span className="stat-label">Total Students</span>
          </div>
        </div>
        <div className="quick-stat">
          <div className="stat-icon green">
            <i className="fas fa-user-check"></i>
          </div>
          <div className="stat-info">
            <span className="stat-number">{stats.active}</span>
            <span className="stat-label">Active Students</span>
          </div>
        </div>
        <div className="quick-stat">
          <div className="stat-icon purple">
            <i className="fas fa-calendar-check"></i>
          </div>
          <div className="stat-info">
            <span className="stat-number">{stats.totalSessions}</span>
            <span className="stat-label">Total Sessions</span>
          </div>
        </div>
        <div className="quick-stat">
          <div className="stat-icon yellow">
            <i className="fas fa-dollar-sign"></i>
          </div>
          <div className="stat-info">
            <span className="stat-number">${stats.totalRevenue.toLocaleString()}</span>
            <span className="stat-label">Total Revenue</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-box">
          <i className="fas fa-search"></i>
          <input 
            type="text" 
            placeholder="Search students..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
          />
        </div>
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Students
          </button>
          <button 
            className={`filter-tab ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            Active
          </button>
          <button 
            className={`filter-tab ${filter === 'inactive' ? 'active' : ''}`}
            onClick={() => setFilter('inactive')}
          >
            Inactive
          </button>
        </div>
      </div>

      {/* Students Grid */}
      <div className="students-grid">
        {filteredStudents.map(student => (
          <div className="student-card" key={student.id}>
            <div className="student-header">
              <div className="student-avatar">
                {student.avatar ? (
                  <img src={student.avatar} alt={student.name} />
                ) : (
                  <span>{student.name.charAt(0)}</span>
                )}
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
                <span className="stat-value">${student.totalSpent}</span>
                <span className="stat-label">Spent</span>
              </div>
            </div>

            <div className="student-languages">
              <span className="label">Learning:</span>
              <div className="language-tags">
                {student.languages.map((lang, i) => (
                  <span key={i} className="language-tag">{lang}</span>
                ))}
              </div>
            </div>

            <div className="student-footer">
              <span className="last-active">
                <i className="fas fa-clock"></i> {student.lastActive}
              </span>
              <div className="actions">
                <button className="action-btn" title="View Profile">
                  <i className="fas fa-eye"></i>
                </button>
                <button className="action-btn" title="Message">
                  <i className="fas fa-envelope"></i>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredStudents.length === 0 && (
        <div className="empty-state">
          <i className="fas fa-user-slash"></i>
          <p>No students found matching your criteria</p>
        </div>
      )}
    </div>
  );
};

export default StudentsPage;
