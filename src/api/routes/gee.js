import express from 'express';
import { getEE } from '../../lib/utils/gee-utils.js';
import {
  getTimeSeriesData,
  normalizeSatelliteLabel,
  SAT_CONF,
} from '../../lib/services/gee-service.js';

const router = express.Router();

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
