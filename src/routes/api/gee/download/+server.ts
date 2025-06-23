import { getEE } from '$lib/utils/gee-utils';
import type { RequestHandler } from '@sveltejs/kit';

/* ------------------------------------------------------------------ */
/* Configuração partilhada com severity-maps ------------------------- */
type SatCfg = { collection: string; bands: [string, string]; scale: number; scaler: (img: any) => any };

const SAT_CFG: Record<string, SatCfg> = {
  'Sentinel-2/MSI': {
    collection: 'COPERNICUS/S2_SR_HARMONIZED',
    bands: ['B8', 'B12'],
    scale: 20,
    scaler: (img) => img.divide(1e4)              // reflectância já em 0-10000
  },
  'Landsat-5/TM': {
    collection: 'LANDSAT/LT05/C02/T1_L2',
    bands: ['SR_B4', 'SR_B7'],
    scale: 30,
    scaler: (img) => img.multiply(0.0000275).add(-0.2)
  },
  'Landsat-7/ETM': {
    collection: 'LANDSAT/LE07/C02/T1_L2',
    bands: ['SR_B4', 'SR_B7'],
    scale: 30,
    scaler: (img) => img.multiply(0.0000275).add(-0.2)
  },
  'Landsat-8/OLI': {
    collection: 'LANDSAT/LC08/C02/T1_L2',
    bands: ['SR_B5', 'SR_B7'],
    scale: 30,
    scaler: (img) => img.multiply(0.0000275).add(-0.2)
  },
  'Landsat-9/OLI': {                             // caso queiras L9
    collection: 'LANDSAT/LC09/C02/T1_TOA',
    bands: ['B5', 'B7'],
    scale: 30,
    scaler: (img) => img.multiply(0.0000275)
  },
  'Terra/MODIS': {
    collection: 'MODIS/061/MOD09A1',
    bands: ['sur_refl_b02', 'sur_refl_b07'],
    scale: 500,
    scaler: (img) => img.divide(1e4)
  },
  'HLS': {
    collection: 'NASA/HLS/HLSL30/v002',
    bands: ['B5', 'B7'],
    scale: 30,
    scaler: (img) => img.divide(1e4)
  }
};
/* ------------------------------------------------------------------ */

export const GET: RequestHandler = async ({ url }) => {
  try {
    const type       = url.searchParams.get('type');        // dNBR | RdNBR | RBR | Severity
    const satellite  = url.searchParams.get('satellite');
    const preStart   = url.searchParams.get('preStart');
    const preEnd     = url.searchParams.get('preEnd');
    const postStart  = url.searchParams.get('postStart');
    const postEnd    = url.searchParams.get('postEnd');
    const geometryQS = url.searchParams.get('geometry');    // JSON

    if (!type || !satellite || !preStart || !preEnd || !postStart || !postEnd) {
      return new Response('Missing required parameters', { status: 400 });
    }

    const cfg = SAT_CFG[satellite];
    if (!cfg) return new Response('Unsupported satellite', { status: 400 });

    const ee   = await getEE();
    const geom = geometryQS
      ? ee.Geometry(JSON.parse(geometryQS))
      : ee.Geometry.Rectangle([-180, -90, 180, 90]);

    /* ---------- Colecção & NBR median pré / pós ---------- */
    const makeNBR = (img: any) =>
      cfg
        .scaler(ee.Image(img).select(cfg.bands))
        .normalizedDifference(cfg.bands)
        .rename('NBR');

    const col  = ee.ImageCollection(cfg.collection).filterBounds(geom);
    const pre  = col.filterDate(preStart,  preEnd ).map(makeNBR).median();
    const post = col.filterDate(postStart, postEnd).map(makeNBR).median();

    /* ---------- Construir raster conforme `type` ---------- */
    let image: any;
    let description = '';

    switch (type) {
      case 'dNBR':
        image = pre.subtract(post).rename('dNBR');
        description = 'Delta_NBR';
        break;
      case 'RdNBR':
        image = pre.subtract(post).divide(pre.abs().sqrt()).rename('RdNBR');
        description = 'Relativized_Delta_NBR';
        break;
      case 'RBR':
        image = pre.subtract(post).divide(pre.add(1.001)).rename('RBR');
        description = 'Relative_Burn_Ratio';
        break;
      case 'Severity': {
        const dNBR = pre.subtract(post);
        image = dNBR
          .where(dNBR.lte(0.1), 1)
          .where(dNBR.gt(0.1).and(dNBR.lte(0.27)), 2)
          .where(dNBR.gt(0.27).and(dNBR.lte(0.44)), 3)
          .where(dNBR.gt(0.44).and(dNBR.lte(0.66)), 4)
          .where(dNBR.gt(0.66), 5)
          .rename('Severity')
          .toInt16();
        description = 'Burn_Severity_Classes';
        break;
      }
      default:
        return new Response('Invalid map type', { status: 400 });
    }

    const downloadUrl = image
      .clip(geom)
      .getDownloadURL({
        name: `SeverusPT_${satellite.replace(/\//g, '_')}_${description}_${timestamp()}`,
        scale: cfg.scale,
        region: geom,
        format: 'GEO_TIFF',
        filePerBand: false
      });

    return Response.redirect(downloadUrl);
  } catch (err) {
    console.error('Error generating download:', err);
    return new Response('Server error', { status: 500 });
  }
};

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
const timestamp = () => {
  const d = new Date();
  return d
    .toISOString()                       // 2025-06-23T14:05:12.345Z
    .replace(/[-T:Z.]/g, '')            // 20250623 140512345
    .slice(0, 15);                      // 20250623_140512
};
/* ------------------------------------------------------------------ */
