import React from 'react';
import { useNavigate } from 'react-router-dom';
import MetricIcon from './MetricIcon';
import Sparkline from './Sparkline';
import PrecipitationLogger from './PrecipitationLogger';
import { buildMetrics, getTrendData as getMetricTrendData } from '../utils/metricsData';
import './Metrics.css';

const Metrics = ({ current, forecast, recent, onMetricClick, onPrecipAddClick, isLocal, onRefresh }) => {
  const navigate = useNavigate();
  
  if (!current) return null;

  const getTrendData = (metric) => getMetricTrendData(metric, recent, forecast);

  const handleClick = (link, metricType) => {
    if (onMetricClick) {
      onMetricClick(link);
    } else {
      navigate(link);
    }
  };

  const metrics = buildMetrics(current, forecast, recent).map((metric) => (
    metric.manualNotes
      ? { ...metric, customContent: <div className="manual-precip-note">{metric.manualNotes}</div> }
      : metric
  ));

  return (
    <div className="metrics-section">
      <div className="metrics">
        {metrics.map((metric, index) => {
          const isSunTime = metric.type === 'sunrise' || metric.type === 'sunset';
          return (
          <div
            key={index}
            className="metric-card"
            onClick={isSunTime ? undefined : () => handleClick(metric.link, metric.type)}
            data-sun-times={isSunTime ? 'true' : undefined}
            style={{
              animationDelay: `${0.3 + index * 0.05}s`
            }}
          >
            <MetricIcon type={metric.type} size={32} className="metric-icon" />
            <div className="metric-content">
              <div className="metric-label">{metric.label}</div>
              <div className="metric-value">
                {metric.value}
                {metric.unit && <span className="metric-unit">{metric.unit}</span>}
              </div>
              {metric.secondary && (
                <div className="metric-secondary">
                  {metric.secondary}
                </div>
              )}
              {metric.customContent && metric.customContent}
              {(getTrendData(metric.type) || metric.type === 'precipitation') && (
                <div className="metric-trend-row">
                  {getTrendData(metric.type) && (
                    <div className="metric-trend">
                      <Sparkline
                        data={getTrendData(metric.type)}
                        width={120}
                        height={24}
                        color="var(--trendline-stroke)"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            {metric.type === 'precipitation' && isLocal && onPrecipAddClick && (
              <PrecipitationLogger onAddClick={onPrecipAddClick} />
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
};

export default Metrics;
