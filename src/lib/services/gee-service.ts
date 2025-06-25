/*********************************************************************
 * gee-service.ts  –  utilidades Earth Engine para a app SeverusPT
 *********************************************************************/

import { getEE } from '$lib/utils/gee-utils';
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

type SeverityParams = {
  satellite: string;
  index: 'NDVI' | 'NBR';
  fireDate: string;                  // YYYY-MM-DD
  windowSize: number;                // dias
  geometry: GeoJSON.Geometry;
};

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

const SAT_CONF: Record<string, SatConf> = {
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
    bands: {
      NDVI: ['SR_B5', 'SR_B4'],   //  NIR ,  RED
      NBR: ['SR_B5', 'SR_B7']    //  NIR ,  SWIR-2
    },
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
    rescale: (img) => img.multiply(0.0001)
  }
};

// Auxiliares para Landsat L2
function landsatMask(img: any) {
  const qa = img.select('QA_PIXEL');
  const cloud = 1 << 3, shadow = 1 << 4;
  return img.updateMask(qa.bitwiseAnd(cloud).eq(0).and(qa.bitwiseAnd(shadow).eq(0)));
}
function landsatScale(img: any) {
  return img.multiply(0.0000275).add(-0.2);
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

// ----------  Severity trajectory  ----------
export async function getSeverityTrajectory(p: SeverityParams) {
  const ee = await getEE();
  const sat = normalizeSatelliteLabel(p.satellite);
  const geom = ee.Geometry(p.geometry);

  const start = ee.Date(p.fireDate).advance(-p.windowSize, 'day');
  const end = ee.Date(Date.now());

  const seq = ee.List.sequence(start.millis(), end.millis(), p.windowSize * 24 * 3600 * 1000)
    .map((m: any) => ee.Date(m));

  const col = getImageCollection(ee, sat, p.index).filterBounds(geom);
  const scale = getScaleForSatellite(sat);

  const bands = ee.List.sequence(0, seq.length().subtract(2)).map(i => {
    const ini = ee.Date(seq.get(i));
    const fin = ee.Date(seq.get(ee.Number(i).add(1)));
    const med = col.filterDate(ini, fin).median().reduceRegion({
      reducer: ee.Reducer.median(), geometry: geom, scale, maxPixels: 1e13
    }).get(p.index);
    return med;
  });

  const values: (number | null)[] = await evaluate(bands);
  const base = values[0];
  const deltas = values.map(v => v != null && base != null ? v - base : null);
  const days = Array.from({ length: deltas.length }, (_, i) => (i + 1) * p.windowSize);

  return { days, deltas };
}

// ----------  Severity maps  ----------
export async function generateSeverityMaps(args: {
  satellite: string;
  geometry: GeoJSON.Geometry;

  preStart: string;
  preEnd: string;
  postStart: string;
  postEnd: string;

  applySegmentation?: boolean;

  /*— parâmetros de segmentação (todos opcionais) */
  segmKernel?: number;
  segmDnbrThresh?: number;
  segmCvaThresh?: number;
  segmMinPix?: number;
}) {

  const ee   = await getEE();
  const sat  = normalizeSatelliteLabel(args.satellite);
  const geom = ee.Geometry(args.geometry);

  const col = getImageCollection(ee, sat, 'NBR')
               .filterBounds(geom)
               .filterDate(args.preStart, args.postEnd);

  const preCol  = col.filterDate(args.preStart,  args.preEnd);
  const postCol = col.filterDate(args.postStart, args.postEnd);

  /* ───── Avaliar tamanho das colecções ───── */
  const [preCount, postCount] = await Promise.all([
    evaluate<number>(preCol.size()),
    evaluate<number>(postCol.size())
  ]);

  if (preCount === 0)
    throw new Error(
      `Não há imagens ${sat} no intervalo pré-fogo: ${args.preStart} – ${args.preEnd}`
    );

  if (postCount === 0)
    throw new Error(
      `Não há imagens ${sat} no intervalo pós-fogo: ${args.postStart} – ${args.postEnd}`
    );

  /* ---------- resto do algoritmo mantém-se ---------- */
  const pre  = preCol .median();
  const post = postCol.median();
  const dNBR = pre.subtract(post).rename('dNBR').clip(geom);
  const rdNBR = dNBR.divide(pre.sqrt()).rename('rdNBR').clip(geom);
  const rbr   = dNBR.divide(pre.add(1.001)).rename('rbr').clip(geom);
  const classified = dNBR
      .where(dNBR.lte(0.1), 1)
      .where(dNBR.gt(0.1).and(dNBR.lte(0.27)), 2)
      .where(dNBR.gt(0.27).and(dNBR.lte(0.44)), 3)
      .where(dNBR.gt(0.44).and(dNBR.lte(0.66)), 4)
      .where(dNBR.gt(0.66), 5)
      .clip(geom)
      .rename('severity')
      .toInt16();

  return { deltaNBR: dNBR, rdNBR, rbr, classified };
}


/* ------------------------------------------------------------------ *
 * 6. FUNÇÕES AUXILIARES (fetchBurnedAreaLayer, getSeverityMap, …)
 * ------------------------------------------------------------------ */

export async function fetchBurnedAreaLayer(dataset: 'ICNF' | 'EFFIS', year: number) {
  const res = await fetch('/api/gee/burned-areas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset, year })
  });
  if (!res.ok) throw new Error('Failed to fetch burned area layer');
  return res.json();
}

// Helper to call severity API from frontend
export async function loadSeverityChart(
  satellite: string,
  index: 'NDVI' | 'NBR',
  fireDate: string,
  windowSize: number,
  geometry: GeoJSON.Geometry
): Promise<{ days: number[]; deltas: (number | null)[] } | null> {
  try {
    // Não normaliza aqui porque presumimos que a API vai normalizar
    const res = await fetch('/api/gee/severity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ satellite, index, fireDate, windowSize, geometry })
    });

    if (!res.ok) throw new Error('Failed to fetch severity data');

    const { data } = await res.json();
    return data;
  } catch (err) {
    console.error('Error in loadSeverityChart:', err);
    return null;
  }
}

export async function getSeverityMap(lat: number, lon: number, dataset: string, year: number) {
  try {
    const response = await fetch(`/api/gee/severity-maps?lat=${lat}&lon=${lon}&dataset=${dataset}&year=${year}`);

    if (!response.ok) {
      throw new Error('Erro ao buscar mapa de severidade');
    }

    const data = await response.json();

    return {
      tileUrl: data.tileUrl,
      bounds: {
        south: data.bounds.south,
        west: data.bounds.west,
        north: data.bounds.north,
        east: data.bounds.east
      }
    };
  } catch (error) {
    console.error('Erro na função getSeverityMap:', error);
    throw error;
  }
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
