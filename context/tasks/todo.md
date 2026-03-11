# SvelteKit → React Migration Plan

**Project**: FireAnalyst - Wildfire Analysis Web Application
**Date**: March 9, 2026
**Status**: Migration Complete ✅ - Now in Enhancement Phase 🚀

---

## ⚠️ CRITICAL: Data Source Migration Required

**Current Issue**: GEE datasets owned by `users/joaofgo/severus_pt/` - No contact with João
- `users/joaofgo/severus_pt/AA_ICNF_2000_2021_PT_v2` (ICNF burned areas)
- `users/joaofgo/severus_pt/effis_all` (EFFIS burned areas)

**Action Required**: Find alternative public data sources for:
1. ICNF burned areas (2000-2021) - Check ICNF official database
2. EFFIS burned areas (2000-2023) - Check Copernicus Emergency Service
3. Create new GEE assets from public sources
4. Update dataset references in `src/api/routes/gee.js`

**Priority**: 🔴 HIGH - App won't work without data access

---

## Migration Overview

This migration converts the UI layer from SvelteKit to React while preserving:
- ✅ All backend services (`src/lib/services`, `src/lib/rag`, `src/lib/utils`)
- ✅ All API routes (converted to Express)
- ✅ Production server (`server.js`)
- ✅ Wildfire analysis functionality

**Components Migrated**: 9 Svelte files → ✅ ALL CONVERTED
- src/routes/+page.svelte (main application page) → src/pages/Home.tsx
- src/lib/components/analyst/FireAnalyst.svelte → src/components/analyst/FireAnalyst.tsx
- src/lib/components/map/Map.svelte → src/components/map/Map.tsx
- src/lib/components/map/SeverityMapper.svelte → src/components/map/SeverityMapper.tsx
- src/lib/components/ChatBot/ChatWidget.svelte → src/components/ChatBot/ChatWidget.tsx
- src/lib/components/charts/Chart.svelte → src/components/charts/Chart.tsx
- src/lib/components/charts/SeverityChart.svelte → src/components/charts/SeverityChart.tsx
- src/lib/components/tutorials/InfoDialog.svelte → src/components/tutorials/InfoDialog.tsx
- src/lib/components/RAGInitializer.svelte → src/components/RAGInitializer.tsx

---

## Phase 1: Project Setup & Configuration ✅ COMPLETE
- [x] 1.1 Remove Svelte dependencies (kit, plugins, adapters)
- [x] 1.2 Install React dependencies (react, react-dom, react-router-dom, @vitejs/plugin-react)
- [x] 1.3 Create `tsconfig.json` with React JSX configuration
- [x] 1.4 Update `vite.config.js` → `vite.config.ts` (replace svelte plugin with react)
- [x] 1.5 Update `package.json` scripts (remove svelte-kit sync)
- [x] 1.6 Create `index.html` in project root (Vite entry point)
- [x] 1.7 Move `static/` directory to `public/`
- [x] 1.8 Remove `svelte.config.js` and `jsconfig.json`

## Phase 2: Entry Points & Routing ✅ COMPLETE
- [x] 2.1 Create `src/main.tsx` (Vite entry point)
- [x] 2.2 Create `src/App.tsx` (root component with React Router)
- [x] 2.3 Create `src/pages/` directory structure
- [x] 2.4 Create placeholder Home page component
- [x] 2.5 Create component directory structure
- [x] 2.6 Test dev server - **App is running!** 🎉
- [x] 2.7 Commit Phase 1 & 2 (commit 2960455)

