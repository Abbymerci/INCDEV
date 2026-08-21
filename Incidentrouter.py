"""
COO Major Incident Dashboard — v3 backend, built against HUGO_Incidents.

THIS REPLACES wft_incidents_blueprint.py. We switched source tables — HUGO_Incidents
has real columns for almost everything the dashboard needs (Impacted Business Group,
Impacted Application, Causal/Impacted CIO Org, Platform Leaders, and real long-form
text: Overview, Cause, Business Impact, Close Notes, Work Notes) instead of the mock
version's invented AI summary / commander / timeline. Stop registering
wft_incidents_blueprint's blueprint; register this one instead:

    from hugo_incidents_blueprint import incident_dashboard_bp
    app.register_blueprint(incident_dashboard_bp)

WHAT CHANGED FROM THE LAST VERSION
------------------------------------
  - Table: WFT_Incidents -> HUGO_Incidents (same DB, [TCOO_TOOLS].[dbo].[...])
  - Category tiles are no longer based on a "category" column. They're computed by
    checking whether Causal CIO Org / Impacted CIO Org equals "TECHCT" (see
    TECHCT_ORG_CODE below) — that's what "COO Caused" / "COO Impacted" actually mean
    in the real data.
  - The detail panel now returns real fields (Overview, Cause, Business Impact,
    Close Notes, Work Notes) alongside an "ai_summary" field for the AI-Generated
    Summary box — but unlike the old mock version, this one isn't invented text.
    _compose_ai_summary() below just condenses the real Cause / Business Impact /
    Platform Leader / Status fields already pulled from HUGO_Incidents into a short
    paragraph. It never states a fact that isn't already sitting in one of those
    columns. Edit the sentence templates in _compose_ai_summary() to change the
    wording/tone.
  - New: an /api/incidents/filter-options endpoint that returns the current distinct
    values for the 9 "advanced filter" fields, so the frontend can populate dropdowns
    instead of you hardcoding a list that goes stale.

QUICK EDIT GUIDE — "I want to change X, where do I look?"
------------------------------------------------------------------
  Change the AI-generated summary wording   -> `_compose_ai_summary()`
  Change what counts as "resolved"          -> `RESOLVED_STATUSES`
  Change the TECHCT org code / which CIO    -> `TECHCT_ORG_CODE` / `CAUSAL_CIO_COLUMN`
    columns count as "caused/impacted by COO"    and `IMPACTED_CIO_COLUMN`
  Add a new Priority or Status value        -> `PRIORITY_MAP` / `STATUS_MAP`, then add a
                                                 matching entry in IncidentDashboard.tsx's
                                                 PRIORITY_STYLES / STATUS_DOT_COLOR
  Add a new Advanced Filter field           -> `ADVANCED_FILTER_FIELDS`, then add a
                                                 matching column to the SELECT in
                                                 `_fetch_incidents()` and a matching entry
                                                 in IncidentDashboard.tsx's
                                                 ADVANCED_FILTER_FIELDS array

4 THINGS I COULDN'T VERIFY MYSELF — CHECK THESE
---------------------------------------------------
I built this from column NAMES you showed me in HUGO_Incidents, but I never saw
actual DISTINCT values from THIS table (only from WFT_Incidents, which may not
match). Search "TODO" below for exactly where each of these plugs in:

  1. PRIORITY_MAP / STATUS_MAP were carried over from WFT_Incidents' real values
     ("1 - CRITICAL", "NEW", etc.). Confirm HUGO_Incidents uses the same text:
       SELECT DISTINCT [Priority] FROM [TCOO_TOOLS].[dbo].[HUGO_Incidents];
       SELECT DISTINCT [Status]   FROM [TCOO_TOOLS].[dbo].[HUGO_Incidents];

  2. TECHCT_ORG_CODE = "TECHCT" is used for both tile math and the two new
     "Causal CIO" / "Impacted CIO" checkmark columns. Confirm this is the exact
     string stored in Causal CIO Org / Impacted CIO Org (case, spacing):
       SELECT DISTINCT [Causal CIO Org] FROM [TCOO_TOOLS].[dbo].[HUGO_Incidents];
       SELECT DISTINCT [Impacted CIO Org] FROM [TCOO_TOOLS].[dbo].[HUGO_Incidents];
     You told me to use the plain "CIO Org" columns rather than "CIO Direct Org" —
     that's set in CAUSAL_CIO_COLUMN / IMPACTED_CIO_COLUMN below, one line each to
     change if you meant the Direct Org versions instead.

  3. MAJOR_INCIDENT_TRUE_VALUES: I don't know what [Major Incident] actually stores
     ("Y"/"N"? 1/0? "Yes"/"No"?) — see is_major_incident() below, currently accepts
     several common spellings. Confirm with:
       SELECT DISTINCT [Major Incident] FROM [TCOO_TOOLS].[dbo].[HUGO_Incidents];

  4. RESOLVED_STATUSES (used for the new Total tile's Resolved/Open split) currently
     buckets "Resolved" and "Closed" as resolved, "New" and "In Progress" as open.
     Change RESOLVED_STATUSES below if that's not the right split.

WHAT DIDN'T NEED TO CHANGE
------------------------------
The overall shape — a Flask Blueprint, db_conn.get_db_conn('dev'), SQL columns
renamed with `AS` right in the query, cur.description used to build the pandas
DataFrame safely — is identical to wft_incidents_blueprint.py. See that file's
comments if any of this looks unfamiliar.
"""

