# Incident Console

FastAPI + React (Vite/TypeScript) port of the "Institutional Heritage" Incident
Console dashboard, generated from `code.html` / `DESIGN.md`.

## Structure

```
incident-console/
  backend/            FastAPI app
    app/
      main.py          routes: /api/incidents, /api/incidents/summary
      models.py        Pydantic schemas
      data.py          in-memory mock data (swap for a real DB later)
    requirements.txt
  frontend/            Vite + React + TypeScript + Tailwind
    src/
      api/             fetch helpers (client.ts, incidents.ts)
      components/
        layout/        Sidebar, TopNav, AppLayout (react-router Outlet)
        Icon.tsx        Material Symbols wrapper
      pages/
        incidents/      IncidentsDashboardPage, IncidentsTable, IncidentDetailModal,
                         SummaryCard, badges
        PlaceholderPage.tsx   stub for Services / Changes / Analytics / Settings
      types.ts
      utils/format.ts
    tailwind.config.js  DESIGN.md tokens (colors, spacing, type scale, radii)
```

## Running locally

**Backend**

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8000
```

**Frontend**

```bash
cd frontend
npm install
cp .env.example .env.local   # VITE_API_URL=http://localhost:8000
npm run dev
```

Then open http://localhost:5173/incidents.

## What's wired up

- `/api/incidents` — paginated, filterable (`priority`, `status`) list of
  incidents.
- `/api/incidents/summary` — the four summary-card figures (critical count,
  high count, active bridges, avg resolution time).
- `/api/incidents/{incident_number}` — a single incident's full detail
  (description, incident commander, bridge link, timeline of updates); 404s
  if the number doesn't exist. Description/commander/timeline are derived
  deterministically from the base incident in `data.build_incident_detail` —
  there's no separate "detail" data store yet.
- The dashboard page fetches list + summary on mount and whenever
  filters/page change, with loading and error states in the table.
- Clicking a row (or its "open in new" icon) opens `IncidentDetailModal`: an
  80vw × 80vh panel centered over a dimmed backdrop, animated in/out (fade +
  scale, ~200ms) via a portal into `document.body`. Closes on the backdrop
  click, the × button, or Escape.
- Sidebar routing is real (`react-router-dom`): Incidents is fully built;
  Services / Changes / Analytics / Settings are routed placeholder pages
  ready to be filled in.
- Tailwind config carries over every token from `DESIGN.md` (colors, 4px
  spacing scale, Source Serif 4 / Work Sans type scale, border radii) so any
  new page you add stays visually consistent.

## Known gap

Material Symbols and the two Google Fonts are loaded from
`fonts.googleapis.com` in `index.html`. That's fine for local dev and most
deployments, but if you're behind a network that blocks Google Fonts, the
icons will render as literal text (e.g. "add", "search") instead of glyphs —
self-host the font files in that case.

## Next steps to consider

- Swap `data.py`'s in-memory list (and `build_incident_detail`'s derived
  fields) for a real database/repository.
- Add auth (the top-nav account icon is currently a no-op).
- Build out the Services/Changes/Analytics/Settings pages.
- Make the incident detail modal deep-linkable (e.g. `?incident=INC-98214`)
  so a URL can be shared straight to one incident.
