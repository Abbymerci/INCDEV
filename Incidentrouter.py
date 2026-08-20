"""
COO Major Incident Dashboard — backend for the target-mockup dashboard
(the 4-tile KPI design: P1&P2 WFT-Wide / COO Caused / COO Impacted /
TCOO Caused). Single file: models, mock data, and a FastAPI APIRouter.

This is the companion to IncidentDashboard.tsx — pair them the same way
as the earlier incidents_router.py + IncidentConsole.tsx:

    from incident_dashboard_router import router as incident_dashboard_router
    app.include_router(incident_dashboard_router)

Routes already carry the "/api" prefix, so they plug straight into
whatever FastAPI app you already have. If your app enforces auth via a
shared dependency (e.g. Ping OAuth + AD-group checks), apply it when you
include the router rather than inside this file:

    app.include_router(
        incident_dashboard_router,
        dependencies=[Depends(your_ping_oauth_dependency)],
    )

ENDPOINTS
---------
    GET /api/health
    GET /api/incidents/summary                         -> tile counts
    GET /api/incidents?tile=...&page=...&page_size=...  -> incident list
    GET /api/incidents/{incident_number}                -> full detail

`tile` accepts: P1_P2_WFT | COO_CAUSED | COO_IMPACTED | TCOO_CAUSED
(omit it to get every incident, matching the dashboard's default view).

SWAPPING IN REAL DATA
----------------------
Everything the routes touch lives in `INCIDENTS` and `build_incident_detail()`
below. Replace those with a real repository/query layer whenever you're
ready — the route functions and response models don't need to change.

RUNNING THIS FILE STANDALONE (optional, for local testing only)
------------------------------------------------------------------
    python incident_dashboard_router.py
    # -> serves http://localhost:8000 with permissive CORS, so
    #    IncidentDashboard.tsx can point at it without your real app
    #    running at all.

QUICK EDIT GUIDE — "I want to change X, where do I look?"
------------------------------------------------------------------
  Add / edit / remove a mock incident       -> the `_RAW` list (search "Mock data")
  Change a category name (e.g. "COO Caused") -> the `Category` enum near the top
                                                 AND the matching label in
                                                 IncidentDashboard.tsx's TILE_LABELS
                                                 (both files must say the exact same text)
  Add a new Priority (e.g. "P5")            -> the `Priority` enum, then add a matching
                                                 entry in IncidentDashboard.tsx's
                                                 PRIORITY_STYLES so it has a badge color
  Add a new Status (e.g. "Resolved")        -> the `IncidentStatus` enum, then add a
                                                 matching entry in IncidentDashboard.tsx's
                                                 STATUS_DOT_COLOR
  Change what a tile counts                 -> `get_summary()` and the filter branches
                                                 at the top of `list_incidents()`
  Change the AI-generated summary wording   -> `_compose_ai_summary()`
  Change the timeline entries               -> `_build_timeline()`
  Hand-write the detail text for one        -> add/edit an entry in `_DETAIL_OVERRIDES`
    specific incident (like INC-98214 has)     keyed by incident_number
  Add a new filter/search/sort option       -> `list_incidents()` — add a `Query(...)`
                                                 parameter, then use it before the
                                                 `sorted(...)` call
  Change default page size                  -> the `page_size` default in `list_incidents()`
"""

from __future__ import annotations

from datetime import datetime, timedelta
from enum import Enum

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Models
#
# These are the "shapes" of the data the API sends. Every one of these has
# a matching TypeScript `interface` of the same name in IncidentDashboard.tsx
# — if you rename a field here, rename it there too, or the frontend will
# get `undefined` for that field. Enum *values* (the strings on the right of
# each "=") must also match the frontend's copies of these lists exactly,
# including spacing/punctuation, since they're compared as plain text.
# ---------------------------------------------------------------------------


class Priority(str, Enum):
    """The 4 severity levels. To add a P5, add a line here AND add a
    matching color entry to PRIORITY_STYLES in IncidentDashboard.tsx."""

    P1 = "P1"
    P2 = "P2"
    P3 = "P3"
    P4 = "P4"


