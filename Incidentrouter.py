"""
COO Incident Console — incidents feature module (single-file backend).
 
Everything the Incident Console dashboard needs on the API side lives in
this one file: enums, Pydantic models, mock data, and a FastAPI
``APIRouter`` with every endpoint. Nothing outside this file is required.
 
HOW TO MOUNT INTO YOUR EXISTING APP
------------------------------------
    from incidents_router import router as incidents_router
    app.include_router(incidents_router)
 
That's it. The router already carries the "/api" prefix and the
"incidents" tag, so it plugs straight into whatever FastAPI app you
already have — same process, same port, same middleware.
 
If your app enforces auth via a shared dependency (e.g. Ping OAuth +
AD-group checks), apply it when you include the router rather than
inside this file, so this module stays auth-agnostic and easy to test
on its own:
 
    app.include_router(
        incidents_router,
        dependencies=[Depends(your_ping_oauth_dependency)],
    )
 
SWAPPING IN REAL DATA
----------------------
Everything below "Mock data" is a stand-in for a real datastore. The
only two things the route handlers touch are ``INCIDENTS`` (a list of
``Incident``) and ``build_incident_detail()``. Replace those with real
repository/query calls when you're ready — the route functions and
response models don't need to change.
 
RUNNING THIS FILE STANDALONE (optional, for local testing only)
------------------------------------------------------------------
    python incidents_router.py
    # -> serves the same routes on http://localhost:8000, with permissive
    #    CORS, so you can point the companion frontend script at it
    #    without your real app running at all.
"""
 
from __future__ import annotations
 
from datetime import datetime, timedelta
from enum import Enum
 
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
 
# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
 
 
class Priority(str, Enum):
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"
 
 
class IncidentStatus(str, Enum):
    BRIDGE_ACTIVE = "Bridge Active"
    PENDING_VENDOR = "Pending Vendor"
    INVESTIGATING = "Investigating"
 
 