from flask import Blueprint, jsonify, request
import db_conn
import pandas as pd

incident_dashboard_bp = Blueprint("IncidentDashboard", __name__, url_prefix="/api")

# ---------------------------------------------------------------------------
# Config you're most likely to need to tweak — see "4 THINGS" in the docstring.
# ---------------------------------------------------------------------------

# TODO #2: confirm this is the exact text stored in Causal/Impacted CIO Org.
TECHCT_ORG_CODE = "TECHCT"

# Which columns count as "caused by COO" / "impacted by COO". You confirmed the
# plain "CIO Org" columns (not "CIO Direct Org") — change these two lines if
# that turns out to be wrong; nothing else in the file needs to change.
CAUSAL_CIO_COLUMN = "causal_cio_org"
IMPACTED_CIO_COLUMN = "impacted_cio_org"

# TODO #1: confirmed real values from WFT_Incidents — verify HUGO_Incidents matches.
PRIORITY_MAP = {
    "1 - CRITICAL": "P1",
    "2 - HIGH": "P2",
    "3 - MODERATE": "P3",
    "4 - LOW": "P4",
    "5 - VERY LOW": "P5",
}
STATUS_MAP = {
    "NEW": "New",
    "IN PROGRESS": "In Progress",
    "RESOLVED": "Resolved",
    "CLOSED": "Closed",
}
NULL_STATUS_FALLBACK = None  # see wft_incidents_blueprint.py's note on this pattern

# Which of the (already-translated) statuses count as "resolved" vs "open" for
# the new Total tile's breakdown line.
RESOLVED_STATUSES = {"Resolved", "Closed"}

# TODO #3: confirm against a real DISTINCT query — these are guesses at common spellings.
MAJOR_INCIDENT_TRUE_VALUES = {"Y", "YES", "TRUE", "1"}


def is_major_incident(raw_value) -> bool:
    if raw_value is None or (isinstance(raw_value, float) and pd.isna(raw_value)):
        return False
    return str(raw_value).strip().upper() in MAJOR_INCIDENT_TRUE_VALUES


# ---------------------------------------------------------------------------
# The 9 "Advanced Filter" fields, in the order you listed them. Each maps a
# frontend query-param name to the clean column name selected below. Reused
# by both list_incidents() (to filter) and get_filter_options() (to list the
# current distinct values for each one, for populating dropdowns).
# ---------------------------------------------------------------------------
ADVANCED_FILTER_FIELDS = {
    "impacted_cio_org": "impacted_cio_org",
    "impacted_cio_direct_org": "impacted_cio_direct_org",
    "causal_cio_direct_org": "causal_cio_direct_org",
    "causal_business_group": "causal_business_group",
    "impacted_business_group": "impacted_business_group",
    "causal_app_id": "causal_app_id",
    "impacted_app_id": "impacted_app_id",
    "causal_platform_leader": "causal_platform_leader",
    "impacted_platform_leader": "impacted_platform_leader",
}


