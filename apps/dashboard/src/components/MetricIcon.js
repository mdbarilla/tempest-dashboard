import React from 'react';

const MetricIcon = ({ type, size = 32 }) => {
  const iconProps = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",  /* Standardized 24x24 bounding box */
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,  /* Standardized to 2px per audit */
    strokeLinecap: "round",
    strokeLinejoin: "round"
  };

  const icons = {
    temperature: (
      <svg {...iconProps}>
        <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
      </svg>
    ),
    pressure: (
      <svg {...iconProps}>
        {/* Barometer - vertical tube with bulb at bottom and scale marks */}
        <path d="M10 4v12a2 2 0 1 0 4 0V4a2 2 0 0 0-4 0z" />
        <line x1="15" y1="7" x2="17" y2="7" />
        <line x1="15" y1="10" x2="17" y2="10" />
        <line x1="15" y1="13" x2="17" y2="13" />
        <line x1="7" y1="7" x2="9" y2="7" />
        <line x1="7" y1="10" x2="9" y2="10" />
        <line x1="7" y1="13" x2="9" y2="13" />
      </svg>
    ),
    humidity: (
      <svg {...iconProps}>
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
      </svg>
    ),
    wind: (
      <svg {...iconProps}>
        <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
      </svg>
    ),
    precipitation: (
      <svg {...iconProps}>
        <line x1="8" y1="19" x2="8" y2="21" />
        <line x1="8" y1="13" x2="8" y2="15" />
        <line x1="16" y1="19" x2="16" y2="21" />
        <line x1="16" y1="13" x2="16" y2="15" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="12" y1="15" x2="12" y2="17" />
        <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
      </svg>
    ),
    solar: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="4" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    ),
    sunset: (
      <svg {...iconProps}>
        <path d="M17 18a5 5 0 0 0-10 0" />
        <line x1="12" y1="9" x2="12" y2="2" />
        <line x1="4.22" y1="10.22" x2="5.64" y2="11.64" />
        <line x1="1" y1="18" x2="3" y2="18" />
        <line x1="21" y1="18" x2="23" y2="18" />
        <line x1="18.36" y1="11.64" x2="19.78" y2="10.22" />
        <line x1="23" y1="22" x2="1" y2="22" />
        <polyline points="16 5 12 9 8 5" />
      </svg>
    ),
    sunrise: (
      <svg {...iconProps}>
        <path d="M17 18a5 5 0 0 0-10 0" />
        <line x1="12" y1="2" x2="12" y2="9" />
        <line x1="4.22" y1="10.22" x2="5.64" y2="11.64" />
        <line x1="1" y1="18" x2="3" y2="18" />
        <line x1="21" y1="18" x2="23" y2="18" />
        <line x1="18.36" y1="11.64" x2="19.78" y2="10.22" />
        <line x1="23" y1="22" x2="1" y2="22" />
        <polyline points="8 6 12 2 16 6" />
      </svg>
    )
  };

  return icons[type] || null;
};

export default MetricIcon;
