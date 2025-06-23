// src/routes/api/gee/severity-maps/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getEE } from '$lib/utils/gee-utils';

/* ------------------------------------------------------------------ */
/*  Configurações de satélite                                          */
/* ------------------------------------------------------------------ */
const SAT_CFG: Record<
  string,
  { collection: string; bands: [string, string]; scale: number }
> = {
  'Sentinel-2/MSI': {
    collection: 'COPERNICUS/S2_SR_HARMONIZED',
    bands: ['B8', 'B12'],
    scale: 20
  },
  'Landsat-5/TM': {
    collection: 'LANDSAT/LT05/C02/T1_L2',
    bands: ['SR_B4', 'SR_B7'],
    scale: 30
  },
  'Landsat-7/ETM': {
    collection: 'LANDSAT/LE07/C02/T1_L2',
    bands: ['SR_B4', 'SR_B7'],
    scale: 30
  },
  'Landsat-8/OLI': {
    collection: 'LANDSAT/LC08/C02/T1_L2',
    bands: ['SR_B5', 'SR_B7'],
    scale: 30
  },
  'Terra/MODIS': {
    collection: 'MODIS/061/MOD09GA',
    bands: ['sur_refl_b02', 'sur_refl_b07'],
    scale: 500
  }
};

const PALETTE = ['3385ff', 'ffff4d', 'ff8000', 'b30000', '330000'];

/* ------------------------------------------------------------------ */
/*  POST /api/gee/severity-maps                                        */
/* ------------------------------------------------------------------ */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const {
      geometry,
      satellite,
      preStart,
      preEnd,
      postStart,
      postEnd,
      applySegmentation,
      segmParams = {} // { kernel, dnbr, cva, minPix }
    } = await request.json();

    const cfg = SAT_CFG[satellite];
    if (!cfg) throw new Error(`Satélite não suportado: ${satellite}`);

    const ee = await getEE();
    const geom = ee.Geometry(geometry);

    /* ---------- 1. Colecções & NBR ---------- */
    const makeNBR = (img: any) =>
      ee
        .Image(img)
        .select(cfg.bands)
        .divide(1e4)
        .normalizedDifference(cfg.bands)
        .rename('NBR');

    const pre = ee
      .ImageCollection(cfg.collection)
      .filterBounds(geom)
      .filterDate(preStart, preEnd)
      .map(makeNBR)
      .median();

    const post = ee
      .ImageCollection(cfg.collection)
      .filterBounds(geom)
      .filterDate(postStart, postEnd)
      .map(makeNBR)
      .median();

    /* ---------- 2. Índices ---------- */
    let dNBR: any = pre.subtract(post).rename('dNBR');
    let RdNBR: any = dNBR.divide(pre.abs().sqrt()).rename('RdNBR');
    let RBR: any = dNBR.divide(pre.add(1.001)).rename('RBR');

    /* ---------- 3. Classes ---------- */
    let classes: any = dNBR
      .where(dNBR.lte(0.1), 1)
      .where(dNBR.gt(0.1).and(dNBR.lte(0.27)), 2)
      .where(dNBR.gt(0.27).and(dNBR.lte(0.44)), 3)
      .where(dNBR.gt(0.44).and(dNBR.lte(0.66)), 4)
      .where(dNBR.gt(0.66), 5)
      .rename('Severity');

    /* ---------- 4. Segmentação opcional ---------- */
    if (applySegmentation) {
      const { kernel = 3, dnbr = 0.1, cva = 0.05, minPix = 100 } = segmParams;

      const deltaMask = dNBR.focalMedian(kernel).gte(dnbr);

      const cvaMag = pre.subtract(post).pow(2).reduce(ee.Reducer.sum()).sqrt();
      const cvaMask = cvaMag.focalMedian(kernel).gte(cva);

      const mask = deltaMask.and(cvaMask).connectedPixelCount(minPix, true).gte(minPix);

      dNBR = dNBR.updateMask(mask);
      RdNBR = RdNBR.updateMask(mask);
      RBR = RBR.updateMask(mask);
      classes = classes.updateMask(mask);
    }

    /* ---------- 5. Geração dos tiles ---------- */
    const vis = {
      dNBR: { min: 0, max: 0.85, palette: ['b6cdff', 'efcc4b', 'c03838'] },
      RdNBR: { min: -0.5, max: 1.5, palette: ['b6cdff', 'efcc4b', 'c03838'] },
      RBR: { min: 0, max: 0.6, palette: ['b6cdff', 'efcc4b', 'c03838'] },
      Severity: { min: 1, max: 5, palette: PALETTE }
    };

    const imgs = { dNBR, RdNBR, RBR, Severity: classes };

    const tiles = await Promise.all(
      Object.entries(imgs).map(
        ([key, img]) =>
          new Promise<{ name: string; tileUrl: string }>((resolve, reject) => {
            ee.data.getMapId({ image: img.visualize(vis[key]) }, (info: any, err: any) => {
              if (err || !info?.urlFormat) reject(err ?? new Error('getMapId falhou'));
              else resolve({ name: key, tileUrl: info.urlFormat });
            });
          })
      )
    );

    /* ---------- 6. Done ---------- */
    return json({ maps: tiles });
  } catch (err: any) {
    console.error('❌ severity-maps:', err);
    return json({ error: err.message ?? 'Erro desconhecido' }, { status: 500 });
  }
};
