# Migration Lessons Learned

This file tracks patterns, corrections, and learnings during the SvelteKit → React migration.

---

## Pre-Migration Lessons

### 1. Planning Phase
- ✅ Created comprehensive migration plan before touching code
- ✅ Identified all Svelte files that need conversion
- ✅ Documented risk areas upfront

---

## Phase 1 & 2 Lessons (March 9, 2026)

### 2. File Conflicts
- **Issue**: Empty `src/app.ts` from SvelteKit caused white screen - conflicted with `App.tsx`
- **Solution**: Remove old SvelteKit files (`app.ts`, `app.html`) immediately after creating React structure
- **Lesson**: When migrating, clean up old framework files proactively to avoid naming conflicts

### 3. Import Specificity
- **Issue**: `import App from './App'` was ambiguous with both `app.ts` and `App.tsx` present
- **Solution**: Use explicit extension: `import App from './App.tsx'`
- **Lesson**: Use explicit `.tsx` extensions during migration until old files are removed

### 4. Commit Early
- Successfully committed Phase 1 & 2 with testable React app (commit 2960455)
- **Lesson**: Commit after each phase completion to create rollback points

---

## Satellite-Only Branch Lessons (March 14, 2026)

### 5. Environment Variables Must Be Explicitly Loaded
- **Issue**: FIRMS key was in `.env` but API still reported `FIRMS_MAP_KEY is not configured`
- **Solution**: Load dotenv at server startup (`import 'dotenv/config'`)
- **Lesson**: Always verify runtime env loading before diagnosing API integration failures

### 6. Keep Legacy Data Controls Optional
- **Issue**: Old burned-area controls were still presented as primary flow, causing confusion in satellite-only mode
- **Solution**: Move legacy burned-area inputs to an optional advanced section
- **Lesson**: In progressive migrations, hide legacy dependencies behind optional controls and keep the new flow primary

### 7. Always Update Tracking Docs at Milestones
- **Issue**: Progress can drift if code changes are not reflected in planning docs
- **Solution**: Update `todo.md` and `lessons.md` in the same cycle as implementation and commit
- **Lesson**: Treat docs as part of the deliverable, not as an afterthought

---

---

## Public Data Source Integration (April 20, 2026)

### 8. GlobFire `FinalPerimeters` on GEE has degenerate geometries
- **Issue**: `JRC/GWIS/GlobFire/v2/FinalPerimeters` filter+`getInfo()` returns every feature with a
  global-bbox Polygon `[[-180,-90],[180,-90],[180,90],[-180,90],[-180,-90]]`. Properties (Id, IDate, FDate)
  are intact, but the fire outlines themselves are lost.
- **Solution**: use the per-year tables `JRC/GWIS/GlobFire/v2/DailyPerimeters/YYYY` and merge them
  across the requested year range. Those tables store real fire polygons.
- **Lesson**: before committing to a GEE table asset, query one feature and inspect `.geometry.coordinates` —
  don't trust the catalog description alone. Client-visible geometry can be stripped server-side.

### 9. fogos.pt returns a plain JSON envelope, not GeoJSON
- **Issue**: `api.fogos.pt/new/fires` responds with `{ success, data: [{ lat, lng, ... }] }`, not a
  FeatureCollection. Clients that expected GeoJSON failed silently.
- **Solution**: proxy router converts each item to `Feature { geometry: Point([lng, lat]), properties }`
  and filters by `statusCode` (active) and `naturezaCode` (3101/3102/3103 for wildfires; 3109 = fuel
  management, 3107 = false alarm rural, both excluded by default).
- **Lesson**: never assume third-party "fires API" means GeoJSON. Normalise at the edge so the map
  layer code stays consistent across sources.

### 10. EFFIS public WFS can 403 without warning
- **Issue**: `maps.effis.emergency.copernicus.eu/effis?service=WFS&request=GetFeature` returns 403 from
  this environment even with a browser-like `User-Agent`.
- **Current state**: route kept defensive — honours `EFFIS_WFS_URL` and `EFFIS_BA_LAYER` envs, tries
  both `FIREDATE` and `FIRE_DATE` schemas before erroring out.
- **Lesson**: for INSPIRE/Copernicus services, treat 403 as "this deployment may need registration or an
  allow-listed egress". Document the override knobs so the next person doesn't have to re-diagnose.

### 11. tsx doesn't hot-reload server routes in this setup
- **Issue**: editing `src/api/routes/*.js` while `npm start` is running produced stale responses
  (cached `mode=final` default even after changing the code).
- **Solution**: kill the node process on port 3000 and restart `npm start` after every route edit.
- **Lesson**: don't trust tsx to reload the Express server; confirm edits with a deliberate restart
  before spending time "debugging" apparent bugs.

### 12. Don't ship a mirror without checking its version timestamp
- **Issue**: `JRC/GWIS/GlobFire/v2/...` on GEE is described in the catalog as "daily fire perimeters
  based on MCD64A1", which reads as actively maintained. In reality the asset's
  `system:asset_size` version timestamp is 2022-03-18 — the mirror has been frozen for ~4 years.
  JRC continues publishing GlobFire via GWIS shapefiles, but the GEE copy stopped.
- **Solution**: probe `FeatureCollection(assetId).limit(1).first().getInfo()` and also the
  per-year `.../DailyPerimeters/YYYY` table for recent years before committing to an asset.
  Print `system:time_start` (image collections) or version timestamp (tables).
- **Lesson**: GEE catalog descriptions describe intent, not current reality. Always verify
  the latest available date of any "near real-time" dataset before wiring it into a UI.

### 13. Prefer ImageCollection tiles over FeatureCollection polygons when the source is a raster
- **Issue**: for burned-area maps the natural instinct was to fetch polygons and render via
  `L.geoJSON()`. For `MODIS/061/MCD64A1` that would mean vectorising with `reduceToVectors()` —
  slow, expensive, and fragile.
- **Solution**: expose a GEE `getMap()` tile URL directly; Leaflet already renders tiles via the
  existing `addTileLayer` handle. No client-side GeoJSON, no vectorisation cost.
- **Lesson**: map the GEE asset type to the right transport:
  - `FeatureCollection` → `/api/.../geojson` returning `FeatureCollection` JSON
  - `ImageCollection` / `Image` → `/api/.../tiles` returning `{ tileUrl, mapid }`
  Returning `{tileUrl}` from the backend is a one-round-trip pattern and avoids shipping
  megabytes of coordinates over the wire.
