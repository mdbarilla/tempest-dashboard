import React from 'react';
import WeatherIcon from './WeatherIcon';
import './Forecast.css';

const Forecast = ({ forecast }) => {
  if (!forecast?.daily) return null;

  const getDayName = (timestamp, index) => {
    if (index === 0) return 'Today';
    if (index === 1) return 'Tomorrow';

    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  return (
    <div className="forecast-section">
      <div className="forecast-container">
        <div className="forecast-layout">
          <div className="forecast-header">
            <h2>10-Day Forecast</h2>
          </div>
          <div className="forecast-grid">
            {forecast.daily.map((day, index) => (
              <div key={index} className="forecast-day-card">
                <WeatherIcon
                  condition={day.conditions || 'Clear'}
                  size={32}
                  className="forecast-icon"
                />
                <div className="forecast-content">
                  <div className="forecast-day-name">
                    {getDayName(day.date, index)}
                  </div>
                  <div className="forecast-condition">
                    {day.conditions || 'Clear'}
                  </div>
                  <div className="forecast-temps">
                    <span className="temp-high">{Math.round(day.temperature.high.fahrenheit)}°</span>
                    <span className="temp-separator"> / </span>
                    <span className="temp-low">{Math.round(day.temperature.low.fahrenheit)}°</span>
                  </div>
                  {day.precipProbability > 20 && (
                    <div className="forecast-precip">{day.precipProbability}%</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Forecast;
