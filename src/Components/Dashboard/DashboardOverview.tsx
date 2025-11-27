import { useState, useEffect } from 'preact/hooks';
import { WeatherData } from '@server/weather.services/weather.interface';
import { getCurrentWeather } from '@/client/weather/clientWeather';
import { useAuthStore } from '../../context/AuthContext';
import './DashboardOverview.css';
import { setupTokenRefresh } from '@/client/tokenRefresh';

const farmGreetings: string[] = [
  "Let's nurture your fields to abundance today! 🌾",
  "Your sustainable practices are making a difference! 🌱",
  "Today's seeds are tomorrow's prosperity! 🚜",
  "Cultivating success, one acre at a time! 🌿",
  "Nature's bounty awaits your expert touch! 🌅",
  "Your dedication makes our food system stronger! 🌾",
  "Growing hope, harvesting success! 🎋",
  "Smart farming leads to better harvests! 🌱",
  "Your farm, your legacy, our future! 🌄",
  "Building a sustainable tomorrow, starting today! 🌿"
];

const getWeatherIcon = (condition: string) => {
  condition = condition.toLowerCase();
  if (condition.includes('rain') || condition.includes('drizzle')) return 'cloud-rain';
  if (condition.includes('snow')) return 'snowflake';
  if (condition.includes('cloud')) return 'cloud-sun';
  if (condition.includes('thunder')) return 'bolt';
  if (condition.includes('fog') || condition.includes('mist')) return 'smog';
  return 'sun';
};

const getTimeOfDay = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
};

