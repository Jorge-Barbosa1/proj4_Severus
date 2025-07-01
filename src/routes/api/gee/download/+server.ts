// src/routes/api/gee/download/+server.ts

import { getEE } from '$lib/utils/gee-utils';
import type { RequestHandler } from '@sveltejs/kit';

type SatCfg = {
  collection: string;
  bands: [string, string];
  scale: number;
  scaler: (img: any) => any;
};

const SAT_CFG: Record<string, SatCfg> = {
  'Sentinel-2/MSI': {
    collection: 'COPERNICUS/S2_SR_HARMONIZED',
    bands: ['B8', 'B12'],
    scale: 20,
    scaler: img => img.divide(1e4)
  },
  'Landsat-5/TM': {
    collection: 'LANDSAT/LT05/C02/T1_L2',
    bands: ['SR_B4', 'SR_B7'],
    scale: 30,
    scaler: img => img.multiply(0.0000275).add(-0.2)
  },
  'Landsat-7/ETM': {
    collection: 'LANDSAT/LE07/C02/T1_L2',
    bands: ['SR_B4', 'SR_B7'],
    scale: 30,
    scaler: img => img.multiply(0.0000275).add(-0.2)
  },
  'Landsat-8/OLI': {
    collection: 'LANDSAT/LC08/C02/T1_L2',
    bands: ['SR_B5', 'SR_B7'],
    scale: 30,
    scaler: img => img.multiply(0.0000275).add(-0.2)
  },
  'Landsat-9/OLI': {
    collection: 'LANDSAT/LC09/C02/T1_L2',
    bands: ['B5', 'B7'],
    scale: 30,
    scaler: img => img.multiply(0.0000275)
  },
  'Terra/MODIS': {
    collection: 'MODIS/061/MOD09A1',
    bands: ['sur_refl_b02', 'sur_refl_b07'],
    scale: 500,
    scaler: img => img.divide(1e4)
  },
  'HLS': {
    collection: 'NASA/HLS/HLSL30/v002',
    bands: ['B5', 'B7'],
    scale: 30,
    scaler: img => img.divide(1e4)
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const {
      type,
      satellite,
      preStart, preEnd,
      postStart, postEnd,
      region    // Array de 5 pares [lon,lat]
    } = await request.json();

    if (
      !type ||
      !satellite ||
      !preStart ||
      !preEnd ||
      !postStart ||
      !postEnd ||
      !region
    ) {
      return new Response('Missing parameters', { status: 400 });
    }

    const satCfg = SAT_CFG[satellite];
    if (!satCfg) {
      return new Response('Invalid satellite', { status: 400 });
    }

    const ee = await getEE();
    const regionGeom = ee.Geometry.Polygon([region]);

    // calcula o NBR pré e pós
    const makeNbr = (col: any) =>
      satCfg
        .scaler(col.median())
        .normalizedDifference(satCfg.bands)
        .rename('NBR');

    const preCol = ee.ImageCollection(satCfg.collection)
      .filterDate(preStart, preEnd)
      .filterBounds(regionGeom)
      .select(satCfg.bands);

    const postCol = ee.ImageCollection(satCfg.collection)
      .filterDate(postStart, postEnd)
      .filterBounds(regionGeom)
      .select(satCfg.bands);

    const pre  = makeNbr(preCol);
    const post = makeNbr(postCol);
    const dNBR = pre.subtract(post);

    // classes de severidade 1–5
    const image = dNBR
      .where(dNBR.lte(0.1), 1)
      .where(dNBR.gt(0.1).and(dNBR.lte(0.27)), 2)
      .where(dNBR.gt(0.27).and(dNBR.lte(0.44)), 3)
      .where(dNBR.gt(0.44).and(dNBR.lte(0.66)), 4)
      .where(dNBR.gt(0.66), 5)
      .rename('Severity')
      .toInt16();

    // pede um GeoTIFF bruto
    const downloadUrl = await image.getDownloadURL({
      name:        `Severity_${timestamp()}`,
      scale:       satCfg.scale,
      region,      // bbox de 5 pares
      format:      'GEO_TIFF',
      filePerBand: false
    });

    const upstream = await fetch(downloadUrl);
    if (!upstream.ok) {
      console.error('Earth Engine error:', await upstream.text());
      return new Response('Earth Engine error', { status: 502 });
    }

    // força extensão .tif
    const headers = new Headers(upstream.headers);
    headers.set(
      'Content-Disposition',
      `attachment; filename="severity_${timestamp()}.tif"`
    );
    headers.set('Content-Type', 'image/tiff');

    // faz streaming direto do TIFF cru
    return new Response(upstream.body, {
      status: upstream.status,
      headers
    });

  } catch (err) {
    console.error('Download handler error:', err);
    return new Response('Server error', { status: 500 });
  }
};

// timestamp helper fora do handler
const timestamp = () => {
  const d = new Date();
  return d.toISOString().replace(/[-T:Z.]/g, '').slice(0, 15);
};
