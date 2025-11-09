/**
 * Timeseries Chart Component
 * Simple line chart for time-series data
 */

import { useMemo } from 'react';

interface TimeseriesPoint {
  t: string;
  value: number;
}

interface TimeseriesChartProps {
  data: TimeseriesPoint[];
}

export function TimeseriesChart({ data }: TimeseriesChartProps) {
  const { max, min, points } = useMemo(() => {
    if (data.length === 0) {
      return { max: 100, min: 0, points: [] };
    }

    const values = data.map(d => d.value);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;

    // Normalize points for SVG (0-100 scale)
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1 || 1)) * 100;
      const y = 100 - ((d.value - min) / range) * 100;
      return { x, y, value: d.value, t: d.t };
    });

    return { max, min, points };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-muted-foreground">
        No data available
      </div>
    );
  }

  // Generate path for line
  const pathData = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  return (
    <div className="h-48 relative">
      <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(y => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2="100"
            y2={y}
            stroke="currentColor"
            strokeWidth="0.5"
            opacity="0.1"
          />
        ))}

        {/* Data line */}
        <path
          d={pathData}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="1"
            fill="hsl(var(--primary))"
          />
        ))}
      </svg>

      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-muted-foreground px-2">
        <span>{Math.round(max)}</span>
        <span>{Math.round((max + min) / 2)}</span>
        <span>{Math.round(min)}</span>
      </div>
    </div>
  );
}

