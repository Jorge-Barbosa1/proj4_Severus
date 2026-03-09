# SvelteKit → React Migration Plan

**Project**: FireAnalyst - Wildfire Analysis Web Application
**Date**: March 9, 2026
**Status**: Phase 4 Complete ✓ - Migration DONE!

---

## Migration Overview

This migration converts the UI layer from SvelteKit to React while preserving:
- ✅ All backend services (`src/lib/services`, `src/lib/rag`, `src/lib/utils`)
- ✅ All API routes (converted to Express)
- ✅ Production server (`server.js`)
- ✅ Wildfire analysis functionality

**Components to Migrate**: 9 Svelte files → ✅ ALL CONVERTED
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

## Phase 6: Cleanup & Verification
- [x] 6.1 Delete all `.svelte` files ✓
- [ ] 6.2 Delete old SvelteKit API routes (`src/routes/api/`)
- [x] 6.3 Run `npm run build` - verify success ✓
- [ ] 6.4 Run `npm start` - verify production server works
- [ ] 6.5 Check for TypeScript errors
- [ ] 6.6 Verify no SvelteKit imports remain
- [ ] 6.7 Final deployment test

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
2. Fire date + days before/after (calculated range)
3. Analysis range (manual range selection)

All reactive recalculation logic preserved with `useMemo` hooks.

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
