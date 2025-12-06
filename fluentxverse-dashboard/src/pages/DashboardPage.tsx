import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { adminApi, type DashboardStats, type ExamStats, type PendingTutor, type RecentActivity } from '../api/admin.api';
import './DashboardPage.css';

interface StatCard {
  title: string;
  value: string | number;
  icon: string;
  color: string;
}

const DashboardPage = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [examStats, setExamStats] = useState<ExamStats | null>(null);
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

      const [statsData, examData, tutorsData, activityData] = await Promise.all([
        adminApi.getStats(),
        adminApi.getExamStats(),
        adminApi.getPendingTutors(5),
        adminApi.getRecentActivity(5)
      ]);

      setStats(statsData);
      setExamStats(examData);
      setPendingTutors(tutorsData);
      setRecentActivities(activityData);
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
        <h1>Dashboard</h1>
        <p>Welcome back! Here's an overview of your platform.</p>
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