const DashboardOverview = () => {
  const userInfo = useAuthStore((state) => state.userInfo);
  const [randomGreeting, setRandomGreeting] = useState('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  useEffect(() => {
    
    // Set random greeting
    const randomIndex = Math.floor(Math.random() * farmGreetings.length);
    setRandomGreeting(farmGreetings[randomIndex]);

    // Fetch weather data
    const fetchWeather = async () => {
      try {
        await setupTokenRefresh()
        setLoading(true);
        // Default to Manila if no city is set
        const city = userInfo?.city || 'Manila';
        const result = await getCurrentWeather(city);

        if (result instanceof Error) {
          console.error('Failed to fetch weather:', result);
          setError(result.message || 'Unable to load weather data');
          setWeather(null);
        } else {
          setWeather(result);
          setError(null);
        }
      } catch (err) {
        console.error('Failed to fetch weather:', err);
        setError(err instanceof Error ? err.message : 'Unable to load weather data');
        setWeather(null);
      } finally {
        setLoading(false);
      }
    };

      fetchWeather();

  }, [userInfo?.city, userInfo?.accessToken]);

  // Mock data for other dashboard sections
  const farmStats = {
    totalFarms: 2,
    totalArea: 12.5, // hectares
    cropTypes: 4,
    sustainabilityScore: 87,
  };

  const recentActivities = [
    { id: 1, type: 'farm', title: 'Added new crop data', time: '2 hours ago' },
    { id: 2, type: 'soil', title: 'Soil analysis results updated', time: '1 day ago' },
    { id: 3, type: 'finance', title: 'Applied for sustainability incentive', time: '2 days ago' },
    { id: 4, type: 'weather', title: 'Weather alert: light rain forecasted', time: '3 days ago' },
  ];

  const marketInsights = [
    { id: 1, crop: 'Rice', trend: 'up', price: '₱48.50/kg', change: '+2.5%' },
    { id: 2, crop: 'Corn', trend: 'down', price: '₱32.75/kg', change: '-1.2%' },
    { id: 3, crop: 'Vegetables', trend: 'up', price: '₱78.00/kg', change: '+3.8%' },
    { id: 4, crop: 'Fruits', trend: 'up', price: '₱92.25/kg', change: '+1.7%' },
  ];

  return (
    <div className="dashboard-overview">
      <div className="welcome-card">
        <div className="welcome-card-content">
          <h1 className="welcome-title">Welcome back, {userInfo?.name || userInfo?.username || 'Farmer'}!</h1>
          <p className="welcome-greeting">{randomGreeting}</p>
          <p className="welcome-date">{formattedDate}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-icon farms">
            <i className="fas fa-landmark"></i>
          </div>
          <div className="stat-info">
            <h3>Total Farms</h3>
            <p className="stat-value">{farmStats.totalFarms}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon area">
            <i className="fas fa-ruler-combined"></i>
          </div>
          <div className="stat-info">
            <h3>Total Area</h3>
            <p className="stat-value">{farmStats.totalArea} <span>hectares</span></p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon crops">
            <i className="fas fa-seedling"></i>
          </div>
          <div className="stat-info">
            <h3>Crop Types</h3>
            <p className="stat-value">{farmStats.cropTypes}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon sustainability">
            <i className="fas fa-leaf"></i>
          </div>
          <div className="stat-info">
            <h3>Sustainability Score</h3>
            <p className="stat-value">{farmStats.sustainabilityScore}<span>/100</span></p>
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="overview-grid">
        {/* Weather Card */}
        <div className="overview-card weather-card">
          <div className="card-header">
            <h3><i className="fas fa-cloud-sun"></i> Weather</h3>
            <span className="location">
              <i className="fas fa-map-marker-alt"></i>
              {weather?.location?.name || userInfo?.city || 'Manila'}
            </span>
          </div>
          <div className="weather-content">
            {loading ? (
              <div className="weather-loading">
                <i className="fas fa-spinner fa-spin"></i>
                <p>Loading weather data...</p>
              </div>
            ) : error ? (
              <div className="weather-error">
                <i className="fas fa-exclamation-circle"></i>
                <p>{error}</p>

              </div>
            ) : weather ? (
              <>
                <div className="weather-main">
                  <i className={`weather-icon fas fa-${getWeatherIcon(weather.current.condition.text)}`}></i>
                  <div className="weather-temp">
                    <h2>{Math.round(weather.current.temp_c)}°C</h2>
                    <p>{weather.current.condition.text}</p>
                  </div>
                </div>
                <div className="weather-details">
                  <div className="weather-detail">
                    <i className="fas fa-tint"></i>
                    <div>
                      <p className="detail-value">{weather.current.humidity}%</p>
                      <p className="detail-label">Humidity</p>
                    </div>
                  </div>
                  <div className="weather-detail">
                    <i className="fas fa-wind"></i>
                    <div>
                      <p className="detail-value">{Math.round(weather.current.wind_kph)} km/h</p>
                      <p className="detail-label">Wind Speed</p>
                    </div>
                  </div>
                </div>
                <a href="/dashboard/weather-forecast" className="view-forecast">
                  <i className="fas fa-calendar-alt"></i> View 7-Day Forecast
                </a>
              </>
            ) : null}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="overview-card activity-card">
          <div className="card-header">
            <h3><i className="fas fa-history"></i> Recent Activity</h3>
          </div>
          <div className="activity-list">
            {recentActivities.map(activity => (
              <div key={activity.id} className="activity-item">
                <div className={`activity-icon ${activity.type}`}>
                  <i className={`fas fa-${
                    activity.type === 'farm' ? 'tractor' : 
                    activity.type === 'soil' ? 'microscope' : 
                    activity.type === 'finance' ? 'coins' : 'cloud-rain'
                  }`}></i>
                </div>
                <div className="activity-info">
                  <p className="activity-title">{activity.title}</p>
                  <p className="activity-time">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="card-footer">
            <a href="/activity-log">View all activity →</a>
          </div>
        </div>

        {/* Market Insights */}
        <div className="overview-card market-card">
          <div className="card-header">
            <h3><i className="fas fa-chart-line"></i> Market Insights</h3>
          </div>
          <div className="market-list">
            {marketInsights.map(item => (
              <div key={item.id} className="market-item">
                <div className="market-crop">
                  <p className="crop-name">{item.crop}</p>
                </div>
                <div className="market-price">
                  <p>{item.price}</p>
                </div>
                <div className={`market-trend ${item.trend}`}>
                  <i className={`fas fa-arrow-${item.trend}`}></i>
                  <span>{item.change}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="card-footer">
            <a href="/market-insights">View market details →</a>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="overview-card actions-card">
          <div className="card-header">
            <h3><i className="fas fa-bolt"></i> Quick Actions</h3>
          </div>
          <div className="actions-grid">
            <button className="action-button">
              <i className="fas fa-plus-circle"></i>
              <span>Add Crop Data</span>
            </button>
            <button className="action-button">
              <i className="fas fa-camera"></i>
              <span>Scan Plant</span>
            </button>
            <button className="action-button">
              <i className="fas fa-sync-alt"></i>
              <span>Update Status</span>
            </button>
            <button className="action-button">
              <i className="fas fa-file-export"></i>
              <span>Export Report</span>
            </button>
            <button className="action-button">
              <i className="fas fa-user-plus"></i>
              <span>Add Worker</span>
            </button>
            <button className="action-button">
              <i className="fas fa-hand-holding-usd"></i>
              <span>Finance</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
