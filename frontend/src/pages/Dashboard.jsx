import { Link } from 'react-router-dom';

import { dashboard } from '../api/endpoints.js';
import { useFetch } from '../hooks/useFetch.js';
import { Card, ErrorMessage, PanelHeader } from '../components/ui.jsx';
import { PageHeader } from '../components/Layout.jsx';
import { FullPageSpinner } from '../components/Spinner.jsx';
import { BarList } from '../components/charts/BarList.jsx';
import { WeeklyVolumeChart } from '../components/charts/WeeklyVolumeChart.jsx';
import { IconActivity, IconAlert, IconClock, IconPackage } from '../components/Icons.jsx';

export function Dashboard() {
  const { data, error, loading } = useFetch(() => dashboard.get(), []);

  if (loading && !data) return <FullPageSpinner />;
  if (error) return <ErrorMessage error={error} />;

  const { headline, byCategory, byLocation, weekly } = data;

  // Single values, so each is a stat tile rather than a one-bar chart.
  const tiles = [
    { label: 'Active items', value: headline.activeItems, to: '/items', icon: IconPackage, hint: 'in the catalogue' },
    { label: 'At or below reorder level', value: headline.atOrBelowReorder, to: '/items?belowReorder=true', icon: IconAlert, hint: 'need reordering', alert: headline.atOrBelowReorder > 0 },
    { label: 'Movements today', value: headline.movementsToday, to: '/movements', icon: IconClock, hint: 'recorded so far' },
    { label: 'Items moved this week', value: headline.itemsMovedThisWeek, to: '/movements', icon: IconActivity, hint: 'distinct SKUs' },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" description="Stock position and activity across every location" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <Link key={tile.label} to={tile.to} className="group rounded-xl">
            <Card className="relative h-full overflow-hidden p-4 transition duration-150 group-hover:shadow-md group-hover:shadow-slate-900/10 group-hover:ring-slate-300">
              {/* Oversized, very faint glyph: gives the tile a subject without
                  competing with the number. */}
              <tile.icon className="pointer-events-none absolute -right-3 -top-3 h-24 w-24 text-slate-900/[0.035]" />

              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-semibold uppercase tracking-wide ${tile.alert ? 'text-rose-600' : 'text-slate-500'}`}>
                  {tile.label}
                </span>
                {tile.alert && (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                  </span>
                )}
              </div>

              {/* Proportional figures: tabular-nums makes a large standalone
                  number look loose. */}
              <p className={`mt-2 text-[30px] font-semibold leading-none tracking-tight ${tile.alert ? 'text-rose-600' : 'text-slate-900'}`}>
                {tile.value.toLocaleString()}
              </p>
              <p className="mt-1.5 text-[12px] text-slate-400">{tile.hint}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <PanelHeader title="Stock by category" description="Units on hand across all locations" />
          <div className="px-4 py-4">
            <BarList
              rows={byCategory.map((row) => ({
                key: row.id,
                label: row.name,
                note: `${row.itemCount} item${row.itemCount === 1 ? '' : 's'}`,
                value: row.onHand,
              }))}
            />
          </div>
        </Card>

        <Card>
          <PanelHeader title="Stock by location" description="Where those units physically are" />
          <div className="px-4 py-4">
            <BarList
              rows={byLocation.map((row) => ({
                key: row.id,
                label: row.code,
                note: row.isActive ? row.name : `${row.name} · inactive`,
                value: row.onHand,
              }))}
            />
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <PanelHeader title="Receipt and issue volume" description="Units moved per week, last eight weeks" />
        <div className="px-4 py-4">
          <WeeklyVolumeChart weeks={weekly} />
        </div>
      </Card>
    </div>
  );
}
