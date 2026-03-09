import express from 'express';
import ee from '@google/earthengine';
import { getEE } from '../../lib/utils/gee-utils.js';
import { 
  getTimeSeriesData, 
  generateSeverityMaps,
  normalizeSatelliteLabel,
  SAT_CONF 
} from '../../lib/services/gee-service.js';

const router = express.Router();

// Visualization palettes
const VIS = {
  deltaNBR: { min: 0, max: 0.85, palette: ['b6cdff', 'efcc4b', 'c03838'] },
  rdNBR: { min: -0.5, max: 1.5, palette: ['b6cdff', 'efcc4b', 'c03838'] },
  rbr: { min: 0, max: 0.6, palette: ['b6cdff', 'efcc4b', 'c03838'] },
  classified: {
    min: 1, max: 5,
    palette: ['3385ff', 'ffff4d', 'ff8000', 'b30000', '330000']
  }
};

// POST /api/gee/burned-areas
router.post('/burned-areas', async (req, res) => {
  try {
    const { dataset, year } = req.body;
    const ee = await getEE();

    const datasets = {
      ICNF: 'users/joaofgo/severus_pt/AA_ICNF_2000_2021_PT_v2',
      EFFIS: 'users/joaofgo/severus_pt/effis_all'
    };

    if (!datasets[dataset]) {
      return res.status(400).json({ error: 'Dataset inválido' });
    }

    const collection = ee.FeatureCollection(datasets[dataset])
      .filter(ee.Filter.eq(dataset === 'ICNF' ? 'Ano' : 'year', year));

    const geojson = await new Promise((resolve, reject) => {
      collection.getInfo((result, err) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    res.json(geojson);
  } catch (err) {
    console.error('Erro ao obter áreas queimadas:', err);
    res.status(500).json({ message: 'Server error' });
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
      geometry
    });

    res.json({ data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/gee/severity-maps
router.post('/severity-maps', async (req, res) => {
  try {
    const {
      satellite,
      geometry,
      preStart, preEnd,
      postStart, postEnd,
      cloudCoverMax,
      applySegmentation = false,
      segmKernel,
      segmDnbrThresh,
      segmCvaThresh,
      segmMinPix
    } = req.body;

    const sat = normalizeSatelliteLabel(satellite);

    const imgs = await generateSeverityMaps({
      satellite: sat,
      geometry,
      preStart, preEnd,
      postStart, postEnd,
      cloudCoverMax,
      applySegmentation,
      segmKernel, segmDnbrThresh, segmCvaThresh, segmMinPix
    });

    // Generate tiles
    const toTile = (name, image) => new Promise((resolve, reject) => {
      ee.data.getMapId(
        { image: image.visualize(VIS[name]) },
        (info, err) => {
          if (err || !info?.urlFormat) {
            reject(err ?? new Error('getMapId failed'));
          } else {
            resolve({ name, tileUrl: info.urlFormat });
          }
        }
      );
    });

    const maps = await Promise.all([
      toTile('deltaNBR', imgs.deltaNBR),
      toTile('rdNBR', imgs.rdNBR),
      toTile('rbr', imgs.rbr),
      toTile('classified', imgs.classified)
    ]);

    res.json({ maps });
  } catch (e) {
    console.error('❌ severity-maps:', e);
    res.status(500).json({ error: e.message ?? 'Erro desconhecido' });
  }
});

// POST /api/gee/image-list
router.post('/image-list', async (req, res) => {
  try {
    const ee = await getEE();
    const { satellite, preStart, preEnd, postStart, postEnd, geometry } = req.body;

    const region = ee.Geometry(geometry);
    const sat = normalizeSatelliteLabel(satellite);
    const cfg = SAT_CONF[sat];

    if (!cfg) {
      return res.status(400).json({ error: 'Satélite não suportado' });
    }

    const col = ee.ImageCollection(cfg.ic).filterBounds(region);
    const preCol = col.filterDate(preStart, preEnd);
    const postCol = col.filterDate(postStart, postEnd);

    const toArray = (c) => new Promise((resolve, reject) =>
      c.aggregate_array('system:index').distinct()
        .evaluate((result, err) => err ? reject(err) : resolve(result))
    );

    const [preImageIds, postImageIds] = await Promise.all([
      toArray(preCol),
      toArray(postCol)
    ]);

    res.json({ preImageIds, postImageIds });
  } catch (err) {
    console.error('Erro ao listar imagens:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/gee/severity
router.post('/severity', async (req, res) => {
  try {
    const ee = await getEE();
    const {
      satellite: satLabel,
      index, fireDate, windowSize, geometry
    } = req.body;

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
        .map((img) =>
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
      maxPixels: 1e13
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

// POST /api/gee/severity-stats
router.post('/severity-stats', async (req, res) => {
  try {
    const ee = await getEE();
    const {
      geometry,
      satellite,
      preStart,
      preEnd,
      postStart,
      postEnd
    } = req.body;

    const geom = ee.Geometry(geometry);
    const sat = normalizeSatelliteLabel(satellite);
    const cfg = SAT_CONF[sat];
    const scale = cfg?.scale ?? 30;

    // Get pre and post collections
    const col = ee.ImageCollection(cfg.ic).filterBounds(geom);
    const pre = col.filterDate(preStart, preEnd).median();
    const post = col.filterDate(postStart, postEnd).median();

    // Calculate dNBR
    const [b1, b2] = cfg.bands['NBR'];
    const preNBR = pre.normalizedDifference([b1, b2]);
    const postNBR = post.normalizedDifference([b1, b2]);
    const dNBR = preNBR.subtract(postNBR).rename('dNBR');

    // Classify severity
    const classified = dNBR
      .where(dNBR.lte(0.1), 1)
      .where(dNBR.gt(0.1).and(dNBR.lte(0.27)), 2)
      .where(dNBR.gt(0.27).and(dNBR.lte(0.44)), 3)
      .where(dNBR.gt(0.44).and(dNBR.lte(0.66)), 4)
      .where(dNBR.gt(0.66), 5)
      .rename('Severity')
      .toInt16();

    // Calculate areas
    const pixelArea = ee.Image.pixelArea().divide(10000);
    
    const areaByClass = pixelArea
      .addBands(classified)
      .reduceRegion({
        reducer: ee.Reducer.sum().group({
          groupField: 1,
          groupName: 'class',
        }),
        geometry: geom,
        scale: scale,
        maxPixels: 1e13
      });

    const stats = await new Promise((resolve, reject) => {
      ee.data.computeValue(areaByClass, (result, error) => {
        if (error) reject(error);
        else resolve(result);
      });
    });

    const classTotals = {};
    let maxClassTotal = 0;

    if (stats.groups) {
      stats.groups.forEach(group => {
        classTotals[group.class] = group.sum;
        if (group.sum > maxClassTotal) maxClassTotal = group.sum;
      });
    }

    res.json({ classTotals, maxClassTotal });
  } catch (err) {
    console.error('Error calculating severity statistics:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/gee/stats
router.post('/stats', async (req, res) => {
  try {
    const { geometry, severityRasterId } = req.body;
    const ee = await getEE();

    const raster = ee.Image(severityRasterId);
    const region = ee.Geometry(geometry);

    const hist = raster.reduceRegion({
      reducer: ee.Reducer.frequencyHistogram(),
      geometry: region,
      scale: 20,
      maxPixels: 1e13
    });

    const counts = await new Promise((resolve, reject) => {
      hist.get('Severity').getInfo((result, err) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    const areaHa = Object.fromEntries(
      Object.entries(counts).map(([k, v]) => [k, v * 20 * 20 / 10000])
    );

    res.json({ areaHa });
  } catch (err) {
    console.error('Erro ao calcular estatísticas:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Placeholder routes for less critical endpoints
router.post('/composite-image', async (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

router.post('/download', async (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

router.post('/mapper', async (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

export default router;
