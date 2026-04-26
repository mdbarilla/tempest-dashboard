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
  ReferenceDot,
  Legend,
  Label
} from 'recharts';
import { formatTime, getMetricConfig, formatTooltipValue, formatTooltipValueParts } from '../utils/chartHelpers';
import './MetricChart.css';

const PLOT_LEFT = 72;
const PLOT_RIGHT = 36;
const MOBILE_PLOT_LEFT = 8;
const MOBILE_PLOT_RIGHT = 0;

const MetricChart = React.memo(({ data, metric, hours, manualEntries = [], pressureUnit, onHoverChange, useClickTooltip, stableTimeEnd, hideYAxis = false, customYAxisTicks, customYAxisDomain, activePoint }) => {
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
      let formattedValue = formatTooltipValue(value, metric, tooltipOptions);
      if (metric === 'wind') {
        const extras = [];
        if (dataPoint.valueLull != null) extras.push(`Lull ${Math.round(dataPoint.valueLull)} mph`);
        if (dataPoint.valueGust != null) extras.push(`Gust ${Math.round(dataPoint.valueGust)} mph`);
        formattedValue = extras.length ? `${formattedValue} · ${extras.join(' · ')}` : formattedValue;
      }
      onHoverChange({
        timestamp: dataPoint.timestamp,
        value: value,
        formattedTime: dataPoint.formattedTime,
        formattedValue,
        formattedValueNumber,
        formattedValueUnit,
        manualEntry,
        windGust: dataPoint.valueGust,
        windLull: dataPoint.valueLull
      });
    }, [active, payload]);
    return null;
  };

  const containerRef = useRef(null);
  const plotLeft = hideYAxis ? MOBILE_PLOT_LEFT : PLOT_LEFT;
  const plotRight = hideYAxis ? MOBILE_PLOT_RIGHT : PLOT_RIGHT;
  const handleChartClick = useCallback((e) => {
    if (!useClickTooltip || !onHoverChange || !chartData?.length) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const plotWidth = rect.width - plotLeft - plotRight;
    if (plotWidth <= 0) return;
    const relativeX = x - plotLeft;
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
    let formattedValue = formatTooltipValue(value, metric, tooltipOptions);
    if (metric === 'wind') {
      const extras = [];
      if (dataPoint.valueLull != null) extras.push(`Lull ${Math.round(dataPoint.valueLull)} mph`);
      if (dataPoint.valueGust != null) extras.push(`Gust ${Math.round(dataPoint.valueGust)} mph`);
      formattedValue = extras.length ? `${formattedValue} · ${extras.join(' · ')}` : formattedValue;
    }
    const tapXPercent = plotWidth > 0 ? relativeX / plotWidth : 0;
    onHoverChange({
      timestamp: dataPoint.timestamp,
      value: value,
      formattedTime: dataPoint.formattedTime,
      formattedValue,
      formattedValueNumber,
      formattedValueUnit,
      manualEntry,
      windGust: dataPoint.valueGust,
      windLull: dataPoint.valueLull,
      tapXPercent
    });
  }, [useClickTooltip, onHoverChange, chartData, metric, pressureUnit, plotLeft, plotRight]);

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

  const formatYTick = (value) => {
    if (value == null) return '';
    if (metric === 'pressure' && config.unit === 'inHg') return value.toFixed(2);
    if (metric === 'precipitation') return value.toFixed(2);
    return String(Math.round(value));
  };

  const CustomYAxisTick = ({ x, y, payload }) => {
    if (payload?.value == null) return null;
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={0} textAnchor="end" dominantBaseline="middle" fill="var(--text-secondary)" fontSize={12}>
          {formatYTick(payload.value)}
        </text>
      </g>
    );
  };

  const CustomYAxisTickRight = ({ x, y, payload }) => {
    if (payload?.value == null) return null;
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={0} textAnchor="start" dominantBaseline="middle" fill="var(--text-secondary)" fontSize={12}>
          {formatYTick(payload.value)}
        </text>
      </g>
    );
  };

  // Stable x-axis: when stableTimeEnd is provided, use a fixed time range so labels don't redraw between metric switches.
  // For 24h, ensure domain includes all data: use data extent so points are never clipped off-screen.
  const xDomain = useMemo(() => {
    if (!chartData?.length) return undefined;
    const dataMin = Math.min(...chartData.map(d => d.timestamp));
    const dataMax = Math.max(...chartData.map(d => d.timestamp));
    if (stableTimeEnd != null && typeof stableTimeEnd === 'number' && hours > 24) {
      const start = stableTimeEnd - hours * 3600;
      return [start, stableTimeEnd];
    }
    // 24h: use data extent so chart always shows all points (fixes data rendering off-screen)
    // Wind: use smaller padding so chart renders more fully in view
    const padFactor = metric === 'wind' ? 0.01 : 0.02;
    const pad = Math.max(3600, (dataMax - dataMin) * padFactor);
    return [dataMin - pad, dataMax + pad];
  }, [stableTimeEnd, hours, chartData, metric]);

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
          margin={{ top: 24, right: hideYAxis ? 0 : 36, left: hideYAxis ? 2 : 72, bottom: 44 }}
          accessibilityLayer={!useClickTooltip}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border-light)"
            vertical
            horizontal
            syncWithTicks
            verticalValues={xTicks}
          />
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={xDomain || ['dataMin', 'dataMax']}
            ticks={xTicks}
            interval="preserveStartEnd"
            stroke="var(--border-light)"
            tickLine={false}
            axisLine={false}
            tick={<CustomXAxisTick />}
            tickMargin={14}
            height={hours > 168 ? 56 : hours > 24 ? 52 : 40}
          />
          <YAxis
            hide={hideYAxis}
            orientation="left"
            stroke="var(--border-light)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            domain={customYAxisDomain || config.domain}
            ticks={customYAxisTicks}
            interval={0}
            tick={<CustomYAxisTick />}
            width={72}
          >
            {!hideYAxis && (
              <Label
                value={config.yAxisLabel}
                content={(props) => {
                  const { viewBox, value } = props;
                  if (!value || !viewBox) return null;
                  const x = viewBox.x ?? 0;
                  const y = (viewBox.y ?? 0) + (viewBox.height ?? 0) - 4;
                  return (
                    <text
                      x={x}
                      y={y}
                      textAnchor="start"
                      fill="var(--text-secondary)"
                      fontSize={13}
                      style={{ fontFamily: 'var(--font-primary)', opacity: 0.6 }}
                    >
                      {value}
                    </text>
                  );
                }}
              />
            )}
          </YAxis>
          <YAxis
            hide={hideYAxis}
            orientation="right"
            stroke="var(--border-light)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            domain={customYAxisDomain || config.domain}
            ticks={customYAxisTicks}
            interval={0}
            tick={<CustomYAxisTickRight />}
            width={36}
            mirror
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
            name={metric === 'wind' ? 'Speed' : undefined}
            stroke="var(--trendline-stroke)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--trendline-stroke)' }}
            isAnimationActive={true}
            connectNulls={false}
            animationDuration={350}
            animationEasing="ease-out"
          />
          {/* Wind: gust line (solid, accent color) */}
          {metric === 'wind' && (
            <Line
              type="monotone"
              dataKey="valueGust"
              stroke="var(--accent)"
              strokeWidth={2}
              strokeOpacity={0.85}
              dot={false}
              activeDot={{ r: 3, fill: 'var(--accent)' }}
              isAnimationActive={true}
              connectNulls={false}
              animationDuration={350}
              animationEasing="ease-out"
              name="Gust"
            />
          )}
          {/* Wind: lull line (solid, muted) - 0 is valid, only null/undefined skip */}
          {metric === 'wind' && (
            <Line
              type="monotone"
              dataKey="valueLull"
              stroke="var(--text-secondary)"
              strokeWidth={1.5}
              strokeOpacity={0.5}
              dot={false}
              activeDot={{ r: 3, fill: 'var(--text-secondary)' }}
              isAnimationActive={true}
              connectNulls={false}
              animationDuration={350}
              animationEasing="ease-out"
              name="Lull"
            />
          )}
          {metric === 'wind' && (
            <Legend wrapperStyle={{ fontSize: 11 }} />
          )}
          {/* Tap indicator dot (mobile) */}
          {activePoint && (
            <ReferenceDot
              x={activePoint.timestamp}
              y={activePoint.value}
              r={5}
              fill="var(--trendline-stroke)"
              stroke="var(--bg-card)"
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
              label={{
                value: 'Freezing 32°F',
                position: 'insideTopLeft',
                fill: 'var(--text-secondary)',
                fontSize: 10
              }}
            />
          )}
          {/* Manual precipitation entries: dotted lines on all ranges; labels only on 24h/3-day (7-day labels don't render well) */}
          {metric === 'precipitation' && manualEntries.map((entry, index) => (
            <ReferenceLine
              key={`manual-${entry.timestamp}-${index}`}
              x={entry.timestamp}
              stroke="var(--accent)"
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
                      fill="var(--accent)"
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