class IncidentStatus(str, Enum):
    """What's currently happening with an incident. To add a new status
    (e.g. "Resolved"), add a line here AND a matching color in
    STATUS_DOT_COLOR in IncidentDashboard.tsx."""

    BRIDGE_ACTIVE = "Bridge Active"
    PENDING_VENDOR = "Pending Vendor"
    INVESTIGATING = "Investigating"


class Category(str, Enum):
    """Which of the 4 dashboard tiles an incident belongs to. WFT_WIDE is
    the "none of the above, but still counts toward P1&P2 WFT-Wide" bucket.
    Renaming a value here must also be updated in IncidentDashboard.tsx's
    TILE_LABELS map, or the dashboard will show the old name."""

    COO_CAUSED = "COO Caused"
    COO_IMPACTED = "COO Impacted"
    TCOO_CAUSED = "TCOO Caused"
    WFT_WIDE = "WFT-Wide"


class TileFilter(str, Enum):
    """The `?tile=` query param values the frontend sends when a KPI tile
    is clicked. These are internal codes (no spaces) — not shown to users."""

    P1_P2_WFT = "P1_P2_WFT"
    COO_CAUSED = "COO_CAUSED"
    COO_IMPACTED = "COO_IMPACTED"
    TCOO_CAUSED = "TCOO_CAUSED"


class Incident(BaseModel):
    """One row in the incidents table. This is the "summary" shape — just
    enough to render the table. Full detail (for the modal) is IncidentDetail
    below, which adds more fields on top of this one."""

    incident_number: str
    priority: Priority
    category: Category
    status: IncidentStatus
    opened_at: datetime  # when the incident started; "elapsed" is computed from this
    root_cause: str
    customer_impact: str


class TimelineEntry(BaseModel):
    """One line in the detail modal's Timeline section."""

    timestamp: datetime
    author: str
    note: str


class IncidentDetail(Incident):
    """Everything Incident has, PLUS the extra fields only shown when you
    click into a single incident (the 80vw x 80vh modal)."""

    description: str  # shown as "Root Cause" in the modal (can be more detailed than the table's root_cause)
    impact_to_coo_services: str
    customer_client_impact: str
    incident_commander: str
    bridge_url: str | None = None  # None hides the "Join Bridge" button
    ai_summary: str  # the text in the "AI-Generated Summary" box
    updates: list[TimelineEntry]


class IncidentListResponse(BaseModel):
    """What GET /api/incidents returns: one page of incidents plus paging info."""

    items: list[Incident]
    total: int
    page: int
    page_size: int


class SummaryResponse(BaseModel):
    """The 4 numbers shown on the KPI tiles. Field names here must match
    what IncidentDashboard.tsx reads (summary.p1_p2_wft, etc.) — see
    get_summary() further down for how each number is calculated."""

    p1_p2_wft: int
    coo_caused: int
    coo_impacted: int
    tcoo_caused: int


# ---------------------------------------------------------------------------
# Mock data — this is ALL the incidents the dashboard shows, in one list.
# There's no database here; this file IS the data source. Replace this
# block with a real repository/DB call later (see the module docstring's
# "SWAPPING IN REAL DATA" section) — until then, this is what you edit.
#
# TO ADD A NEW INCIDENT: copy one of the `dict(...)` entries below, paste
# it anywhere in the `_RAW` list, and change its values. Every field is
# required:
#
#   dict(
#       incident_number="INC-98999",              # must be unique
#       priority=Priority.P2,                      # P1 / P2 / P3 / P4
#       category=Category.COO_IMPACTED,             # which tile it counts toward
#       status=IncidentStatus.INVESTIGATING,        # Bridge Active / Pending Vendor / Investigating
#       opened_at=_ago(120),                        # "120 minutes ago" — see _ago() below
#       root_cause="Short phrase for the table",
#       customer_impact="Short phrase for the table",
#   ),
#
# TO REMOVE AN INCIDENT: delete its whole dict(...) block (including the
# trailing comma before/after it).
#
# TO EDIT AN INCIDENT: find it by its incident_number and change any field.
# Note: the detail modal's longer text (AI summary, timeline, etc.) is NOT
# stored here — it's generated automatically from these fields by the
# functions below (_compose_ai_summary, _build_timeline). If you want to
# hand-write custom detail text for one specific incident instead of the
# auto-generated version, add it to `_DETAIL_OVERRIDES` further down.
# ---------------------------------------------------------------------------

