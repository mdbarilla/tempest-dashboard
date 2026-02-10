import React from 'react';
import { useNavigate } from 'react-router-dom';
import CurrentWeather from '../components/CurrentWeather';
import Metrics from '../components/Metrics';
import Forecast from '../components/Forecast';
const Dashboard = ({ weatherData, lastUpdate }) => {
  const navigate = useNavigate();

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
      </footer>
    </>
  );
};

export default Dashboard;
