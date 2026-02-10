import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './Analytics.css';

const Analytics = () => {
  const { metric } = useParams();
  const navigate = useNavigate();

  const metricTitles = {
    pressure: 'Pressure Analytics',
    humidity: 'Humidity Analytics',
    wind: 'Wind Analytics',
    precipitation: 'Precipitation Analytics'
  };

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <button className="back-button" onClick={() => navigate('/')}>
          ← Back to Dashboard
        </button>
        <h1>{metricTitles[metric] || 'Analytics'}</h1>
      </div>

      <div className="analytics-content">
        <div className="coming-soon">
          <h2>Detailed {metric} analytics coming soon</h2>
          <p>This page will show historical trends, charts, and statistics for {metric}.</p>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
