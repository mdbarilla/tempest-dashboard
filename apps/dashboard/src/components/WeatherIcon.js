import React from 'react';

const WeatherIcon = ({ condition, size = 48, className = '', isNight = false }) => {
  const getIconProps = (customViewBox) => ({
    width: size,
    height: size,
    viewBox: customViewBox || "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,  /* Standardized to 2px per audit */
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: className,
    role: "img",
    "aria-label": condition
  });

  const iconProps = getIconProps();

  // Determine icon based on condition
  const getIcon = () => {
    const lowerCondition = condition?.toLowerCase() || '';

    // Clear/Sunny - show moon at night
    if (lowerCondition.includes('clear') && !lowerCondition.includes('night')) {
      if (isNight) {
        // Moon icon for clear night
        return (
          <svg {...iconProps}>
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        );
      }
      return (
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
      );
    }

    // Clear Night/Moon (explicit night condition)
    if (lowerCondition.includes('clear') || lowerCondition.includes('night')) {
      return (
        <svg {...iconProps}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      );
    }

    // Partly Cloudy - show moon with cloud at night
    if (lowerCondition.includes('partly') && !lowerCondition.includes('night')) {
      if (isNight) {
        // Cloud-moon icon from Lucide
        return (
          <svg {...iconProps}>
            <path d="M13 16a3 3 0 1 1 0 6H7a5 5 0 1 1 4.9-6H13z" />
            <path d="M10.188 8.5A6 6 0 0 1 16 4a1 1 0 0 0 6 6 6 6 0 0 1-3 5.197" />
          </svg>
        );
      }
      // Cloud-sun icon from Lucide
      return (
        <svg {...iconProps}>
          <path d="M12 2v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="M20 12h2" />
          <path d="m19.07 4.93-1.41 1.41" />
          <path d="M15.947 12.65a4 4 0 0 0-5.925-4.128" />
          <path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6z" />
        </svg>
      );
    }

    // Cloudy
    if (lowerCondition.includes('cloudy') || lowerCondition.includes('overcast')) {
      return (
        <svg {...iconProps}>
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
        </svg>
      );
    }

    // Rain
    if (lowerCondition.includes('rain') || lowerCondition.includes('drizzle')) {
      return (
        <svg {...iconProps}>
          <path d="M16 13v8m-8-8v8m4-8v8" />
          <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
        </svg>
      );
    }

    // Thunderstorm
    if (lowerCondition.includes('thunder') || lowerCondition.includes('storm')) {
      return (
        <svg {...iconProps}>
          <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9" />
          <polyline points="13 11 9 17 15 17 11 23" />
        </svg>
      );
    }

    // Snow
    if (lowerCondition.includes('snow') || lowerCondition.includes('sleet')) {
      return (
        <svg {...iconProps}>
          <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" />
          <line x1="8" y1="16" x2="8.01" y2="16" />
          <line x1="8" y1="20" x2="8.01" y2="20" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
          <line x1="12" y1="22" x2="12.01" y2="22" />
          <line x1="16" y1="16" x2="16.01" y2="16" />
          <line x1="16" y1="20" x2="16.01" y2="20" />
        </svg>
      );
    }

    // Fog/Mist
    if (lowerCondition.includes('fog') || lowerCondition.includes('mist') || lowerCondition.includes('haze')) {
      return (
        <svg {...iconProps}>
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="10" x2="20" y2="10" />
          <line x1="4" y1="14" x2="20" y2="14" />
          <line x1="4" y1="18" x2="14" y2="18" />
        </svg>
      );
    }

    // Wind
    if (lowerCondition.includes('wind')) {
      return (
        <svg {...iconProps}>
          <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
        </svg>
      );
    }

    // Default: partly cloudy
    return (
      <svg {...iconProps}>
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
      </svg>
    );
  };

  return getIcon();
};

export default WeatherIcon;
