import { h } from 'preact';
import { useState } from 'preact/hooks';
import './ExamsPage.css';

interface ExamResult {
  id: string;
  tutorName: string;
  tutorEmail: string;
  examType: 'written' | 'speaking';
  score: number;
  passed: boolean;
  completedAt: string;
  duration: string;
  attemptNumber: number;
}

const ExamsPage = () => {
  const [examType, setExamType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Mock data
  const examResults: ExamResult[] = [
    {
      id: '1',
      tutorName: 'Sarah Johnson',
      tutorEmail: 'sarah@example.com',
      examType: 'speaking',
      score: 88,
      passed: true,
      completedAt: '2024-01-15 14:30',
      duration: '25 min',
      attemptNumber: 1
    },
    {
      id: '2',
      tutorName: 'Michael Chen',
      tutorEmail: 'michael@example.com',
      examType: 'written',
      score: 92,
      passed: true,
      completedAt: '2024-01-15 13:45',
      duration: '45 min',
      attemptNumber: 1
    },
    {
      id: '3',
      tutorName: 'Emily Davis',
      tutorEmail: 'emily@example.com',
      examType: 'written',
      score: 65,
      passed: false,
      completedAt: '2024-01-15 12:20',
      duration: '52 min',
      attemptNumber: 2
    },
    {
      id: '4',
      tutorName: 'Robert Wilson',
      tutorEmail: 'robert@example.com',
      examType: 'speaking',
      score: 55,
      passed: false,
      completedAt: '2024-01-14 16:15',
      duration: '28 min',
      attemptNumber: 1
    },
    {
      id: '5',
      tutorName: 'Maria Garcia',
      tutorEmail: 'maria@example.com',
      examType: 'written',
      score: 95,
      passed: true,
      completedAt: '2024-01-14 11:00',
      duration: '38 min',
      attemptNumber: 1
    },
    {
      id: '6',
      tutorName: 'James Brown',
      tutorEmail: 'james@example.com',
      examType: 'speaking',
      score: 72,
      passed: false,
      completedAt: '2024-01-14 09:30',
      duration: '30 min',
      attemptNumber: 2
    }
  ];

  const filteredResults = examResults.filter(result => {
    const matchesType = examType === 'all' || result.examType === examType;
    const matchesSearch = result.tutorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          result.tutorEmail.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const stats = {
    totalExams: examResults.length,
    writtenExams: examResults.filter(e => e.examType === 'written').length,
    speakingExams: examResults.filter(e => e.examType === 'speaking').length,
    passRate: Math.round((examResults.filter(e => e.passed).length / examResults.length) * 100),
    avgScore: Math.round(examResults.reduce((sum, e) => sum + e.score, 0) / examResults.length)
  };

  return (
    <div className="exams-page">
      <div className="page-header">
        <div className="header-content">
          <h1>Exam Results</h1>
          <p>View and manage tutor certification exam results</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary">
            <i className="fas fa-download"></i> Export Results
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="stats-overview">
        <div className="stat-card">
          <div className="stat-icon blue">
            <i className="fas fa-file-alt"></i>
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.totalExams}</span>
            <span className="stat-label">Total Exams</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">
            <i className="fas fa-pen"></i>
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.writtenExams}</span>
            <span className="stat-label">Written Exams</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow">
            <i className="fas fa-microphone"></i>
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.speakingExams}</span>
            <span className="stat-label">Speaking Exams</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">
            <i className="fas fa-chart-line"></i>
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.passRate}%</span>
            <span className="stat-label">Pass Rate</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange">
            <i className="fas fa-star"></i>
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.avgScore}</span>
            <span className="stat-label">Avg Score</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-box">
          <i className="fas fa-search"></i>
          <input 
            type="text" 
            placeholder="Search by tutor name or email..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
          />
        </div>
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${examType === 'all' ? 'active' : ''}`}
            onClick={() => setExamType('all')}
          >
            All Exams
          </button>
          <button 
            className={`filter-tab ${examType === 'written' ? 'active' : ''}`}
            onClick={() => setExamType('written')}
          >
            <i className="fas fa-pen"></i> Written
          </button>
          <button 
            className={`filter-tab ${examType === 'speaking' ? 'active' : ''}`}
            onClick={() => setExamType('speaking')}
          >
            <i className="fas fa-microphone"></i> Speaking
          </button>
        </div>
      </div>

      {/* Results Table */}
      <div className="results-table-card">
        <table className="results-table">
          <thead>
            <tr>
              <th>Tutor</th>
              <th>Exam Type</th>
              <th>Score</th>
              <th>Result</th>
              <th>Attempt</th>
              <th>Duration</th>
              <th>Completed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredResults.map(result => (
              <tr key={result.id}>
                <td>
                  <div className="tutor-info">
                    <div className="tutor-avatar">
                      <span>{result.tutorName.charAt(0)}</span>
                    </div>
                    <div className="tutor-details">
                      <span className="tutor-name">{result.tutorName}</span>
                      <span className="tutor-email">{result.tutorEmail}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`exam-type-badge ${result.examType}`}>
                    <i className={`fas ${result.examType === 'written' ? 'fa-pen' : 'fa-microphone'}`}></i>
                    {result.examType === 'written' ? 'Written' : 'Speaking'}
                  </span>
                </td>
                <td>
                  <div className="score-display">
                    <div className="score-bar-bg">
                      <div 
                        className={`score-bar ${result.passed ? 'passed' : 'failed'}`}
                        style={{ width: `${result.score}%` }}
                      ></div>
                    </div>
                    <span className="score-value">{result.score}%</span>
                  </div>
                </td>
                <td>
                  <span className={`result-badge ${result.passed ? 'passed' : 'failed'}`}>
                    <i className={`fas ${result.passed ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                    {result.passed ? 'Passed' : 'Failed'}
                  </span>
                </td>
                <td className="attempt-cell">
                  <span className="attempt-number">#{result.attemptNumber}</span>
                </td>
                <td className="duration-cell">{result.duration}</td>
                <td className="date-cell">{result.completedAt}</td>
                <td>
                  <div className="action-buttons">
                    <button className="action-btn view" title="View Details">
                      <i className="fas fa-eye"></i>
                    </button>
                    {result.examType === 'speaking' && (
                      <button className="action-btn play" title="Play Recording">
                        <i className="fas fa-play"></i>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredResults.length === 0 && (
          <div className="empty-state">
            <i className="fas fa-file-alt"></i>
            <p>No exam results found matching your criteria</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamsPage;