_NOW = datetime.utcnow()


def _ago(minutes: int) -> datetime:
    """Helper so incidents look "live" (e.g. _ago(120) = opened 2 hours
    before this file was loaded) instead of having stale hardcoded dates."""
    return _NOW - timedelta(minutes=minutes)


_RAW: list[dict] = [
    # --- Major incidents — COO Caused ---
    dict(
        incident_number="INC-98214",
        priority=Priority.P1,
        category=Category.COO_CAUSED,
        status=IncidentStatus.BRIDGE_ACTIVE,
        opened_at=_ago(166),
        root_cause="Core Banking DB failover",
        customer_impact="Retail digital banking degraded",
    ),
    dict(
        incident_number="INC-98185",
        priority=Priority.P2,
        category=Category.COO_CAUSED,
        status=IncidentStatus.BRIDGE_ACTIVE,
        opened_at=_ago(340),
        root_cause="Payment gateway cert expiry",
        customer_impact="Commercial banking payments delayed",
    ),
    dict(
        incident_number="INC-98166",
        priority=Priority.P2,
        category=Category.COO_CAUSED,
        status=IncidentStatus.INVESTIGATING,
        opened_at=_ago(365),
        root_cause="IAM token service latency",
        customer_impact="Internal only — no client impact",
    ),
    dict(
        incident_number="INC-98147",
        priority=Priority.P2,
        category=Category.COO_CAUSED,
        status=IncidentStatus.PENDING_VENDOR,
        opened_at=_ago(675),
        root_cause="Network circuit — 3rd party carrier",
        customer_impact="Wealth mgmt reporting delayed",
    ),
    # --- Major incidents — COO Impacted ---
    dict(
        incident_number="INC-98201",
        priority=Priority.P1,
        category=Category.COO_IMPACTED,
        status=IncidentStatus.BRIDGE_ACTIVE,
        opened_at=_ago(210),
        root_cause="Data Warehouse ETL job failure",
        customer_impact="COO reporting dashboards stale",
    ),
    dict(
        incident_number="INC-98194",
        priority=Priority.P2,
        category=Category.COO_IMPACTED,
        status=IncidentStatus.INVESTIGATING,
        opened_at=_ago(290),
        root_cause="Shared API gateway rate-limiting",
        customer_impact="Trade settlement confirmations delayed",
    ),
    dict(
        incident_number="INC-98180",
        priority=Priority.P1,
        category=Category.COO_IMPACTED,
        status=IncidentStatus.BRIDGE_ACTIVE,
        opened_at=_ago(95),
        root_cause="Enterprise DNS resolution failure",
        customer_impact="Multiple COO-owned apps intermittently unreachable",
    ),
    dict(
        incident_number="INC-98172",
        priority=Priority.P2,
        category=Category.COO_IMPACTED,
        status=IncidentStatus.PENDING_VENDOR,
        opened_at=_ago(510),
        root_cause="Cloud region networking outage (3rd-party)",
        customer_impact="COO batch processing delayed",
    ),
    dict(
        incident_number="INC-98159",
        priority=Priority.P2,
        category=Category.COO_IMPACTED,
        status=IncidentStatus.INVESTIGATING,
        opened_at=_ago(605),
        root_cause="Identity provider session expiry bug",
        customer_impact="Internal only — no client impact",
    ),
    dict(
        incident_number="INC-98142",
        priority=Priority.P1,
        category=Category.COO_IMPACTED,
        status=IncidentStatus.BRIDGE_ACTIVE,
        opened_at=_ago(58),
        root_cause="Mainframe batch scheduler stall",
        customer_impact="End-of-day COO reconciliation delayed",
    ),
    # --- P3 & P4 — TCOO Caused ---
    dict(
        incident_number="INC-98135",
        priority=Priority.P3,
        category=Category.TCOO_CAUSED,
        status=IncidentStatus.INVESTIGATING,
        opened_at=_ago(720),
        root_cause="Internal reporting service memory leak",
        customer_impact="Internal only — no client impact",
    ),
    dict(
        incident_number="INC-98128",
        priority=Priority.P4,
        category=Category.TCOO_CAUSED,
        status=IncidentStatus.INVESTIGATING,
        opened_at=_ago(890),
        root_cause="Batch job retry storm",
        customer_impact="Internal only — no client impact",
    ),
    dict(
        incident_number="INC-98120",
        priority=Priority.P3,
        category=Category.TCOO_CAUSED,
        status=IncidentStatus.PENDING_VENDOR,
        opened_at=_ago(745),
        root_cause="Vendor SFTP connectivity",
        customer_impact="Delayed nightly file delivery",
    ),
    dict(
        incident_number="INC-98113",
        priority=Priority.P3,
        category=Category.TCOO_CAUSED,
        status=IncidentStatus.INVESTIGATING,
        opened_at=_ago(1040),
        root_cause="Log aggregation pipeline backlog",
        customer_impact="Internal only — no client impact",
    ),
    dict(
        incident_number="INC-98107",
        priority=Priority.P4,
        category=Category.TCOO_CAUSED,
        status=IncidentStatus.INVESTIGATING,
        opened_at=_ago(1200),
        root_cause="Dev/test environment outage",
        customer_impact="Internal only — no client impact",
    ),
    dict(
        incident_number="INC-98099",
        priority=Priority.P3,
        category=Category.TCOO_CAUSED,
        status=IncidentStatus.INVESTIGATING,
        opened_at=_ago(1330),
        root_cause="Card processing batch reconciliation mismatch",
        customer_impact="Internal only — no client impact",
    ),
    dict(
        incident_number="INC-98092",
        priority=Priority.P4,
        category=Category.TCOO_CAUSED,
        status=IncidentStatus.PENDING_VENDOR,
        opened_at=_ago(1455),
        root_cause="3rd-party monitoring tool false alerts",
        customer_impact="Internal only — no client impact",
    ),
    dict(
        incident_number="INC-98085",
        priority=Priority.P3,
        category=Category.TCOO_CAUSED,
        status=IncidentStatus.INVESTIGATING,
        opened_at=_ago(1600),
        root_cause="Reporting Services query timeout",
        customer_impact="Wealth mgmt report generation slow",
    ),
    dict(
        incident_number="INC-98077",
        priority=Priority.P3,
        category=Category.TCOO_CAUSED,
        status=IncidentStatus.INVESTIGATING,
        opened_at=_ago(1740),
        root_cause="Legacy batch scheduler misconfiguration",
        customer_impact="Internal only — no client impact",
    ),
    dict(
        incident_number="INC-98070",
        priority=Priority.P4,
        category=Category.TCOO_CAUSED,
        status=IncidentStatus.INVESTIGATING,
        opened_at=_ago(1890),
        root_cause="Data Warehouse index rebuild backlog",
        customer_impact="Internal only — no client impact",
    ),
    # --- General WFT incidents (not COO/TCOO-tagged; still count toward tile 1) ---
    dict(
        incident_number="INC-98063",
        priority=Priority.P1,
        category=Category.WFT_WIDE,
        status=IncidentStatus.BRIDGE_ACTIVE,
        opened_at=_ago(40),
        root_cause="Retail mobile app crash on login",
        customer_impact="Retail mobile banking unavailable",
    ),
    dict(
        incident_number="INC-98056",
        priority=Priority.P2,
        category=Category.WFT_WIDE,
        status=IncidentStatus.INVESTIGATING,
        opened_at=_ago(455),
        root_cause="Card tokenization service errors",
        customer_impact="Some card-not-present transactions failing",
    ),
    dict(
        incident_number="INC-98048",
        priority=Priority.P3,
        category=Category.WFT_WIDE,
        status=IncidentStatus.INVESTIGATING,
        opened_at=_ago(2020),
        root_cause="Internal wiki search indexing failure",
        customer_impact="Internal only — no client impact",
    ),
    dict(
        incident_number="INC-98041",
        priority=Priority.P4,
        category=Category.WFT_WIDE,
        status=IncidentStatus.INVESTIGATING,
        opened_at=_ago(2160),
        root_cause="Non-prod CI pipeline flakiness",
        customer_impact="Internal only — no client impact",
    ),
]

