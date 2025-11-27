import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../context/AuthContext';
import './UserDashboard.css';

interface WeatherData {
  current: {
    temp_c: number;
    condition: {
      text: string;
      icon: string;
    };
    humidity: number;
    wind_kph: number;
    precip_mm: number;
    feelslike_c: number;
  };
  forecast?: {
    forecastday: Array<{
      date: string;
      day: {
        maxtemp_c: number;
        mintemp_c: number;
        condition: {
          text: string;
          icon: string;
        };
      }
    }>;
  };
}

const UserDashboard = () => {
  const { userInfo } = useAuthStore();
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  
  useEffect(() => {
    // Update the date and time every minute
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 60000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    // Fetch weather data
    const fetchWeather = async () => {
      try {
        setLoading(true);
        const response = await fetch('https://api.weatherapi.com/v1/forecast.json?key=YOUR_API_KEY&q=auto:ip&days=7&aqi=no&alerts=no');
        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error.message);
        }
        
        setWeatherData(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching weather data:', err);
        setError('Failed to load weather data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, []);

  // Format date for greeting
  const formatGreeting = () => {
    const hours = currentDateTime.getHours();
    if (hours < 12) return 'Good morning';
    if (hours < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Format date in a user-friendly way
  const formatDate = () => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return currentDateTime.toLocaleDateString(undefined, options);
  };

  return (
    <div className="user-dashboard-container">
      <div className="dashboard-header">
        <h2 className="dashboard-greeting">
          {formatGreeting()}, {userInfo?.username || 'Farmer'}!
        </h2>
        <p className="dashboard-date">{formatDate()}</p>
      </div>

      <div className="dashboard-cards">
        {/* Weather Card */}
        <div className="dashboard-card">
          <h3>Current Weather</h3>
          {loading && <p className="loading-text">Loading weather data...</p>}
          {error && <p className="error-text">{error}</p>}
          {weatherData && !loading && (
            <div className="weather-info">
              <div className="weather-main">
                <img src={weatherData.current.condition.icon} alt="Weather icon" className="weather-icon" />
                <div className="weather-temp">
                  <h2>{Math.round(weatherData.current.temp_c)}°C</h2>
                  <p>{weatherData.current.condition.text}</p>
                </div>
              </div>
              <div className="weather-details">
                <div className="weather-detail">
                  <span className="detail-label">Feels like</span>
                  <span className="detail-value">{Math.round(weatherData.current.feelslike_c)}°C</span>
                </div>
                <div className="weather-detail">
                  <span className="detail-label">Humidity</span>
                  <span className="detail-value">{weatherData.current.humidity}%</span>
                </div>
                <div className="weather-detail">
                  <span className="detail-label">Wind</span>
                  <span className="detail-value">{Math.round(weatherData.current.wind_kph)} km/h</span>
                </div>
                <div className="weather-detail">
                  <span className="detail-label">Precipitation</span>
                  <span className="detail-value">{weatherData.current.precip_mm} mm</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Farm Status Card */}
        <div className="dashboard-card">
          <h3>Farm Status</h3>
          <div className="farm-status">
            <p>No farms registered yet.</p>
            <button className="btn add-farm-btn">Add Farm</button>
          </div>
        </div>

        {/* Forecast Card (7-day) */}
        <div className="dashboard-card forecast-card">
          <h3>7-Day Forecast</h3>
          {loading && <p className="loading-text">Loading forecast data...</p>}
          {error && <p className="error-text">{error}</p>}
          {weatherData?.forecast && !loading && (
            <div className="forecast-container">
              {weatherData.forecast.forecastday.map((day, index) => (
                <div key={index} className="forecast-day">
                  <div className="forecast-date">
                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <img 
                    src={day.day.condition.icon} 
                    alt={day.day.condition.text} 
                    className="forecast-icon"
                  />
                  <div className="forecast-temp">
                    <span className="max-temp">{Math.round(day.day.maxtemp_c)}°</span>
                    <span className="min-temp">{Math.round(day.day.mintemp_c)}°</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Card */}
        <div className="dashboard-card">
          <h3>Recent Activity</h3>
          <div className="activity-list">
            <p>No recent activities.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
