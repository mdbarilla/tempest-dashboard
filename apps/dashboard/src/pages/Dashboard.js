import React from 'react';
import { useNavigate } from 'react-router-dom';
import CurrentWeather from '../components/CurrentWeather';
import Metrics from '../components/Metrics';
import Forecast from '../components/Forecast';
import NewsCarousel from '../components/NewsCarousel';

const Dashboard = ({ weatherData, lastUpdate, newsData, newsLoading, newsError }) => {
  const navigate = useNavigate();

  // Check for ?news=1 query parameter
  const params = new URLSearchParams(window.location.search);
  const showNews = params.get('news') === '1';

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

        {showNews && (
          <NewsCarousel
            newsData={newsData}
            loading={newsLoading}
            error={newsError}
          />
        )}
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
