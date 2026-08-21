/**
 * COO Major Incident Dashboard — v3, built against HUGO_Incidents (via the
 * companion hugo_incidents_blueprint.py Flask Blueprint — NOT the older
 * wft_incidents_blueprint.py or incident_dashboard_router.py; ignore both
 * of those, they're superseded).
 *
 * This is CONTENT ONLY — no sidebar, no top nav. Drop it into your existing
 * shell and render:
 *
 *   <IncidentDashboard />
 *   <IncidentDashboard apiBaseUrl="/api" />                 // explicit base path
 *   <IncidentDashboard apiBaseUrl="https://host:8000" />    // different host
 *
 * WHAT'S NEW IN v3 (vs the version with the centered popup modal):
 *   - 5 KPI tiles instead of 4: a new red "Total Incidents" tile (with a
 *     Resolved/Open breakdown line) is now first, followed by the original
 *     4 (P1 & P2, COO Caused, COO Impacted, P3 & P4).
 *   - New table columns: Incident #, Priority, Status, Impacted Business
 *     Group, Impacted Application, and two checkmark columns (Causal CIO /
 *     Impacted CIO) showing whether TECHCT caused/was impacted.
 *   - New filter row: search, Open Date range, Priority, Status, and 3
 *     toggle filters (Major Incident, TCOO-Caused, TCOO-Impacted) — plus a
 *     collapsible "Advanced Filters" panel with 9 more fields, populated
 *     from a live /api/incidents/filter-options call (no hardcoded lists).
 *   - Clicking a row no longer opens a centered popup — it opens a SIDE
 *     PANEL. The main content shrinks to the left, the panel slides in on
 *     the right, and the divider between them is draggable (see
 *     SplitPane below) to resize either side.
 *   - The detail panel shows real fields (Overview, Cause, Business Impact,
 *     Close Notes, Work Notes) plus the AI-Generated Summary box back at the
 *     top, sparkle icon and all — it's still there, just condensed from real
 *     HUGO_Incidents fields now instead of the old mock version's invented
 *     text (the wording is composed server-side, see hugo_incidents_
 *     blueprint.py's _compose_ai_summary()).
 *
 * QUICK EDIT GUIDE — "I want to change X, where do I look?"
 * ------------------------------------------------------------------
 *   Change a color (red, gold, etc.)          -> the `theme` object below
 *   Change fonts                              -> `fontHeadline` / `fontBody` below
 *   Change a tile's title text                -> `TILE_LABELS` (near the bottom)
 *   Change what a tile counts                 -> hugo_incidents_blueprint.py's
 *                                                  get_summary() / list_incidents()
 *   Change a Priority badge's color           -> `PRIORITY_STYLES`
 *   Change a Status dot's color               -> `STATUS_DOT_COLOR`
 *   Change the AI-Generated Summary wording    -> hugo_incidents_blueprint.py's
 *                                                  _compose_ai_summary()
 *   Change the AI-Generated Summary's look     -> `AiSummaryCard` / `IconSparkle`
 *   Add/remove a table column                 -> touch 3 places: the
 *                                                  <SortableHeader> in
 *                                                  IncidentsTable's <thead>,
 *                                                  the matching <td> in
 *                                                  IncidentRow, and (if
 *                                                  sortable) _SORTABLE_FIELDS
 *                                                  in the backend
 *   Add/remove an Advanced Filter field        -> `ADVANCED_FILTER_FIELDS`
 *                                                  below AND the matching dict
 *                                                  in hugo_incidents_blueprint.py
 *   Change the default split-panel width       -> `DEFAULT_DETAIL_WIDTH_PCT`
 *   Change how wide the panel can be dragged    -> `MIN_DETAIL_WIDTH_PCT` /
 *                                                  `MAX_DETAIL_WIDTH_PCT`
 *   Change what's shown in the detail panel    -> `IncidentDetailPanel`
 *   Change how many rows show per page         -> `PAGE_SIZE` constant
 *   This file only fetches/displays data — to change WHAT data shows up
 *   edit hugo_incidents_blueprint.py instead.
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// Theme — Institutional Heritage palette. Every color used anywhere in this
// file comes from this one object.
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
  success: "#2e7d32",
} as const;

const fontHeadline = '"Source Serif 4", Georgia, "Times New Roman", serif';
const fontBody = '"Work Sans", "Segoe UI", Arial, sans-serif';

// ---------------------------------------------------------------------------
// Types — mirror the JSON shapes hugo_incidents_blueprint.py's Flask routes
// return. IMPORTANT: keep these in sync with that file — field names and
// enum string values (Priority/Status) are compared as plain text between
// frontend and backend, so a mismatch just silently shows nothing instead of
// throwing an error you'd notice.
// ---------------------------------------------------------------------------

export type Priority = "P1" | "P2" | "P3" | "P4" | "P5";
export type IncidentStatus = "New" | "In Progress" | "Resolved" | "Closed";
export type TileFilter = "P1_P2" | "COO_CAUSED" | "COO_IMPACTED" | "P3_P4_TECHCT" | null;
export type SortField =
  | "incident_number"
  | "priority"
  | "status"
  | "impacted_business_group"
  | "impacted_application"
  | "causal_cio_check"
  | "impacted_cio_check";
export type SortDir = "asc" | "desc";

// The row shape returned by GET /api/incidents (list_incidents()'s "items").
export interface IncidentRowData {
  incident_number: string;
  priority: Priority;
  status: IncidentStatus;
  impacted_business_group: string | null;
  impacted_application: string | null;
  causal_cio_check: boolean;
  impacted_cio_check: boolean;
}

export interface IncidentListResponse {
  items: IncidentRowData[];
  total: number;
  page: number;
  page_size: number;
}

export interface SummaryResponse {
  total: number;
  total_resolved: number;
  total_open: number;
  p1_p2: number;
  coo_caused: number;
  coo_impacted: number;
  p3_p4_techct: number;
}

// The full shape returned by GET /api/incidents/{incident_number} — every
// real HUGO_Incidents field the detail panel can show. Nothing here is
// fabricated (no AI summary, no invented commander).
export interface IncidentDetail {
  incident_number: string;
  priority: Priority;
  status: IncidentStatus;
  major_incident: boolean;
  opened_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  causal_cio_org: string | null;
  causal_cio_direct_org: string | null;
  impacted_cio_org: string | null;
  impacted_cio_direct_org: string | null;
  causal_business_group: string | null;
  impacted_business_group: string | null;
  causal_application: string | null;
  causal_app_id: string | null;
  impacted_application: string | null;
  impacted_app_id: string | null;
  causal_platform_leader: string | null;
  impacted_platform_leader: string | null;
  assignment_group: string | null;
  short_description: string | null;
  description: string | null;
  cause: string | null;
  overview: string | null;
  business_impact: string | null;
  close_notes: string | null;
  work_notes: string | null;
  // A short paragraph composed server-side from the real fields above (Cause,
  // Business Impact, Platform Leader, Status) — not fabricated detail. Shown
  // in the "AI-Generated Summary" box at the top of the detail panel.
  ai_summary: string | null;
}

// The 9 Advanced Filter fields, in the exact order requested. Each key here
// must match a key in hugo_incidents_blueprint.py's ADVANCED_FILTER_FIELDS
// dict — that's both the query param name AND the key in the
// /api/incidents/filter-options response.
const ADVANCED_FILTER_FIELDS: { key: string; label: string }[] = [
  { key: "impacted_cio_org", label: "Impacted CIO Org" },
  { key: "impacted_cio_direct_org", label: "Impacted CIO Direct Org" },
  { key: "causal_cio_direct_org", label: "Causal CIO Direct Org" },
  { key: "causal_business_group", label: "Causal Business Group" },
  { key: "impacted_business_group", label: "Impacted Business Group" },
  { key: "causal_app_id", label: "Causal App Id" },
  { key: "impacted_app_id", label: "Impacted App Id" },
  { key: "causal_platform_leader", label: "Causal Platform Leader" },
  { key: "impacted_platform_leader", label: "Impacted Platform Leader" },
];

export type FilterOptions = Record<string, string[]>;

// ---------------------------------------------------------------------------
// API client — everything below talks to hugo_incidents_blueprint.py.
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

export interface ListIncidentsParams {
  tile?: TileFilter;
  priority?: Priority | "";
  status?: IncidentStatus | "";
  majorIncident?: "" | "true" | "false";
  tcooCaused?: "" | "true" | "false";
  tcooImpacted?: "" | "true" | "false";
  openDateFrom?: string;
  openDateTo?: string;
  q?: string;
  sortBy?: SortField | null;
  sortDir?: SortDir;
  advanced?: Record<string, string>;
  page: number;
  pageSize: number;
}

function listIncidents(apiBaseUrl: string, params: ListIncidentsParams): Promise<IncidentListResponse> {
  return apiGet<IncidentListResponse>(apiBaseUrl, "/api/incidents", {
    tile: params.tile ?? undefined,
    priority: params.priority || undefined,
    status: params.status || undefined,
    major_incident: params.majorIncident || undefined,
    tcoo_caused: params.tcooCaused || undefined,
    tcoo_impacted: params.tcooImpacted || undefined,
    open_date_from: params.openDateFrom || undefined,
    open_date_to: params.openDateTo || undefined,
    q: params.q || undefined,
    sort_by: params.sortBy ?? undefined,
    sort_dir: params.sortBy ? params.sortDir : undefined,
    page: params.page.toString(),
    page_size: params.pageSize.toString(),
    ...(params.advanced || {}),
  });
}

function getSummary(apiBaseUrl: string): Promise<SummaryResponse> {
  return apiGet<SummaryResponse>(apiBaseUrl, "/api/incidents/summary");
}

function getFilterOptions(apiBaseUrl: string): Promise<FilterOptions> {
  return apiGet<FilterOptions>(apiBaseUrl, "/api/incidents/filter-options");
}

function getIncidentDetail(apiBaseUrl: string, incidentNumber: string): Promise<IncidentDetail> {
  return apiGet<IncidentDetail>(apiBaseUrl, `/api/incidents/${encodeURIComponent(incidentNumber)}`);
}

// ---------------------------------------------------------------------------
// Format utils
// ---------------------------------------------------------------------------

function formatDateTime(isoString: string | null): string {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ---------------------------------------------------------------------------
// Inline SVG icons — purely decorative, safe to swap for an icon library.
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

const IconChevronDown = (p: { size?: number }) => (
  <IconBase size={p.size}>
    <path d="m6 9 6 6 6-6" />
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

const IconCheck = (p: { size?: number }) => (
  <IconBase size={p.size}>
    <path d="M20 6 9 17l-5-5" />
  </IconBase>
);

// The little 4-point "sparkle" used next to the AI-Generated Summary label.
// Filled (not stroked, unlike the other icons above) so it reads as a solid
// star/glint rather than an outline. Two extra tiny sparkles are added around
// it in AiSummaryCard for the twinkle effect.
const IconSparkle = (p: { size?: number; className?: string; style?: CSSProperties }) => (
  <svg
    width={p.size ?? 16}
    height={p.size ?? 16}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={p.className}
    style={p.style}
  >
    <path d="M12 2c.6 3.8 1.9 6.1 4 8.2 2.1 2 4.4 3.2 8 3.8-3.8.6-6.1 1.9-8.2 4-2 2.1-3.2 4.4-3.8 8-.6-3.8-1.9-6.1-4-8.2-2.1-2-4.4-3.2-8-3.8 3.8-.6 6.1-1.9 8.2-4 2-2.1 3.2-4.4 3.8-8z" />
  </svg>
);

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

// The colored pill shown next to each Priority (P1-P5). To add another
// priority, add a matching entry here AND to the Priority type above AND to
// PRIORITY_MAP in hugo_incidents_blueprint.py.
const PRIORITY_STYLES: Record<Priority, { bg: string; fg: string }> = {
  P1: { bg: theme.errorContainer, fg: theme.onErrorContainer },
  P2: { bg: theme.secondaryContainer, fg: theme.onSecondaryContainer },
  P3: { bg: theme.surfaceVariant, fg: theme.onSurfaceVariant },
  P4: { bg: theme.surfaceVariant, fg: theme.onSurfaceVariant },
  P5: { bg: theme.surfaceVariant, fg: theme.onSurfaceVariant },
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

// The color of the small status dot. These 4 values (New / In Progress /
// Resolved / Closed) are your real HUGO_Incidents statuses — see STATUS_MAP
// in hugo_incidents_blueprint.py.
const STATUS_DOT_COLOR: Record<IncidentStatus, string> = {
  New: theme.error,
  "In Progress": theme.secondary,
  Resolved: theme.outline,
  Closed: theme.outline,
};

const LIVE_STATUS: IncidentStatus = "In Progress";

function StatusIndicator({ status }: { status: IncidentStatus }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        color: status === LIVE_STATUS ? theme.onBackground : theme.onSurfaceVariant,
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
          animation: status === LIVE_STATUS ? "ic-pulse 1.6s ease-in-out infinite" : undefined,
        }}
      />
      {status}
    </div>
  );
}

// The small checkmark used for the "Causal CIO" / "Impacted CIO" table
// columns — true means TECHCT was the causal/impacted org for this incident.
function TechctCheck({ value }: { value: boolean }) {
  if (!value) {
    return <span style={{ color: theme.outline, fontFamily: fontBody, fontSize: 14 }}>—</span>;
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 20,
        height: 20,
        borderRadius: "50%",
        background: theme.errorContainer,
        color: theme.onErrorContainer,
      }}
      aria-label="Yes"
    >
      <IconCheck size={12} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// KPI tiles
// ---------------------------------------------------------------------------

function KpiTile({
  label,
  value,
  subtext,
  restingAccent,
  emphasized,
  selected,
  onClick,
}: {
  label: string;
  value: number | string;
  subtext?: string;
  restingAccent?: string;
  emphasized?: boolean;
  selected: boolean;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const clickable = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        textAlign: "left",
        background: emphasized ? theme.primary : selected ? "rgba(175,0,23,0.06)" : theme.surface,
        border: selected ? `2px solid ${theme.primary}` : `1px solid ${theme.outlineVariant}`,
        borderTop: !selected && !emphasized && restingAccent ? `4px solid ${restingAccent}` : undefined,
        borderRadius: 4,
        padding: 20,
        cursor: clickable ? "pointer" : "default",
        boxShadow: hovered && clickable ? "0 2px 6px rgba(0,0,0,0.08)" : "0 1px 2px rgba(0,0,0,0.04)",
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
          color: emphasized ? theme.onPrimaryContainer : selected ? theme.primary : theme.onSurfaceVariant,
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
          color: emphasized ? theme.onPrimary : selected ? theme.primary : theme.onBackground,
          margin: 0,
        }}
      >
        {value}
      </p>
      {subtext && (
        <p
          style={{
            fontFamily: fontBody,
            fontSize: 13,
            fontWeight: 600,
            color: emphasized ? theme.onPrimaryContainer : theme.onSurfaceVariant,
            margin: "6px 0 0",
          }}
        >
          {subtext}
        </p>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Filter row
// ---------------------------------------------------------------------------

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

const labelStyle: CSSProperties = {
  fontFamily: fontBody,
  fontSize: 11,
  fontWeight: 600,
  color: theme.onSurfaceVariant,
};

function FilterField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={labelStyle} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
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

function IncidentRow({
  incident,
  isEven,
  isSelected,
  onOpen,
}: {
  incident: IncidentRowData;
  isEven: boolean;
  isSelected: boolean;
  onOpen: (incidentNumber: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <tr
      style={{
        background: isSelected
          ? "rgba(175,0,23,0.06)"
          : hovered || isEven
          ? theme.surfaceContainerLow
          : theme.surface,
        cursor: "pointer",
      }}
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
      <td style={td}>
        <StatusIndicator status={incident.status} />
      </td>
      <td style={{ ...td, color: theme.onSurfaceVariant }}>{incident.impacted_business_group || "—"}</td>
      <td style={{ ...td, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {incident.impacted_application || "—"}
      </td>
      <td style={{ ...td, textAlign: "center" }}>
        <TechctCheck value={incident.causal_cio_check} />
      </td>
      <td style={{ ...td, textAlign: "center" }}>
        <TechctCheck value={incident.impacted_cio_check} />
      </td>
    </tr>
  );
}

function SortableHeader({
  label,
  field,
  width,
  align,
  sortBy,
  sortDir,
  onSort,
}: {
  label: string;
  field: SortField;
  width?: number;
  align?: "left" | "center";
  sortBy: SortField | null;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}) {
  const active = sortBy === field;
  return (
    <th style={{ ...th, width, textAlign: align || "left" }}>
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

function IncidentsTable({
  incidents,
  loading,
  error,
  total,
  page,
  pageSize,
  sortBy,
  sortDir,
  selectedIncidentNumber,
  onSort,
  onPageChange,
  onRowOpen,
}: {
  incidents: IncidentRowData[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  pageSize: number;
  sortBy: SortField | null;
  sortDir: SortDir;
  selectedIncidentNumber: string | null;
  onSort: (field: SortField) => void;
  onPageChange: (page: number) => void;
  onRowOpen: (incidentNumber: string) => void;
}) {
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const COLS = 7;

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
              <SortableHeader label="Incident #" field="incident_number" width={120} sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <SortableHeader label="Priority" field="priority" width={90} sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <SortableHeader label="Status" field="status" width={140} sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <SortableHeader label="Impacted Business Group" field="impacted_business_group" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <SortableHeader label="Impacted Application" field="impacted_application" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <SortableHeader label="Causal CIO" field="causal_cio_check" width={90} align="center" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <SortableHeader label="Impacted CIO" field="impacted_cio_check" width={100} align="center" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={COLS} style={{ ...td, textAlign: "center", padding: "32px 16px", color: theme.onSurfaceVariant }}>
                  Loading incidents…
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={COLS} style={{ ...td, textAlign: "center", padding: "32px 16px", color: theme.error }}>
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && incidents.length === 0 && (
              <tr>
                <td colSpan={COLS} style={{ ...td, textAlign: "center", padding: "32px 16px", color: theme.onSurfaceVariant }}>
                  No incidents match the current filters.
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              incidents.map((incident, index) => (
                <IncidentRow
                  key={incident.incident_number}
                  incident={incident}
                  isEven={index % 2 === 1}
                  isSelected={incident.incident_number === selectedIncidentNumber}
                  onOpen={onRowOpen}
                />
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
// Detail panel (side panel — replaces the old centered popup modal)
// ---------------------------------------------------------------------------

function Fact({ label, value }: { label: string; value: string | null }) {
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
      <p style={{ fontFamily: fontBody, fontSize: 14, color: theme.onBackground, margin: 0 }}>{value || "—"}</p>
    </div>
  );
}

// The "AI-Generated Summary" box — a gold-tinted card with a twinkling
// sparkle icon next to the label, shown first in the detail panel. The text
// itself is composed server-side by hugo_incidents_blueprint.py's
// _compose_ai_summary() from real Cause/Business Impact/Status fields, so
// this component just needs to render whatever string it's given; it returns
// null (renders nothing) if the backend didn't send one.
function AiSummaryCard({ value }: { value: string | null }) {
  if (!value) return null;
  return (
    <div
      style={{
        position: "relative",
        background: `linear-gradient(135deg, ${theme.tertiaryContainer} 0%, ${theme.surfaceContainerLow} 75%)`,
        border: `1px solid ${theme.secondaryContainer}`,
        borderRadius: 4,
        padding: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ position: "relative", display: "inline-flex", color: theme.secondary }}>
          <IconSparkle size={16} style={{ animation: "ic-twinkle 2.4s ease-in-out infinite" }} />
          <IconSparkle
            size={8}
            style={{
              position: "absolute",
              top: -5,
              right: -7,
              animation: "ic-twinkle 2.4s ease-in-out infinite",
              animationDelay: "0.5s",
            }}
          />
        </span>
        <p
          style={{
            fontFamily: fontBody,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: theme.secondary,
            margin: 0,
          }}
        >
          AI-Generated Summary
        </p>
      </div>
      <p style={{ fontFamily: fontBody, fontSize: 14, lineHeight: "22px", color: theme.onBackground, margin: 0 }}>
        {value}
      </p>
    </div>
  );
}

function NotesSection({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div
      style={{
        background: theme.surfaceContainerLow,
        border: `1px solid ${theme.outlineVariant}`,
        borderRadius: 4,
        padding: 16,
      }}
    >
      <p
        style={{
          fontFamily: fontBody,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: theme.onSurfaceVariant,
          margin: "0 0 8px",
        }}
      >
        {label}
      </p>
      <p style={{ fontFamily: fontBody, fontSize: 14, lineHeight: "22px", color: theme.onBackground, margin: 0, whiteSpace: "pre-wrap" }}>
        {value}
      </p>
    </div>
  );
}

function IncidentDetailPanel({
  apiBaseUrl,
  incidentNumber,
  onClose,
}: {
  apiBaseUrl: string;
  incidentNumber: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  }, [apiBaseUrl, incidentNumber]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: theme.surface }}>
      {/* Header */}
      <div
        style={{
          borderBottom: `1px solid ${theme.outlineVariant}`,
          padding: "20px 24px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
            <h2 style={{ fontFamily: fontHeadline, fontSize: 22, fontWeight: 700, color: theme.primary, margin: 0 }}>
              {incidentNumber}
            </h2>
            {detail && <PriorityBadge priority={detail.priority} />}
            {detail?.major_incident && (
              <span
                style={{
                  fontFamily: fontBody,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  background: theme.primary,
                  color: theme.onPrimary,
                  padding: "2px 8px",
                  borderRadius: 999,
                }}
              >
                Major Incident
              </span>
            )}
          </div>
          {detail && (
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", color: theme.onSurfaceVariant }}>
              <StatusIndicator status={detail.status} />
              <span style={{ fontFamily: fontBody, fontSize: 13 }}>Opened {formatDateTime(detail.opened_at)}</span>
              {detail.resolved_at && (
                <span style={{ fontFamily: fontBody, fontSize: 13 }}>Resolved {formatDateTime(detail.resolved_at)}</span>
              )}
              {detail.closed_at && (
                <span style={{ fontFamily: fontBody, fontSize: 13 }}>Closed {formatDateTime(detail.closed_at)}</span>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close incident details"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 8, margin: -8, color: theme.onSurfaceVariant, flexShrink: 0 }}
        >
          <IconClose size={22} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        {!detail && !error && (
          <p style={{ fontFamily: fontBody, fontSize: 14, color: theme.onSurfaceVariant }}>Loading incident details…</p>
        )}
        {error && <p style={{ fontFamily: fontBody, fontSize: 14, color: theme.error }}>{error}</p>}

        {detail && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <AiSummaryCard value={detail.ai_summary} />
            <NotesSection label="Overview" value={detail.overview} />
            <NotesSection label="Cause" value={detail.cause} />
            <NotesSection label="Business Impact" value={detail.business_impact} />
            <NotesSection label="Work Notes" value={detail.work_notes} />
            <NotesSection label="Close Notes" value={detail.close_notes} />

            <div>
              <p
                style={{
                  fontFamily: fontBody,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: theme.onSurfaceVariant,
                  margin: "0 0 12px",
                }}
              >
                Details
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Fact label="Causal Application" value={detail.causal_application} />
                <Fact label="Impacted Application" value={detail.impacted_application} />
                <Fact label="Causal CIO Org" value={detail.causal_cio_org} />
                <Fact label="Impacted CIO Org" value={detail.impacted_cio_org} />
                <Fact label="Causal Business Group" value={detail.causal_business_group} />
                <Fact label="Impacted Business Group" value={detail.impacted_business_group} />
                <Fact label="Causal Platform Leader" value={detail.causal_platform_leader} />
                <Fact label="Impacted Platform Leader" value={detail.impacted_platform_leader} />
                <Fact label="Assignment Group" value={detail.assignment_group} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SplitPane — the draggable divider between the main content and the detail
// panel. This is the piece that replaces the old centered popup modal.
// ---------------------------------------------------------------------------

const DEFAULT_DETAIL_WIDTH_PCT = 38;
const MIN_DETAIL_WIDTH_PCT = 24;
const MAX_DETAIL_WIDTH_PCT = 65;

function SplitPane({ main, detail }: { main: ReactNode; detail: ReactNode | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [detailWidthPct, setDetailWidthPct] = useState(DEFAULT_DETAIL_WIDTH_PCT);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isDragging) return;

    function handleMove(e: PointerEvent) {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const pctFromRight = ((rect.right - e.clientX) / rect.width) * 100;
      const clamped = Math.min(Math.max(pctFromRight, MIN_DETAIL_WIDTH_PCT), MAX_DETAIL_WIDTH_PCT);
      setDetailWidthPct(clamped);
    }
    function handleUp() {
      setIsDragging(false);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [isDragging]);

  const detailOpen = detail !== null;

  return (
    <div ref={containerRef} style={{ display: "flex", width: "100%", alignItems: "stretch", position: "relative" }}>
      <div
        style={{
          width: detailOpen ? `${100 - detailWidthPct}%` : "100%",
          transition: isDragging ? "none" : "width 220ms ease",
          minWidth: 0,
        }}
      >
        {main}
      </div>

      {detailOpen && (
        <>
          {/* The draggable divider. Drag left/right to resize both panes. */}
          <div
            onPointerDown={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize incident detail panel"
            style={{
              width: 8,
              flexShrink: 0,
              cursor: "col-resize",
              background: isDragging ? theme.primary : "transparent",
              position: "relative",
              transition: isDragging ? "none" : "background 120ms ease",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: "50%",
                transform: "translateX(-50%)",
                width: 1,
                background: theme.outlineVariant,
              }}
            />
          </div>

          <div
            style={{
              width: `${detailWidthPct}%`,
              transition: isDragging ? "none" : "width 220ms ease",
              minWidth: 0,
              border: `1px solid ${theme.outlineVariant}`,
              borderRadius: 4,
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              overflow: "hidden",
            }}
          >
            {detail}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root component — this is what you actually render: <IncidentDashboard />
// ---------------------------------------------------------------------------

const PAGE_SIZE = 6;

const TILE_LABELS: Record<Exclude<TileFilter, null>, string> = {
  P1_P2: "P1 & P2 — WFT-Wide",
  COO_CAUSED: "Major Incidents — COO Caused",
  COO_IMPACTED: "Major Incidents — COO Impacted",
  P3_P4_TECHCT: "P3 & P4 — TCOO Caused",
};

export interface IncidentDashboardProps {
  /** Base URL prepended to every fetch, e.g. "" (default, same-origin) or "https://host:8000". */
  apiBaseUrl?: string;
}

export default function IncidentDashboard({ apiBaseUrl = "" }: IncidentDashboardProps) {
  // --- Filters ---
  const [tileFilter, setTileFilter] = useState<TileFilter>(null);
  const [priorityFilter, setPriorityFilter] = useState<Priority | "">("");
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | "">("");
  const [majorIncidentFilter, setMajorIncidentFilter] = useState<"" | "true" | "false">("");
  const [tcooCausedFilter, setTcooCausedFilter] = useState<"" | "true" | "false">("");
  const [tcooImpactedFilter, setTcooImpactedFilter] = useState<"" | "true" | "false">("");
  const [openDateFrom, setOpenDateFrom] = useState("");
  const [openDateTo, setOpenDateTo] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedValues, setAdvancedValues] = useState<Record<string, string>>({});
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({});

  // --- Sort / paging / selection ---
  const [sortBy, setSortBy] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [selectedIncidentNumber, setSelectedIncidentNumber] = useState<string | null>(null);

  // --- Data from the backend ---
  const [incidents, setIncidents] = useState<IncidentRowData[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce the search box.
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  // Load the Advanced Filter dropdown options once on mount.
  useEffect(() => {
    getFilterOptions(apiBaseUrl)
      .then(setFilterOptions)
      .catch(() => {
        /* non-fatal — advanced filter dropdowns just show no options */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBaseUrl]);

  // Any filter/search/sort change resets to page 1.
  useEffect(() => {
    setPage(1);
  }, [
    tileFilter,
    priorityFilter,
    statusFilter,
    majorIncidentFilter,
    tcooCausedFilter,
    tcooImpactedFilter,
    openDateFrom,
    openDateTo,
    debouncedSearch,
    advancedValues,
    sortBy,
    sortDir,
  ]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      listIncidents(apiBaseUrl, {
        tile: tileFilter,
        priority: priorityFilter,
        status: statusFilter,
        majorIncident: majorIncidentFilter,
        tcooCaused: tcooCausedFilter,
        tcooImpacted: tcooImpactedFilter,
        openDateFrom,
        openDateTo,
        q: debouncedSearch,
        sortBy,
        sortDir,
        advanced: advancedValues,
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
            ? `Could not reach the incidents API (${err.status}). Is the backend blueprint registered?`
            : "Could not reach the incidents API. Is the backend blueprint registered?";
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    apiBaseUrl,
    tileFilter,
    priorityFilter,
    statusFilter,
    majorIncidentFilter,
    tcooCausedFilter,
    tcooImpactedFilter,
    openDateFrom,
    openDateTo,
    debouncedSearch,
    advancedValues,
    sortBy,
    sortDir,
    page,
  ]);

  function toggleTile(next: Exclude<TileFilter, null>) {
    setTileFilter((current) => (current === next ? null : next));
  }

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

  function setAdvancedValue(key: string, value: string) {
    setAdvancedValues((current) => {
      const next = { ...current };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  }

  const advancedActiveCount = Object.keys(advancedValues).length;

  const mainContent = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: fontBody, paddingRight: selectedIncidentNumber ? 16 : 0 }}>
      {/* This <style> tag defines two keyframe animations used elsewhere in this
          file: "ic-pulse" for the "In Progress" status dot, and "ic-twinkle"
          for the sparkle icon on the AI-Generated Summary box (AiSummaryCard). */}
      <style>
        {
          "@keyframes ic-pulse{0%,100%{opacity:1}50%{opacity:.35}}" +
          "@keyframes ic-twinkle{0%,100%{opacity:.5;transform:scale(0.85)}50%{opacity:1;transform:scale(1.15)}}"
        }
      </style>

      <div>
        <h2 style={{ fontFamily: fontHeadline, fontSize: 30, fontWeight: 700, color: theme.onBackground, margin: "0 0 4px" }}>
          COO Major Incident Dashboard
        </h2>
        <p style={{ fontFamily: fontBody, fontSize: 15, color: theme.onSurfaceVariant, margin: 0 }}>
          Real-time view for SOD ops calls — click a tile to filter, click a row for full detail.
        </p>
      </div>

      {/* KPI tiles — Total first (red, emphasized), then the original 4. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 24 }}>
        <KpiTile
          label="Total Incidents"
          value={summary?.total ?? "—"}
          subtext={summary ? `Resolved ${summary.total_resolved} · Open ${summary.total_open}` : undefined}
          emphasized
          selected={false}
        />
        <KpiTile
          label={TILE_LABELS.P1_P2}
          value={summary?.p1_p2 ?? "—"}
          restingAccent={theme.error}
          selected={tileFilter === "P1_P2"}
          onClick={() => toggleTile("P1_P2")}
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
          label={TILE_LABELS.P3_P4_TECHCT}
          value={summary?.p3_p4_techct ?? "—"}
          selected={tileFilter === "P3_P4_TECHCT"}
          onClick={() => toggleTile("P3_P4_TECHCT")}
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

      {/* Basic filter row */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: theme.onSurfaceVariant, display: "flex" }}>
            <IconSearch size={16} />
          </span>
          <input
            type="text"
            placeholder="Search incidents..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ ...selectStyle, width: 200, padding: "6px 12px 6px 32px" }}
            aria-label="Search incidents"
          />
        </div>

        <FilterField label="Open Date From" htmlFor="open-date-from">
          <input
            id="open-date-from"
            type="date"
            value={openDateFrom}
            onChange={(e) => setOpenDateFrom(e.target.value)}
            style={{ ...selectStyle, width: 150 }}
          />
        </FilterField>
        <FilterField label="Open Date To" htmlFor="open-date-to">
          <input
            id="open-date-to"
            type="date"
            value={openDateTo}
            onChange={(e) => setOpenDateTo(e.target.value)}
            style={{ ...selectStyle, width: 150 }}
          />
        </FilterField>

        <FilterField label="Priority" htmlFor="priority-filter">
          <select
            id="priority-filter"
            style={{ ...selectStyle, width: 120 }}
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as Priority | "")}
          >
            <option value="">All Priorities</option>
            <option value="P1">P1</option>
            <option value="P2">P2</option>
            <option value="P3">P3</option>
            <option value="P4">P4</option>
            <option value="P5">P5</option>
          </select>
        </FilterField>

        <FilterField label="Status" htmlFor="status-filter">
          <select
            id="status-filter"
            style={{ ...selectStyle, width: 150 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as IncidentStatus | "")}
          >
            <option value="">All Statuses</option>
            <option value="New">New</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
          </select>
        </FilterField>

        <FilterField label="Major Incident" htmlFor="major-incident-filter">
          <select
            id="major-incident-filter"
            style={{ ...selectStyle, width: 100 }}
            value={majorIncidentFilter}
            onChange={(e) => setMajorIncidentFilter(e.target.value as "" | "true" | "false")}
          >
            <option value="">All</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </FilterField>

        <FilterField label="TCOO-Caused" htmlFor="tcoo-caused-filter">
          <select
            id="tcoo-caused-filter"
            style={{ ...selectStyle, width: 100 }}
            value={tcooCausedFilter}
            onChange={(e) => setTcooCausedFilter(e.target.value as "" | "true" | "false")}
          >
            <option value="">All</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </FilterField>

        <FilterField label="TCOO-Impacted" htmlFor="tcoo-impacted-filter">
          <select
            id="tcoo-impacted-filter"
            style={{ ...selectStyle, width: 100 }}
            value={tcooImpactedFilter}
            onChange={(e) => setTcooImpactedFilter(e.target.value as "" | "true" | "false")}
          >
            <option value="">All</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </FilterField>

        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: advancedOpen ? theme.tertiaryContainer : theme.surface,
            border: `1px solid ${theme.outlineVariant}`,
            borderRadius: 4,
            padding: "7px 14px",
            fontFamily: fontBody,
            fontSize: 13,
            fontWeight: 600,
            color: theme.onSurface,
            cursor: "pointer",
          }}
        >
          Advanced Filters{advancedActiveCount > 0 ? ` (${advancedActiveCount})` : ""}
          <span style={{ display: "flex", transform: advancedOpen ? "rotate(180deg)" : undefined, transition: "transform 120ms ease" }}>
            <IconChevronDown size={14} />
          </span>
        </button>
      </div>

      {/* Advanced filter panel */}
      {advancedOpen && (
        <div
          style={{
            background: theme.surfaceContainerLow,
            border: `1px solid ${theme.outlineVariant}`,
            borderRadius: 4,
            padding: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          {ADVANCED_FILTER_FIELDS.map(({ key, label }) => (
            <FilterField key={key} label={label} htmlFor={`adv-${key}`}>
              <select
                id={`adv-${key}`}
                style={{ ...selectStyle, width: "100%" }}
                value={advancedValues[key] || ""}
                onChange={(e) => setAdvancedValue(key, e.target.value)}
              >
                <option value="">All</option>
                {(filterOptions[key] || []).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </FilterField>
          ))}
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
        selectedIncidentNumber={selectedIncidentNumber}
        onSort={handleSort}
        onPageChange={setPage}
        onRowOpen={setSelectedIncidentNumber}
      />
    </div>
  );

  const detailContent = selectedIncidentNumber ? (
    <IncidentDetailPanel apiBaseUrl={apiBaseUrl} incidentNumber={selectedIncidentNumber} onClose={() => setSelectedIncidentNumber(null)} />
  ) : null;

  return <SplitPane main={mainContent} detail={detailContent} />;
}
