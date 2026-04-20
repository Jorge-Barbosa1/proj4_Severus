import express from 'express';
import { getEE } from '../../lib/utils/gee-utils.js';
import {
  getTimeSeriesData,
  normalizeSatelliteLabel,
  SAT_CONF,
} from '../../lib/services/gee-service.js';

const router = express.Router();

// Default Portugal bounding box for burned-area queries
const PT_BBOX = [-10.0, 36.8, -6.0, 42.3]; // [minLon, minLat, maxLon, maxLat]
const MCD64A1_ASSET = 'MODIS/061/MCD64A1';

// GET /api/gee/modis-burned-areas
// Returns a Leaflet-ready tile URL for MODIS MCD64A1 BurnDate rendered as a color ramp,
// plus the asset's real coverage so the UI can clamp user-entered dates.
// Query: from=YYYY-MM-DD, to=YYYY-MM-DD
router.get('/modis-burned-areas', async (req, res) => {
  try {
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({
        error: 'from and to are required in YYYY-MM-DD format',
      });
    }

    const ee = await getEE();
    const region = ee.Geometry.Rectangle(PT_BBOX);
    const ic = ee.ImageCollection(MCD64A1_ASSET);

    // Coverage window of the collection itself (so the UI can tell users what's actually available)
    const [latestDate, earliestDate] = await Promise.all([
      new Promise((r, j) =>
        ee
          .Date(ic.limit(1, 'system:time_start', false).first().get('system:time_start'))
          .format('YYYY-MM-dd')
          .evaluate((v, e) => (e ? j(e) : r(v))),
      ),
      new Promise((r, j) =>
        ee
          .Date(ic.limit(1, 'system:time_start', true).first().get('system:time_start'))
          .format('YYYY-MM-dd')
          .evaluate((v, e) => (e ? j(e) : r(v))),
      ),
    ]);

    // Apply requested window, clipped to Portugal
    const filtered = ic.filterDate(from, to).filterBounds(region).select('BurnDate');

    const matchedCount = await new Promise((r, j) =>
      filtered.size().evaluate((v, e) => (e ? j(e) : r(v))),
    );

    if (matchedCount === 0) {
      return res.status(200).json({
        source: 'MODIS/061/MCD64A1',
        from,
        to,
        coverage: { earliest: earliestDate, latest: latestDate },
        matchedImages: 0,
        tileUrl: null,
        note:
          `MCD64A1 has no images in this window. Latest available month is ${latestDate}.`,
      });
    }

    const mosaic = filtered.mosaic();
    const burned = mosaic.selfMask();

    // Count burned pixels in PT so the UI can warn the user if the window is empty
    // (e.g. winter months where nothing burned).
    const burnedPixelCount = await new Promise((resolve, reject) =>
      mosaic
        .gt(0)
        .reduceRegion({
          reducer: ee.Reducer.sum(),
          geometry: region,
          scale: 500,
          maxPixels: 1e10,
        })
        .evaluate((v, e) => (e ? reject(e) : resolve(Math.round(v?.BurnDate ?? 0)))),
    );

    const visParams = {
      min: 1,
      max: 366,
      palette: ['#ffeda0', '#feb24c', '#f03b20', '#bd0026'],
    };

    const mapInfo = await new Promise((resolve, reject) =>
      burned.getMap(visParams, (info, err) => (err ? reject(err) : resolve(info))),
    );

    res.json({
      source: 'MODIS/061/MCD64A1',
      from,
      to,
      coverage: { earliest: earliestDate, latest: latestDate },
      matchedImages: matchedCount,
      burnedPixelCount,
      // ~0.215 km^2 per MODIS 500m pixel (approximate, varies with latitude)
      approxBurnedKm2: Math.round(burnedPixelCount * 0.215),
      tileUrl: mapInfo.urlFormat,
      mapid: mapInfo.mapid,
      note: burnedPixelCount === 0
        ? 'No burned pixels detected in Portugal for this window. Try a fire-season window (Jun–Sep).'
        : undefined,
    });
  } catch (err) {
    console.error('MCD64A1 fetch error:', err);
    res.status(500).json({
      error: 'MCD64A1_FETCH_FAILED',
      message: err?.message || String(err),
    });
  }
});

// POST /api/gee/time-series
router.post('/time-series', async (req, res) => {
  try {
    const { satellite, index, startDate, endDate, geometry } = req.body;

    if (!satellite || !index || !startDate || !endDate || !geometry) {
      return res.status(400).json({ message: 'Missing parameters' });
    }

    const data = await getTimeSeriesData({
      satellite,
      index,
      startDate,
      endDate,
      geometry,
    });

    res.json({ data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/gee/severity
router.post('/severity', async (req, res) => {
  try {
    const {
      satellite: satLabel,
      index,
      fireDate,
      windowSize,
      geometry,
    } = req.body;

    if (!satLabel || !index || !fireDate || !windowSize || !geometry) {
      return res.status(400).json({
        message: 'Missing parameters: satellite, index, fireDate, windowSize, geometry are required',
      });
    }

    const ee = await getEE();
    const sat = normalizeSatelliteLabel(satLabel);
    const cfg = SAT_CONF[sat];
    if (!cfg) {
      throw new Error(`Satélite não suportado: ${satLabel}`);
    }

    const region = ee.Geometry(geometry);
    const collectionId = cfg.ic;
    const scale = cfg.scale;
    const [b1, b2] = cfg.bands[index];

    const start = ee.Date(fireDate).advance(-windowSize, 'day');
    const end = ee.Date(Date.now());
    const stepMillis = windowSize * 24 * 60 * 60 * 1000;

    const dateSeq = ee.List
      .sequence(start.millis(), end.millis(), stepMillis)
      .map(m => ee.Date(m));

    const imgCol = ee.ImageCollection(collectionId).filterBounds(region);

    const imgSeq = ee.List.sequence(0, dateSeq.length().subtract(2)).map(i => {
      const ini = ee.Date(dateSeq.get(i));
      const fin = ee.Date(dateSeq.get(ee.Number(i).add(1)));

      return imgCol
        .filterDate(ini, fin)
        .map(img =>
          ee.Image(img)
            .normalizedDifference([b1, b2])
            .rename(index)
            .copyProperties(img, ['system:time_start'])
        )
        .median();
    });

    const bandsImg = ee.ImageCollection.fromImages(imgSeq).toBands();

    const reducer = bandsImg.reduceRegion({
      reducer: ee.Reducer.median(),
      geometry: region,
      scale,
      maxPixels: 1e13,
    });

    const values = await new Promise((resolve, reject) =>
      reducer.evaluate((v, e) => (e ? reject(e) : resolve(Object.values(v))))
    );

    const base = values[0];
    const deltas = values.map(v => (v != null && base != null ? v - base : null));
    const days = Array.from({ length: deltas.length }, (_, i) => (i + 1) * windowSize);

    res.json({ data: { days, deltas } });
  } catch (err) {
    console.error('Erro em /api/gee/severity:', err);
    res.status(500).json({ error: err.message ?? 'Erro desconhecido.' });
  }
});

export default router;
