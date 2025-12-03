import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { useAuthContext } from '../context/AuthContext';
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
          <h1>Welcome back, {user?.givenName}!</h1>
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
              <a href="/browse-tutors" className="btn-link">Book Session</a>
            </div>
            {loading ? (
              <p>Loading...</p>
            ) : upcomingSessions.length === 0 ? (
              <div className="empty-state">
                <i className="ri-calendar-line"></i>
                <p>No upcoming sessions</p>
                <a href="/browse-tutors" className="btn-primary">Find a Tutor</a>
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
              <a href="/browse-tutors" className="action-button">
                <i className="ri-search-line"></i>
                <span>Find Tutors</span>
              </a>
              <a href="/schedule" className="action-button">
                <i className="ri-calendar-check-line"></i>
                <span>View Schedule</span>
              </a>
              <a href="/settings" className="action-button">
                <i className="ri-settings-line"></i>
                <span>Settings</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
