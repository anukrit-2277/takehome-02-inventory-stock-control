import { useState } from 'react';

import { formatDate } from '../../lib/format.js';

// Plot geometry, in the SVG's own coordinates. The viewBox scales to the card,
// so these are ratios rather than pixels on screen.
const WIDTH = 800;
const PLOT_HEIGHT = 180;
const AXIS_BAND = 30;          // room for the week labels, inside the viewBox
const PAD = { left: 40, right: 6, top: 10 };
// The viewBox is 800 wide and stretches to the card, so a unit here draws
// larger than a pixel. 13 units lands under the 24px cap on a desktop card and
// leaves the rest of the band as air.
const MAX_BAR = 13;
const GAP = 2;                 // surface gap between the two bars of a week

const SERIES = [
  { key: 'receiptQuantity', countKey: 'receiptCount', label: 'Received', color: 'var(--series-1)' },
  { key: 'issueQuantity', countKey: 'issueCount', label: 'Issued', color: 'var(--series-2)' },
];

/** Rounds an axis maximum up to a readable number rather than the raw peak. */
function niceMax(value) {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

/** A bar with a rounded cap and a square foot on the baseline. */
function barPath(x, y, width, height, radius = 3) {
  const r = Math.min(radius, height, width / 2);
  return `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
}

export function WeeklyVolumeChart({ weeks }) {
  const [showTable, setShowTable] = useState(false);
  const [hover, setHover] = useState(null);

  const peak = Math.max(0, ...weeks.flatMap((w) => [w.receiptQuantity, w.issueQuantity]));
  const max = niceMax(peak);
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const band = plotWidth / Math.max(weeks.length, 1);
  const barWidth = Math.min(MAX_BAR, (band - GAP) / 2 - 6);
  const yOf = (value) => PAD.top + PLOT_HEIGHT - (value / max) * PLOT_HEIGHT;
  // Three interior lines rather than five: enough to read a height, quiet
  // enough to stay behind the data.
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const totalHeight = PAD.top + PLOT_HEIGHT + AXIS_BAND;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* A legend is always present once there are two series, so identity
            never rests on colour alone. */}
        <ul className="flex gap-4">
          {SERIES.map((series) => (
            <li key={series.key} className="flex items-center gap-1.5 text-[12px] font-medium text-slate-600">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: series.color }} />
              {series.label}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="rounded-md px-2 py-1 text-[12px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        >
          {showTable ? 'Show chart' : 'Show table'}
        </button>
      </div>

      {showTable ? (
        <WeeklyTable weeks={weeks} />
      ) : (
        <div className="relative mt-3">
          <svg
            viewBox={`0 0 ${WIDTH} ${totalHeight}`}
            className="w-full"
            role="img"
            aria-label={`Units received and issued for the last ${weeks.length} weeks`}
            onMouseLeave={() => setHover(null)}
          >
            {ticks.map((tick) => {
              const y = yOf(tick);
              return (
                <g key={tick}>
                  {/* Hairline, solid, one step off the surface. */}
                  <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth="1" />
                  <text x={PAD.left - 8} y={y + 3.5} textAnchor="end" className="fill-slate-400 text-[10px] tnum">
                    {tick.toLocaleString()}
                  </text>
                </g>
              );
            })}

            {weeks.map((week, index) => {
              const groupLeft = PAD.left + index * band + (band - (barWidth * 2 + GAP)) / 2;
              const active = hover?.week === index;

              return (
                <g key={week.weekStart}>
                  {/* A band-wide hover target, so the pointer never has to find
                      a 13-unit bar. */}
                  <rect
                    x={PAD.left + index * band}
                    y={PAD.top}
                    width={band}
                    height={PLOT_HEIGHT}
                    fill={active ? 'rgb(241 245 249 / 0.7)' : 'transparent'}
                    onMouseEnter={() => setHover({ week: index })}
                  />

                  {SERIES.map((series, seriesIndex) => {
                    const value = week[series.key];
                    if (value <= 0) return null;
                    const height = (value / max) * PLOT_HEIGHT;
                    const x = groupLeft + seriesIndex * (barWidth + GAP);

                    return (
                      <path
                        key={series.key}
                        d={barPath(x, yOf(value), barWidth, height)}
                        fill={series.color}
                        className="pointer-events-none transition-opacity"
                        opacity={hover && !active ? 0.35 : 1}
                      />
                    );
                  })}

                  <text
                    x={PAD.left + index * band + band / 2}
                    y={PAD.top + PLOT_HEIGHT + 18}
                    textAnchor="middle"
                    className={`pointer-events-none text-[10px] ${active ? 'fill-slate-700 font-medium' : 'fill-slate-400'}`}
                  >
                    {formatDate(week.weekStart).replace(/ \d{4}$/, '')}
                  </text>
                </g>
              );
            })}

            <line
              x1={PAD.left} x2={WIDTH - PAD.right}
              y1={PAD.top + PLOT_HEIGHT} y2={PAD.top + PLOT_HEIGHT}
              stroke="#cbd5e1" strokeWidth="1"
            />
          </svg>

          {hover && <Tooltip week={weeks[hover.week]} index={hover.week} total={weeks.length} />}
        </div>
      )}
    </div>
  );
}

/** Positioned over the hovered band, flipping side near the right edge. */
function Tooltip({ week, index, total }) {
  const fraction = (index + 0.5) / total;
  const flip = fraction > 0.65;

  return (
    <div
      className="pointer-events-none absolute top-2 z-10 w-52 rounded-lg bg-slate-900 px-3 py-2 text-white shadow-lg shadow-slate-900/20"
      style={{ left: `${fraction * 100}%`, transform: `translateX(${flip ? '-108%' : '8%'})` }}
    >
      <p className="text-[11px] font-medium text-slate-300">Week of {formatDate(week.weekStart)}</p>
      <dl className="mt-1.5 space-y-1">
        {SERIES.map((series) => (
          <div key={series.key} className="flex items-baseline gap-2 text-[12px]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: series.color }} />
            <dt className="text-slate-300">{series.label}</dt>
            <dd className="ml-auto font-semibold tnum">{week[series.key].toLocaleString()}</dd>
            <dd className="w-14 text-right text-[11px] text-slate-400 tnum">
              {week[series.countKey]} mv
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** The chart's table twin, so no value is only reachable by hovering. */
function WeeklyTable({ weeks }) {
  return (
    <div className="mt-3 overflow-x-auto scrollbar-slim">
      <table className="min-w-full text-[13px]">
        <thead>
          <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
            <th scope="col" className="py-2 text-left font-semibold">Week of</th>
            <th scope="col" className="py-2 text-right font-semibold">Received</th>
            <th scope="col" className="py-2 text-right font-semibold">Receipts</th>
            <th scope="col" className="py-2 text-right font-semibold">Issued</th>
            <th scope="col" className="py-2 text-right font-semibold">Issues</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {weeks.map((week) => (
            <tr key={week.weekStart} className="hover:bg-slate-50">
              <td className="py-1.5 text-slate-700">{formatDate(week.weekStart)}</td>
              <td className="py-1.5 text-right font-medium text-slate-900 tnum">{week.receiptQuantity.toLocaleString()}</td>
              <td className="py-1.5 text-right text-slate-500 tnum">{week.receiptCount}</td>
              <td className="py-1.5 text-right font-medium text-slate-900 tnum">{week.issueQuantity.toLocaleString()}</td>
              <td className="py-1.5 text-right text-slate-500 tnum">{week.issueCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
