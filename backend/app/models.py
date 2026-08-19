from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


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
