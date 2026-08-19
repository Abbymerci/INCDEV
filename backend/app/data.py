"""In-memory mock incident data.

Opened timestamps are generated relative to server start time so that
`duration_minutes` (computed on the fly) stays realistic across requests.
Replace this module with a real database-backed repository later.
"""

from datetime import datetime, timedelta

from .models import Incident, IncidentDetail, IncidentOut, IncidentStatus, Priority, TimelineEntry

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
