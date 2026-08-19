import Icon from "../../components/Icon";
import type { Incident } from "../../types";
import { formatDuration, formatOpenedAt } from "../../utils/format";
import { PriorityBadge, StatusIndicator } from "./badges";

interface IncidentsTableProps {
  incidents: Incident[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onRowClick: (incidentNumber: string) => void;
}

export default function IncidentsTable({
  incidents,
  loading,
  error,
  total,
  page,
  pageSize,
  onPageChange,
  onRowClick,
}: IncidentsTableProps) {
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <div className="col-span-12 bg-surface rounded border border-outline-variant shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
              <th className="py-3 px-4 w-28">Incident #</th>
              <th className="py-3 px-4 w-20">Priority</th>
              <th className="py-3 px-4 w-16 text-center">MIM</th>
              <th className="py-3 px-4 w-40">Opened</th>
              <th className="py-3 px-4 w-24">Duration</th>
              <th className="py-3 px-4 w-40">Status</th>
              <th className="py-3 px-4">Causal CIO</th>
              <th className="py-3 px-4">Impacted Biz</th>
              <th className="py-3 px-4 w-12" />
            </tr>
          </thead>
          <tbody className="font-body-md text-body-md text-on-background">
            {loading && (
              <tr>
                <td colSpan={9} className="py-8 px-4 text-center text-on-surface-variant">
                  Loading incidents…
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={9} className="py-8 px-4 text-center text-error">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && incidents.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 px-4 text-center text-on-surface-variant">
                  No incidents match the current filters.
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              incidents.map((incident, index) => (
                <tr
                  key={incident.incident_number}
                  className={`border-b border-surface-dim hover:bg-surface-container-low transition-colors group cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-inset ${
                    index % 2 === 1 ? "bg-surface-bright" : ""
                  }`}
                  onClick={() => onRowClick(incident.incident_number)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRowClick(incident.incident_number);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`View details for ${incident.incident_number}`}
                >
                  <td className="py-3 px-4 font-semibold text-primary">{incident.incident_number}</td>
                  <td className="py-3 px-4">
                    <PriorityBadge priority={incident.priority} />
                  </td>
                  <td className="py-3 px-4 text-center">
                    {incident.mim ? (
                      <span className="font-bold text-error">Y</span>
                    ) : (
                      <span className="text-on-surface-variant">N</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-on-surface-variant">{formatOpenedAt(incident.opened_at)}</td>
                  <td
                    className={`py-3 px-4 ${
                      incident.status === "Bridge Active" ? "font-medium text-error" : ""
                    }`}
                  >
                    {formatDuration(incident.duration_minutes)}
                  </td>
                  <td className="py-3 px-4">
                    <StatusIndicator status={incident.status} />
                  </td>
                  <td className="py-3 px-4 truncate max-w-[150px]">{incident.causal_cio}</td>
                  <td className="py-3 px-4 truncate max-w-[150px]">{incident.impacted_biz}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      className="text-on-surface-variant hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                      aria-label={`Open ${incident.incident_number}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRowClick(incident.incident_number);
                      }}
                    >
                      <Icon name="open_in_new" className="text-[20px]" />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="bg-surface-container-low border-t border-outline-variant p-3 flex justify-between items-center text-body-md text-on-surface-variant">
        <span>
          {total === 0
            ? "No active incidents"
            : `Showing ${rangeStart}-${rangeEnd} of ${total} active incidents`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="p-1 hover:text-primary disabled:opacity-50 disabled:hover:text-on-surface-variant"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            <Icon name="chevron_left" className="text-[20px]" />
          </button>
          <span className="px-2 font-label-md">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="p-1 hover:text-primary disabled:opacity-50 disabled:hover:text-on-surface-variant"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            <Icon name="chevron_right" className="text-[20px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
