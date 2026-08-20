/**
 * COO Major Incident Dashboard — standalone single-file React component,
 * matching the "target design" mockup 1:1 (the 4-tile KPI dashboard +
 * animated incident detail modal).
 *
 * This is CONTENT ONLY — no sidebar, no top nav, no search bar. Drop it
 * into your existing shell (which already provides those) and render:
 *
 *   <IncidentDashboard />
 *   <IncidentDashboard apiBaseUrl="/api" />                 // explicit base path
 *   <IncidentDashboard apiBaseUrl="https://host:8000" />    // different host
 *
 * DATA: this version fetches from a backend — the companion
 * `incident_dashboard_router.py` (same pairing pattern as the earlier
 * incidents_router.py + IncidentConsole.tsx). `apiBaseUrl` defaults to ""
 * — same-origin relative fetches to "/api/incidents...". That matches
 * mounting that router directly into your existing backend app.
 *
 * Behavior (matches the ideal flow):
 *   - 4 KPI tiles at the top:
 *       1. P1 & P2 — WFT-Wide      (count of all P1/P2 incidents)
 *       2. Major Incidents — COO Caused
 *       3. Major Incidents — COO Impacted
 *       4. P3 & P4 — TCOO Caused
 *   - The table defaults to showing ALL incidents regardless of category.
 *   - Clicking a tile filters the table to that category; clicking the
 *     same tile again (or the "x" on the filter chip) clears the filter.
 *   - Clicking a row (or its sparkle button) opens an 80vw x 80vh animated
 *     detail panel: root cause, impact to COO services, customer/client
 *     impact, incident commander, a Join Bridge link, an AI-generated
 *     summary, and a timeline.
 *
 * No external CSS, font, or icon-font dependency — plain inline styles,
 * same Institutional Heritage palette as the rest of this project.
 * Requires only `react` and `react-dom` (createPortal).
 *
 * QUICK EDIT GUIDE — "I want to change X, where do I look?"
 * ------------------------------------------------------------------
 *   Change a color (red, gold, etc.)          -> the `theme` object below
 *   Change fonts                              -> `fontHeadline` / `fontBody` below
 *   Change a tile's title text                -> `TILE_LABELS` (near the bottom)
 *   Change a Priority badge's color           -> `PRIORITY_STYLES`
 *   Change a Status dot's color               -> `STATUS_DOT_COLOR`
 *   Add/remove a table column                 -> you need to touch 3 places:
 *                                                  1. add a <SortableHeader> in
 *                                                     IncidentsTable's <thead>
 *                                                  2. add a matching <td> in IncidentRow
 *                                                  3. (if it should be sortable) add the
 *                                                     field to SortField above AND to
 *                                                     _SORTABLE_FIELDS in the backend
 *   Add a new dropdown filter option           -> add an <option> in the Priority/Status
 *                                                  <select> near the bottom, matching the
 *                                                  Python enum's exact text in the backend
 *   Change how many rows show per page         -> `PAGE_SIZE` constant (near the bottom)
 *   Change the header title/subtitle text      -> the <h2>/<p> inside the root component,
 *                                                  near the top of the returned JSX
 *   Change what's shown in the detail modal    -> `IncidentDetailModal` (the `<Fact>` rows
 *                                                  and the AI-summary/timeline sections)
 *   This file only fetches/displays data — to change WHAT data shows up
 *   (add an incident, change wording, etc.) edit incident_dashboard_router.py instead.
 */

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

// ---------------------------------------------------------------------------
// Theme — Institutional Heritage palette, ported 1:1 from the design tokens.
// EVERY color used anywhere in this file comes from this one object — to
// re-theme the whole dashboard, change the hex values here rather than
// hunting through the JSX below.
// ---------------------------------------------------------------------------

const theme = {
  primary: "#af0017",
  primaryContainer: "#d71e28",
  onPrimary: "#ffffff",
  onPrimaryContainer: "#ffeeec",
  error: "#ba1a1a",
  errorContainer: "#ffdad6",
  onErrorContainer: "#93000a",
  secondary: "#7a5900",
  secondaryContainer: "#fdce6d",
  onSecondaryContainer: "#765600",
  tertiaryContainer: "#ebe2ce",
  surface: "#fcf9f8",
  surfaceContainer: "#f0eded",
  surfaceContainerLow: "#f6f3f2",
  surfaceDim: "#dcd9d9",
  surfaceVariant: "#e5e2e1",
  onSurface: "#1b1c1c",
  onSurfaceVariant: "#5c3f3d",
  onBackground: "#1b1c1c",
  background: "#fcf9f8",
  outline: "#916f6c",
  outlineVariant: "#e6bdb9",
  inverseSurface: "#303030",
} as const;