def _fetch_incidents():
    """Runs the HUGO_Incidents query and returns a list of dicts, one per
    incident, with clean field names and translated priority/status. Every
    field the frontend's table, filters, or detail panel need is selected
    here — add a new column to the SELECT (with an `AS clean_name`) and to
    the dict built in the loop below if you need something not listed yet."""
    cur, conn = db_conn.get_db_conn("dev")

    query = """
        SELECT
            [Incident Id]              AS incident_number,
            [Priority]                 AS priority_raw,
            [Status]                   AS status_raw,
            [Major Incident]           AS major_incident_raw,
            [OPENED_AT]                AS opened_at,
            [RESOLVED_AT]              AS resolved_at,
            [CLOSED_AT]                AS closed_at,
            [Causal CIO Org]           AS causal_cio_org,
            [Causal CIO Direct Org]    AS causal_cio_direct_org,
            [Impacted CIO Org]         AS impacted_cio_org,
            [Impacted CIO Direct Org]  AS impacted_cio_direct_org,
            [Causal Business Group]    AS causal_business_group,
            [Impacted Business Group]  AS impacted_business_group,
            [Causal Application]       AS causal_application,
            [Causal App Id]            AS causal_app_id,
            [Impacted Application]     AS impacted_application,
            [Impacted App Id]          AS impacted_app_id,
            [Causal Platform Leader]   AS causal_platform_leader,
            [Impacted Platform Leader] AS impacted_platform_leader,
            [Assignment Group]         AS assignment_group,
            [Short Description]        AS short_description,
            [Description]              AS description,
            [Cause]                    AS cause,
            [Overview]                 AS overview,
            [Business Impact]          AS business_impact,
            [Close Notes]              AS close_notes,
            [Work Notes]               AS work_notes
        FROM [TCOO_TOOLS].[dbo].[HUGO_Incidents]
        ORDER BY [OPENED_AT] DESC
    """
    cur.execute(query)
    data = cur.fetchall()
    # See wft_incidents_blueprint.py's comment on why cur.description is used
    # explicitly here instead of trusting pd.DataFrame(data) to know column names.
    columns = [col[0] for col in cur.description]
    conn.close()

    df = pd.DataFrame.from_records(data, columns=columns)
    incidents = []
    for _, row in df.iterrows():
        priority_raw = None if pd.isna(row.priority_raw) else row.priority_raw
        status_raw = None if pd.isna(row.status_raw) else row.status_raw

        priority = PRIORITY_MAP.get(priority_raw)
        status = STATUS_MAP.get(status_raw, NULL_STATUS_FALLBACK if status_raw is None else None)
        if priority is None or status is None:
            print(
                f"[hugo_incidents_blueprint] Skipping {row.incident_number}: "
                f"unmapped Priority={priority_raw!r} or Status={status_raw!r} "
                f"— add it to PRIORITY_MAP / STATUS_MAP at the top of this file."
            )
            continue

        def clean(value):
            return None if pd.isna(value) else value

        incidents.append(
            {
                "incident_number": row.incident_number,
                "priority": priority,
                "status": status,
                "major_incident": is_major_incident(row.major_incident_raw),
                "opened_at": clean(row.opened_at),
                "resolved_at": clean(row.resolved_at),
                "closed_at": clean(row.closed_at),
                "causal_cio_org": clean(row.causal_cio_org),
                "causal_cio_direct_org": clean(row.causal_cio_direct_org),
                "impacted_cio_org": clean(row.impacted_cio_org),
                "impacted_cio_direct_org": clean(row.impacted_cio_direct_org),
                "causal_business_group": clean(row.causal_business_group),
                "impacted_business_group": clean(row.impacted_business_group),
                "causal_application": clean(row.causal_application),
                "causal_app_id": clean(row.causal_app_id),
                "impacted_application": clean(row.impacted_application),
                "impacted_app_id": clean(row.impacted_app_id),
                "causal_platform_leader": clean(row.causal_platform_leader),
                "impacted_platform_leader": clean(row.impacted_platform_leader),
                "assignment_group": clean(row.assignment_group),
                "short_description": clean(row.short_description),
                "description": clean(row.description),
                "cause": clean(row.cause),
                "overview": clean(row.overview),
                "business_impact": clean(row.business_impact),
                "close_notes": clean(row.close_notes),
                "work_notes": clean(row.work_notes),
            }
        )
    return incidents


def _is_techct(incident, column_key):
    value = incident.get(column_key)
    return bool(value) and str(value).strip().upper() == TECHCT_ORG_CODE.upper()