# The actual list every endpoint reads from. Built once, when this file is
# first imported, by validating each _RAW dict against the Incident model
# above (this also means a typo'd field name or wrong enum value in _RAW
# will raise an error immediately on startup rather than failing silently).
INCIDENTS: list[Incident] = [Incident(**row) for row in _RAW]

# ---------------------------------------------------------------------------
# Detail overrides — hand-written text for specific incidents, used INSTEAD
# OF the auto-generated description/AI-summary/etc. Right now only
# INC-98214 has one (so it matches the reference mockup word-for-word).
# Every other incident falls back to the auto-generated version further down.
#
# TO GIVE ANOTHER INCIDENT CUSTOM TEXT: add a new key, same shape as the
# INC-98214 example — you don't have to fill in every field; anything you
# omit still falls back to the auto-generated text for that field.
#
#   _DETAIL_OVERRIDES = {
#       "INC-98214": dict(...),          # existing
#       "INC-98185": dict(                # new
#           ai_summary="Whatever custom paragraph you want here.",
#       ),
#   }
# ---------------------------------------------------------------------------
_DETAIL_OVERRIDES: dict[str, dict] = {
    "INC-98214": dict(
        description=(
            "Core Banking database failover triggered a 12-minute write-lock "
            "during peak retail traffic."
        ),
        impact_to_coo_services="Retail digital banking, mobile deposit",
        customer_client_impact="~410K retail customers experienced degraded login & balance refresh",
        incident_commander="Priya Natarajan",
        ai_summary=(
            "A failover event on the Core Banking primary database at 11:18 AM triggered a write-lock "
            "that blocked retail login and balance-refresh transactions. Engineering rolled back to the "
            "standby replica at 11:41 AM; residual latency is being monitored. No data loss detected. "
            "Estimated full recovery within 30 minutes pending vendor confirmation on replica sync health."
        ),
    ),
}