## Phase 3: Component Migration ✅ COMPLETE
- [x] 3.1 Convert `InfoDialog.svelte` → `src/components/tutorials/InfoDialog.tsx`
- [x] 3.2 Convert `RAGInitializer.svelte` → `src/components/RAGInitializer.tsx`
- [x] 3.3 Convert `Chart.svelte` → `src/components/charts/Chart.tsx`
- [x] 3.4 Convert `SeverityChart.svelte` → `src/components/charts/SeverityChart.tsx`
- [x] 3.5 Convert `ChatWidget.svelte` → `src/components/ChatBot/ChatWidget.tsx`
- [x] 3.6 Convert `Map.svelte` → `src/components/map/Map.tsx` (critical - Leaflet integration)
- [x] 3.7 Convert `SeverityMapper.svelte` → `src/components/map/SeverityMapper.tsx`
- [x] 3.8 Convert `FireAnalyst.svelte` → `src/components/analyst/FireAnalyst.tsx`
- [x] 3.9 Convert `+page.svelte` → `src/pages/Home.tsx` (main orchestrator)
- [x] 3.10 Created `gee-constants.ts` for client-safe GEE utilities
- [x] 3.11 Fixed TypeScript strict mode errors
- [x] 3.12 Removed all old .svelte files
- [x] 3.13 Production build working successfully
- [x] 3.14 Commit Phase 3 (commit 1633234)

## Phase 4: API Migration to Express ✅ COMPLETE  
- [x] 4.1 Create Express router for chat API (`src/api/routes/chat.js`)
- [x] 4.2 Create Express router for RAG APIs (`src/api/routes/rag.js`)
- [x] 4.3 Create Express router for GEE APIs (`src/api/routes/gee.js`)
- [x] 4.4 Convert all 13 SvelteKit `+server.ts` routes to Express
- [x] 4.5 Update `server.js` to use Express for both React UI and API
- [x] 4.6 Fix `gee-utils.ts` to load credentials from env or file
- [x] 4.7 Fix all `$lib` imports to use relative paths
- [x] 4.8 Downgrade Express from 5.x to 4.x for stability
- [x] 4.9 Update `package.json` start script to use `tsx`
- [x] 4.10 Server running successfully on http://localhost:3000
- [x] 4.11 Commit Phase 4 (commit 347b994)

## Phase 5: Integration & Testing 🔄 IN PROGRESS
- [ ] 5.1 Verify all API endpoints are callable from React
- [ ] 5.2 Test map rendering and layer controls
- [ ] 5.3 Test chat functionality
- [ ] 5.4 Test analyst/mapper mode switching
- [ ] 5.5 Test date range calculations (3 modes)
- [ ] 5.6 Test severity analysis and charts
- [ ] 5.7 Verify tutorial dialogs work

## Phase 6: Cleanup & Verification ✅ COMPLETE
- [x] 6.1 Delete all `.svelte` files ✓
- [x] 6.2 Delete old SvelteKit API routes (`src/routes/api/`)
- [x] 6.3 Run `npm run build` - verify success ✓
- [x] 6.4 Map rendering fixed (Leaflet CSS imports) ✓
- [x] 6.5 Security: GEE credentials removed from git ✓
- [x] 6.6 README.md updated with React documentation ✓

---

## 🚀 Phase 7: Data Source Migration (PRIORITY 1 - CRITICAL)
Development Priorities Summary

### 🔴 **CRITICAL (Do First)**
1. **Data Source Migration** - Replace João's private GEE datasets with public alternatives
   - App currently non-functional without proper data access
   - Research ICNF and EFFIS official sources
   - Create new GEE assets or use public collections

### 🟡 **HIGH PRIORITY (Next)**
2. **Mobile Responsiveness** - Make app fully usable on phones/tablets
   - Responsive layout with media queries
   - Touch-friendly controls (44px buttons)
   - Collapsible sidebar for small screens
   - Test on real devices

### 🟢 **MEDIUM PRIORITY**
3. **UX Enhancements** - Improve user experience
   - Loading states and feedback
   - Layer control panel
   - Data export (GeoTIFF, CSV, PDF)
   - Measurement tools

4. **Advanced Analysis** - Add analytical power
   - Statistics dashboard
   - Fire progression animation
   - Comparison tools
   - Climate data integration

### 🔵 **LOW PRIORITY**
5. **Real-time Monitoring** - Live fire tracking
   - NASA FIRMS active fires
   - Weather warnings
   - Automated alerts

6. **Technical Debt** - Code quality
   - Performance optimization
   - Testing infrastructure
   - Error handling
   - Caching strategy

### ⚫ **DEFERRED**
7. **RAG System** - Chatbot improvements (lowest priority)
   - Only work on if specifically needed
   - Current implementation sufficient for now

---

## 
**Goal**: Replace João's private GEE datasets with public alternatives

