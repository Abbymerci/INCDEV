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
"""

from __future__ import annotations

# pyright: reportMissingImports=false

from datetime import datetime, timedelta
from enum import Enum

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class Priority(str, Enum):
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"
    P4 = "P4"


class IncidentStatus(str, Enum):
    BRIDGE_ACTIVE = "Bridge Active"
    PENDING_VENDOR = "Pending Vendor"
    INVESTIGATING = "Investigating"


class Category(str, Enum):
    COO_CAUSED = "COO Caused"
    COO_IMPACTED = "COO Impacted"
    TCOO_CAUSED = "TCOO Caused"
    WFT_WIDE = "WFT-Wide"


class TileFilter(str, Enum):
    P1_P2_WFT = "P1_P2_WFT"
    COO_CAUSED = "COO_CAUSED"
    COO_IMPACTED = "COO_IMPACTED"
    TCOO_CAUSED = "TCOO_CAUSED"


class Incident(BaseModel):
    incident_number: str
    priority: Priority
    category: Category
    status: IncidentStatus
    opened_at: datetime
    root_cause: str
    customer_impact: str


class TimelineEntry(BaseModel):
    timestamp: datetime
    author: str
    note: str


class IncidentDetail(Incident):
    description: str
    impact_to_coo_services: str
    customer_client_impact: str
    incident_commander: str
    bridge_url: str | None = None
    ai_summary: str
    updates: list[TimelineEntry]


class IncidentListResponse(BaseModel):
    items: list[Incident]
    total: int
    page: int
    page_size: int


class SummaryResponse(BaseModel):
    p1_p2_wft: int
    coo_caused: int
    coo_impacted: int
    tcoo_caused: int


# ---------------------------------------------------------------------------
# Mock data — mirrors IncidentDashboard.tsx's built-in dataset exactly, so
# the two stay visually identical whether you run them standalone or
# paired together. Replace with a real repository call later.
# ---------------------------------------------------------------------------

_NOW = datetime.utcnow()


def _ago(minutes: int) -> datetime:
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

INCIDENTS: list[Incident] = [Incident(**row) for row in _RAW]

# Hand-authored detail copy for the one incident shown in the reference
# detail mockup, so opening it matches exactly. Every other incident's
# detail is composed deterministically by build_incident_detail() below.
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

_COMMANDERS = [
    "Morgan Reyes",
    "Priya Natarajan",
    "Elena Cho",
    "Jamal Whitfield",
    "Sofia Marchetti",
    "Derek Owusu",
]


def _pick_commander(incident_number: str) -> str:
    index = sum(ord(c) for c in incident_number) % len(_COMMANDERS)
    return _COMMANDERS[index]


def _compose_ai_summary(incident: Incident, commander: str) -> str:
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
    return {"status": "ok"}


@router.get("/incidents/summary", response_model=SummaryResponse)
def get_summary() -> SummaryResponse:
    return SummaryResponse(
        p1_p2_wft=sum(1 for i in INCIDENTS if i.priority in (Priority.P1, Priority.P2)),
        coo_caused=sum(1 for i in INCIDENTS if i.category == Category.COO_CAUSED),
        coo_impacted=sum(1 for i in INCIDENTS if i.category == Category.COO_IMPACTED),
        tcoo_caused=sum(1 for i in INCIDENTS if i.category == Category.TCOO_CAUSED),
    )


@router.get("/incidents", response_model=IncidentListResponse)
def list_incidents(
    tile: TileFilter | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=6, ge=1, le=100),
) -> IncidentListResponse:
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

    filtered = sorted(filtered, key=lambda i: i.opened_at, reverse=True)

    total = len(filtered)
    start = (page - 1) * page_size
    end = start + page_size

    return IncidentListResponse(items=filtered[start:end], total=total, page=page, page_size=page_size)


@router.get("/incidents/{incident_number}", response_model=IncidentDetail)
def get_incident_detail(incident_number: str) -> IncidentDetail:
    incident = next((i for i in INCIDENTS if i.incident_number == incident_number), None)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"Incident {incident_number!r} not found")
    return build_incident_detail(incident)


# ---------------------------------------------------------------------------
# Standalone dev runner. Not used once this router is mounted into your
# real app — this only exists so the file can be smoke-tested on its own.
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

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