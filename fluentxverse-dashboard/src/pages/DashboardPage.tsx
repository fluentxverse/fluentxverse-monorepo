import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { useAuthContext } from '../context/AuthContext';
import { adminApi, type DashboardStats, type ExamStats, type PendingTutor, type RecentActivity } from '../api/admin.api';
import { interviewApi } from '../api/interview.api';
import './DashboardPage.css';

interface StatCard {
  title: string;
  value: string | number;
  icon: string;
  color: string;
}

interface InterviewStats {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  passRate: number;
  avgScores: {
    grammar: number;
    fluency: number;
    pronunciation: number;
    vocabulary: number;
    professionalism: number;
    overall: number;
  };
  weeklyData: { week: string; passed: number; failed: number }[];
  rubricDistribution: { category: string; scores: number[] }[];
}

interface TodayInterview {
  id: string;
  time: string;
  tutorId: string;
  tutorName: string;
  tutorEmail: string;
  status: string;
}

const DashboardPage = () => {
  const { user } = useAuthContext();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [examStats, setExamStats] = useState<ExamStats | null>(null);
  const [interviewStats, setInterviewStats] = useState<InterviewStats | null>(null);
  const [todayQueue, setTodayQueue] = useState<TodayInterview[]>([]);
  const [pendingTutors, setPendingTutors] = useState<PendingTutor[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsData, examData, tutorsData, activityData, interviewData, queueData] = await Promise.all([
        adminApi.getStats(),
        adminApi.getExamStats(),
        adminApi.getPendingTutors(5),
        adminApi.getRecentActivity(5),
        interviewApi.getStats().catch(() => null),
        interviewApi.getTodayQueue().catch(() => [])
      ]);

      setStats(statsData);
      setExamStats(examData);
      setPendingTutors(tutorsData);
      setRecentActivities(activityData);
      setInterviewStats(interviewData);
      setTodayQueue(queueData);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const statCards: StatCard[] = stats ? [
    {
      title: 'Total Tutors',
      value: stats.totalTutors,
      icon: 'fa-chalkboard-teacher',
      color: '#0245ae'
    },
    {
      title: 'Certified Tutors',
      value: stats.certifiedTutors,
      icon: 'fa-certificate',
      color: '#10b981'
    },
    {
      title: 'Total Students',
      value: stats.totalStudents,
      icon: 'fa-user-graduate',
      color: '#8b5cf6'
    },
    {
      title: 'Pending Tutors',
      value: stats.pendingTutors,
      icon: 'fa-clock',
      color: '#f59e0b'
    }
  ] : [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_written':
        return <span className="status-badge pending">Pending Written</span>;
      case 'pending_speaking':
        return <span className="status-badge in-progress">Pending Speaking</span>;
      case 'processing':
        return <span className="status-badge processing">Processing</span>;
      default:
        return <span className="status-badge">{status}</span>;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'exam_passed':
        return 'activity-icon success';
      case 'exam_failed':
        return 'activity-icon danger';
      case 'tutor_registered':
        return 'activity-icon primary';
      case 'student_joined':
        return 'activity-icon info';
      case 'booking':
        return 'activity-icon warning';
      default:
        return 'activity-icon';
    }
  };

  const getActivityIconClass = (type: string) => {
    switch (type) {
      case 'tutor_registered':
        return 'fa-user-plus';
      case 'student_joined':
        return 'fa-graduation-cap';
      case 'exam_passed':
        return 'fa-check-circle';
      case 'exam_failed':
        return 'fa-times-circle';
      case 'booking':
        return 'fa-calendar-check';
      default:
        return 'fa-bell';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="loading-state">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="error-state">
          <i className="fas fa-exclamation-circle"></i>
          <p>{error}</p>
          <button onClick={loadDashboardData} className="retry-btn">
            <i className="fas fa-redo"></i> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h1>Welcome back, {user?.username || 'Admin'}!</h1>
        <p>Here's an overview of your platform today.</p>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        {statCards.map((stat, index) => (
          <div className="stat-card" key={index} style={{ '--accent-color': stat.color } as any}>
            <div className="stat-icon">
              <i className={`fas ${stat.icon}`}></i>
            </div>
            <div className="stat-content">
              <h3>{stat.title}</h3>
              <div className="stat-value">{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="dashboard-content">
        {/* Exam Statistics */}
        {examStats && (
          <div className="dashboard-card exam-stats-card">
            <div className="card-header">
              <h2><i className="fas fa-chart-pie"></i> Exam Statistics</h2>
            </div>
            <div className="card-body">
              <div className="exam-stats-grid">
                <div className="exam-stat-section">
                  <h4>Written Exams</h4>
                  <div className="progress-stats">
                    <div className="progress-bar-container">
                      {examStats.writtenExams.total > 0 && (
                        <div 
                          className="progress-bar passed" 
                          style={{ width: `${(examStats.writtenExams.passed / examStats.writtenExams.total) * 100}%` }}
                        ></div>
                      )}
                    </div>
                    <div className="progress-labels">
                      <span className="passed-label">
                        <i className="fas fa-check-circle"></i> {examStats.writtenExams.passed} Passed
                      </span>
                      <span className="failed-label">
                        <i className="fas fa-times-circle"></i> {examStats.writtenExams.failed} Failed
                      </span>
                    </div>
                  </div>
                </div>
                <div className="exam-stat-section">
                  <h4>Speaking Exams</h4>
                  <div className="progress-stats">
                    <div className="progress-bar-container">
                      {examStats.speakingExams.total > 0 && (
                        <>
                          <div 
                            className="progress-bar passed" 
                            style={{ width: `${(examStats.speakingExams.passed / examStats.speakingExams.total) * 100}%` }}
                          ></div>
                          <div 
                            className="progress-bar processing" 
                            style={{ 
                              width: `${(examStats.speakingExams.processing / examStats.speakingExams.total) * 100}%`,
                              left: `${(examStats.speakingExams.passed / examStats.speakingExams.total) * 100}%`
                            }}
                          ></div>
                        </>
                      )}
                    </div>
                    <div className="progress-labels">
                      <span className="passed-label">
                        <i className="fas fa-check-circle"></i> {examStats.speakingExams.passed} Passed
                      </span>
                      <span className="processing-label">
                        <i className="fas fa-spinner fa-spin"></i> {examStats.speakingExams.processing} Processing
                      </span>
                      <span className="failed-label">
                        <i className="fas fa-times-circle"></i> {examStats.speakingExams.failed} Failed
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Interview Analytics */}
        {interviewStats && (
          <div className="dashboard-card interview-analytics-card">
            <div className="card-header">
              <h2><i className="fas fa-video"></i> Interview Analytics</h2>
              <a href="/interviews" className="view-all-link">View Schedule</a>
            </div>
            <div className="card-body">
              {/* Pass Rate Donut */}
              <div className="interview-stats-summary">
                <div className="donut-chart-container">
                  <svg viewBox="0 0 100 100" className="donut-chart">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="12" />
                    <circle 
                      cx="50" cy="50" r="40" fill="none" 
                      stroke="#10b981" strokeWidth="12"
                      strokeDasharray={`${interviewStats.passRate * 2.51} 251`}
                      strokeDashoffset="63"
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                    />
                    <text x="50" y="50" textAnchor="middle" dy="0.35em" className="donut-text">
                      {interviewStats.passRate}%
                    </text>
                  </svg>
                  <div className="donut-label">Pass Rate</div>
                </div>
                <div className="interview-counts">
                  <div className="count-item passed">
                    <i className="fas fa-check-circle"></i>
                    <span className="count-value">{interviewStats.passed}</span>
                    <span className="count-label">Passed</span>
                  </div>
                  <div className="count-item failed">
                    <i className="fas fa-times-circle"></i>
                    <span className="count-value">{interviewStats.failed}</span>
                    <span className="count-label">Failed</span>
                  </div>
                  <div className="count-item pending">
                    <i className="fas fa-clock"></i>
                    <span className="count-value">{interviewStats.pending}</span>
                    <span className="count-label">Pending</span>
                  </div>
                </div>
              </div>

              {/* Weekly Bar Chart */}
              {interviewStats.weeklyData.length > 0 && (
                <div className="weekly-chart">
                  <h4>Weekly Interviews</h4>
                  <div className="bar-chart">
                    {interviewStats.weeklyData.map((week, idx) => {
                      const maxVal = Math.max(...interviewStats.weeklyData.flatMap(w => [w.passed, w.failed]), 1);
                      return (
                        <div className="bar-group" key={idx}>
                          <div className="bars">
                            <div 
                              className="bar passed" 
                              style={{ height: `${(week.passed / maxVal) * 100}%` }}
                              title={`${week.passed} passed`}
                            ></div>
                            <div 
                              className="bar failed" 
                              style={{ height: `${(week.failed / maxVal) * 100}%` }}
                              title={`${week.failed} failed`}
                            ></div>
                          </div>
                          <span className="bar-label">{new Date(week.week).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="chart-legend">
                    <span className="legend-item passed"><span className="legend-dot"></span> Passed</span>
                    <span className="legend-item failed"><span className="legend-dot"></span> Failed</span>
                  </div>
                </div>
              )}

              {/* Average Scores */}
              <div className="avg-scores">
                <h4>Average Rubric Scores</h4>
                <div className="scores-grid">
                  {[
                    { key: 'grammar', label: 'Grammar', icon: 'fa-spell-check' },
                    { key: 'fluency', label: 'Fluency', icon: 'fa-water' },
                    { key: 'pronunciation', label: 'Pronunciation', icon: 'fa-volume-up' },
                    { key: 'vocabulary', label: 'Vocabulary', icon: 'fa-book' },
                    { key: 'professionalism', label: 'Professional', icon: 'fa-user-tie' }
                  ].map(({ key, label, icon }) => (
                    <div className="score-item" key={key}>
                      <div className="score-icon"><i className={`fas ${icon}`}></i></div>
                      <div className="score-bar-bg">
                        <div 
                          className="score-bar-fill" 
                          style={{ width: `${((interviewStats.avgScores as any)[key] / 5) * 100}%` }}
                        ></div>
                      </div>
                      <span className="score-value">{(interviewStats.avgScores as any)[key]}</span>
                    </div>
                  ))}
                </div>
                <div className="overall-score">
                  <span>Overall Average</span>
                  <strong>{interviewStats.avgScores.overall}/5</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Today's Interview Queue */}
        <div className="dashboard-card today-queue-card">
          <div className="card-header">
            <h2><i className="fas fa-calendar-day"></i> Today's Interviews</h2>
            <span className="queue-count">{todayQueue.length} scheduled</span>
          </div>
          <div className="card-body">
            {todayQueue.length > 0 ? (
              <div className="queue-list">
                {todayQueue.map((interview) => {
                  // Check if interview time has passed (give 1 hour window)
                  const now = new Date();
                  const [hours, minutes] = interview.time.split(':').map(Number);
                  const interviewTime = new Date();
                  // Handle 12-hour format with AM/PM
                  const timeParts = interview.time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
                  if (timeParts) {
                    let h = parseInt(timeParts[1]);
                    const m = parseInt(timeParts[2]);
                    const ampm = timeParts[3];
                    if (ampm) {
                      if (ampm.toUpperCase() === 'PM' && h !== 12) h += 12;
                      if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
                    }
                    interviewTime.setHours(h, m, 0, 0);
                  }
                  // Add 1 hour grace period
                  interviewTime.setHours(interviewTime.getHours() + 1);
                  const isPast = now > interviewTime;
                  const isActive = interview.status === 'in_progress';
                  
                  return (
                    <div className={`queue-item ${isPast && !isActive ? 'past' : ''}`} key={interview.id}>
                      <div className="queue-time">
                        <i className="fas fa-clock"></i>
                        {interview.time}
                      </div>
                      <div className="queue-tutor">
                        <div className="tutor-avatar">
                          {interview.tutorName.charAt(0)}
                        </div>
                        <div className="tutor-info">
                          <span className="tutor-name">{interview.tutorName}</span>
                          <span className="tutor-email">{interview.tutorEmail}</span>
                        </div>
                      </div>
                      <div className="queue-status">
                        <span className={`status-dot ${interview.status} ${isPast && !isActive ? 'missed' : ''}`}></span>
                        {isActive ? 'In Progress' : isPast ? 'Missed' : 'Scheduled'}
                      </div>
                      {isPast && !isActive ? (
                        <span className="join-btn disabled">
                          <i className="fas fa-clock"></i> Passed
                        </span>
                      ) : (
                        <a 
                          href={`/interview/room/${interview.id}?tutorId=${interview.tutorId}`} 
                          className="join-btn"
                        >
                          <i className="fas fa-video"></i> Join
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <i className="fas fa-calendar-check" style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.5 }}></i>
                <p>No interviews scheduled for today</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="dashboard-card activity-card">
          <div className="card-header">
            <h2><i className="fas fa-history"></i> Recent Activity</h2>
            <a href="/reports" className="view-all-link">View All</a>
          </div>
          <div className="card-body">
            {recentActivities.length > 0 ? (
              <div className="activity-list">
                {recentActivities.map((activity) => (
                  <div className="activity-item" key={activity.id}>
                    <div className={getActivityIcon(activity.type)}>
                      <i className={`fas ${getActivityIconClass(activity.type)}`}></i>
                    </div>
                    <div className="activity-content">
                      <p>{activity.message}</p>
                      <span className="activity-time">{formatTimeAgo(activity.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No recent activity</p>
              </div>
            )}
          </div>
        </div>

        {/* Pending Tutors */}
        <div className="dashboard-card pending-tutors-card">
          <div className="card-header">
            <h2><i className="fas fa-user-clock"></i> Pending Tutors</h2>
            <a href="/tutors?status=pending" className="view-all-link">View All</a>
          </div>
          <div className="card-body">
            {pendingTutors.length > 0 ? (
              <div className="pending-tutors-table">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Registered</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingTutors.map((tutor) => (
                      <tr key={tutor.id}>
                        <td className="tutor-name">{tutor.name}</td>
                        <td className="tutor-email">{tutor.email}</td>
                        <td className="tutor-date">{formatDate(tutor.registeredAt)}</td>
                        <td>{getStatusBadge(tutor.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <p>No pending tutors</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