# Pool of names used as "Incident Commander" for any incident that doesn't
# have a hand-written override. Add/remove/rename names freely.
_COMMANDERS = [
    "Morgan Reyes",
    "Priya Natarajan",
    "Elena Cho",
    "Jamal Whitfield",
    "Sofia Marchetti",
    "Derek Owusu",
]


def _pick_commander(incident_number: str) -> str:
    """Always returns the SAME name for the same incident_number (it's not
    random — it's a hash of the incident number), so a given incident
    doesn't change commander every time you refresh the page."""
    index = sum(ord(c) for c in incident_number) % len(_COMMANDERS)
    return _COMMANDERS[index]


def _compose_ai_summary(incident: Incident, commander: str) -> str:
    """Auto-writes the paragraph shown in the "AI-Generated Summary" box
    for any incident that doesn't have a hand-written override above.
    Edit the sentence templates below to change the wording/tone."""
    if incident.status == IncidentStatus.BRIDGE_ACTIVE:
        engagement = "A major incident bridge is active and stakeholders are being updated every 30 minutes."
    elif incident.status == IncidentStatus.PENDING_VENDOR:
        engagement = f"{commander} is awaiting vendor confirmation before the next remediation step."
    else:
        engagement = f"{commander} and the service owner team are investigating root cause and containment options."

    category_label = "WFT services" if incident.category == Category.WFT_WIDE else incident.category.value
    return (
        f"{incident.root_cause} was identified affecting {category_label}. {engagement} "
        f"Customer impact: {incident.customer_impact.lower()}."
    )


def _build_timeline(incident: Incident, commander: str) -> list[TimelineEntry]:
    """Auto-generates the 3-line Timeline shown in the detail modal:
    (1) when it was opened, (2) a mid-point "engaged stakeholders" update,
    (3) a recent status update. There's no real event log here — these are
    just calculated from opened_at + status. Edit the note= text below to
    change the wording; add more TimelineEntry(...) entries to the returned
    list to show more than 3 lines."""
    now = datetime.utcnow()
    elapsed = now - incident.opened_at
    midpoint = incident.opened_at + elapsed / 2
    recent = now - timedelta(minutes=5) if elapsed > timedelta(minutes=10) else now

    return [
        TimelineEntry(
            timestamp=incident.opened_at,
            author="Monitoring System",
            note=(
                f"{incident.incident_number} declared {incident.priority.value} "
                f"— root cause traced to {incident.root_cause}."
            ),
        ),
        TimelineEntry(
            timestamp=midpoint,
            author=commander,
            note=f'Engaged stakeholders. Status set to "{incident.status.value}".',
        ),
        TimelineEntry(
            timestamp=recent,
            author=commander,
            note=(
                "Bridge remains active; next update in 30 minutes."
                if incident.status == IncidentStatus.BRIDGE_ACTIVE
                else f"Still {incident.status.value.lower()} — no ETA yet."
            ),
        ),
    ]


