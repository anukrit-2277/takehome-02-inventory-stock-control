import { useRef, useState } from 'react';

import { exports as exportsApi, imports } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useAlerts } from '../context/AlertsContext.jsx';
import { Button, Card, ErrorMessage, Select } from '../components/ui.jsx';

export function DataTransfer() {
  const { isManager } = useAuth();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Import and export</h1>
        <p className="text-sm text-slate-500">
          Bring items and receipts in from a spreadsheet, or take the current stock position out
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {isManager && (
          <ImportCard
            title="Import items"
            description="Creates items in bulk. Categories must already exist."
            columns="sku, name, description, unitOfMeasure, reorderLevel, category"
            run={imports.items}
            noun="item"
          />
        )}
        <ImportCard
          title="Import receipts"
          description="Records stock arriving. Each row goes through the same checks as the form, including your assigned locations."
          columns="sku, location, quantity, date, note"
          run={imports.receipts}
          noun="receipt"
        />
      </div>

      <ExportCard />
    </div>
  );
}

function ImportCard({ title, description, columns, run, noun }) {
  const { refresh: refreshBadge } = useAlerts();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);

  async function upload() {
    setError(null);
    setReport(null);
    setUploading(true);
    try {
      setReport(await run(file));
      refreshBadge();
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      setError(err);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="flex flex-col p-5">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      <p className="mt-2 font-mono text-xs text-slate-500">{columns}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          aria-label={title}
          onChange={(e) => { setFile(e.target.files[0] ?? null); setReport(null); setError(null); }}
          className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
        />
        <Button onClick={upload} disabled={!file || uploading}>
          {uploading ? 'Importing…' : 'Import'}
        </Button>
      </div>

      <ErrorMessage error={error} className="mt-3" />
      {report && <ImportReport report={report} noun={noun} />}
    </Card>
  );
}

/**
 * The per-row report goal 7 asks for: what went in, what did not, and why —
 * with the line number so the file can be corrected.
 */
function ImportReport({ report, noun }) {
  const allGood = report.failed === 0;

  return (
    <div className="mt-4">
      <div
        className={`rounded-md px-3 py-2 text-sm ring-1 ${
          allGood ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-amber-50 text-amber-900 ring-amber-200'
        }`}
      >
        <strong>{report.imported}</strong> of {report.totalRows} {noun}
        {report.totalRows === 1 ? '' : 's'} imported
        {report.failed > 0 && <> · <strong>{report.failed}</strong> skipped</>}
        {!allGood && (
          <span className="mt-1 block text-xs">
            Valid rows were imported. Only the rows listed below were skipped.
          </span>
        )}
      </div>

      {report.failures.length > 0 && (
        <div className="mt-3 max-h-64 overflow-y-auto rounded-md ring-1 ring-slate-200">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-600">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Line</th>
                <th scope="col" className="px-3 py-2 font-medium">SKU</th>
                <th scope="col" className="px-3 py-2 font-medium">Why it was skipped</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.failures.map((failure) => (
                <tr key={`${failure.line}-${failure.sku}`}>
                  <td className="px-3 py-2 tabular-nums text-slate-500">{failure.line}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-700">{failure.sku ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-700">{failure.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ExportCard() {
  const [archived, setArchived] = useState('active');
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  async function download() {
    setError(null);
    setDownloading(true);
    try {
      await exportsApi.stockPosition({ archived });
    } catch (err) {
      setError(err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-slate-900">Export stock position</h2>
      <p className="mt-1 text-sm text-slate-600">
        Every item's on-hand quantity in each location, as a CSV.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Select value={archived} onChange={(e) => setArchived(e.target.value)} aria-label="Which items to export" className="max-w-56">
          <option value="active">Active items only</option>
          <option value="archived">Archived items only</option>
          <option value="all">Active and archived</option>
        </Select>
        <Button onClick={download} disabled={downloading}>
          {downloading ? 'Preparing…' : 'Download CSV'}
        </Button>
      </div>

      <ErrorMessage error={error} className="mt-3" />
    </Card>
  );
}
