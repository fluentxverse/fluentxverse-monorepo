import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Link } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import './StudentDashboard.css';

export const StudentDashboard = () => {
  const { user } = useAuthContext();
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [pastSessions, setPastSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch student's sessions from API
    setLoading(false);
  }, []);

  return (
    <div className="student-dashboard">
      <div className="container">
        <div className="dashboard-header">
          <h1>Welcome back, {user?.firstName}!</h1>
          <p>Continue your learning journey</p>
        </div>

        <div className="dashboard-grid">
          {/* Quick Stats */}
          <div className="dashboard-card stats-card">
            <h3>Your Progress</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-value">0</span>
                <span className="stat-label">Total Sessions</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">0h</span>
                <span className="stat-label">Learning Time</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">-</span>
                <span className="stat-label">Current Tutor</span>
              </div>
            </div>
          </div>

          {/* Upcoming Sessions */}
          <div className="dashboard-card upcoming-sessions">
            <div className="card-header">
              <h3>Upcoming Sessions</h3>
              <Link to="/browse-tutors" className="btn-link">Book Session</Link>
            </div>
            {loading ? (
              <p>Loading...</p>
            ) : upcomingSessions.length === 0 ? (
              <div className="empty-state">
                <i className="ri-calendar-line"></i>
                <p>No upcoming sessions</p>
                <Link to="/browse-tutors" className="btn-primary">Find a Tutor</Link>
              </div>
            ) : (
              <div className="sessions-list">
                {upcomingSessions.map((session: any) => (
                  <div key={session.id} className="session-item">
                    {/* Session details */}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="dashboard-card recent-activity">
            <h3>Recent Activity</h3>
            {pastSessions.length === 0 ? (
              <div className="empty-state">
                <i className="ri-history-line"></i>
                <p>No past sessions yet</p>
              </div>
            ) : (
              <div className="activity-list">
                {pastSessions.map((session: any) => (
                  <div key={session.id} className="activity-item">
                    {/* Activity details */}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="dashboard-card quick-actions">
            <h3>Quick Actions</h3>
            <div className="actions-grid">
              <Link to="/browse-tutors" className="action-button">
                <i className="ri-search-line"></i>
                <span>Find Tutors</span>
              </Link>
              <Link to="/schedule" className="action-button">
                <i className="ri-calendar-check-line"></i>
                <span>View Schedule</span>
              </Link>
              <Link to="/settings" className="action-button">
                <i className="ri-settings-line"></i>
                <span>Settings</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