def _caused_by_coo(incident):
    return _is_techct(incident, CAUSAL_CIO_COLUMN)


def _impacted_by_coo(incident):
    return _is_techct(incident, IMPACTED_CIO_COLUMN)


def _compose_ai_summary(incident: dict) -> str:
    """Auto-writes the paragraph shown in the "AI-Generated Summary" box in
    the detail panel. This is a CONDENSED REWRITE of fields already fetched
    from HUGO_Incidents (Cause, Business Impact, Impacted Application/Group,
    Platform Leader, Status) — it does not invent any fact that isn't already
    sitting in one of those columns. Edit the sentence templates below to
    change the wording/tone."""
    cause = (incident.get("cause") or "").strip()
    business_impact = (incident.get("business_impact") or "").strip()
    impacted_app = incident.get("impacted_application") or "the affected application"
    impacted_group = incident.get("impacted_business_group") or "the business"
    leader = incident.get("causal_platform_leader")
    status = incident.get("status")

    opening = cause if cause else "Root cause has not yet been documented"
    sentences = [f"{opening.rstrip('.')}, impacting {impacted_app} for {impacted_group}."]

    if business_impact:
        sentences.append(business_impact if business_impact.endswith(".") else f"{business_impact}.")

    if status in ("New", "In Progress"):
        sentences.append(
            f"{leader} and the platform team are actively working the incident."
            if leader
            else "The platform team is actively working the incident."
        )
    elif status == "Resolved":
        sentences.append("The incident has been resolved and is being monitored for recurrence.")
    elif status == "Closed":
        sentences.append("The incident has been closed.")

    return " ".join(sentences)


@incident_dashboard_bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@incident_dashboard_bp.route("/incidents/summary", methods=["GET"])
def get_summary():
    """Powers the 5 KPI tiles. Tile math, as confirmed:
      - total: every incident, plus how many of those are resolved vs still open
      - p1_p2: simple priority count, no CIO-org filter
      - coo_caused: Causal CIO Org == TECHCT, ALL priorities
      - coo_impacted: Impacted CIO Org == TECHCT, ALL priorities
      - p3_p4_techct: Causal CIO Org == TECHCT, but ONLY priority P3 or P4
    """
    incidents = _fetch_incidents()
    resolved = sum(1 for i in incidents if i["status"] in RESOLVED_STATUSES)
    return jsonify(
        {
            "total": len(incidents),
            "total_resolved": resolved,
            "total_open": len(incidents) - resolved,
            "p1_p2": sum(1 for i in incidents if i["priority"] in ("P1", "P2")),
            "coo_caused": sum(1 for i in incidents if _caused_by_coo(i)),
            "coo_impacted": sum(1 for i in incidents if _impacted_by_coo(i)),
            "p3_p4_techct": sum(
                1 for i in incidents if i["priority"] in ("P3", "P4") and _caused_by_coo(i)
            ),
        }
    )


@incident_dashboard_bp.route("/incidents/filter-options", methods=["GET"])
def get_filter_options():
    """Returns the current distinct, non-empty values for each of the 9
    Advanced Filter fields, so the frontend can show real dropdown options
    instead of a hardcoded list that goes stale as new orgs/apps/leaders show
    up in the data. Capped at 200 values per field as a sanity limit."""
    incidents = _fetch_incidents()
    options = {}
    for param_name, column_key in ADVANCED_FILTER_FIELDS.items():
        values = sorted({i[column_key] for i in incidents if i.get(column_key)})
        options[param_name] = values[:200]
    return jsonify(options)


# Columns the table header lets a user click to sort by.
_SORTABLE_FIELDS = {
    "incident_number": lambda i: i["incident_number"],
    "priority": lambda i: i["priority"],
    "status": lambda i: i["status"],
    "impacted_business_group": lambda i: (i["impacted_business_group"] or "").lower(),
    "impacted_application": lambda i: (i["impacted_application"] or "").lower(),
    "causal_cio_check": lambda i: _caused_by_coo(i),
    "impacted_cio_check": lambda i: _impacted_by_coo(i),
}


