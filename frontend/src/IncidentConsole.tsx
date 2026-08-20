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
 */

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

// ---------------------------------------------------------------------------
// Theme — Institutional Heritage palette, ported 1:1 from the design tokens.
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
// ---------------------------------------------------------------------------

export type Priority = "P1" | "P2" | "P3" | "P4";
export type IncidentStatus = "Bridge Active" | "Pending Vendor" | "Investigating";
export type Category = "COO Caused" | "COO Impacted" | "TCOO Caused" | "WFT-Wide";
export type TileFilter = "P1_P2_WFT" | "COO_CAUSED" | "COO_IMPACTED" | "TCOO_CAUSED" | null;

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
// API client
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

function listIncidents(
  apiBaseUrl: string,
  params: { tile?: TileFilter; page: number; pageSize: number }
): Promise<IncidentListResponse> {
  return apiGet<IncidentListResponse>(apiBaseUrl, "/api/incidents", {
    tile: params.tile ?? undefined,
    page: params.page.toString(),
    page_size: params.pageSize.toString(),
  });
}

function getSummary(apiBaseUrl: string): Promise<SummaryResponse> {
  return apiGet<SummaryResponse>(apiBaseUrl, "/api/incidents/summary");
}

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
// KPI tile
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

function IncidentsTable({
  incidents,
  loading,
  error,
  total,
  page,
  pageSize,
  onPageChange,
  onRowOpen,
}: {
  incidents: Incident[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  pageSize: number;
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
              <th style={{ ...th, width: 112 }}>Incident #</th>
              <th style={{ ...th, width: 90 }}>Priority</th>
              <th style={{ ...th, width: 130 }}>Category</th>
              <th style={{ ...th, width: 150 }}>Status</th>
              <th style={th}>Root Cause</th>
              <th style={th}>Customer Impact</th>
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
// ---------------------------------------------------------------------------

const ANIMATION_MS = 200;

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
// Root component
// ---------------------------------------------------------------------------

const PAGE_SIZE = 6;

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
  const [tileFilter, setTileFilter] = useState<TileFilter>(null);
  const [page, setPage] = useState(1);
  const [selectedIncidentNumber, setSelectedIncidentNumber] = useState<string | null>(null);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [tileFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      listIncidents(apiBaseUrl, { tile: tileFilter, page, pageSize: PAGE_SIZE }),
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
  }, [apiBaseUrl, tileFilter, page]);

  function toggleTile(next: Exclude<TileFilter, null>) {
    setTileFilter((current) => (current === next ? null : next));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: fontBody }}>
      {/* This <style> tag only defines the "Bridge Active" status-dot pulse
          animation — the one thing inline styles can't express. */}
      <style>{"@keyframes ic-pulse{0%,100%{opacity:1}50%{opacity:.35}}"}</style>

      <div>
        <h2 style={{ fontFamily: fontHeadline, fontSize: 30, fontWeight: 700, color: theme.onBackground, margin: "0 0 4px" }}>
          COO Major Incident Dashboard
        </h2>
        <p style={{ fontFamily: fontBody, fontSize: 15, color: theme.onSurfaceVariant, margin: 0 }}>
          Real-time view for SOD ops calls — click a tile to filter, click a row for full detail.
        </p>
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
