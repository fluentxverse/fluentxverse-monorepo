import { h } from 'preact';
import './ReportsPage.css';

const ReportsPage = () => {
  // Mock data for reports
  const weeklyData = [
    { day: 'Mon', sessions: 45, revenue: 675 },
    { day: 'Tue', sessions: 52, revenue: 780 },
    { day: 'Wed', sessions: 38, revenue: 570 },
    { day: 'Thu', sessions: 61, revenue: 915 },
    { day: 'Fri', sessions: 55, revenue: 825 },
    { day: 'Sat', sessions: 72, revenue: 1080 },
    { day: 'Sun', sessions: 48, revenue: 720 },
  ];

  const topTutors = [
    { name: 'Maria Garcia', sessions: 234, rating: 4.9, revenue: 3510 },
    { name: 'Sarah Johnson', sessions: 198, rating: 4.8, revenue: 2970 },
    { name: 'David Lee', sessions: 176, rating: 4.7, revenue: 2640 },
    { name: 'Emma Wilson', sessions: 165, rating: 4.9, revenue: 2475 },
    { name: 'James Brown', sessions: 152, rating: 4.6, revenue: 2280 },
  ];

  const languageStats = [
    { language: 'Spanish', students: 423, percentage: 32 },
    { language: 'Mandarin', students: 287, percentage: 22 },
    { language: 'French', students: 198, percentage: 15 },
    { language: 'German', students: 156, percentage: 12 },
    { language: 'Japanese', students: 134, percentage: 10 },
    { language: 'Other', students: 119, percentage: 9 },
  ];

  const maxSessions = Math.max(...weeklyData.map(d => d.sessions));

  return (
    <div className="reports-page">
      <div className="page-header">
        <div className="header-content">
          <h1>Reports & Analytics</h1>
          <p>Platform performance insights and statistics</p>
        </div>
        <div className="header-actions">
          <select className="period-select">
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
          <button className="btn-secondary">
            <i className="fas fa-download"></i> Export Report
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="summary-stats">
        <div className="summary-card">
          <div className="summary-icon blue">
            <i className="fas fa-calendar-check"></i>
          </div>
          <div className="summary-content">
            <span className="summary-value">371</span>
            <span className="summary-label">Total Sessions</span>
            <span className="summary-trend positive">
              <i className="fas fa-arrow-up"></i> 12% vs last week
            </span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon green">
            <i className="fas fa-dollar-sign"></i>
          </div>
          <div className="summary-content">
            <span className="summary-value">$5,565</span>
            <span className="summary-label">Total Revenue</span>
            <span className="summary-trend positive">
              <i className="fas fa-arrow-up"></i> 8% vs last week
            </span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon purple">
            <i className="fas fa-user-plus"></i>
          </div>
          <div className="summary-content">
            <span className="summary-value">47</span>
            <span className="summary-label">New Students</span>
            <span className="summary-trend positive">
              <i className="fas fa-arrow-up"></i> 23% vs last week
            </span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon yellow">
            <i className="fas fa-certificate"></i>
          </div>
          <div className="summary-content">
            <span className="summary-value">12</span>
            <span className="summary-label">New Tutors Certified</span>
            <span className="summary-trend negative">
              <i className="fas fa-arrow-down"></i> 5% vs last week
            </span>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        {/* Weekly Sessions Chart */}
        <div className="chart-card">
          <div className="card-header">
            <h2><i className="fas fa-chart-bar"></i> Weekly Sessions</h2>
          </div>
          <div className="card-body">
            <div className="bar-chart">
              {weeklyData.map((data, index) => (
                <div className="bar-column" key={index}>
                  <div className="bar-wrapper">
                    <div 
                      className="bar" 
                      style={{ height: `${(data.sessions / maxSessions) * 100}%` }}
                    >
                      <span className="bar-value">{data.sessions}</span>
                    </div>
                  </div>
                  <span className="bar-label">{data.day}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Language Distribution */}
        <div className="chart-card">
          <div className="card-header">
            <h2><i className="fas fa-globe"></i> Language Distribution</h2>
          </div>
          <div className="card-body">
            <div className="language-stats">
              {languageStats.map((stat, index) => (
                <div className="language-item" key={index}>
                  <div className="language-info">
                    <span className="language-name">{stat.language}</span>
                    <span className="language-count">{stat.students} students</span>
                  </div>
                  <div className="language-bar-wrapper">
                    <div 
                      className="language-bar"
                      style={{ width: `${stat.percentage}%` }}
                    ></div>
                  </div>
                  <span className="language-percentage">{stat.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Tutors */}
      <div className="top-tutors-card">
        <div className="card-header">
          <h2><i className="fas fa-trophy"></i> Top Performing Tutors</h2>
          <a href="/tutors" className="view-all-link">View All</a>
        </div>
        <div className="card-body">
          <table className="top-tutors-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Tutor</th>
                <th>Sessions</th>
                <th>Rating</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topTutors.map((tutor, index) => (
                <tr key={index}>
                  <td>
                    <span className={`rank rank-${index + 1}`}>
                      {index === 0 && <i className="fas fa-crown"></i>}
                      #{index + 1}
                    </span>
                  </td>
                  <td>
                    <div className="tutor-info">
                      <div className="tutor-avatar">
                        <span>{tutor.name.charAt(0)}</span>
                      </div>
                      <span className="tutor-name">{tutor.name}</span>
                    </div>
                  </td>
                  <td className="sessions-cell">{tutor.sessions}</td>
                  <td>
                    <div className="rating">
                      <i className="fas fa-star"></i>
                      <span>{tutor.rating}</span>
                    </div>
                  </td>
                  <td className="revenue-cell">${tutor.revenue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
