from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .data import AVG_RESOLUTION_MINUTES, INCIDENTS, build_incident_detail
from .models import (
    IncidentDetail,
    IncidentListResponse,
    IncidentOut,
    IncidentStatus,
    Priority,
    SummaryResponse,
)

app = FastAPI(title="Incident Console API", version="0.1.0")

# In development the React app runs on Vite's default port (5173).
# Adjust / restrict this list before deploying anywhere near production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/incidents/summary", response_model=SummaryResponse)
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


@app.get("/api/incidents", response_model=IncidentListResponse)
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


@app.get("/api/incidents/{incident_number}", response_model=IncidentDetail)
def get_incident_detail(incident_number: str) -> IncidentDetail:
    incident = next((i for i in INCIDENTS if i.incident_number == incident_number), None)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"Incident {incident_number!r} not found")
    return build_incident_detail(incident)