const fontHeadline = '"Source Serif 4", Georgia, "Times New Roman", serif';
const fontBody = '"Work Sans", "Segoe UI", Arial, sans-serif';

// ---------------------------------------------------------------------------
// Types (mirrors incident_dashboard_router.py's Pydantic models 1:1)
//
// IMPORTANT: these types and the Python models in incident_dashboard_router.py
// must stay in sync. If you rename a field or add a new Priority/Status/
// Category value on the backend, make the matching change here too (and
// vice versa) — field names and enum string values are compared as plain
// text between frontend and backend, so a mismatch just silently shows
// nothing instead of throwing an error you'd notice.
// ---------------------------------------------------------------------------

export type Priority = "P1" | "P2" | "P3" | "P4";
export type IncidentStatus = "Bridge Active" | "Pending Vendor" | "Investigating";
export type Category = "COO Caused" | "COO Impacted" | "TCOO Caused" | "WFT-Wide";
export type TileFilter = "P1_P2_WFT" | "COO_CAUSED" | "COO_IMPACTED" | "TCOO_CAUSED" | null;
export type SortField = "incident_number" | "priority" | "category" | "status" | "root_cause" | "customer_impact";
export type SortDir = "asc" | "desc";

export interface Incident {
  incident_number: string;
  priority: Priority;
  category: Category;
  status: IncidentStatus;
  opened_at: string; // ISO
  root_cause: string;
  customer_impact: string;
}

export interface TimelineEntry {
  timestamp: string;
  author: string;
  note: string;
}

export interface IncidentDetail extends Incident {
  description: string;
  impact_to_coo_services: string;
  customer_client_impact: string;
  incident_commander: string;
  bridge_url: string | null;
  ai_summary: string;
  updates: TimelineEntry[];
}

export interface IncidentListResponse {
  items: Incident[];
  total: number;
  page: number;
  page_size: number;
}

export interface SummaryResponse {
  p1_p2_wft: number;
  coo_caused: number;
  coo_impacted: number;
  tcoo_caused: number;
}

