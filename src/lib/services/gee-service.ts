/*********************************************************************
 * gee-service.ts  –  utilidades Earth Engine para a app SeverusPT
 *********************************************************************/

import { getEE } from '../utils/gee-utils.js';
import ee from '@google/earthengine';

/* ------------------------------------------------------------------ *
 * 1. TIPOS
 * ------------------------------------------------------------------ */
type TimeSeriesParams = {
  satellite: string;                 // rótulo que vem do UI
  index: 'NDVI' | 'NBR';
  startDate: string;
  endDate: string;
  geometry: GeoJSON.Geometry;
};

type TimeSeriesPoint = { date: Date; value: number | null };

/* ------------------------------------------------------------------ *
 * 2. CATÁLOGO DE SATÉLITES – todas as diferenças num só sítio
 * ------------------------------------------------------------------ */
type SatConf = {
  ic: string;                                         // ImageCollection ID
  scale: number;                                      // m/pixel
  bands: Record<'NDVI' | 'NBR', [string, string]>;        // [NIR, RED/SWIR]
  rescale?: (img: any) => any;                          // reflectâncias
  mask?: (img: any) => any;                             // máscara de nuvens

};

export const SAT_CONF: Record<string, SatConf> = {
  Sentinel2: {
    ic: 'COPERNICUS/S2_SR_HARMONIZED',
    scale: 20,
    bands: { NDVI: ['B8', 'B4'], NBR: ['B8', 'B12'] },
    mask: s2Mask,
    rescale: s2Rescale
  },

  Landsat5: {
    ic: 'LANDSAT/LT05/C02/T1_L2',
    scale: 30,
    bands: { NDVI: ['SR_B4', 'SR_B3'], NBR: ['SR_B4', 'SR_B7'] },
    mask: landsatMask,
    rescale: landsatScale
  },

  Landsat7: {
    ic: 'LANDSAT/LE07/C02/T1_L2',
    scale: 30,
    bands: { NDVI: ['SR_B4', 'SR_B3'], NBR: ['SR_B4', 'SR_B7'] },
    mask: landsatMask,
    rescale: landsatScale
  },

  Landsat8: {
    ic: 'LANDSAT/LC08/C02/T1_L2',
    scale: 30,
    bands: { NDVI: ['SR_B5', 'SR_B4'], NBR: ['SR_B5', 'SR_B7'] },
    mask: landsatMask,
    rescale: landsatScale
  },

  Landsat9: {
    ic: 'LANDSAT/LC09/C02/T1_L2',
    scale: 30,
    bands: { NDVI: ['SR_B5', 'SR_B4'], NBR: ['SR_B5', 'SR_B7'] },
    mask: landsatMask,
    rescale: landsatScale
  },

  HLS: {
    ic: 'NASA/HLS/HLSL30/v002',
    scale: 30,
    bands: { NDVI: ['B5', 'B4'], NBR: ['B5', 'B7'] },
    mask: (img) => {
      const fm = img.select('Fmask');
      const c = 1 << 1, adj = 1 << 2, sh = 1 << 3;
      return img.updateMask(
        fm.bitwiseAnd(c).eq(0).and(fm.bitwiseAnd(adj).eq(0)).and(fm.bitwiseAnd(sh).eq(0))
      );
    }
  },

  MODIS: {
    ic: 'MODIS/061/MOD09A1',
    scale: 500,
    bands: { NDVI: ['sur_refl_b02', 'sur_refl_b01'], NBR: ['sur_refl_b02', 'sur_refl_b07'] },
    mask: modisMask,
    rescale: (img: any) => img.addBands(
      img.select('sur_refl_.*').multiply(0.0001), null, true)
  }
};

// Auxiliares para Landsat L2
function landsatMask(img: any) {
  const qa = img.select('QA_PIXEL');
  const cloud = 1 << 3, shadow = 1 << 4;
  return img.updateMask(qa.bitwiseAnd(cloud).eq(0).and(qa.bitwiseAnd(shadow).eq(0)));
}
function landsatScale(img: any) {
  const optical = img.select('SR_B.*');         // bandas ópticas (SR_B1, SR_B2, ...)
  const scaled = optical.multiply(0.0000275).add(-0.2);
  return img.addBands(scaled, null, true);
}

