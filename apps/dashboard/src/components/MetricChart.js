import React, { useMemo, useRef, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot
} from 'recharts';
import { formatTime, getMetricConfig, formatTooltipValue, formatTooltipValueParts } from '../utils/chartHelpers';
import './MetricChart.css';

const PLOT_LEFT = 50;
const PLOT_RIGHT = 24;

const MetricChart = React.memo(({ data, metric, hours, manualEntries = [], pressureUnit, onHoverChange, useClickTooltip, activePoint, stableTimeEnd }) => {
  const config = useMemo(
    () => getMetricConfig(metric, metric === 'pressure' ? { pressureUnit: pressureUnit || 'inHg' } : {}),
    [metric, pressureUnit]
  );

  const chartData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    const options = metric === 'pressure' ? { pressureUnit: pressureUnit || 'inHg' } : {};
    return data.map(point => ({
      ...point,
      formattedTime: formatTime(point.timestamp, hours),
      formattedValue: formatTooltipValue(point.value, metric, options)
    }));
  }, [data, hours, metric, pressureUnit]);

  const CustomTooltip = ({ active, payload }) => {
    React.useEffect(() => {
      if (!onHoverChange) return;
      if (!active || !payload?.length) {
        onHoverChange(null);
        return;
      }
      const dataPoint = payload[0].payload;
      const value = payload[0].value;
      const tooltipOptions = metric === 'pressure' ? { pressureUnit: pressureUnit || 'inHg' } : {};
      const manualEntry = dataPoint.manualEntry;
      const parts = formatTooltipValueParts(value, metric, tooltipOptions);
      const formattedValueNumber = parts.value;
      const formattedValueUnit = parts.unit;
      onHoverChange({
        timestamp: dataPoint.timestamp,
        value: value,
        formattedTime: dataPoint.formattedTime,
        formattedValue: formatTooltipValue(value, metric, tooltipOptions),
        formattedValueNumber,
        formattedValueUnit,
        manualEntry
      });
    }, [active, payload]);
    return null;
  };

  const containerRef = useRef(null);
  const handleChartClick = useCallback((e) => {
    if (!useClickTooltip || !onHoverChange || !chartData?.length) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const plotWidth = rect.width - PLOT_LEFT - PLOT_RIGHT;
    if (plotWidth <= 0) return;
    const relativeX = x - PLOT_LEFT;
    const t = Math.max(0, Math.min(1, relativeX / plotWidth));
    const index = Math.round(t * (chartData.length - 1));
    const idx = Math.max(0, Math.min(index, chartData.length - 1));
    const dataPoint = chartData[idx];
    const value = dataPoint.value;
    const manualEntry = dataPoint.manualEntry;
    const tooltipOptions = metric === 'pressure' ? { pressureUnit: pressureUnit || 'inHg' } : {};
    const parts = formatTooltipValueParts(value, metric, tooltipOptions);
    const formattedValueNumber = parts.value;
    const formattedValueUnit = parts.unit;
    onHoverChange({
      timestamp: dataPoint.timestamp,
      value: value,
      formattedTime: dataPoint.formattedTime,
      formattedValue: formatTooltipValue(value, metric, tooltipOptions),
      formattedValueNumber,
      formattedValueUnit,
      manualEntry
    });
  }, [useClickTooltip, onHoverChange, chartData, metric, pressureUnit]);

  // Format x-axis labels: 24h = time only; 3d/7d = day + time on separate lines
  const formatTickValue = (value) => {
    if (value == null || typeof value !== 'number') return { line1: '', line2: null };
    const date = new Date(value * 1000);
    if (hours <= 24) {
      return { line1: date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }), line2: null };
    }
    if (hours <= 168) {
      return {
        line1: date.toLocaleDateString('en-US', { weekday: 'short' }),
        line2: date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
      };
    }
    return { line1: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), line2: null };
  };

  const CustomXAxisTick = ({ x, y, payload }) => {
    if (payload?.value == null) return null;
    const { line1, line2 } = formatTickValue(payload.value);
    if (!line1) return null;
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={line2 ? 4 : 8} textAnchor="middle" fill="var(--text-secondary)" fontSize={12}>
          <tspan x={0} dy={0}>{line1}</tspan>
          {line2 != null && <tspan x={0} dy={14}>{line2}</tspan>}
        </text>
      </g>
    );
  };

  // Stable x-axis: when stableTimeEnd is provided, use a fixed time range so labels don't redraw between metric switches
  const xDomain = useMemo(() => {
    if (stableTimeEnd != null && typeof stableTimeEnd === 'number') {
      const start = stableTimeEnd - hours * 3600;
      return [start, stableTimeEnd];
    }
    return undefined;
  }, [stableTimeEnd, hours]);

  const xTicks = useMemo(() => {
    if (xDomain) {
      const [min, max] = xDomain;
      const n = hours <= 24 ? 8 : hours <= 72 ? 7 : 8;
      if (n <= 2) return [min, max];
      return Array.from({ length: n }, (_, i) => min + (i / (n - 1)) * (max - min));
    }
    if (!chartData?.length) return undefined;
    const n = Math.min(chartData.length, hours <= 24 ? 8 : hours <= 72 ? 7 : 8);
    if (n <= 2) return chartData.map((d) => d.timestamp);
    const min = chartData[0].timestamp;
    const max = chartData[chartData.length - 1].timestamp;
    return Array.from({ length: n }, (_, i) => min + (i / (n - 1)) * (max - min));
  }, [xDomain, chartData, hours]);

  if (!chartData || chartData.length === 0) {
    return (
      <div className="metric-chart-empty">
        <p>No data available for this time range</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`metric-chart-container ${useClickTooltip ? 'metric-chart-container--click' : ''}`}
      role="img"
      aria-label={`${config.label} over time`}
      onClick={useClickTooltip ? handleChartClick : undefined}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 28, right: 24, left: 10, bottom: 44 }}
          accessibilityLayer
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border-light)"
          />
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={xDomain || ['dataMin', 'dataMax']}
            ticks={xTicks}
            stroke="var(--border-light)"
            tickLine={false}
            axisLine={false}
            tick={<CustomXAxisTick />}
            tickMargin={14}
            height={hours > 168 ? 56 : hours > 24 ? 52 : 40}
          />
          <YAxis
            stroke="var(--border-light)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            domain={config.domain}
            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
            label={{
              value: config.yAxisLabel,
              angle: -90,
              position: 'insideLeft',
              style: { textAnchor: 'middle', fill: 'var(--text-secondary)', fontSize: 12 }
            }}
          />
          {!useClickTooltip && (
            <Tooltip 
              content={<CustomTooltip />}
              cursor={{ stroke: 'var(--trendline-stroke)', strokeWidth: 1, opacity: 0.3, strokeDasharray: '0' }}
              delayShow={400}
              isAnimationActive={false}
              animationDuration={0}
              wrapperStyle={{ outline: 'none' }}
              allowEscapeViewBox={{ x: true, y: true }}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--trendline-stroke)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--trendline-stroke)' }}
            isAnimationActive={true}
            connectNulls={false}
            animationDuration={350}
            animationEasing="ease-out"
          />
          {/* Mobile tap: show a dot at the selected point */}
          {useClickTooltip && activePoint != null && activePoint.timestamp != null && activePoint.value != null && (
            <ReferenceDot
              x={activePoint.timestamp}
              y={activePoint.value}
              r={6}
              fill="var(--trendline-stroke)"
              stroke="var(--bg-primary)"
              strokeWidth={2}
            />
          )}
          {/* Freezing line (32°F) on temperature chart */}
          {metric === 'temperature' && (
            <ReferenceLine
              y={32}
              stroke="var(--text-secondary)"
              strokeDasharray="4 4"
              strokeWidth={1}
              strokeOpacity={0.35}
            />
          )}
          {/* Manual precipitation entries: dotted lines on all ranges; labels only on 24h/3-day (7-day labels don't render well) */}
          {metric === 'precipitation' && manualEntries.map((entry, index) => (
            <ReferenceLine
              key={`manual-${entry.timestamp}-${index}`}
              x={entry.timestamp}
              stroke="var(--accent-blue)"
              strokeDasharray="4 4"
              strokeWidth={2}
              strokeOpacity={0.35}
              label={hours <= 72 ? {
                position: 'top',
                content: (props) => {
                  const { viewBox } = props;
                  if (!viewBox || viewBox.y == null) return null;
                  const y = viewBox.y - 8;
                  return (
                    <text
                      x={viewBox.x}
                      y={y}
                      textAnchor="middle"
                      fill="var(--accent-blue)"
                      fillOpacity={0.35}
                      fontSize={10}
                      className="metric-chart-manual-label"
                    >
                      {`${entry.amountInches.toFixed(2)} in`}
                    </text>
                  );
                }
              } : false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

MetricChart.displayName = 'MetricChart';

export default MetricChart;
