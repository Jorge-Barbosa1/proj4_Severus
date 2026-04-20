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
// Returns clickable GeoJSON polygons vectorised from MODIS MCD64A1 BurnDate
// for the requested window, clipped to Portugal. Each polygon has:
//   - fire_date (YYYY-MM-DD) derived from the pixel's BurnDate + image year
//   - area_ha (integer hectares)
// Small patches below `minAreaHa` are dropped to cut MODIS noise.
// Query: from=YYYY-MM-DD, to=YYYY-MM-DD, minAreaHa=<number, default 100>
router.get('/modis-burned-areas', async (req, res) => {
  try {
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();
    const minAreaHa = Math.max(0, parseFloat(String(req.query.minAreaHa || '100')) || 100);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({
        error: 'from and to are required in YYYY-MM-DD format',
      });
    }

    const ee = await getEE();
    const region = ee.Geometry.Rectangle(PT_BBOX);
    const ic = ee.ImageCollection(MCD64A1_ASSET);

    // Coverage window of the collection itself so the UI can show users what is really available.
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

    const filtered = ic.filterDate(from, to).filterBounds(region);

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
        count: 0,
        geojson: { type: 'FeatureCollection', features: [] },
        note: `MCD64A1 has no images in this window. Latest available month is ${latestDate}.`,
      });
    }

    // Encode absBurn = year*1000 + BurnDate(DOY) so downstream vectorisation can
    // recover the real calendar date regardless of which monthly image a pixel came from.
    const withAbsDate = filtered.map((img) => {
      const year = ee.Date(img.get('system:time_start')).get('year');
      const bd = img.select('BurnDate');
      return bd
        .add(year.multiply(1000))
        .updateMask(bd.gt(0))
        .rename('absBurn')
        .toInt32();
    });

    const mosaic = withAbsDate.mosaic();

    // reduceToVectors with labelProperty=absBurn groups pixels of equal absBurn
    // into polygons. Eight-connected so diagonal neighbours merge.
    const polys = mosaic.reduceToVectors({
      geometry: region,
      scale: 500,
      geometryType: 'polygon',
      eightConnected: true,
      labelProperty: 'absBurn',
      maxPixels: 1e10,
    });

    const enriched = polys
      .map((f) => {
        const absBurn = ee.Number(f.get('absBurn'));
        const year = absBurn.divide(1000).floor();
        const doy = absBurn.mod(1000);
        const date = ee.Date.fromYMD(year, 1, 1).advance(doy.subtract(1), 'day');
        const areaHa = f.geometry().area(1).divide(10000);
        return f.set({
          fire_date: date.format('YYYY-MM-dd'),
          area_ha: areaHa,
        });
      })
      .filter(ee.Filter.gte('area_ha', minAreaHa));

    const raw = await new Promise((resolve, reject) =>
      enriched.getInfo((v, e) => (e ? reject(e) : resolve(v))),
    );

    const features = (raw?.features || []).map((f) => {
      const p = f.properties || {};
      return {
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          source_dataset: MCD64A1_ASSET,
          fire_date: p.fire_date || null,
          area_ha: typeof p.area_ha === 'number' ? Math.round(p.area_ha) : null,
        },
      };
    });

    const totalHa = features.reduce((s, f) => s + (f.properties.area_ha || 0), 0);

    res.json({
      source: 'MODIS/061/MCD64A1',
      from,
      to,
      minAreaHa,
      coverage: { earliest: earliestDate, latest: latestDate },
      matchedImages: matchedCount,
      count: features.length,
      totalBurnedHa: totalHa,
      totalBurnedKm2: Math.round(totalHa / 100),
      geojson: { type: 'FeatureCollection', features },
      note: features.length === 0
        ? `No burned patches above ${minAreaHa} ha in Portugal for this window. Try a fire-season window (Jun-Sep) or lower minAreaHa.`
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