//Funçoes auxiliares para MODIS
function modisMask(img: any) {
   const qa = img.select('StateQA');    

  /* bits 10 = cloud, 15 = cloud shadow (iguais em v061) */
  const cloud  = qa.bitwiseAnd(1 << 10).eq(0);
  const shadow = qa.bitwiseAnd(1 << 15).eq(0);

  return img.updateMask(cloud.and(shadow));
}

/* ------------------------------------------------------------------ *
 * 3. HELPERS
 * ------------------------------------------------------------------ */
export function normalizeSatelliteLabel(label: string): string {
  return ({
    'Landsat-9/OLI': 'Landsat9',
    'Landsat-8/OLI': 'Landsat8',
    'Landsat-7/ETM': 'Landsat7',
    'Landsat-5/TM': 'Landsat5',
    'Sentinel-2/MSI': 'Sentinel2',
    'Terra/MODIS': 'MODIS',
    'HLS (S2+L8)': 'HLS'
  } as Record<string, string>)[label] ?? label;
}

function getScaleForSatellite(sat: string) {
  return SAT_CONF[sat]?.scale ?? 30;
}

function evaluate<T>(obj: any): Promise<T> {
  return new Promise((ok, err) => obj.evaluate((v: T, e: any) => e ? err(e) : ok(v)));
}

/* ------------------------------------------------------------------ *
 * 4. COLECÇÃO + CÁLCULO DE ÍNDICE
 * ------------------------------------------------------------------ */
function getImageCollection(ee: any, sat: string, index: 'NDVI' | 'NBR') {
  const cfg = SAT_CONF[sat];
  if (!cfg) throw new Error(`Satellite ${sat} not supported`);

  return ee.ImageCollection(cfg.ic)
    .map(i => {
      if (cfg.mask) i = cfg.mask(i);
      if (cfg.rescale) i = cfg.rescale(i);
      const [nir, redSwir] = cfg.bands[index];
      const idx = i.normalizedDifference([nir, redSwir]).rename(index);
      return idx.copyProperties(i, ['system:time_start']);
    })
    .select(index);
}

/* ================================================================== *
 * 5. FUNÇÕES EXPORTADAS
 * ================================================================== */

// ----------  Time-series  ----------
export async function getTimeSeriesData(params: TimeSeriesParams): Promise<TimeSeriesPoint[]> {
  const ee = await getEE();
  const sat = normalizeSatelliteLabel(params.satellite);
  const geom = ee.FeatureCollection([ee.Feature(ee.Geometry(params.geometry))]);

  const col = getImageCollection(ee, sat, params.index)
    .filterDate(params.startDate, params.endDate)
    .filterBounds(geom)
    .sort('system:time_start');

  const scale = getScaleForSatellite(sat);
  const list = ee.List(col.toList(col.size()));
  const imgs = await evaluate<any[]>(list);

  return Promise.all(imgs.map(async (_ignored, i) => {
    const img = ee.Image(list.get(i));
    const mean = img.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: geom.geometry(),
      scale,
      maxPixels: 1e13
    });
    const val = await evaluate<any>(mean);
    const ts = await evaluate<number>(img.get('system:time_start'));
    return { date: new Date(ts), value: val?.[params.index] ?? null };
  }));
}

/* ───────────────── Sentinel-2: escala só as bandas ópticas que existirem ───────────────── */
/* reflectâncias Sentinel-2 L2A */
const S2_BANDS = ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'B11', 'B12'];

/* 1 ─ mascarar (igual ao teu script) */
function s2Mask(img: any) {
  const qa = img.select('QA60');
  const cloud = 1 << 10;
  const cirrus = 1 << 11;
  const mask = qa.bitwiseAnd(cloud).eq(0)
    .and(qa.bitwiseAnd(cirrus).eq(0));
  return img.updateMask(mask);
}

/* 2 ─ manter só bandas ópticas + escalar */
function s2Rescale(img: any) {
  const refl = img.select(S2_BANDS).divide(1e4);
  return ee.Image(img).addBands(refl, null, /*overwrite=*/true);
}
