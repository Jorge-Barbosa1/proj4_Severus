import express from 'express';

const router = express.Router();

const FOGOS_BASE_URL = process.env.FOGOS_BASE_URL || 'https://api.fogos.pt';
const CACHE_TTL_MS = parseInt(process.env.FOGOS_CACHE_TTL_MS || '120000', 10); // 2 min

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

// Status codes considered "active" in the ANEPC feed
const ACTIVE_STATUS_CODES = new Set([3, 4, 5, 6, 7]); // Despacho -> Em Resolução

// Natureza codes we consider wildfire-like (3101 = Incêndio Rural, 3102 = Incêndio Urbano,
// 3103 = Incêndio Agrícola, 3107 = Falso Alarme Rural, 3109 = Gestão de Combustível)
function isWildfireNatureza(code) {
  const s = String(code ?? '');
  return s.startsWith('31') && s !== '3109' && s !== '3107';
}

function toGeoJson(items, { onlyActive, onlyFires }) {
  const features = items
    .filter((it) => {
      if (typeof it.lat !== 'number' || typeof it.lng !== 'number') return false;
      if (onlyActive && !ACTIVE_STATUS_CODES.has(Number(it.statusCode))) return false;
      if (onlyFires && !isWildfireNatureza(it.naturezaCode)) return false;
      return true;
    })
    .map((it) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [it.lng, it.lat] },
      properties: {
        source_dataset: 'ANEPC/fogos.pt',
        id: it.id ?? null,
        date: it.date ?? null,
        hour: it.hour ?? null,
        datetime: it.date && it.hour ? `${it.date} ${it.hour}` : null,
        unixSec: it.dateTime?.sec ?? null,
        location: it.location ?? null,
        district: it.district ?? null,
        concelho: it.concelho ?? null,
        freguesia: it.freguesia ?? null,
        natureza: it.natureza ?? null,
        naturezaCode: it.naturezaCode ?? null,
        status: it.status ?? null,
        statusCode: it.statusCode ?? null,
        statusColor: it.statusColor ?? null,
        man: it.man ?? 0,
        terrain: it.terrain ?? 0,
        aerial: it.aerial ?? 0,
        aquaticos: it.meios_aquaticos ?? 0,
      },
    }));

  return { type: 'FeatureCollection', features };
}

async function fetchFogos(pathname) {
  const url = `${FOGOS_BASE_URL}${pathname}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`fogos.pt request failed (${response.status}): ${body.slice(0, 300)}`);
    error.statusCode = response.status;
    throw error;
  }
  const json = await response.json();
  if (!json || json.success === false) {
    const error = new Error('fogos.pt returned success=false');
    error.statusCode = 502;
    throw error;
  }
  return Array.isArray(json.data) ? json.data : [];
}

router.get('/status', async (_req, res) => {
  try {
    const items = await fetchFogos('/new/fires');
    res.json({
      configured: true,
      source: 'ANEPC via api.fogos.pt',
      baseUrl: FOGOS_BASE_URL,
      totalItems: items.length,
      cacheEntries: cache.size,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      configured: false,
      error: err.message || 'Could not reach fogos.pt',
    });
  }
});

router.get('/active', async (req, res) => {
  try {
    const onlyActive = String(req.query.onlyActive ?? 'true') !== 'false';
    const onlyFires = String(req.query.onlyFires ?? 'true') !== 'false';
    const cacheKey = `active:${onlyActive}:${onlyFires}`;

    const cached = cacheGet(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const items = await fetchFogos('/new/fires');
    const geojson = toGeoJson(items, { onlyActive, onlyFires });

    const payload = {
      source: 'ANEPC/fogos.pt',
      mode: 'active',
      filters: { onlyActive, onlyFires },
      totalItems: items.length,
      count: geojson.features.length,
      geojson,
    };

    cacheSet(cacheKey, payload, CACHE_TTL_MS);
    return res.json({ ...payload, cached: false });
  } catch (err) {
    console.error('fogos.pt active fetch error:', err);
    return res.status(err.statusCode || 500).json({
      error: err.message || 'Failed to fetch fogos.pt active occurrences',
    });
  }
});

export default router;
