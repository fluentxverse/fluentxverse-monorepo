import { h } from 'preact';
import { useState } from 'preact/hooks';
import './TutorsPage.css';

interface Tutor {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  registeredAt: string;
  writtenExamPassed: boolean;
  speakingExamPassed: boolean;
  writtenExamScore?: number;
  speakingExamScore?: number;
  status: 'pending' | 'certified' | 'processing' | 'failed';
  languages: string[];
  totalSessions: number;
  rating: number;
}

const TutorsPage = () => {
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Mock data
  const tutors: Tutor[] = [
    {
      id: '1',
      name: 'Sarah Johnson',
      email: 'sarah@example.com',
      registeredAt: '2024-01-10',
      writtenExamPassed: true,
      speakingExamPassed: true,
      writtenExamScore: 92,
      speakingExamScore: 88,
      status: 'certified',
      languages: ['English', 'Spanish'],
      totalSessions: 156,
      rating: 4.9
    },
    {
      id: '2',
      name: 'Michael Chen',
      email: 'michael@example.com',
      registeredAt: '2024-01-12',
      writtenExamPassed: true,
      speakingExamPassed: false,
      writtenExamScore: 85,
      status: 'pending',
      languages: ['English', 'Mandarin'],
      totalSessions: 0,
      rating: 0
    },
    {
      id: '3',
      name: 'Emily Davis',
      email: 'emily@example.com',
      registeredAt: '2024-01-13',
      writtenExamPassed: false,
      speakingExamPassed: false,
      status: 'pending',
      languages: ['English', 'French'],
      totalSessions: 0,
      rating: 0
    },
    {
      id: '4',
      name: 'Robert Wilson',
      email: 'robert@example.com',
      registeredAt: '2024-01-14',
      writtenExamPassed: true,
      speakingExamPassed: false,
      writtenExamScore: 78,
      status: 'processing',
      languages: ['English', 'German'],
      totalSessions: 0,
      rating: 0
    },
    {
      id: '5',
      name: 'Maria Garcia',
      email: 'maria@example.com',
      registeredAt: '2024-01-08',
      writtenExamPassed: true,
      speakingExamPassed: true,
      writtenExamScore: 95,
      speakingExamScore: 91,
      status: 'certified',
      languages: ['English', 'Spanish', 'Portuguese'],
      totalSessions: 234,
      rating: 4.8
    },
    {
      id: '6',
      name: 'James Brown',
      email: 'james@example.com',
      registeredAt: '2024-01-11',
      writtenExamPassed: true,
      speakingExamPassed: false,
      writtenExamScore: 67,
      speakingExamScore: 58,
      status: 'failed',
      languages: ['English'],
      totalSessions: 0,
      rating: 0
    }
  ];

  const getStatusBadge = (tutor: Tutor) => {
    if (tutor.status === 'certified') {
      return <span className="status-badge certified"><i className="fas fa-certificate"></i> Certified</span>;
    } else if (tutor.status === 'processing') {
      return <span className="status-badge processing"><i className="fas fa-spinner fa-spin"></i> Processing</span>;
    } else if (tutor.status === 'failed') {
      return <span className="status-badge failed"><i className="fas fa-times-circle"></i> Failed</span>;
    } else {
      if (!tutor.writtenExamPassed) {
        return <span className="status-badge pending"><i className="fas fa-file-alt"></i> Pending Written</span>;
      } else {
        return <span className="status-badge pending-speaking"><i className="fas fa-microphone"></i> Pending Speaking</span>;
      }
    }
  };

  const filteredTutors = tutors.filter(tutor => {
    const matchesFilter = filter === 'all' || tutor.status === filter;
    const matchesSearch = tutor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          tutor.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: tutors.length,
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
        <button className="btn-primary">
          <i className="fas fa-plus"></i> Add Tutor
        </button>
      </div>

      {/* Quick Stats */}
      <div className="quick-stats">
        <div className="quick-stat" onClick={() => setFilter('all')}>
          <span className="stat-number">{stats.total}</span>
          <span className="stat-label">Total Tutors</span>
        </div>
        <div className="quick-stat certified" onClick={() => setFilter('certified')}>
          <span className="stat-number">{stats.certified}</span>
          <span className="stat-label">Certified</span>
        </div>
        <div className="quick-stat pending" onClick={() => setFilter('pending')}>
          <span className="stat-number">{stats.pending}</span>
          <span className="stat-label">Pending</span>
        </div>
        <div className="quick-stat failed" onClick={() => setFilter('failed')}>
          <span className="stat-number">{stats.failed}</span>
          <span className="stat-label">Failed</span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="filters-bar">
        <div className="search-box">
          <i className="fas fa-search"></i>
          <input 
            type="text" 
            placeholder="Search tutors..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
          />
        </div>
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button 
            className={`filter-tab ${filter === 'certified' ? 'active' : ''}`}
            onClick={() => setFilter('certified')}
          >
            Certified
          </button>
          <button 
            className={`filter-tab ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            Pending
          </button>
          <button 
            className={`filter-tab ${filter === 'processing' ? 'active' : ''}`}
            onClick={() => setFilter('processing')}
          >
            Processing
          </button>
          <button 
            className={`filter-tab ${filter === 'failed' ? 'active' : ''}`}
            onClick={() => setFilter('failed')}
          >
            Failed
          </button>
        </div>
      </div>

      {/* Tutors Table */}
      <div className="tutors-table-card">
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
            {filteredTutors.map(tutor => (
              <tr key={tutor.id}>
                <td className="tutor-cell">
                  <div className="tutor-info">
                    <div className="tutor-avatar">
                      {tutor.avatar ? (
                        <img src={tutor.avatar} alt={tutor.name} />
                      ) : (
                        <span>{tutor.name.charAt(0)}</span>
                      )}
                    </div>
                    <div className="tutor-details">
                      <span className="tutor-name">{tutor.name}</span>
                      <span className="tutor-email">{tutor.email}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="language-tags">
                    {tutor.languages.map((lang, i) => (
                      <span key={i} className="language-tag">{lang}</span>
                    ))}
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
                    <span className="processing-text"><i className="fas fa-spinner fa-spin"></i> Processing</span>
                  ) : (
                    <span className="not-taken">Not taken</span>
                  )}
                </td>
                <td>{getStatusBadge(tutor)}</td>
                <td className="sessions-cell">{tutor.totalSessions}</td>
                <td>
                  {tutor.rating > 0 ? (
                    <div className="rating">
                      <i className="fas fa-star"></i>
                      <span>{tutor.rating}</span>
                    </div>
                  ) : (
                    <span className="no-rating">—</span>
                  )}
                </td>
                <td>
                  <div className="action-buttons">
                    <button className="action-btn view" title="View Profile">
                      <i className="fas fa-eye"></i>
                    </button>
                    <button className="action-btn edit" title="Edit">
                      <i className="fas fa-edit"></i>
                    </button>
                    <button className="action-btn delete" title="Delete">
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredTutors.length === 0 && (
          <div className="empty-state">
            <i className="fas fa-user-slash"></i>
            <p>No tutors found matching your criteria</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TutorsPage;
