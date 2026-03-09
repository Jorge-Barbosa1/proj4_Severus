# SvelteKit → React Migration Plan

**Project**: FireAnalyst - Wildfire Analysis Web Application
**Date**: March 9, 2026
**Status**: Phase 2 Complete ✓ - App is testable!

---

## Migration Overview

This migration converts the UI layer from SvelteKit to React while preserving:
- ✅ All backend services (`src/lib/services`, `src/lib/rag`, `src/lib/utils`)
- ✅ All API routes (`src/routes/api/`)
- ✅ Production server (`server.js`)
- ✅ Wildfire analysis functionality

**Components to Migrate**: 9 Svelte files
- src/routes/+page.svelte (main application page)
- src/lib/components/analyst/FireAnalyst.svelte
- src/lib/components/map/Map.svelte
- src/lib/components/map/SeverityMapper.svelte
- src/lib/components/ChatBot/ChatWidget.svelte
- src/lib/components/charts/Chart.svelte
- src/lib/components/charts/SeverityChart.svelte
- src/lib/components/tutorials/InfoDialog.svelte
- src/lib/components/RAGInitializer.svelte

---

## Phase 1: Project Setup & Configuration ✓ COMPLETE
- [x] 1.1 Remove Svelte dependencies (kit, plugins, adapters)
- [x] 1.2 Install React dependencies (react, react-dom, react-router-dom, @vitejs/plugin-react)
- [x] 1.3 Create `tsconfig.json` with React JSX configuration
- [x] 1.4 Update `vite.config.js` → `vite.config.ts` (replace svelte plugin with react)
- [x] 1.5 Update `package.json` scripts (remove svelte-kit sync)
- [x] 1.6 Create `index.html` in project root (Vite entry point)
- [x] 1.7 Move `static/` directory to `public/`
- [x] 1.8 Remove `svelte.config.js` and `jsconfig.json`

## Phase 2: Entry Points & Routing ✓ COMPLETE
- [x] 2.1 Create `src/main.tsx` (Vite entry point)
- [x] 2.2 Create `src/App.tsx` (root component with React Router)
- [x] 2.3 Create `src/pages/` directory structure
- [x] 2.4 Create placeholder Home page component
- [x] 2.5 Create component directory structure
- [x] 2.6 Test dev server - **App is running!** 🎉

## Phase 3: Component Migration (Priority Order)
- [ ] 3.1 Convert `InfoDialog.svelte` → `src/components/tutorials/InfoDialog.tsx`
- [ ] 3.2 Convert `RAGInitializer.svelte` → `src/components/RAGInitializer.tsx`
- [ ] 3.3 Convert `Chart.svelte` → `src/components/charts/Chart.tsx`
- [ ] 3.4 Convert `SeverityChart.svelte` → `src/components/charts/SeverityChart.tsx`
- [ ] 3.5 Convert `ChatWidget.svelte` → `src/components/ChatBot/ChatWidget.tsx`
- [ ] 3.6 Convert `Map.svelte` → `src/components/map/Map.tsx` (critical - Leaflet integration)
- [ ] 3.7 Convert `SeverityMapper.svelte` → `src/components/map/SeverityMapper.tsx`
- [ ] 3.8 Convert `FireAnalyst.svelte` → `src/components/analyst/FireAnalyst.tsx`
- [ ] 3.9 Convert `+page.svelte` → `src/pages/Home.tsx` (main orchestrator)

## Phase 4: State Management
- [ ] 4.1 Create React Context for global state (map state, mode selection)
- [ ] 4.2 Replace localStorage persistence with custom hooks
- [ ] 4.3 Convert reactive date calculations to useMemo hooks

## Phase 5: Integration & Testing
- [ ] 5.1 Verify all API endpoints are callable from React
- [ ] 5.2 Test map rendering and layer controls
- [ ] 5.3 Test chat functionality
- [ ] 5.4 Test analyst/mapper mode switching
- [ ] 5.5 Test date range calculations (3 modes)
- [ ] 5.6 Test severity analysis and charts
- [ ] 5.7 Verify tutorial dialogs work

## Phase 6: Cleanup & Verification
- [ ] 6.1 Delete all `.svelte` files
- [ ] 6.2 Delete `svelte.config.js`
- [ ] 6.3 Delete `jsconfig.json` (replaced by tsconfig.json)
- [ ] 6.4 Run `npm run build` - verify success
- [ ] 6.5 Run `npm start` - verify production build works
- [ ] 6.6 Check for TypeScript errors
- [ ] 6.7 Verify no SvelteKit imports remain

---

## Critical Technical Notes

### Map Integration (Leaflet)
- Map initialization must use `useEffect` with ref
- Preserve existing tile URLs and GEE service calls
- Keep all layer management logic intact

### Date Mode Complexity
The app has 3 date modes in mapper:
1. Pre/Post dates (fixed dates)
2. Fire date + days before/after (calculated range)
3. Analysis range (manual range selection)

Must preserve reactive recalculation logic.

### API Preservation
All routes in `src/routes/api/` are UNCHANGED:
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