// ---------------------------------------------------------------------------
// API client — everything below talks to incident_dashboard_router.py.
// You shouldn't need to edit this section unless you're adding a brand-new
// endpoint or query parameter; for wording/data changes, edit the backend
// file instead.
// ---------------------------------------------------------------------------

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function apiGet<T>(
  apiBaseUrl: string,
  path: string,
  params?: Record<string, string | undefined>
): Promise<T> {
  const qs = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") qs.set(key, value);
    });
  }
  const query = qs.toString();
  const res = await fetch(`${apiBaseUrl}${path}${query ? `?${query}` : ""}`);
  if (!res.ok) {
    throw new ApiError(`Request to ${path} failed with status ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}

// Fetches one page of the incidents table. Called whenever a tile, filter,
// search box, sort header, or page button changes — see the root component's
// useEffect near the bottom. Every param here becomes a "?x=..." on the
// request; the backend's list_incidents() function is what actually reads them.
function listIncidents(
  apiBaseUrl: string,
  params: {
    tile?: TileFilter;
    priority?: Priority | "";
    status?: IncidentStatus | "";
    q?: string;
    sortBy?: SortField | null;
    sortDir?: SortDir;
    page: number;
    pageSize: number;
  }
): Promise<IncidentListResponse> {
  return apiGet<IncidentListResponse>(apiBaseUrl, "/api/incidents", {
    tile: params.tile ?? undefined,
    priority: params.priority || undefined,
    status: params.status || undefined,
    q: params.q || undefined,
    sort_by: params.sortBy ?? undefined,
    sort_dir: params.sortBy ? params.sortDir : undefined,
    page: params.page.toString(),
    page_size: params.pageSize.toString(),
  });
}

// Fetches the 4 numbers shown on the KPI tiles.
function getSummary(apiBaseUrl: string): Promise<SummaryResponse> {
  return apiGet<SummaryResponse>(apiBaseUrl, "/api/incidents/summary");
}

// Fetches the full detail for one incident, used to populate the modal
// when a row is clicked.
function getIncidentDetail(apiBaseUrl: string, incidentNumber: string): Promise<IncidentDetail> {
  return apiGet<IncidentDetail>(apiBaseUrl, `/api/incidents/${encodeURIComponent(incidentNumber)}`);
}

// ---------------------------------------------------------------------------
// Format utils
// ---------------------------------------------------------------------------

function formatOpenedAt(isoString: string): string {
  const date = new Date(isoString);
  const datePart = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const timePart = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${datePart}, ${timePart}`;
}

function formatElapsed(isoString: string): string {
  const minutes = Math.max(Math.floor((Date.now() - new Date(isoString).getTime()) / 60_000), 0);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins.toString().padStart(2, "0")}m`;
}

function formatTimelineTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ---------------------------------------------------------------------------
// Inline SVG icons (no icon-font dependency)
//
// These are all plain decorative line-icons — purely visual, no data or
// logic in them. Safe to swap out or delete any of these if you'd rather
// use an icon library (e.g. lucide-react) instead; just keep the same
// component name and a `size` prop so the call sites below don't need to change.
// ---------------------------------------------------------------------------

function IconBase({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const IconChevronLeft = (p: { size?: number }) => (
  <IconBase size={p.size}>
    <path d="M15 18l-6-6 6-6" />
  </IconBase>
);

const IconChevronRight = (p: { size?: number }) => (
  <IconBase size={p.size}>
    <path d="M9 18l6-6-6-6" />
  </IconBase>
);

const IconSearch = (p: { size?: number }) => (
  <IconBase size={p.size}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </IconBase>
);

const IconArrowUp = (p: { size?: number }) => (
  <IconBase size={p.size}>
    <path d="M12 19V5" />
    <path d="m5 12 7-7 7 7" />
  </IconBase>
);

const IconArrowDown = (p: { size?: number }) => (
  <IconBase size={p.size}>
    <path d="M12 5v14" />
    <path d="m19 12-7 7-7-7" />
  </IconBase>
);

const IconClose = (p: { size?: number }) => (
  <IconBase size={p.size}>
    <path d="M18 6 6 18" />
    <path d="M6 6l12 12" />
  </IconBase>
);

const IconCall = (p: { size?: number }) => (
  <IconBase size={p.size}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </IconBase>
);

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

// The colored pill shown next to each Priority (P1/P2/P3/P4) in the table
// and modal. To add a new priority (e.g. "P5"), add a matching entry here
// AND add "P5" to the Priority type above AND to the Priority enum in
// incident_dashboard_router.py.
const PRIORITY_STYLES: Record<Priority, { bg: string; fg: string }> = {
  P1: { bg: theme.errorContainer, fg: theme.onErrorContainer },
  P2: { bg: theme.secondaryContainer, fg: theme.onSecondaryContainer },
  P3: { bg: theme.surfaceVariant, fg: theme.onSurfaceVariant },
  P4: { bg: theme.surfaceVariant, fg: theme.onSurfaceVariant },
};

function PriorityBadge({ priority }: { priority: Priority }) {
  const s = PRIORITY_STYLES[priority];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 2,
        fontFamily: fontBody,
        fontSize: 12,
        fontWeight: 700,
        background: s.bg,
        color: s.fg,
      }}
    >
      {priority}
    </span>
  );
}

// The color of the small status dot shown next to each incident's status
// text. To add a new status (e.g. "Resolved"), add a matching entry here
// AND to the IncidentStatus type above AND to the IncidentStatus enum in
// incident_dashboard_router.py.
const STATUS_DOT_COLOR: Record<IncidentStatus, string> = {
  "Bridge Active": theme.error,
  "Pending Vendor": theme.secondary,
  Investigating: theme.outline,
};

function StatusIndicator({ status }: { status: IncidentStatus }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        color: status === "Bridge Active" ? theme.onBackground : theme.onSurfaceVariant,
        fontFamily: fontBody,
        fontSize: 14,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: STATUS_DOT_COLOR[status],
          flexShrink: 0,
          animation: status === "Bridge Active" ? "ic-pulse 1.6s ease-in-out infinite" : undefined,
        }}
      />
      {status}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI tile — one of the 4 clickable boxes at the top of the dashboard.
// `selected` = this tile is the active filter (red border + "Selected" tag).
// `restingAccent` = an optional thin top-border color shown when NOT
// selected (used on the P1&P2 and COO Impacted tiles to hint at severity;
// omit it for a plain tile with no accent).
// ---------------------------------------------------------------------------

function KpiTile({
  label,
  value,
  restingAccent,
  selected,
  onClick,
}: {
  label: string;
  value: number | string;
  restingAccent?: string;
  selected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        textAlign: "left",
        background: selected ? "rgba(175,0,23,0.06)" : theme.surface,
        border: selected ? `2px solid ${theme.primary}` : `1px solid ${theme.outlineVariant}`,
        borderTop: !selected && restingAccent ? `4px solid ${restingAccent}` : undefined,
        borderRadius: 4,
        padding: 20,
        cursor: "pointer",
        boxShadow: hovered ? "0 2px 6px rgba(0,0,0,0.08)" : "0 1px 2px rgba(0,0,0,0.04)",
        transition: "box-shadow 120ms ease",
        fontFamily: fontBody,
      }}
    >
      {selected && (
        <span
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            background: theme.primary,
            color: theme.onPrimary,
            padding: "2px 8px",
            borderRadius: 999,
          }}
        >
          Selected
        </span>
      )}
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: selected ? theme.primary : theme.onSurfaceVariant,
          margin: "0 0 4px",
          paddingRight: selected ? 64 : 0,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: fontHeadline,
          fontSize: 40,
          lineHeight: "48px",
          fontWeight: 700,
          color: selected ? theme.primary : theme.onBackground,
          margin: 0,
        }}
      >
        {value}
      </p>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Incidents table
// ---------------------------------------------------------------------------

const th: CSSProperties = {
  padding: "12px 16px",
  textAlign: "left",
  fontFamily: fontBody,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: theme.onSurfaceVariant,
};

const td: CSSProperties = {
  padding: "12px 16px",
  fontFamily: fontBody,
  fontSize: 14,
  color: theme.onSurface,
  borderBottom: `1px solid ${theme.surfaceDim}`,
};

// One row of the incidents table. Add/remove a <td> here to add/remove a
// column — and add/remove the matching <SortableHeader> in IncidentsTable
// below (both must have the same number of columns, in the same order).
function IncidentRow({
  incident,
  isEven,
  onOpen,
}: {
  incident: Incident;
  isEven: boolean;
  onOpen: (incidentNumber: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <tr
      style={{ background: hovered || isEven ? theme.surfaceContainerLow : theme.surface, cursor: "pointer" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onOpen(incident.incident_number)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(incident.incident_number);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`View details for ${incident.incident_number}`}
    >
      <td style={{ ...td, fontWeight: 700, color: theme.primary }}>{incident.incident_number}</td>
      <td style={td}>
        <PriorityBadge priority={incident.priority} />
      </td>
      <td style={{ ...td, color: theme.onSurfaceVariant }}>{incident.category}</td>
      <td style={td}>
        <StatusIndicator status={incident.status} />
      </td>
      <td style={{ ...td, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {incident.root_cause}
      </td>
      <td style={{ ...td, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {incident.customer_impact}
      </td>
      <td style={{ ...td, textAlign: "center", opacity: hovered ? 1 : 0.55, transition: "opacity 120ms ease" }}>
        <span aria-hidden="true">✨</span>
      </td>
    </tr>
  );
}

// A clickable column header. Clicking it calls onSort(field); the parent
// (IncidentsTable/root component) decides what that does — toggling between
// ascending/descending and re-fetching from the backend already sorted.
// `field` must be one of the SortField values, which must also exist as a
// key in the backend's _SORTABLE_FIELDS dict, or sorting that column will fail.
function SortableHeader({
  label,
  field,
  width,
  sortBy,
  sortDir,
  onSort,
}: {
  label: string;
  field: SortField;
  width?: number;
  sortBy: SortField | null;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}) {
  const active = sortBy === field;
  return (
    <th style={{ ...th, width }}>
      <button
        type="button"
        onClick={() => onSort(field)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          background: "none",
          border: "none",
          padding: 0,
          margin: 0,
          font: "inherit",
          color: active ? theme.primary : "inherit",
          cursor: "pointer",
        }}
        aria-label={`Sort by ${label} ${active && sortDir === "asc" ? "descending" : "ascending"}`}
      >
        {label}
        {active ? (
          sortDir === "asc" ? (
            <IconArrowUp size={12} />
          ) : (
            <IconArrowDown size={12} />
          )
        ) : (
          <span style={{ width: 12, height: 12, display: "inline-block" }} />
        )}
      </button>
    </th>
  );
}

// The table itself: header row (6 sortable columns), body rows (loading /
// error / empty-state / actual rows), and the pagination footer. This
// component doesn't fetch data or hold filter state itself — it just
// displays whatever the root component (at the bottom of this file) hands it.
function IncidentsTable({
  incidents,
  loading,
  error,
  total,
  page,
  pageSize,
  sortBy,
  sortDir,
  onSort,
  onPageChange,
  onRowOpen,
}: {
  incidents: Incident[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  pageSize: number;
  sortBy: SortField | null;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  onPageChange: (page: number) => void;
  onRowOpen: (incidentNumber: string) => void;
}) {
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <div
      style={{
        background: theme.surface,
        borderRadius: 4,
        border: `1px solid ${theme.outlineVariant}`,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        overflow: "hidden",
      }}
    >
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: theme.surfaceContainerLow, borderBottom: `1px solid ${theme.outlineVariant}` }}>
              <SortableHeader label="Incident #" field="incident_number" width={112} sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <SortableHeader label="Priority" field="priority" width={90} sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <SortableHeader label="Category" field="category" width={130} sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <SortableHeader label="Status" field="status" width={150} sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <SortableHeader label="Root Cause" field="root_cause" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <SortableHeader label="Customer Impact" field="customer_impact" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <th style={{ ...th, width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} style={{ ...td, textAlign: "center", padding: "32px 16px", color: theme.onSurfaceVariant }}>
                  Loading incidents…
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={7} style={{ ...td, textAlign: "center", padding: "32px 16px", color: theme.error }}>
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && incidents.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...td, textAlign: "center", padding: "32px 16px", color: theme.onSurfaceVariant }}>
                  No incidents match the current filter.
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              incidents.map((incident, index) => (
                <IncidentRow key={incident.incident_number} incident={incident} isEven={index % 2 === 1} onOpen={onRowOpen} />
              ))}
          </tbody>
        </table>
      </div>

      <div
        style={{
          background: theme.surfaceContainerLow,
          borderTop: `1px solid ${theme.outlineVariant}`,
          padding: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: fontBody,
          fontSize: 14,
          color: theme.onSurfaceVariant,
        }}
      >
        <span>{total === 0 ? "No incidents" : `Showing ${rangeStart}-${rangeEnd} of ${total} incidents`}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            style={{
              display: "flex",
              padding: 4,
              background: "none",
              border: "none",
              cursor: page <= 1 ? "default" : "pointer",
              color: theme.onSurfaceVariant,
              opacity: page <= 1 ? 0.5 : 1,
            }}
          >
            <IconChevronLeft />
          </button>
          <span style={{ padding: "0 8px", fontWeight: 600 }}>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            aria-label="Next page"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            style={{
              display: "flex",
              padding: 4,
              background: "none",
              border: "none",
              cursor: page >= totalPages ? "default" : "pointer",
              color: theme.onSurfaceVariant,
              opacity: page >= totalPages ? 0.5 : 1,
            }}
          >
            <IconChevronRight />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Incident detail modal (80vw x 80vh, centered, animated in/out)
//
// Opens when a table row is clicked. Fetches the full IncidentDetail for
// just that one incident (getIncidentDetail, above) and renders it in two
// columns: key facts + Join Bridge button on the left, AI summary + timeline
// on the right. To change what's shown, edit the <Fact> rows and the
// AI-summary/Timeline blocks further down in this component — to change the
// underlying TEXT those show, edit incident_dashboard_router.py instead
// (_compose_ai_summary, _build_timeline, _DETAIL_OVERRIDES).
// ---------------------------------------------------------------------------

const ANIMATION_MS = 200;

// One label+value pair in the modal's left column (e.g. "Root Cause" ->
// the actual root cause text). Set accent=true to show the value in red/bold
// (used for Customer/Client Impact to make it stand out).
function Fact({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p
        style={{
          fontFamily: fontBody,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: theme.onSurfaceVariant,
          margin: "0 0 4px",
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: fontBody,
          fontSize: 16,
          fontWeight: accent ? 700 : 400,
          color: accent ? theme.primary : theme.onBackground,
          margin: 0,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function IncidentDetailModal({
  apiBaseUrl,
  incidentNumber,
  onClose,
}: {
  apiBaseUrl: string;
  incidentNumber: string;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  function requestClose() {
    setVisible(false);
    window.setTimeout(onClose, ANIMATION_MS);
  }

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setError(null);

    getIncidentDetail(apiBaseUrl, incidentNumber)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError && err.status === 404
            ? `Incident ${incidentNumber} could not be found.`
            : "Could not load incident details."
        );
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBaseUrl, incidentNumber]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `${theme.inverseSurface}80`,
        opacity: visible ? 1 : 0,
        transition: `opacity ${ANIMATION_MS}ms ease-out`,
      }}
      onClick={requestClose}
      role="presentation"
    >
      <div
        style={{
          background: theme.surface,
          borderRadius: 8,
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
          border: `1px solid ${theme.outlineVariant}`,
          width: "80vw",
          height: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(0.95)",
          transition: `opacity ${ANIMATION_MS}ms ease-out, transform ${ANIMATION_MS}ms ease-out`,
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="incident-modal-title"
      >
        {/* Header */}
        <div
          style={{
            borderBottom: `1px solid ${theme.outlineVariant}`,
            padding: "24px 32px",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <h2
                id="incident-modal-title"
                style={{ fontFamily: fontHeadline, fontSize: 24, fontWeight: 700, color: theme.primary, margin: 0 }}
              >
                {incidentNumber}
              </h2>
              {detail && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "2px 10px",
                    borderRadius: 2,
                    fontFamily: fontBody,
                    fontSize: 12,
                    fontWeight: 700,
                    background: theme.errorContainer,
                    color: theme.onErrorContainer,
                  }}
                >
                  {detail.priority} — {detail.category}
                </span>
              )}
            </div>
            {detail && (
              <div style={{ display: "flex", alignItems: "center", gap: 16, color: theme.onSurfaceVariant }}>
                <StatusIndicator status={detail.status} />
                <span style={{ fontFamily: fontBody, fontSize: 14 }}>
                  Created {formatOpenedAt(detail.opened_at)} · {formatElapsed(detail.opened_at)} elapsed
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close incident details"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 8, margin: -8, color: theme.onSurfaceVariant }}
          >
            <IconClose size={24} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>
          {!detail && !error && (
            <p style={{ fontFamily: fontBody, fontSize: 14, color: theme.onSurfaceVariant }}>
              Loading incident details…
            </p>
          )}
          {error && <p style={{ fontFamily: fontBody, fontSize: 14, color: theme.error }}>{error}</p>}

          {detail && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 32 }}>
              {/* Key facts */}
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <Fact label="Root Cause" value={detail.description} />
                <Fact label="Impact to COO Services" value={detail.impact_to_coo_services} />
                <Fact label="Customer / Client Impact" value={detail.customer_client_impact} accent />
                <Fact label="Incident Commander" value={detail.incident_commander} />

                {detail.bridge_url && (
                  <a
                    href={detail.bridge_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      marginTop: 8,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      background: theme.primaryContainer,
                      color: theme.onPrimary,
                      padding: "10px 0",
                      borderRadius: 4,
                      fontFamily: fontBody,
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      textDecoration: "none",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                    }}
                  >
                    <IconCall size={18} />
                    Join Bridge
                  </a>
                )}
              </div>

              {/* AI summary + timeline */}
              <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                <div
                  style={{
                    background: "rgba(235,226,206,0.35)",
                    border: `1px solid ${theme.outlineVariant}`,
                    borderRadius: 4,
                    padding: 20,
                  }}
                >
                  <p
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontFamily: fontBody,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: theme.primary,
                      margin: "0 0 8px",
                    }}
                  >
                    <span aria-hidden="true">✨</span> AI-Generated Summary
                  </p>
                  <p style={{ fontFamily: fontBody, fontSize: 16, lineHeight: "26px", color: theme.onBackground, margin: 0 }}>
                    {detail.ai_summary}
                  </p>
                </div>

                <div>
                  <p
                    style={{
                      fontFamily: fontBody,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: theme.onSurfaceVariant,
                      margin: "0 0 16px",
                    }}
                  >
                    Timeline
                  </p>
                  <ol style={{ display: "flex", flexDirection: "column", gap: 20, listStyle: "none", margin: 0, padding: 0 }}>
                    {detail.updates.map((entry, index) => (
                      <li key={index} style={{ display: "flex", gap: 16 }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: theme.primary, flexShrink: 0 }} />
                          {index < detail.updates.length - 1 && (
                            <span style={{ width: 1, flex: 1, background: theme.outlineVariant, marginTop: 4 }} />
                          )}
                        </div>
                        <div style={{ paddingBottom: 4 }}>
                          <p style={{ fontFamily: fontBody, fontSize: 12, fontWeight: 600, color: theme.onSurfaceVariant, margin: 0 }}>
                            {formatTimelineTimestamp(entry.timestamp)} · {entry.author}
                          </p>
                          <p style={{ fontFamily: fontBody, fontSize: 14, color: theme.onBackground, margin: "4px 0 0" }}>
                            {entry.note}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Root component — this is what you actually render: <IncidentDashboard />
// ---------------------------------------------------------------------------

// Rows shown per page. Raise this if you want fewer page-turns / more rows
// visible at once (the backend's page_size default doesn't matter — this
// value is always sent explicitly).
const PAGE_SIZE = 6;

// The exact title text shown on each KPI tile and on the "Showing: ..."
// filter chip. Edit the strings on the right to change what's displayed —
// this is purely display text and doesn't need to match anything in the
// backend.
const TILE_LABELS: Record<Exclude<TileFilter, null>, string> = {
  P1_P2_WFT: "P1 & P2 — WFT-Wide",
  COO_CAUSED: "Major Incidents — COO Caused",
  COO_IMPACTED: "Major Incidents — COO Impacted",
  TCOO_CAUSED: "P3 & P4 — TCOO Caused",
};

export interface IncidentDashboardProps {
  /** Base URL prepended to every fetch, e.g. "" (default, same-origin) or "https://host:8000". */
  apiBaseUrl?: string;
}

export default function IncidentDashboard({ apiBaseUrl = "" }: IncidentDashboardProps) {
  // --- What the user has selected (all the ways the table can be filtered/sorted) ---
  const [tileFilter, setTileFilter] = useState<TileFilter>(null); // which KPI tile is clicked, if any
  const [priorityFilter, setPriorityFilter] = useState<Priority | "">(""); // Priority dropdown
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | "">(""); // Status dropdown
  const [searchInput, setSearchInput] = useState(""); // what's typed in the search box right now (every keystroke)
  const [debouncedSearch, setDebouncedSearch] = useState(""); // the search text AFTER the 300ms debounce below — this is what actually gets sent to the API
  const [sortBy, setSortBy] = useState<SortField | null>(null); // which column header was clicked
  const [sortDir, setSortDir] = useState<SortDir>("asc"); // asc/desc for that column
  const [page, setPage] = useState(1); // current page number
  const [selectedIncidentNumber, setSelectedIncidentNumber] = useState<string | null>(null); // which row's modal is open (null = modal closed)

  // --- Data fetched from the backend ---
  const [incidents, setIncidents] = useState<Incident[]>([]); // the current page of rows
  const [total, setTotal] = useState(0); // total matching rows, across all pages (for "Showing X-Y of Z")
  const [summary, setSummary] = useState<SummaryResponse | null>(null); // the 4 KPI tile numbers

  // --- Request status ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce the search box so we don't fire a request on every keystroke.
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  // Whenever any filter/search/sort changes, jump back to page 1 — otherwise
  // you could be stuck on "page 4" of a search that only has 1 page of results.
  useEffect(() => {
    setPage(1);
  }, [tileFilter, priorityFilter, statusFilter, debouncedSearch, sortBy, sortDir]);

  // The main data fetch. Re-runs any time something in the dependency array
  // at the bottom of this effect changes — that's what makes clicking a
  // tile/filter/header/page-button actually update the table.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      listIncidents(apiBaseUrl, {
        tile: tileFilter,
        priority: priorityFilter,
        status: statusFilter,
        q: debouncedSearch,
        sortBy,
        sortDir,
        page,
        pageSize: PAGE_SIZE,
      }),
      getSummary(apiBaseUrl),
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
            ? `Could not reach the incidents API (${err.status}). Is the backend router mounted?`
            : "Could not reach the incidents API. Is the backend router mounted?";
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, tileFilter, priorityFilter, statusFilter, debouncedSearch, sortBy, sortDir, page]);

  // Clicking a tile that's already selected clears the filter; clicking a
  // different tile switches to it.
  function toggleTile(next: Exclude<TileFilter, null>) {
    setTileFilter((current) => (current === next ? null : next));
  }

  // Clicking a column header: if it's already the active sort column, flip
  // asc<->desc. If it's a different column, switch to it and start at asc.
  function handleSort(field: SortField) {
    setSortBy((current) => {
      if (current === field) {
        setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
        return current;
      }
      setSortDir("asc");
      return field;
    });
  }

  const selectStyle: CSSProperties = {
    border: `1px solid ${theme.outlineVariant}`,
    background: theme.surface,
    borderRadius: 4,
    padding: "6px 12px",
    fontFamily: fontBody,
    fontSize: 14,
    color: theme.onSurface,
    outline: "none",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: fontBody }}>
      {/* This <style> tag only defines the "Bridge Active" status-dot pulse
          animation — the one thing inline styles can't express. */}
      <style>{"@keyframes ic-pulse{0%,100%{opacity:1}50%{opacity:.35}}"}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ fontFamily: fontHeadline, fontSize: 30, fontWeight: 700, color: theme.onBackground, margin: "0 0 4px" }}>
            COO Major Incident Dashboard
          </h2>
          <p style={{ fontFamily: fontBody, fontSize: 15, color: theme.onSurfaceVariant, margin: 0 }}>
            Real-time view for SOD ops calls — click a tile to filter, click a row for full detail.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: theme.onSurfaceVariant,
                display: "flex",
              }}
            >
              <IconSearch size={16} />
            </span>
            <input
              type="text"
              placeholder="Search incidents..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ ...selectStyle, width: 220, padding: "6px 12px 6px 32px" }}
              aria-label="Search incidents"
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontFamily: fontBody, fontSize: 11, fontWeight: 600, color: theme.onSurfaceVariant }} htmlFor="priority-filter">
              Priority
            </label>
            <select
              id="priority-filter"
              style={{ ...selectStyle, width: 128 }}
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as Priority | "")}
            >
              <option value="">All Priorities</option>
              <option value="P1">P1 - Critical</option>
              <option value="P2">P2 - High</option>
              <option value="P3">P3 - Medium</option>
              <option value="P4">P4 - Low</option>
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontFamily: fontBody, fontSize: 11, fontWeight: 600, color: theme.onSurfaceVariant }} htmlFor="status-filter">
              Status
            </label>
            <select
              id="status-filter"
              style={{ ...selectStyle, width: 160 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as IncidentStatus | "")}
            >
              <option value="">All Statuses</option>
              <option value="Bridge Active">Bridge Active</option>
              <option value="Pending Vendor">Pending Vendor</option>
              <option value="Investigating">Investigating</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
        <KpiTile
          label={TILE_LABELS.P1_P2_WFT}
          value={summary?.p1_p2_wft ?? "—"}
          restingAccent={theme.error}
          selected={tileFilter === "P1_P2_WFT"}
          onClick={() => toggleTile("P1_P2_WFT")}
        />
        <KpiTile
          label={TILE_LABELS.COO_CAUSED}
          value={summary?.coo_caused ?? "—"}
          selected={tileFilter === "COO_CAUSED"}
          onClick={() => toggleTile("COO_CAUSED")}
        />
        <KpiTile
          label={TILE_LABELS.COO_IMPACTED}
          value={summary?.coo_impacted ?? "—"}
          restingAccent={theme.secondary}
          selected={tileFilter === "COO_IMPACTED"}
          onClick={() => toggleTile("COO_IMPACTED")}
        />
        <KpiTile
          label={TILE_LABELS.TCOO_CAUSED}
          value={summary?.tcoo_caused ?? "—"}
          selected={tileFilter === "TCOO_CAUSED"}
          onClick={() => toggleTile("TCOO_CAUSED")}
        />
      </div>

      {tileFilter && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: fontBody, fontSize: 14, color: theme.onSurfaceVariant }}>
          Showing:
          <button
            type="button"
            onClick={() => setTileFilter(null)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: theme.primary,
              color: theme.onPrimary,
              border: "none",
              padding: "6px 14px",
              borderRadius: 999,
              fontFamily: fontBody,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {TILE_LABELS[tileFilter]}
            <IconClose size={12} />
          </button>
        </div>
      )}

      <IncidentsTable
        incidents={incidents}
        loading={loading}
        error={error}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={handleSort}
        onPageChange={setPage}
        onRowOpen={setSelectedIncidentNumber}
      />

      {selectedIncidentNumber && (
        <IncidentDetailModal
          apiBaseUrl={apiBaseUrl}
          incidentNumber={selectedIncidentNumber}
          onClose={() => setSelectedIncidentNumber(null)}
        />
      )}
    </div>
  );
}
