import { Link } from 'react-router-dom';

import { dashboard } from '../api/endpoints.js';
import { useFetch } from '../hooks/useFetch.js';
import { Card, ErrorMessage } from '../components/ui.jsx';
import { FullPageSpinner } from '../components/Spinner.jsx';
import { BarList } from '../components/charts/BarList.jsx';
import { WeeklyVolumeChart } from '../components/charts/WeeklyVolumeChart.jsx';

export function Dashboard() {
  const { data, error, loading } = useFetch(() => dashboard.get(), []);

  if (loading && !data) return <FullPageSpinner />;
  if (error) return <ErrorMessage error={error} />;

  const { headline, byCategory, byLocation, weekly } = data;

  // Single values, so each is a stat tile rather than a one-bar chart.
  const tiles = [
    { label: 'Active items', value: headline.activeItems, to: '/items' },
    { label: 'At or below reorder level', value: headline.atOrBelowReorder, to: '/items?belowReorder=true', alert: headline.atOrBelowReorder > 0 },
    { label: 'Movements today', value: headline.movementsToday, to: '/movements' },
    { label: 'Items moved this week', value: headline.itemsMovedThisWeek, to: '/movements' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Stock position and activity across every location</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Link key={tile.label} to={tile.to} className="rounded-lg outline-offset-2">
            <Card className="h-full p-4 transition hover:ring-brand-200">
              <p className="text-sm text-slate-500">{tile.label}</p>
              {/* Proportional figures: tabular-nums makes a large standalone
                  number look loose. */}
              <p className={`mt-1 text-3xl font-semibold ${tile.alert ? 'text-red-600' : 'text-slate-900'}`}>
                {tile.value.toLocaleString()}
              </p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">Stock by category</h2>
          <BarList
            rows={byCategory.map((row) => ({
              key: row.id,
              label: row.name,
              note: `${row.itemCount} item${row.itemCount === 1 ? '' : 's'}`,
              value: row.onHand,
            }))}
          />
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">Stock by location</h2>
          <BarList
            rows={byLocation.map((row) => ({
              key: row.id,
              label: row.code,
              note: row.isActive ? row.name : `${row.name} · inactive`,
              value: row.onHand,
            }))}
          />
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-900">Receipt and issue volume</h2>
          <p className="text-xs text-slate-500">Units moved per week, last eight weeks</p>
        </div>
        <WeeklyVolumeChart weeks={weekly} />
      </Card>
    </div>
  );
}
