import React from 'react';
import { useNavigate } from 'react-router-dom';
import CurrentWeather from '../components/CurrentWeather';
import Metrics from '../components/Metrics';
import Forecast from '../components/Forecast';
import { useAppMenu } from '../context/AppMenuContext';

const Dashboard = ({ weatherData, lastUpdate }) => {
  const navigate = useNavigate();
  const { onChangeTheme } = useAppMenu();

  const handleMetricClick = (link) => {
    navigate(link, { state: { from: 'dashboard' } });
  };

  return (
    <>
      <main className="main-content">
        <CurrentWeather
          current={weatherData.current}
          forecast={weatherData.forecast}
          lastUpdate={lastUpdate}
        />

        <Metrics
          current={weatherData.current}
          forecast={weatherData.forecast}
          onMetricClick={handleMetricClick}
        />

        <Forecast forecast={weatherData.forecast} />
      </main>

      <footer className="footer">
        <div className="footer-text">
          Tempest Weather Station • Auto-refresh every 60s
        </div>
        <div className="footer-actions">
          <button className="theme-toggle" onClick={onChangeTheme} aria-label="Toggle theme" title="Toggle theme">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor" stroke="none" />
            </svg>
          </button>
        </div>
      </footer>
    </>
  );
};

export default Dashboard;