class Incident(BaseModel):
    incident_number: str = Field(..., description='e.g. "INC-98214"')
    priority: Priority
    mim: bool = Field(..., description="Whether a Major Incident Manager is engaged")
    opened_at: datetime
    status: IncidentStatus
    causal_cio: str
    impacted_biz: str
 
    @property
    def duration_minutes(self) -> int:
        delta = datetime.utcnow() - self.opened_at
        return max(int(delta.total_seconds() // 60), 0)
 
 
class IncidentOut(BaseModel):
    incident_number: str
    priority: Priority
    mim: bool
    opened_at: datetime
    duration_minutes: int
    status: IncidentStatus
    causal_cio: str
    impacted_biz: str
 
    @classmethod
    def from_incident(cls, incident: Incident) -> "IncidentOut":
        return cls(
            incident_number=incident.incident_number,
            priority=incident.priority,
            mim=incident.mim,
            opened_at=incident.opened_at,
            duration_minutes=incident.duration_minutes,
            status=incident.status,
            causal_cio=incident.causal_cio,
            impacted_biz=incident.impacted_biz,
        )
 
 
class TimelineEntry(BaseModel):
    timestamp: datetime
    author: str
    note: str
 
 
class IncidentDetail(IncidentOut):
    description: str
    incident_commander: str
    bridge_url: str | None = None
    updates: list[TimelineEntry]
 
 
class IncidentListResponse(BaseModel):
    items: list[IncidentOut]
    total: int
    page: int
    page_size: int
 
 
class SummaryResponse(BaseModel):
    critical_count: int
    high_count: int
    active_bridges: int
    avg_resolution_minutes: int
 
 
# ---------------------------------------------------------------------------
# Mock data — replace with a real repository/database call later.
# Opened timestamps are generated relative to import time so that
# `duration_minutes` (computed on the fly) stays realistic across requests.
# ---------------------------------------------------------------------------
 
_NOW = datetime.utcnow()
 
 
def _ago(**kwargs) -> datetime:
    return _NOW - timedelta(**kwargs)
 
 
_RAW: list[dict] = [
    dict(
        incident_number="INC-98214",
        priority=Priority.P1,
        mim=True,
        opened_at=_ago(hours=2, minutes=45),
        status=IncidentStatus.BRIDGE_ACTIVE,
        causal_cio="Core Banking Systems",
        impacted_biz="Retail Operations",
    ),
    dict(
        incident_number="INC-98210",
        priority=Priority.P2,
        mim=False,
        opened_at=_ago(hours=4, minutes=30),
        status=IncidentStatus.PENDING_VENDOR,
        causal_cio="Network Infrastructure",
        impacted_biz="Corporate Trust",
    ),
    dict(
        incident_number="INC-98199",
        priority=Priority.P3,
        mim=False,
        opened_at=_ago(hours=20, minutes=40),
        status=IncidentStatus.INVESTIGATING,
        causal_cio="Data Warehouse",
        impacted_biz="Wealth Management",
    ),
    dict(
        incident_number="INC-98185",
        priority=Priority.P2,
        mim=True,
        opened_at=_ago(hours=26),
        status=IncidentStatus.BRIDGE_ACTIVE,
        causal_cio="Payment Gateway",
        impacted_biz="Commercial Banking",
    ),
    dict(
        incident_number="INC-98171",
        priority=Priority.P1,
        mim=True,
        opened_at=_ago(hours=1, minutes=10),
        status=IncidentStatus.BRIDGE_ACTIVE,
        causal_cio="Core Banking Systems",
        impacted_biz="Retail Operations",
    ),
    dict(
        incident_number="INC-98166",
        priority=Priority.P2,
        mim=False,
        opened_at=_ago(hours=6, minutes=5),
        status=IncidentStatus.INVESTIGATING,
        causal_cio="Identity & Access Mgmt",
        impacted_biz="Corporate Trust",
    ),
    dict(
        incident_number="INC-98160",
        priority=Priority.P3,
        mim=False,
        opened_at=_ago(hours=9, minutes=20),
        status=IncidentStatus.INVESTIGATING,
        causal_cio="Card Processing",
        impacted_biz="Retail Operations",
    ),
    dict(
        incident_number="INC-98152",
        priority=Priority.P3,
        mim=False,
        opened_at=_ago(days=1, hours=2),
        status=IncidentStatus.INVESTIGATING,
        causal_cio="Reporting Services",
        impacted_biz="Wealth Management",
    ),
    dict(
        incident_number="INC-98147",
        priority=Priority.P2,
        mim=False,
        opened_at=_ago(hours=11, minutes=15),
        status=IncidentStatus.PENDING_VENDOR,
        causal_cio="Network Infrastructure",
        impacted_biz="Corporate Trust",
    ),
    dict(
        incident_number="INC-98139",
        priority=Priority.P3,
        mim=False,
        opened_at=_ago(days=1, hours=6),
        status=IncidentStatus.INVESTIGATING,
        causal_cio="Data Warehouse",
        impacted_biz="Commercial Banking",
    ),
    dict(
        incident_number="INC-98133",
        priority=Priority.P3,
        mim=False,
        opened_at=_ago(days=1, hours=9),
        status=IncidentStatus.INVESTIGATING,
        causal_cio="Batch Processing",
        impacted_biz="Retail Operations",
    ),
    dict(
        incident_number="INC-98128",
        priority=Priority.P3,
        mim=False,
        opened_at=_ago(hours=14, minutes=50),
        status=IncidentStatus.INVESTIGATING,
        causal_cio="Payment Gateway",
        impacted_biz="Commercial Banking",
    ),
    dict(
        incident_number="INC-98120",
        priority=Priority.P3,
        mim=False,
        opened_at=_ago(days=1, hours=12),
        status=IncidentStatus.INVESTIGATING,
        causal_cio="Reporting Services",
        impacted_biz="Wealth Management",
    ),
    dict(
        incident_number="INC-98115",
        priority=Priority.P3,
        mim=False,
        opened_at=_ago(days=2, hours=1),
        status=IncidentStatus.INVESTIGATING,
        causal_cio="Identity & Access Mgmt",
        impacted_biz="Corporate Trust",
    ),
    dict(
        incident_number="INC-98109",
        priority=Priority.P3,
        mim=False,
        opened_at=_ago(hours=18, minutes=30),
        status=IncidentStatus.INVESTIGATING,
        causal_cio="Card Processing",
        impacted_biz="Retail Operations",
    ),
    dict(
        incident_number="INC-98101",
        priority=Priority.P3,
        mim=False,
        opened_at=_ago(days=2, hours=4),
        status=IncidentStatus.INVESTIGATING,
        causal_cio="Data Warehouse",
        impacted_biz="Wealth Management",
    ),
    dict(
        incident_number="INC-98094",
        priority=Priority.P3,
        mim=False,
        opened_at=_ago(days=2, hours=8),
        status=IncidentStatus.INVESTIGATING,
        causal_cio="Batch Processing",
        impacted_biz="Commercial Banking",
    ),
    dict(
        incident_number="INC-98088",
        priority=Priority.P2,
        mim=False,
        opened_at=_ago(hours=22, minutes=10),
        status=IncidentStatus.PENDING_VENDOR,
        causal_cio="Network Infrastructure",
        impacted_biz="Corporate Trust",
    ),
    dict(
        incident_number="INC-98079",
        priority=Priority.P3,
        mim=False,
        opened_at=_ago(days=2, hours=15),
        status=IncidentStatus.INVESTIGATING,
        causal_cio="Reporting Services",
        impacted_biz="Retail Operations",
    ),
    dict(
        incident_number="INC-98070",
        priority=Priority.P3,
        mim=False,
        opened_at=_ago(days=3),
        status=IncidentStatus.INVESTIGATING,
        causal_cio="Identity & Access Mgmt",
        impacted_biz="Wealth Management",
    ),
    dict(
        incident_number="INC-98062",
        priority=Priority.P3,
        mim=False,
        opened_at=_ago(days=3, hours=4),
        status=IncidentStatus.INVESTIGATING,
        causal_cio="Data Warehouse",
        impacted_biz="Corporate Trust",
    ),
    dict(
        incident_number="INC-98055",
        priority=Priority.P3,
        mim=False,
        opened_at=_ago(days=3, hours=9),
        status=IncidentStatus.INVESTIGATING,
        causal_cio="Batch Processing",
        impacted_biz="Commercial Banking",
    ),
    dict(
        incident_number="INC-98048",
        priority=Priority.P3,
        mim=False,
        opened_at=_ago(days=3, hours=14),
        status=IncidentStatus.INVESTIGATING,
        causal_cio="Card Processing",
        impacted_biz="Retail Operations",
    ),
    dict(
        incident_number="INC-98041",
        priority=Priority.P3,
        mim=False,
        opened_at=_ago(days=4),
        status=IncidentStatus.INVESTIGATING,
        causal_cio="Reporting Services",
        impacted_biz="Wealth Management",
    ),
]
 
INCIDENTS: list[Incident] = [Incident(**row) for row in _RAW]
 
# Average resolution time for recently *closed* incidents. Hardcoded here to
# match the original design (4h 12m); swap for a real aggregate query later.
AVG_RESOLUTION_MINUTES = 4 * 60 + 12
 
 
_COMMANDERS = [
    "Morgan Reyes",
    "Priya Natarajan",
    "Elena Cho",
    "Jamal Whitfield",
    "Sofia Marchetti",
    "Derek Owusu",
]
 
 
def _pick_commander(incident_number: str) -> str:
    # Deterministic "random" pick so the same incident always gets the same
    # commander across requests, without needing to persist anything.
    index = sum(ord(c) for c in incident_number) % len(_COMMANDERS)
    return _COMMANDERS[index]
 
 
def build_incident_detail(incident: Incident) -> IncidentDetail:
    """Derive a richer detail payload from a base Incident.
 
    Nothing here is persisted — description/commander/timeline are computed
    on the fly from the incident's existing fields. Replace with real
    incident-notes / audit-log data once there's a database behind this.
    """
    now = datetime.utcnow()
    commander = _pick_commander(incident.incident_number)
 
    if incident.mim:
        engagement = (
            "A major incident bridge is active and stakeholders are being "
            "updated every 30 minutes."
        )
        bridge_url = f"https://bridge.enterprise-incident.internal/{incident.incident_number.lower()}"
    else:
        engagement = "The service owner team is investigating and will escalate if a bridge is needed."
        bridge_url = None
 
    description = f"{incident.causal_cio} is degraded, impacting {incident.impacted_biz}. {engagement}"
 
    elapsed = now - incident.opened_at
    midpoint = incident.opened_at + elapsed / 2
    recent = now - timedelta(minutes=5) if elapsed > timedelta(minutes=10) else now
 
    updates = [
        TimelineEntry(
            timestamp=incident.opened_at,
            author="Monitoring System",
            note=(
                f"{incident.incident_number} declared {incident.priority.value} "
                f"— root cause traced to {incident.causal_cio}."
            ),
        ),
        TimelineEntry(
            timestamp=midpoint,
            author=commander,
            note=f'Engaged {incident.impacted_biz} stakeholders. Status set to "{incident.status.value}".',
        ),
        TimelineEntry(
            timestamp=recent,
            author=commander,
            note=(
                "Bridge remains active; next update in 30 minutes."
                if incident.mim
                else f"Still {incident.status.value.lower()} — no ETA yet."
            ),
        ),
    ]
 
    return IncidentDetail(
        **IncidentOut.from_incident(incident).model_dump(),
        description=description,
        incident_commander=commander,
        bridge_url=bridge_url,
        updates=updates,
    )
 
 
# ---------------------------------------------------------------------------
# Router — mount this into your existing FastAPI app (see module docstring).
# ---------------------------------------------------------------------------
 
router = APIRouter(prefix="/api", tags=["incidents"])
 
 
@router.get("/health")
def health() -> dict:
    return {"status": "ok"}
 
 
@router.get("/incidents/summary", response_model=SummaryResponse)
def get_summary() -> SummaryResponse:
    critical_count = sum(1 for i in INCIDENTS if i.priority == Priority.P1)
    high_count = sum(1 for i in INCIDENTS if i.priority == Priority.P2)
    active_bridges = sum(1 for i in INCIDENTS if i.status == IncidentStatus.BRIDGE_ACTIVE)
    return SummaryResponse(
        critical_count=critical_count,
        high_count=high_count,
        active_bridges=active_bridges,
        avg_resolution_minutes=AVG_RESOLUTION_MINUTES,
    )
 
 
@router.get("/incidents", response_model=IncidentListResponse)
def list_incidents(
    priority: Priority | None = Query(default=None),
    status: IncidentStatus | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=4, ge=1, le=100),
) -> IncidentListResponse:
    filtered = INCIDENTS
    if priority is not None:
        filtered = [i for i in filtered if i.priority == priority]
    if status is not None:
        filtered = [i for i in filtered if i.status == status]
 
    # Most recently opened first, matching the original design's ordering.
    filtered = sorted(filtered, key=lambda i: i.opened_at, reverse=True)
 
    total = len(filtered)
    start = (page - 1) * page_size
    end = start + page_size
    page_items = [IncidentOut.from_incident(i) for i in filtered[start:end]]
 
    return IncidentListResponse(items=page_items, total=total, page=page, page_size=page_size)
 
 
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
 
    dev_app = FastAPI(title="Incident Console API (standalone dev)")
    dev_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    dev_app.include_router(router)
 
    print("Standalone dev server: http://localhost:8000/api/health")
    uvicorn.run(dev_app, host="0.0.0.0", port=8000)
 
