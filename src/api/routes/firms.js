import express from 'express';

const router = express.Router();

const FIRMS_BASE_URL = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';
const DEFAULT_DATASET = process.env.FIRMS_DEFAULT_DATASET || 'VIIRS_SNPP_NRT';
const DEFAULT_BBOX = process.env.FIRMS_PORTUGAL_BBOX || '-10.0,36.8,-6.0,42.3';
const NRT_CACHE_TTL_MS = parseInt(process.env.FIRMS_CACHE_TTL_NRT_MS || '600000', 10); // 10 min
const HIST_CACHE_TTL_MS = parseInt(process.env.FIRMS_CACHE_TTL_HIST_MS || '2592000000', 10); // 30 days

const cache = new Map();

function getMapKey() {
  return process.env.FIRMS_MAP_KEY;
}

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function isValidDateYYYYMMDD(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr));
}

function isValidBbox(bbox) {
  const parts = String(bbox).split(',').map((v) => Number.parseFloat(v));
  if (parts.length !== 4 || parts.some((v) => Number.isNaN(v))) return false;

  const [minLon, minLat, maxLon, maxLat] = parts;
  return minLon < maxLon && minLat < maxLat && minLon >= -180 && maxLon <= 180 && minLat >= -90 && maxLat <= 90;
}

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

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] ?? '').trim();
    });
    return row;
  });
}

function toGeoJson(rows, sourceDataset) {
  const features = rows
    .map((row) => {
      const latitude = Number.parseFloat(row.latitude);
      const longitude = Number.parseFloat(row.longitude);
      if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        properties: {
          source_dataset: sourceDataset,
          datetime: `${row.acq_date || ''}T${String(row.acq_time || '').padStart(4, '0')}`,
          acq_date: row.acq_date || null,
          acq_time: row.acq_time || null,
          satellite: row.satellite || null,
          instrument: row.instrument || null,
          confidence: row.confidence || null,
          frp: row.frp ? Number.parseFloat(row.frp) : null,
          daynight: row.daynight || null,
          bright_ti4: row.bright_ti4 ? Number.parseFloat(row.bright_ti4) : null,
          bright_ti5: row.bright_ti5 ? Number.parseFloat(row.bright_ti5) : null,
          scan: row.scan ? Number.parseFloat(row.scan) : null,
          track: row.track ? Number.parseFloat(row.track) : null,
          version: row.version || null
        }
      };
    })
    .filter(Boolean);

  return {
    type: 'FeatureCollection',
    features
  };
}

async function fetchFirmsCsv({ dataset, bbox, days, date }) {
  const key = getMapKey();
  if (!key) {
    const error = new Error('FIRMS_MAP_KEY is not configured');
    error.statusCode = 503;
    throw error;
  }

  const pathParts = [key, dataset, bbox, String(days)];
  if (date) pathParts.push(date);
  const url = `${FIRMS_BASE_URL}/${pathParts.join('/')}`;

  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`FIRMS request failed (${response.status}): ${body.slice(0, 300)}`);
    error.statusCode = response.status;
    throw error;
  }

  return response.text();
}

function normalizeCommonQuery(query) {
  const dataset = String(query.dataset || DEFAULT_DATASET);
  const bbox = String(query.bbox || DEFAULT_BBOX);
  const days = parsePositiveInt(query.days, 1);

  if (!isValidBbox(bbox)) {
    const error = new Error('Invalid bbox format. Expected: minLon,minLat,maxLon,maxLat');
    error.statusCode = 400;
    throw error;
  }

  if (days > 10) {
    const error = new Error('days cannot be greater than 10');
    error.statusCode = 400;
    throw error;
  }

  return { dataset, bbox, days };
}

router.get('/status', (req, res) => {
  res.json({
    configured: Boolean(getMapKey()),
    defaultDataset: DEFAULT_DATASET,
    defaultBbox: DEFAULT_BBOX,
    cacheEntries: cache.size
  });
});

router.get('/active', async (req, res) => {
  try {
    const { dataset, bbox, days } = normalizeCommonQuery(req.query);
    const cacheKey = `active:${dataset}:${bbox}:${days}`;

    const cached = cacheGet(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const csvText = await fetchFirmsCsv({ dataset, bbox, days });
    const rows = parseCsv(csvText);
    const geojson = toGeoJson(rows, dataset);

    const payload = {
      source: 'FIRMS',
      mode: 'active',
      dataset,
      bbox,
      days,
      count: geojson.features.length,
      geojson
    };

    cacheSet(cacheKey, payload, NRT_CACHE_TTL_MS);
    return res.json({ ...payload, cached: false });
  } catch (err) {
    console.error('FIRMS active fetch error:', err);
    return res.status(err.statusCode || 500).json({
      error: err.message || 'Failed to fetch FIRMS active detections'
    });
  }
});

router.get('/historical', async (req, res) => {
  try {
    const { dataset, bbox, days } = normalizeCommonQuery(req.query);
    const date = String(req.query.date || '');

    if (!isValidDateYYYYMMDD(date)) {
      return res.status(400).json({
        error: 'Missing or invalid date. Expected format: YYYY-MM-DD'
      });
    }

    const cacheKey = `historical:${dataset}:${bbox}:${days}:${date}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const csvText = await fetchFirmsCsv({ dataset, bbox, days, date });
    const rows = parseCsv(csvText);
    const geojson = toGeoJson(rows, dataset);

    const payload = {
      source: 'FIRMS',
      mode: 'historical',
      dataset,
      bbox,
      days,
      date,
      count: geojson.features.length,
      geojson
    };

    cacheSet(cacheKey, payload, HIST_CACHE_TTL_MS);
    return res.json({ ...payload, cached: false });
  } catch (err) {
    console.error('FIRMS historical fetch error:', err);
    return res.status(err.statusCode || 500).json({
      error: err.message || 'Failed to fetch FIRMS historical detections'
    });
  }
});

export default router;
