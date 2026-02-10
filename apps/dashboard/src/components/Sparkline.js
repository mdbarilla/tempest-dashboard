import React from 'react';

const Sparkline = ({ data, width = 100, height = 24, color = 'var(--text-secondary)' }) => {
  if (!data || data.length < 2) {
    return null;
  }

  // Find min and max for scaling
  const values = data.filter(d => d !== null && d !== undefined);
  if (values.length < 2) {
    return null;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1; // Avoid division by zero

  // Add padding to prevent clipping at edges
  const padding = 3;
  const effectiveHeight = height - padding * 2;

  // Generate points
  const points = data
    .map((value, index) => {
      if (value === null || value === undefined) return null;

      const x = (index / (data.length - 1)) * width;
      const y = padding + effectiveHeight - ((value - min) / range) * effectiveHeight;

      return { x, y };
    })
    .filter(p => p !== null);

  // Create smooth curve using Catmull-Rom spline
  const createSmoothPath = (points) => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x},${points[0].y}`;

    let path = `M ${points[0].x},${points[0].y}`;

    // For smooth curves between points
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];

      // Calculate control points for cubic bezier
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }

    return path;
  };

  const pathData = createSmoothPath(points);

  // Expand viewBox to accommodate glow effect (add padding for drop-shadow)
  const glowPadding = 8;
  const expandedWidth = width + glowPadding * 2;
  const expandedHeight = height + glowPadding * 2;

  return (
    <svg
      width={width}
      height={height}
      className="sparkline"
      style={{ display: 'block', overflow: 'visible' }}
      viewBox={`${-glowPadding} ${-glowPadding} ${expandedWidth} ${expandedHeight}`}
      preserveAspectRatio="none"
    >
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        shapeRendering="geometricPrecision"
      />
    </svg>
  );
};

export default Sparkline;
