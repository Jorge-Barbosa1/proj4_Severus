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

### 14. EFFIS bulk-download spike (2026-04-28) — no path to recent perimeters from this env

Goal: replace João's `effis_all` GEE asset with a public, daily-fresh source.
Time-boxed 2-3h spike. **Outcome: failed, pivot to ICNF + on-demand dNBR.**

What was tried (PT environment, public IP, no API key):

| Endpoint | Result |
|---|---|
| `data.effis.emergency.copernicus.eu/` (S3 bucket) | ✅ 200, listable. Contains CSVs of country totals, severity TIFFs, GLOBFIRE 3.3 GB zip dated 2025-03-07 (static). **No polygon perimeters.** |
| `maps.effis.emergency.copernicus.eu/` (root) | ✅ 200 in 0.3s |
| `maps.effis.emergency.copernicus.eu/effis?service=WFS&request=GetCapabilities` | ❌ 60s timeout with no bytes — backend hung, not a 403 this time |
| `ies-ows.jrc.ec.europa.eu/effis?service=WFS&request=GetCapabilities` | ✅ 200, lists `ms:ercc.ba`, `ms:ercc.ba_24hrs_point`, `ms:ercc.hs_24hrs_point` |
| `ies-ows.jrc.ec.europa.eu/effis?...DescribeFeatureType...` on `ercc.ba` | ❌ "Failed opening layer ercc.ba" |
| `ies-ows.jrc.ec.europa.eu/effis?...GetFeature...` on all 3 fire layers | ❌ `msOracleSpatialLayerOpen(): OracleSpatial error. Cannot create OCI Handlers. Connection failure.` (same as #10, still broken 8 days later) |
| `forest-fire.emergency.copernicus.eu/geoserver/{wfs,ows}` | ❌ 404 |
| `api.effis.emergency.copernicus.eu/` | ❌ 404 root, no documented paths |
| `gdacs.org/gdacsapi/api/events/geteventlist/MAP?eventlist=WF` | ✅ 200, returns GeoJSON, but **GDACS only tracks "major" events** (alert thresholds) and `eventlist=WF` filter is ignored — useless for typical PT fires |

How the JS in `forest-fire.emergency.copernicus.eu/apps/effis_current_situation/static/js/app.bundle-2.9.1.js` references the data:
- Bundle calls `https://maps.effis.emergency.copernicus.eu/effis` (the dead one) and `https://ies-ows.jrc.ec.europa.eu/effis` (Oracle-broken). I.e. the official viewer itself depends on the same broken hosts — this isn't an env-specific block, it's broken everywhere.

**Conclusion:** there is no public bulk path to recent EFFIS burned-area perimeters today. The Oracle backend has been broken since at least 2026-04-20 (lessons #10) through 2026-04-28; this is not a transient. Revisit only if (a) Copernicus restores the Oracle backend, or (b) a new endpoint surfaces in the EFFIS viewer bundle.

**Pivot decided 2026-04-28:** ICNF SNIG WFS for historical PT perimeters, on-demand Sentinel-2 dNBR vectorisation for "recent" perimeters. See todo.md Phase SO-8.

### 15. ICNF — use the modern ArcGIS MapServer, not the stale WFS (2026-04-28)

The instinctive entry point — `https://si.icnf.pt/geoserver` (advertised in `geocatalogo.icnf.pt/metadados/area_ardida.html`) — froze at 2018 and its metadata was last revised 2020-03-13. Layers `BDG:ardida_2009 … BDG:ardida_2018` plus aggregates `BDG:ardida_1990_1999` and `BDG:ardida_2000_2008`. Nothing newer.

The currently-maintained source is the ArcGIS Online item `983c4e6c4d5b4666b258a3ad5f3ea5af` ("Territórios ardidos"), backed by **`https://sigservices.icnf.pt/server/rest/services/BDG/areas_ardidas/MapServer`**. As of this writing it covers **1975 → 2025** (yearly layers from 2009 onwards plus aggregates 1975-1989, 1990-1999, 2000-2008). Last `Edit_SGIF` timestamp on the 2024 layer was 2025-02-21.

How to discover it without trial and error: query the ArcGIS portal item JSON directly — `GET https://sigservices.icnf.pt/portal/sharing/rest/content/items/{id}?f=json` returns the canonical service URL in its `url` field. Don't rely on the geocatalogo HTML — it points at the legacy WFS.

Schema differences worth knowing (between the WFS and the MapServer):
- WFS uses lowercase fields (`distrito`, `concelho`, `freguesia`, `dataalerta`).
- MapServer uses ArcGIS-style names (`PI_Distrit`, `PI_Conc`, `PI_Freg`, `DH_Inicio` as ms-epoch).
- Both expose `Cod_SGIF`/`cod_sgif` as the official fire ID.

Layer-id mapping is non-sequential (ICNF created layers out of order) — capture it once and forget it: 2025→20, 2024→19, 2023→18, 2022→17, 2021→15, 2020→0, 2019→1, 2018→2, …, 2009→11, 2000_2008→12, 1990_1999→13, 1975_1989→14.

### 16. ArcGIS MapServer 500s on dense-polygon batches — fix with `maxAllowableOffset` (2026-04-28)

Symptom: paginating ICNF layer 3 (2017) with `resultRecordCount=500` returns 200 for offsets 0, 1500, 2000, 2500 but 500 for 500 and 1000. The error from ArcGIS is the unhelpful "Error performing query operation". Smaller batches (count=100) work everywhere, suggesting a single ultra-dense polygon in the 500-1499 window pushes the response past an internal serialisation limit.

Two workable mitigations:
- `resultRecordCount=100` and accept ~5× more roundtrips.
- **Better:** add `maxAllowableOffset=0.0001` (in `outSR=4326` degrees ≈ 11 m at PT latitude). Server-side simplification both reduces payload (~60% smaller in our tests) and sidesteps the serialisation failure on dense polygons.

Default in `src/api/routes/icnf.js` is the simplification path; `?precision=full` removes it for analytical use cases that need full vertex fidelity.

**Lesson**: when an ArcGIS MapServer 500s on a specific offset window, suspect geometry density before suspecting pagination size. `maxAllowableOffset` is cheaper than splitting batches and gives smaller payloads as a bonus.

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