def build_incident_detail(incident: Incident) -> IncidentDetail:
    """Turns a plain Incident (table row) into a full IncidentDetail (modal
    content) by bolting on the auto-generated commander/AI-summary/timeline,
    then layering any hand-written `_DETAIL_OVERRIDES` on top for incidents
    that have one. This is what GET /api/incidents/{incident_number} returns."""
    commander = _pick_commander(incident.incident_number)
    bridge_url = (
        f"https://bridge.enterprise-incident.internal/{incident.incident_number.lower()}"
        if incident.status == IncidentStatus.BRIDGE_ACTIVE
        else None
    )

    base = dict(
        **incident.model_dump(),
        description=incident.root_cause,
        impact_to_coo_services=incident.customer_impact,
        customer_client_impact=incident.customer_impact,
        incident_commander=commander,
        bridge_url=bridge_url,
        ai_summary=_compose_ai_summary(incident, commander),
        updates=_build_timeline(incident, commander),
    )
    base.update(_DETAIL_OVERRIDES.get(incident.incident_number, {}))
    return IncidentDetail(**base)


# ---------------------------------------------------------------------------
# Router — mount this into your existing FastAPI app (see module docstring).
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/api", tags=["incident-dashboard"])


@router.get("/health")
def health() -> dict:
    """Simple "is the server up" check — doesn't touch any incident data.
    Handy for confirming the backend is running before debugging anything
    else (e.g. open http://localhost:8000/api/health in a browser tab)."""
    return {"status": "ok"}


@router.get("/incidents/summary", response_model=SummaryResponse)
def get_summary() -> SummaryResponse:
    """Powers the 4 KPI tiles at the top of the dashboard. Each number is a
    simple count over ALL incidents (not affected by the table's filters/
    search/page) — see "Change what a tile counts" in the QUICK EDIT GUIDE
    above if you need to change what counts toward a tile."""
    return SummaryResponse(
        p1_p2_wft=sum(1 for i in INCIDENTS if i.priority in (Priority.P1, Priority.P2)),
        coo_caused=sum(1 for i in INCIDENTS if i.category == Category.COO_CAUSED),
        coo_impacted=sum(1 for i in INCIDENTS if i.category == Category.COO_IMPACTED),
        tcoo_caused=sum(1 for i in INCIDENTS if i.category == Category.TCOO_CAUSED),
    )


# Columns the table header lets a user click to sort by. Keep this in sync
# with the clickable <th> set in IncidentDashboard.tsx.
_SORTABLE_FIELDS = {
    "incident_number": lambda i: i.incident_number,
    "priority": lambda i: i.priority.value,
    "category": lambda i: i.category.value,
    "status": lambda i: i.status.value,
    "root_cause": lambda i: i.root_cause.lower(),
    "customer_impact": lambda i: i.customer_impact.lower(),
}


