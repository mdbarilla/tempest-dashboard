import React from 'react';
import './TimeRangeSelector.css';

const TimeRangeSelector = ({ selectedHours, onSelect, disabled = false }) => {
  const ranges = [
    { hours: 24, label: '24h' },
    { hours: 72, label: '3d' },
    { hours: 168, label: '7d' }
  ];

  return (
    <div className="time-range-selector" role="group" aria-label="Select time range">
      {ranges.map(range => (
        <button
          key={range.hours}
          type="button"
          className={`time-range-button ${selectedHours === range.hours ? 'active' : ''}`}
          onClick={() => !disabled && onSelect(range.hours)}
          disabled={disabled}
          aria-pressed={selectedHours === range.hours}
          aria-label={`View ${range.label} of data`}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
};

export default TimeRangeSelector;