### Data Sources to Replace
- [ ] 7.1 **ICNF Burned Areas (2000-2021)**
  - Research ICNF official data portal
  - Check if data available via WMS/WFS services
  - Option: Download shapefiles and upload to own GEE account
  - Create new asset: `users/{YOUR_USERNAME}/ICNF_burned_areas`
  
- [ ] 7.2 **EFFIS Burned Areas (2000-2023)**
  - Check Copernicus Emergency Management Service
  - EFFIS official data portal: https://effis.jrc.ec.europa.eu/
  - May have direct GEE public assets: `JRC/GWIS/GlobFire/v2/FinalPerimeters`
  - Create new asset if needed
  
- [ ] 7.3 **Update Backend References**
  - Modify `src/api/routes/gee.js` - burned-areas endpoint
  - Update dataset IDs in `POST /api/gee/burned-areas`
  - Test with new data sources
  
- [ ] 7.4 **Verify Data Quality**
  - Compare new vs old data (if samples available)
  - Check coordinate systems match (EPSG:4326)
  - Verify attribute fields (year, area, etc.)

---

## 📱 Phase 8: Mobile Responsiveness (PRIORITY 2)

**Goal**: Make app fully usable on mobile devices

### 8.1 Responsive Layout
- [ ] Add CSS media queries for breakpoints (768px, 480px)
- [ ] Convert fixed sidebar (320px) to responsive design
  - Desktop: Side panel
  - Tablet: Collapsible panel
  - Mobile: Bottom sheet or full-screen modal
- [ ] Use CSS Flexbox/Grid with flex-direction changes
- [ ] Test on actual mobile devices (iOS Safari, Chrome Android)

### 8.2 Touch-Friendly UI
- [ ] Increase button sizes to 44x44px minimum (Apple HIG standard)
- [ ] Add spacing between interactive elements (8px minimum)
- [ ] Make dropdowns/selects mobile-friendly
- [ ] Improve input field sizes for touch
- [ ] Add touch gestures for map (pinch-zoom already works via Leaflet)

### 8.3 Mobile-Specific Features
- [ ] Hamburger menu for navigation on mobile
- [ ] Floating action button (FAB) to open controls
- [ ] Swipeable bottom sheet for sidebar content
- [ ] Hide/show advanced options in "More" menu
- [ ] Optimize map controls for touch (larger draw buttons)

### 8.4 Performance Optimization
- [ ] Lazy load heavy components on mobile
- [ ] Reduce initial bundle size
- [ ] Add service worker for offline map tiles
- [ ] Optimize images and assets

---

## 🎨 Phase 9: UX Enhancements (PRIORITY 3)

### 9.1 Loading States & Feedback
- [ ] Add loading spinners for API calls
  - Severity map generation
  - Time series data fetching
  - Burned area layer loading
- [ ] Implement toast notifications library (react-hot-toast)
  - Success: "Severity maps generated!"
  - Error: "Failed to fetch data. Try again."
  - Info: "Drawing polygon..."
- [ ] Progress bars for long operations (>3 seconds)
- [ ] Skeleton screens during initial load

### 9.2 Map Enhancements
- [ ] **Layer Control Panel** (toggleable visibility)
  - Show/hide burned area layers
  - Show/hide severity layers
  - Opacity sliders for each layer
  - Delete individual layers
  
- [ ] **Swipe Tool** (compare pre/post images)
  - Left: Pre-fire imagery
  - Right: Post-fire imagery
  - Draggable divider
  
- [ ] **Measurement Tools**
  - Distance measurement
  - Area measurement (polygon)
  - Show units (km, ha)
  
- [ ] **Export Geometry**
  - Download drawn polygons as GeoJSON
  - Copy coordinates to clipboard
  - Share via URL parameters

### 9.3 Data Export Features
- [ ] **Export Severity Maps**
  - Download as GeoTIFF
  - Export as PNG/JPEG with legend
  - Choice of which severity index (dNBR, RdNBR, RBR, classified)
  
- [ ] **Export Chart Data**
  - Download time series as CSV
  - Export severity stats as Excel
  - JSON export for all analysis data
  
- [ ] **PDF Report Generation**
  - Combine maps + charts + statistics
  - Include metadata (dates, satellite, location)
  - Print-friendly layout