@router.get("/incidents", response_model=IncidentListResponse)
def list_incidents(
    # Every one of these arguments is an "?x=..." in the URL, e.g.
    # /api/incidents?priority=P1&sort_by=status&sort_dir=desc&page=2
    # The frontend's listIncidents() function builds that URL for you —
    # you don't have to construct it by hand.
    tile: TileFilter | None = Query(default=None),  # which KPI tile was clicked (or None = "show everything")
    priority: Priority | None = Query(default=None),  # the Priority dropdown, e.g. Priority.P1
    status: IncidentStatus | None = Query(default=None),  # the Status dropdown
    q: str | None = Query(default=None, description="Case-insensitive search across incident #, root cause, customer impact"),  # the search box
    sort_by: str | None = Query(default=None, pattern="^(" + "|".join(_SORTABLE_FIELDS) + ")$"),  # which column header was clicked (must be a key in _SORTABLE_FIELDS above)
    sort_dir: str = Query(default="asc", pattern="^(asc|desc)$"),  # "asc" or "desc" — toggled by clicking the same header twice
    page: int = Query(default=1, ge=1),  # 1-based page number
    page_size: int = Query(default=6, ge=1, le=100),  # rows per page — change the default here to show more/fewer rows
) -> IncidentListResponse:
    # Step 1: narrow down to the incidents that belong to the clicked tile
    # (or all of them, if no tile was clicked).
    if tile == TileFilter.P1_P2_WFT:
        filtered = [i for i in INCIDENTS if i.priority in (Priority.P1, Priority.P2)]
    elif tile == TileFilter.COO_CAUSED:
        filtered = [i for i in INCIDENTS if i.category == Category.COO_CAUSED]
    elif tile == TileFilter.COO_IMPACTED:
        filtered = [i for i in INCIDENTS if i.category == Category.COO_IMPACTED]
    elif tile == TileFilter.TCOO_CAUSED:
        filtered = [i for i in INCIDENTS if i.category == Category.TCOO_CAUSED]
    else:
        filtered = list(INCIDENTS)

    # Step 2: apply the Priority and Status dropdowns on top of the tile filter.
    if priority is not None:
        filtered = [i for i in filtered if i.priority == priority]
    if status is not None:
        filtered = [i for i in filtered if i.status == status]

    # Step 3: apply the search box. Matches if the text appears ANYWHERE in
    # the incident number, root cause, or customer impact (case-insensitive).
    # Add more `or needle in i.SOMEFIELD.lower()` lines to search more fields.
    if q:
        needle = q.strip().lower()
        filtered = [
            i
            for i in filtered
            if needle in i.incident_number.lower()
            or needle in i.root_cause.lower()
            or needle in i.customer_impact.lower()
        ]

    # Step 4: sort. If a column header was clicked, sort_by tells us which
    # field/direction; otherwise default to newest-opened-first.
    if sort_by:
        filtered = sorted(filtered, key=_SORTABLE_FIELDS[sort_by], reverse=sort_dir == "desc")
    else:
        # Default: most recently opened first, matching the dashboard's original ordering.
        filtered = sorted(filtered, key=lambda i: i.opened_at, reverse=True)

    # Step 5: cut out just the one page of rows the frontend asked for, but
    # report the TOTAL count too (so the frontend can show "1-6 of 24" and
    # enable/disable the Next/Prev buttons correctly).
    total = len(filtered)
    start = (page - 1) * page_size
    end = start + page_size

    return IncidentListResponse(items=filtered[start:end], total=total, page=page, page_size=page_size)


@router.get("/incidents/{incident_number}", response_model=IncidentDetail)
def get_incident_detail(incident_number: str) -> IncidentDetail:
    """Runs when a user clicks a row and the detail modal opens. Looks up
    the one incident by its number and returns the full detail shape
    (built by build_incident_detail() above). Returns a 404 if the
    incident_number doesn't exist in INCIDENTS."""
    incident = next((i for i in INCIDENTS if i.incident_number == incident_number), None)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"Incident {incident_number!r} not found")
    return build_incident_detail(incident)


# ---------------------------------------------------------------------------
# Standalone dev runner. Not used once this router is mounted into your
# real app — this only exists so the file can be smoke-tested on its own.
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    try:
        import uvicorn  # type: ignore[import-not-found]
        from fastapi import FastAPI  # type: ignore[import-not-found]
        from fastapi.middleware.cors import CORSMiddleware  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError(
            "Standalone dev server requires the optional dependencies 'fastapi' and 'uvicorn'. "
            "Install them with: pip install fastapi uvicorn"
        ) from exc

    dev_app = FastAPI(title="Incident Dashboard API (standalone dev)")
    dev_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    dev_app.include_router(router)

    print("Standalone dev server: http://localhost:8000/api/health")
    uvicorn.run(dev_app, host="0.0.0.0", port=8000)