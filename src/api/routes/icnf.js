import express from 'express';

const router = express.Router();

const ICNF_BASE_URL =
  process.env.ICNF_BASE_URL ||
  'https://sigservices.icnf.pt/server/rest/services/BDG/areas_ardidas/MapServer';
const CACHE_TTL_MS = parseInt(process.env.ICNF_CACHE_TTL_MS || '86400000', 10); // 24h
const PAGE_SIZE = parseInt(process.env.ICNF_PAGE_SIZE || '500', 10);
const MAX_PAGES = 200;
// Geometry simplification tolerance in degrees (outSR=4326). 0.0001 ≈ 11m at PT latitude —
// invisible at fire-visualization zoom levels, ~60% smaller payloads, and sidesteps
// ArcGIS 500s seen on 2017 around offset 500-1499 caused by individual dense polygons.
const DEFAULT_SIMPLIFY = process.env.ICNF_SIMPLIFY_OFFSET ?? '0.0001';

// Mapping from year (or aggregate range) to the layer id exposed by the ICNF MapServer.
// Discovered via GET /MapServer?f=json — non-sequential ids reflect ICNF's own layer order.
const YEAR_TO_LAYER = {
  '1975_1989': 14,
  '1990_1999': 13,
  '2000_2008': 12,
  2009: 11,
  2010: 10,
  2011: 9,
  2012: 8,
  2013: 7,
  2014: 6,
  2015: 5,
  2016: 4,
  2017: 3,
  2018: 2,
  2019: 1,
  2020: 0,
  2021: 15,
  2022: 17,
  2023: 18,
  2024: 19,
  2025: 20,
};

const cache = new Map();

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function cacheSet(key, data, ttlMs) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

function resolveLayerId(yearParam) {
  if (yearParam == null) return null;
  const raw = String(yearParam).trim();
  if (raw in YEAR_TO_LAYER) return YEAR_TO_LAYER[raw];
  const n = Number(raw);
  if (Number.isInteger(n) && n in YEAR_TO_LAYER) return YEAR_TO_LAYER[n];
  return null;
}

async function fetchLayerPage(layerId, offset, simplifyOffset) {
  const params = new URLSearchParams({
    where: '1=1',
    outFields: '*',
    f: 'geojson',
    outSR: '4326',
    resultOffset: String(offset),
    resultRecordCount: String(PAGE_SIZE),
  });
  if (simplifyOffset) params.set('maxAllowableOffset', simplifyOffset);
  const url = `${ICNF_BASE_URL}/${layerId}/query?${params.toString()}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`ICNF query failed (${response.status}): ${body.slice(0, 300)}`);
    error.statusCode = response.status;
    throw error;
  }
  const json = await response.json();
  if (json && json.error) {
    const error = new Error(`ICNF returned error: ${json.error.message || JSON.stringify(json.error)}`);
    error.statusCode = 502;
    throw error;
  }
  return Array.isArray(json?.features) ? json.features : [];
}

async function fetchAllForLayer(layerId, simplifyOffset) {
  const features = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const batch = await fetchLayerPage(layerId, page * PAGE_SIZE, simplifyOffset);
    features.push(...batch);
    if (batch.length < PAGE_SIZE) return features;
  }
  return features;
}

function formatDate(epochMs) {
  if (epochMs == null) return null;
  const d = new Date(Number(epochMs));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function normalize(features, yearLabel) {
  return features.map((f) => {
    const p = f.properties || {};
    return {
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        source_dataset: 'ICNF/BDG',
        year: yearLabel,
        // fire_date is the field the Map.tsx burned-area popup reads; keep it ISO YYYY-MM-DD
        fire_date: formatDate(p.DH_Inicio),
        cod_sgif: p.Cod_SGIF ?? null,
        cod_anepc: p.Cod_ANEPC ?? null,
        ano: p.Ano ?? null,
        area_ha: p.AreaHaSGIF ?? p.AreaHaPoly ?? null,
        area_pov_ha: p.AreaHaPov ?? null,
        area_mato_ha: p.AreaHaMato ?? null,
        area_agri_ha: p.AreaHaAgri ?? null,
        distrito: p.PI_Distrit ?? null,
        concelho: p.PI_Conc ?? null,
        freguesia: p.PI_Freg ?? null,
        local: p.PI_Local ?? null,
        dicofre: p.PI_DICOFRE ?? null,
        nuts3: p.PI_NUTS3 ?? null,
        dh_inicio: p.DH_Inicio ?? null,
        dh_1interv: p.DH_1Interv ?? null,
        dh_fim: p.DH_Fim ?? null,
        duracao_min: p.Duracao_m ?? null,
        causa_cod: p.Causa_Cod ?? null,
        causa_tipo: p.Causa_Tipo ?? null,
        causa_desc: p.Causa_Desc ?? null,
      },
    };
  });
}

router.get('/years', (_req, res) => {
  res.json({
    source: 'ICNF/BDG',
    years: Object.keys(YEAR_TO_LAYER),
  });
});

router.get('/status', async (_req, res) => {
  try {
    const response = await fetch(`${ICNF_BASE_URL}?f=json`);
    if (!response.ok) throw new Error(`ICNF MapServer returned ${response.status}`);
    res.json({
      configured: true,
      source: 'ICNF/BDG ArcGIS MapServer',
      baseUrl: ICNF_BASE_URL,
      yearsAvailable: Object.keys(YEAR_TO_LAYER),
      cacheEntries: cache.size,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      configured: false,
      error: err.message || 'Could not reach ICNF MapServer',
    });
  }
});

router.get('/burned-areas', async (req, res) => {
  const yearParam = String(req.query.year ?? '').trim();
  const layerId = resolveLayerId(yearParam);

  if (layerId === null) {
    return res.status(400).json({
      error: `Invalid or missing 'year' parameter. Use one of: ${Object.keys(YEAR_TO_LAYER).join(', ')}`,
    });
  }

  const precision = String(req.query.precision ?? '').toLowerCase();
  const simplifyOffset = precision === 'full' ? '' : DEFAULT_SIMPLIFY;

  const cacheKey = `year:${yearParam}:simplify:${simplifyOffset || 'full'}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true });
  }

  try {
    const raw = await fetchAllForLayer(layerId, simplifyOffset);
    const features = normalize(raw, yearParam);
    const payload = {
      source: 'ICNF/BDG',
      year: yearParam,
      layerId,
      simplifyOffsetDeg: simplifyOffset || null,
      count: features.length,
      geojson: { type: 'FeatureCollection', features },
    };
    cacheSet(cacheKey, payload, CACHE_TTL_MS);
    return res.json({ ...payload, cached: false });
  } catch (err) {
    console.error('ICNF burned-areas fetch error:', err);
    return res.status(err.statusCode || 500).json({
      error: err.message || 'Failed to fetch ICNF burned areas',
    });
  }
});

export default router;
