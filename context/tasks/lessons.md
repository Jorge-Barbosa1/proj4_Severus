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

*Lessons will continue to be added as Phase 3+ progresses*