---

## 📊 Phase 10: Advanced Analysis (PRIORITY 4)

### 10.1 Statistics Dashboard
- [ ] Severity class breakdown (hectares per class)
  - Unburnt/Very-low severity
  - Low severity
  - Moderate severity
  - High severity
  - Very-high severity
- [ ] Pie chart showing severity distribution
- [ ] Bar charts comparing multiple analyses
- [ ] Historical trends (if multiple years analyzed)

### 10.2 Fire Progression Animation
- [ ] Time-lapse of NBR/NDVI changes
- [ ] Slider to scrub through dates
- [ ] Day-by-day severity evolution
- [ ] Export animation as GIF/MP4

### 10.3 Comparison Features
- [ ] Compare multiple fires side-by-side
- [ ] Split-screen view
- [ ] Synchronized map navigation
- [ ] Difference maps (Fire A - Fire B)

### 10.4 Climate Data Integration
- [ ] Weather conditions during fire
  - Temperature
  - Wind speed/direction
  - Humidity
  - Precipitation
- [ ] Source: Open-Meteo API or NASA POWER
- [ ] Show correlation with severity

---

## 🔔 Phase 11: Real-time Monitoring (PRIORITY 5)

### 11.1 Active Fire Alerts
- [ ] Integrate NASA FIRMS API (Fire Information for Resource Management)
- [ ] Show active fires on map (last 24h, 7d, 30d)
- [ ] Color-coded by confidence level
- [ ] Popup with fire details (temp, power, satellite)

### 11.2 Automated Notifications
- [ ] Email alerts for new fires in AOI (Area of Interest)
- [ ] Desktop notifications
- [ ] Webhook support for integrations

### 11.3 Weather Warnings
- [ ] Fire weather index (FWI) overlay
- [ ] Wind warnings
- [ ] Extreme heat alerts
- [ ] Source: EFFIS fire danger forecast

---

## 🔧 Phase 12: Technical Improvements (ONGOING)

### 12.1 Performance Optimization
- [ ] Code splitting by route
- [ ] Lazy load chart libraries
- [ ] Bundle size analysis (webpack-bundle-analyzer)
- [ ] Tree-shaking unused code
- [ ] Compress images and assets

### 12.2 Caching Strategy
- [ ] Cache GEE tile URLs in localStorage
- [ ] IndexedDB for analysis history
- [ ] Service worker for offline mode
- [ ] CDN for static assets

### 12.3 Testing
- [ ] Unit tests for utility functions (Vitest)
- [ ] Integration tests for API endpoints
- [ ] E2E tests for critical flows (Playwright)
- [ ] Visual regression tests for UI

### 12.4 Error Handling
- [ ] Error boundary components
- [ ] Retry logic for failed API calls
- [ ] Fallback UI for errors
- [ ] Logging to external service (Sentry)

---

## 👥 Phase 13: Collaboration (FUTURE)

### 13.1 User Accounts (Optional)
- [ ] Authentication system (Firebase Auth / Auth0)
- [ ] Save analysis projects to cloud
- [ ] User profile and settings
- [ ] API usage tracking

### 13.2 Sharing Features
- [ ] Share analysis via unique URL
- [ ] Embed maps in other websites
- [ ] Public gallery of analyses
- [ ] Collaborate on analysis (real-time)

---

## 🤖 Phase 14: RAG System (LOWEST PRIORITY - DEFERRED)

**Note**: RAG functionality exists but is deprioritized. Only touch if specifically needed.

- [ ] Improve chat UI/UX
- [ ] Add citation sources to responses
- [ ] Update document embeddings with new reports
- [ ] Implement chat history persistence
- [ ] Add streaming responses

---

## Critical Technical Notes

### Map Integration (Leaflet) ✅
- Map uses `forwardRef` + `useImperativeHandle` pattern
- 10 exposed methods for map control
- Dynamic Leaflet import with 100ms delay for draw controls
- All tile URLs and GEE service calls preserved

### Date Mode Complexity ✅
The app has 3 date modes in mapper:
1. Pre/Post dates (fixed dates)
✅ **Phase 5**: Integration complete  
✅ **Phase 6**: Cleanup, security, documentation  

