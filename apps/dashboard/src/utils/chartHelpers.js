/**
 * Chart formatting utilities
 */

/** 1 mb = 0.02953 inHg (standard conversion) */
export const MB_TO_INHG = 0.02953;

export const formatTime = (timestamp, hours) => {
  const date = new Date(timestamp * 1000);
  
  if (hours <= 24) {
    // For 24h: show hours (e.g., "2 PM", "10 AM")
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      hour12: true 
    });
  } else if (hours <= 168) {
    // For 7d: show day and hour (e.g., "Mon 2 PM")
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      hour: 'numeric',
      hour12: true 
    });
  } else {
    // For 30d: show date (e.g., "Jan 15")
    return date.toLocaleDateString('en-US', { 
      month: 'short',
      day: 'numeric'
    });
  }
};

/**
 * Returns the set of data indices that should show an x-axis label (evenly spaced).
 * @param {number} total - Total number of data points
 * @param {number} hours - Time range (24, 168, or 720)
 * @param {boolean} isMobile - Whether viewport is mobile
 * @returns {Set<number>}
 */
export const getXAxisLabelIndices = (total, hours, isMobile = false) => {
  if (total <= 0) return new Set();
  if (total <= 2) return new Set([0, total - 1].filter(i => i >= 0));

  const maxLabels = isMobile
    ? 3
    : hours <= 24
      ? 5
      : hours <= 168
        ? 5
        : 5;
  const n = Math.min(maxLabels, total);
  const indices = new Set();

  if (n === 1) {
    indices.add(0);
    return indices;
  }
  for (let i = 0; i < n; i++) {
    indices.add(Math.round((i * (total - 1)) / (n - 1)));
  }
  return indices;
};

export const formatXAxisLabel = (timestamp, hours, index, total, previousTimestamp = null, isMobile = false) => {
  const labelIndices = getXAxisLabelIndices(total, hours, isMobile);
  if (!labelIndices.has(index)) return '';

  const date = new Date(timestamp * 1000);

  if (hours <= 24) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      hour12: true
    });
  }
  if (hours <= 168) {
    // Use weekday + hour to avoid repeated labels (hourly points on same day)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      hour: 'numeric',
      hour12: true
    });
  }
  // 30d view: two-line format
  return {
    day: date.toLocaleDateString('en-US', { weekday: 'short' }),
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  };
};

export const getMetricConfig = (metric, options = {}) => {
  const { pressureUnit = 'inHg' } = options;
  const configs = {
    temperature: {
      label: 'Temperature',
      unit: '°F',
      yAxisLabel: 'Temperature (°F)',
      color: 'var(--trendline-stroke)',
      domain: ['auto', 'auto']
    },
    pressure: {
      label: 'Pressure',
      unit: pressureUnit === 'mb' ? 'mb' : 'inHg',
      yAxisLabel: pressureUnit === 'mb' ? 'Pressure (mb)' : 'Pressure (inHg)',
      color: 'var(--trendline-stroke)',
      domain: ['auto', 'auto']
    },
    humidity: {
      label: 'Humidity',
      unit: '%',
      yAxisLabel: 'Humidity (%)',
      color: 'var(--trendline-stroke)',
      domain: [0, 100]
    },
    wind: {
      label: 'Wind Speed',
      unit: 'mph',
      yAxisLabel: 'Wind Speed (mph)',
      color: 'var(--trendline-stroke)',
      colorGust: 'var(--accent-blue)',
      domain: ['auto', 'auto']
    },
    precipitation: {
      label: 'Precipitation',
      unit: 'in',
      yAxisLabel: 'Precipitation (inches)',
      color: 'var(--trendline-stroke)',
      domain: ['auto', 'auto']
    },
    solar: {
      label: 'Solar Radiation',
      unit: 'W/m²',
      yAxisLabel: 'Solar Radiation (W/m²)',
      color: 'var(--trendline-stroke)',
      domain: ['auto', 'auto']
    },
    uv: {
      label: 'UV Index',
      unit: '',
      yAxisLabel: 'UV Index',
      color: 'var(--trendline-stroke)',
      domain: [0, 'auto']
    }
  };

  return configs[metric] || {
    label: metric,
    unit: '',
    yAxisLabel: metric,
    color: 'var(--trendline-stroke)',
    domain: ['auto', 'auto']
  };
};

export const formatTooltipValue = (value, metric, options = {}) => {
  const config = getMetricConfig(metric, options);
  
  if (value === null || value === undefined) return 'N/A';
  
  if (metric === 'temperature') {
    return `${Math.round(value)}${config.unit}`;
  } else if (metric === 'pressure') {
    return config.unit === 'mb'
      ? `${Math.round(value * 10) / 10} mb`
      : `${value.toFixed(2)} inHg`;
  } else if (metric === 'precipitation') {
    return `${value.toFixed(2)}${config.unit}`;
  } else if (metric === 'humidity') {
    return `${Math.round(value)}${config.unit}`;
  } else if (metric === 'wind') {
    return `${Math.round(value)}${config.unit}`;
  } else if (metric === 'solar') {
    return `${Math.round(value)}${config.unit}`;
  } else if (metric === 'uv') {
    return `${Math.round(value)}`;
  }
  
  return `${value}${config.unit}`;
};

/** Returns { value, unit } for tooltip display where unit can be styled separately */
export const formatTooltipValueParts = (value, metric, options = {}) => {
  const config = getMetricConfig(metric, options);

  if (value === null || value === undefined) return { value: 'N/A', unit: '' };

  if (metric === 'temperature') {
    return { value: String(Math.round(value)), unit: config.unit };
  }
  if (metric === 'pressure') {
    if (config.unit === 'mb') {
      return { value: String(Math.round(value * 10) / 10), unit: 'mb' };
    }
    return { value: value.toFixed(2), unit: 'inHg' };
  }
  if (metric === 'precipitation') {
    return { value: value.toFixed(2), unit: config.unit };
  }
  if (metric === 'humidity' || metric === 'wind' || metric === 'solar') {
    return { value: String(Math.round(value)), unit: config.unit };
  }
  if (metric === 'uv') {
    return { value: String(Math.round(value)), unit: '' };
  }
  return { value: String(value), unit: config.unit };
};
