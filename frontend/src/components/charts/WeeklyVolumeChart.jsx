import { useState } from 'react';

import { formatDate } from '../../lib/format.js';

// Plot geometry, in the SVG's own coordinates. The viewBox scales to the card,
// so these are ratios rather than pixels on screen.
const WIDTH = 800;
const PLOT_HEIGHT = 190;
const AXIS_BAND = 34;          // room for the week labels, inside the viewBox
const PAD = { left: 46, right: 8, top: 8 };
// The viewBox is 800 wide and stretches to the card, so a unit here draws
// larger than a pixel. 14 units lands around 20px on a typical desktop card,
// inside the 24px cap, and leaves the rest of the band as air.
const MAX_BAR = 14;
const GAP = 2;                 // surface gap between the two bars of a week

const SERIES = [
  { key: 'receiptQuantity', label: 'Received', color: 'var(--series-1)' },
  { key: 'issueQuantity', label: 'Issued', color: 'var(--series-2)' },
];

/** Rounds an axis maximum up to a readable number rather than the raw peak. */
function niceMax(value) {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

function tooltipFor(week, series) {
  const units = week[series.key];
  const moves = week[series.key === 'receiptQuantity' ? 'receiptCount' : 'issueCount'];
  return `Week of ${formatDate(week.weekStart)} — ${series.label.toLowerCase()} ${units.toLocaleString()} units across ${moves} movement${moves === 1 ? '' : 's'}`;
}

/** A bar with a 4px rounded cap and a square foot on the baseline. */
function barPath(x, y, width, height, radius = 4) {
  const r = Math.min(radius, height, width / 2);
  return `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
}

export function WeeklyVolumeChart({ weeks }) {
  const [showTable, setShowTable] = useState(false);

  const peak = Math.max(0, ...weeks.flatMap((w) => [w.receiptQuantity, w.issueQuantity]));
  const max = niceMax(peak);
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const band = plotWidth / Math.max(weeks.length, 1);
  const barWidth = Math.min(MAX_BAR, (band - GAP) / 2 - 6);
  const yOf = (value) => PAD.top + PLOT_HEIGHT - (value / max) * PLOT_HEIGHT;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* A legend is always present once there are two series, so identity
            never rests on colour alone. */}
        <ul className="flex gap-4">
          {SERIES.map((series) => (
            <li key={series.key} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: series.color }} />
              {series.label}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="text-xs font-medium text-brand-600 hover:underline"
        >
          {showTable ? 'Show chart' : 'Show table'}
        </button>
      </div>

      {showTable ? (
        <WeeklyTable weeks={weeks} />
      ) : (
        <svg
          viewBox={`0 0 ${WIDTH} ${PAD.top + PLOT_HEIGHT + AXIS_BAND}`}
          className="mt-3 w-full"
          role="img"
          aria-label={`Units received and issued for the last ${weeks.length} weeks`}
        >
          {ticks.map((tick) => {
            const y = yOf(tick);
            return (
              <g key={tick}>
                {/* Hairline, solid, one step off the surface. */}
                <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth="1" />
                <text x={PAD.left - 8} y={y + 4} textAnchor="end" className="fill-slate-400 text-[11px] tabular-nums">
                  {tick.toLocaleString()}
                </text>
              </g>
            );
          })}

          {weeks.map((week, index) => {
            const groupLeft = PAD.left + index * band + (band - (barWidth * 2 + GAP)) / 2;

            return (
              <g key={week.weekStart}>
                {SERIES.map((series, seriesIndex) => {
                  const value = week[series.key];
                  const height = (value / max) * PLOT_HEIGHT;
                  const x = groupLeft + seriesIndex * (barWidth + GAP);

                  return (
                    <g key={series.key}>
                      {value > 0 && (
                        <path d={barPath(x, yOf(value), barWidth, height)} fill={series.color} />
                      )}
                      {/* Generous hit area for the hover label, wider than the bar. */}
                      <rect
                        x={x} y={PAD.top} width={barWidth} height={PLOT_HEIGHT} fill="transparent"
                      >
                        <title>{tooltipFor(week, series)}</title>
                      </rect>
                    </g>
                  );
                })}

                <text
                  x={PAD.left + index * band + band / 2}
                  y={PAD.top + PLOT_HEIGHT + 20}
                  textAnchor="middle"
                  className="fill-slate-500 text-[11px]"
                >
                  {formatDate(week.weekStart).replace(/ \d{4}$/, '')}
                </text>
              </g>
            );
          })}

          <line
            x1={PAD.left} x2={WIDTH - PAD.right}
            y1={PAD.top + PLOT_HEIGHT} y2={PAD.top + PLOT_HEIGHT}
            stroke="var(--chart-grid)" strokeWidth="1"
          />
        </svg>
      )}
    </div>
  );
}

/** The chart's table twin, so no value is only reachable by hovering. */
function WeeklyTable({ weeks }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500">
            <th scope="col" className="py-1.5 text-left font-medium">Week of</th>
            <th scope="col" className="py-1.5 text-right font-medium">Received</th>
            <th scope="col" className="py-1.5 text-right font-medium">Receipts</th>
            <th scope="col" className="py-1.5 text-right font-medium">Issued</th>
            <th scope="col" className="py-1.5 text-right font-medium">Issues</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {weeks.map((week) => (
            <tr key={week.weekStart}>
              <td className="py-1.5 text-slate-700">{formatDate(week.weekStart)}</td>
              <td className="py-1.5 text-right tabular-nums text-slate-900">{week.receiptQuantity.toLocaleString()}</td>
              <td className="py-1.5 text-right tabular-nums text-slate-500">{week.receiptCount}</td>
              <td className="py-1.5 text-right tabular-nums text-slate-900">{week.issueQuantity.toLocaleString()}</td>
              <td className="py-1.5 text-right tabular-nums text-slate-500">{week.issueCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