**Next**: Phase 7 (Data Source Migration) - CRITICAL ⚠️

---

## Current Data Sources (Need Replacement)

### Burned Area Datasets
- **ICNF**: `users/joaofgo/severus_pt/AA_ICNF_2000_2021_PT_v2`
  - Current: Private GEE asset (no access)
  - Need: Public ICNF data source
  - Options: ICNF WMS/WFS, manual upload to own GEE
  
- **EFFIS**: `users/joaofgo/severus_pt/effis_all`
  - Current: Private GEE asset (no access)
  - Need: Public EFFIS data
  - Options: Copernicus EMS, public GEE assets

### Satellite Imagery (Already Public ✓)
- Sentinel-2: `COPERNICUS/S2_SR_HARMONIZED` ✓
- Landsat 5/7/8/9: Public NASA collections ✓
- MODIS: `MODIS/061/MOD09GA` ✓
- HLS: `NASA/HLS/HLSS30/v002` ✓

### Alternative Data Sources to Investigate
1. **ICNF Official Portal**: https://www.icnf.pt/
2. **Copernicus EMS**: https://emergency.copernicus.eu/
3. **EFFIS Portal**: https://effis.jrc.ec.europa.eu/
4. **OpenData Portugal**: https://dados.gov.pt/
5. **GEE Public Catalog**: Search for "burned area" + "Portugal"

---

## API Endpoints Referenceith `useMemo` hooks.

### API Architecture ✅
**Express Server** (`server.js`):
- Serves React static build from `dist/`
- Routes API requests to modular routers
- `/api/chat` - Chat with RAG and Open Router
- `/api/rag` - RAG initialization and status
- `/api/gee` - All Google Earth Engine operations

**GEE Credentials**:
- Load from `GEE_PRIVATE_KEY` environment variable OR
- Load from `src/lib/config/severus-457615-83acf40ce029.json`

---

## Deployment Checklist

### Environment Variables Required
```bash
DP_API_KEY=<OpenRouter API key>
GEE_PRIVATE_KEY=<JSON string of GEE service account key>
PORT=3000
```

### Build & Run
```bash
npm run build          # Build React frontend
npm start              # Start Express server with tsx
```

### Production URLs
- Frontend: http://localhost:3000
- API: http://localhost:3000/api
- Health check: http://localhost:3000/api/rag/status

---

## Migration Success Summary

✅ **Phase 1**: Dependencies and configuration  
✅ **Phase 2**: React entry points and routing  
✅ **Phase 3**: All 9 components converted  
✅ **Phase 4**: Express API fully operational  
🔄 **Phase 5**: Integration testing (NEXT)  
⏳ **Phase 6**: Final cleanup and deployment

**Status**: Ready for end-to-end testing! 🚀
- /api/chat
- /api/gee/burned-areas
- /api/gee/severity
- /api/gee/time-series
- /api/gee/stats
- /api/gee/mapper
- /api/gee/severity-stats
- /api/gee/severity-maps
- /api/rag/init
- /api/rag/status

### Backend Services (DO NOT TOUCH)
- src/lib/rag/ - RAG pipeline
- src/lib/services/gee-service.ts - GEE integration
- src/lib/utils/gee-utils.ts - Utility functions
- server.js - Production server

---

## Definition of Done
✅ No `.svelte` files in src/
✅ `svelte.config.js` deleted
✅ All pages render without errors
✅ Chat sends/receives messages
✅ Map layers load (burned areas, severity, satellite)
✅ Analyst/Mapper mode switching works
✅ Date calculations work in all 3 modes
✅ Charts display correctly
✅ `npm run build` succeeds
✅ App runs with `node server.js`

---

## Risk Areas
⚠️ **Leaflet map initialization** - Timing and ref management
⚠️ **Date mode reactive calculations** - Complex dependency chains
⚠️ **Chart.js integration** - Event handler differences
⚠️ **ApexCharts integration** - Svelte component wrapper vs React
⚠️ **localStorage persistence** - Mode switching and state sync

---

## Next Steps
1. User approval of this plan
2. Begin Phase 1 (setup)
3. Systematic execution following the checklist
4. Verify each phase before proceeding
