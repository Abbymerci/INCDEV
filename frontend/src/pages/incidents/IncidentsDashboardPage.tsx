import { useEffect, useState } from "react";
import { getIncidentSummary, listIncidents } from "../../api/incidents";
import { ApiError } from "../../api/client";
import type { Incident, IncidentStatus, Priority, SummaryResponse } from "../../types";
import { formatDuration } from "../../utils/format";
import IncidentDetailModal from "./IncidentDetailModal";
import IncidentsTable from "./IncidentsTable";
import SummaryCard from "./SummaryCard";

const PAGE_SIZE = 4;

export default function IncidentsDashboardPage() {
  const [priorityFilter, setPriorityFilter] = useState<Priority | "">("");
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | "">("");
  const [page, setPage] = useState(1);
  const [selectedIncidentNumber, setSelectedIncidentNumber] = useState<string | null>(null);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset back to page 1 whenever filters change.
  useEffect(() => {
    setPage(1);
  }, [priorityFilter, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      listIncidents({
        priority: priorityFilter || undefined,
        status: statusFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
      getIncidentSummary(),
    ])
      .then(([listRes, summaryRes]) => {
        if (cancelled) return;
        setIncidents(listRes.items);
        setTotal(listRes.total);
        setSummary(summaryRes);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof ApiError
            ? `Could not reach the incidents API (${err.status}). Is the backend running?`
            : "Could not reach the incidents API. Is the backend running?";
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [priorityFilter, statusFilter, page]);

  return (
    <div className="grid grid-cols-12 gap-gutter">
      <header className="col-span-12 mb-2 flex justify-between items-end flex-wrap gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-background mb-2">
            Active Incidents Dashboard
          </h2>
          <p className="text-on-surface-variant font-body-lg text-body-lg">
            Monitoring high-priority system events and ongoing resolutions.
          </p>
        </div>

        <div className="flex gap-4">
          <div className="flex flex-col gap-1">
            <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="priority-filter">
              Priority
            </label>
            <select
              id="priority-filter"
              className="border border-outline-variant bg-surface rounded py-1.5 px-3 text-body-md focus:border-secondary focus:ring-secondary focus:ring-opacity-20 outline-none w-32 shadow-sm"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as Priority | "")}
            >
              <option value="">All Priorities</option>
              <option value="P1">P1 - Critical</option>
              <option value="P2">P2 - High</option>
              <option value="P3">P3 - Medium</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="status-filter">
              Status
            </label>
            <select
              id="status-filter"
              className="border border-outline-variant bg-surface rounded py-1.5 px-3 text-body-md focus:border-secondary focus:ring-secondary focus:ring-opacity-20 outline-none w-40 shadow-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as IncidentStatus | "")}
            >
              <option value="">All Active</option>
              <option value="Bridge Active">Bridge Active</option>
              <option value="Pending Vendor">Pending Vendor</option>
              <option value="Investigating">Investigating</option>
            </select>
          </div>
        </div>
      </header>

      <div className="col-span-12 grid grid-cols-4 gap-gutter mb-6">
        <SummaryCard label="Critical (P1)" value={summary?.critical_count ?? "—"} accent="error" valueClassName="text-error" />
        <SummaryCard label="High (P2)" value={summary?.high_count ?? "—"} accent="secondary" />
        <SummaryCard label="Active Bridges" value={summary?.active_bridges ?? "—"} />
        <SummaryCard
          label="Avg Resolution Time"
          value={summary ? formatDuration(summary.avg_resolution_minutes) : "—"}
        />
      </div>

      <IncidentsTable
        incidents={incidents}
        loading={loading}
        error={error}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        onRowClick={setSelectedIncidentNumber}
      />

      {selectedIncidentNumber && (
        <IncidentDetailModal
          incidentNumber={selectedIncidentNumber}
          onClose={() => setSelectedIncidentNumber(null)}
        />
      )}
    </div>
  );
}
