# COPILOT_RULES.md — proj4_Severus Migration Guide
# Svelte/SvelteKit → React + Vite + TypeScript

---

## 0. What This Project Is

**proj4_Severus** is a wildfire analysis web application for Portugal.
It is built with SvelteKit + TypeScript + Vite and deployed on Render.

The migration goal is:
- Replace the **UI layer** (Svelte → React)
- Keep the **server and data layer** intact
- Preserve all wildfire analysis functionality

---

## 1. What Changes vs. What Stays

### ✅ Migrate (touch these)
| From | To |
|---|---|
| `.svelte` files | `.tsx` React components |
| SvelteKit file-based routing (`src/routes/`) | React Router (`src/pages/`) |
| Svelte stores | React `useState` / `useContext` |
| Svelte reactive statements (`$:`) | `useMemo` / `useEffect` |
| `svelte.config.js` | Remove entirely |
| `+page.svelte`, `+layout.svelte` | `App.tsx`, page components |

### 🚫 Do NOT touch
| File/Folder | Reason |
|---|---|
| `server.js` | Production Node server — keep as-is |
| `src/lib/rag/` | RAG pipeline — backend logic |
| `src/lib/services/` | GEE + wildfire services |
| `src/lib/utils/` | Shared utilities |
| `src/routes/api/` | API endpoints — React just calls these |
| `scripts/` | Data processing scripts |
| `test/data/` | Test datasets |
| `static/` | Static assets (copy to `public/`) |
| `.npmrc`, `.gitignore` | Config files — keep intact |

---

## 2. New Project Structure

```
proj4_Severus/
├── src/
│   ├── components/         # Reusable UI components (.tsx)
│   ├── pages/              # One file per route (.tsx)
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # UNCHANGED — backend services
│   │   ├── rag/
│   │   ├── services/
│   │   └── utils/
│   ├── App.tsx             # Root component + router
│   └── main.tsx            # Vite entry point
├── public/                 # Replaces static/ for Vite
├── server.js               # UNCHANGED
├── package.json            # Updated dependencies
├── vite.config.ts          # Updated (remove SvelteKit plugin)
├── tsconfig.json           # Updated for React JSX
└── index.html              # Vite HTML entry point
```

---

## 3. Dependency Changes

### Remove
```bash
npm remove @sveltejs/kit @sveltejs/adapter-node svelte svelte-check vite-plugin-svelte
```

### Install
```bash
npm install react react-dom react-router-dom
npm install -D @types/react @types/react-dom @vitejs/plugin-react
```

---

## 4. Config File Updates

### `vite.config.ts` — Replace SvelteKit plugin with React
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 }
});
```

### `tsconfig.json` — Enable React JSX
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["DOM", "ESNext"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

### `index.html` — Vite entry point (add to repo root)
```html
<!DOCTYPE html>
<html lang="en">
  <head><meta charset="UTF-8" /><title>SeverusPT</title></head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## 5. Routing

SvelteKit uses filesystem routing. Replace with React Router.

### SvelteKit → React Router mapping
| SvelteKit route | React page |
|---|---|
| `src/routes/+page.svelte` | `src/pages/Home.tsx` |
| `src/routes/chat/+page.svelte` | `src/pages/Chat.tsx` |
| `src/routes/map/+page.svelte` | `src/pages/Map.tsx` |
| `src/routes/+layout.svelte` | `src/components/Layout.tsx` |

### `src/App.tsx`
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Chat from './pages/Chat';
import Map from './pages/Map';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/map" element={<Map />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

---

## 6. Component Conversion Patterns

### Reactive variables
```svelte
<!-- Svelte -->
<script>
  let query = '';
  let results = [];
</script>
```
```tsx
// React
const [query, setQuery] = useState('');
const [results, setResults] = useState([]);
```

### Reactive statements
```svelte
<!-- Svelte -->
$: filteredResults = results.filter(r => r.active);
```
```tsx
// React
const filteredResults = useMemo(
  () => results.filter(r => r.active),
  [results]
);
```

### Lifecycle (onMount)
```svelte
<!-- Svelte -->
import { onMount } from 'svelte';
onMount(() => { fetchData(); });
```
```tsx
// React
useEffect(() => { fetchData(); }, []);
```

### Svelte stores
```svelte
<!-- Svelte -->
import { writable } from 'svelte/store';
export const mapState = writable({ zoom: 7 });
```
```tsx
// React — use Context or Zustand
const MapContext = createContext({ zoom: 7 });
```

### Event handlers
```svelte
<!-- Svelte -->
<button on:click={handleClick}>Submit</button>
<input bind:value={query} />
```
```tsx
// React
<button onClick={handleClick}>Submit</button>
<input value={query} onChange={e => setQuery(e.target.value)} />
```

---

## 7. API Integration

All API routes in `src/routes/api/` remain on the server unchanged.
React components call them via `fetch`.

```tsx
// Pattern for all API calls
const res = await fetch('/api/gee/burned-areas', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ region, dateRange })
});
const data = await res.json();
```

### Known API endpoints to preserve
```
/api/chat
/api/gee/burned-areas
/api/gee/severity
/api/gee/time-series
/api/gee/stats
```

---

## 8. Static Assets

Move `static/` → `public/` (Vite convention).

```bash
mv static public
```

References in components: `/image.png` stays the same — Vite serves `public/` at root.

---

## 9. Map Components

The app renders wildfire maps (burned areas, severity layers, satellite imagery).

When migrating map components:
- Keep all GEE service calls intact — they live in `src/lib/services/`
- Wrap map logic in a `useEffect` with the container ref
- Use the same tile URLs / layer configs as before

```tsx
// Pattern for map initialization in React
const mapRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!mapRef.current) return;
  const map = initMap(mapRef.current); // existing init logic
  return () => map.destroy();
}, []);

return <div ref={mapRef} style={{ height: '100vh' }} />;
```

---

## 10. Migration Order

Work in this sequence — do not skip steps:

1. **Setup** — Install deps, update `vite.config.ts`, `tsconfig.json`, add `index.html`
2. **Entry point** — Create `src/main.tsx` and `src/App.tsx`
3. **Layout** — Convert `+layout.svelte` → `src/components/Layout.tsx`
4. **Pages** — Convert each `+page.svelte` → corresponding `src/pages/*.tsx`
5. **Components** — Convert `src/lib/components/` → `src/components/`
6. **State** — Replace Svelte stores with `useState` / Context
7. **API wiring** — Verify all `fetch` calls work
8. **Map layers** — Verify GEE map features render
9. **Cleanup** — Remove all `.svelte` files, `svelte.config.js`

---

## 11. Do Not Do These Things

- ❌ Do not rewrite `server.js`
- ❌ Do not modify files inside `src/lib/rag/`, `src/lib/services/`, `src/lib/utils/`
- ❌ Do not change API route logic
- ❌ Do not add Redux — use `useState` + Context for this project size
- ❌ Do not rename API endpoints
- ❌ Do not introduce a CSS framework unless one already exists in the project
- ❌ Do not split into a separate frontend/backend repo

---

## 12. Definition of Done

A migration task is complete when:

- [ ] No `.svelte` files remain in `src/`
- [ ] `svelte.config.js` is deleted
- [ ] All pages render without errors
- [ ] Chat interface sends and receives messages
- [ ] Wildfire map layers load correctly
- [ ] Statistics / analysis views display data
- [ ] `npm run build` completes without errors
- [ ] App runs on Render with `node server.js`