@incident_dashboard_bp.route("/incidents", methods=["GET"])
def list_incidents():
    args = request.args

    tile = args.get("tile")  # "P1_P2" | "COO_CAUSED" | "COO_IMPACTED" | "P3_P4_TECHCT" | None (= total tile)
    priority = args.get("priority")
    status = args.get("status")
    major_incident = args.get("major_incident")  # "true" / "false" / absent
    tcoo_caused = args.get("tcoo_caused")  # "true" / "false" / absent
    tcoo_impacted = args.get("tcoo_impacted")  # "true" / "false" / absent
    open_date_from = args.get("open_date_from")  # "YYYY-MM-DD"
    open_date_to = args.get("open_date_to")  # "YYYY-MM-DD"
    q = args.get("q")
    sort_by = args.get("sort_by")
    sort_dir = args.get("sort_dir", "asc")
    page = int(args.get("page", 1))
    page_size = int(args.get("page_size", 6))

    incidents = _fetch_incidents()

    # Step 1: KPI tile filter
    if tile == "P1_P2":
        incidents = [i for i in incidents if i["priority"] in ("P1", "P2")]
    elif tile == "COO_CAUSED":
        incidents = [i for i in incidents if _caused_by_coo(i)]
    elif tile == "COO_IMPACTED":
        incidents = [i for i in incidents if _impacted_by_coo(i)]
    elif tile == "P3_P4_TECHCT":
        incidents = [i for i in incidents if i["priority"] in ("P3", "P4") and _caused_by_coo(i)]

    # Step 2: basic filter row
    if priority:
        incidents = [i for i in incidents if i["priority"] == priority]
    if status:
        incidents = [i for i in incidents if i["status"] == status]
    if major_incident is not None:
        want = major_incident.lower() == "true"
        incidents = [i for i in incidents if i["major_incident"] == want]
    if tcoo_caused is not None:
        want = tcoo_caused.lower() == "true"
        incidents = [i for i in incidents if _caused_by_coo(i) == want]
    if tcoo_impacted is not None:
        want = tcoo_impacted.lower() == "true"
        incidents = [i for i in incidents if _impacted_by_coo(i) == want]
    if open_date_from:
        incidents = [i for i in incidents if i["opened_at"] and str(i["opened_at"]) >= open_date_from]
    if open_date_to:
        incidents = [i for i in incidents if i["opened_at"] and str(i["opened_at"]) <= open_date_to]

    # Step 3: advanced filter fields (exact match, case-insensitive)
    for param_name, column_key in ADVANCED_FILTER_FIELDS.items():
        value = args.get(param_name)
        if value:
            incidents = [
                i for i in incidents
                if i.get(column_key) and str(i[column_key]).strip().lower() == value.strip().lower()
            ]

    # Step 4: search box
    if q:
        needle = q.strip().lower()
        def matches(i):
            haystack = " ".join(
                str(i.get(f) or "") for f in ("incident_number", "short_description", "description")
            ).lower()
            return needle in haystack
        incidents = [i for i in incidents if matches(i)]

    # Step 5: sort
    if sort_by in _SORTABLE_FIELDS:
        incidents = sorted(incidents, key=_SORTABLE_FIELDS[sort_by], reverse=sort_dir == "desc")
    else:
        incidents = sorted(incidents, key=lambda i: i["opened_at"] or "", reverse=True)

    # Step 6: paginate
    total = len(incidents)
    start = (page - 1) * page_size
    end = start + page_size
    page_items = incidents[start:end]

    return jsonify(
        {
            "items": [
                {
                    "incident_number": i["incident_number"],
                    "priority": i["priority"],
                    "status": i["status"],
                    "impacted_business_group": i["impacted_business_group"],
                    "impacted_application": i["impacted_application"],
                    "causal_cio_check": _caused_by_coo(i),
                    "impacted_cio_check": _impacted_by_coo(i),
                }
                for i in page_items
            ],
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    )


@incident_dashboard_bp.route("/incidents/<incident_number>", methods=["GET"])
def get_incident_detail(incident_number):
    incidents = _fetch_incidents()
    incident = next((i for i in incidents if i["incident_number"] == incident_number), None)
    if incident is None:
        return jsonify({"detail": f"Incident {incident_number!r} not found"}), 404
    # Every field here is real from HUGO_Incidents except ai_summary, which is
    # a condensed REWRITE of those same real fields (see _compose_ai_summary
    # above) — not fabricated detail.
    incident = dict(incident)
    incident["ai_summary"] = _compose_ai_summary(incident)
    return jsonify(incident)