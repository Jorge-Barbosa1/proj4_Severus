// src/routes/api/gee/severity/+server.ts
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getEE } from '$lib/utils/gee-utils';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const ee = await getEE();
    const { satellite, index, fireDate, windowSize, geometry } = await request.json();

    const region = ee.Geometry(geometry);

    const collections: Record<string, string> = {
      'Terra/MODIS': 'MODIS/061/MOD09A1',
      'Landsat-5/TM': 'LANDSAT/LT05/C02/T1_L2',
      'Landsat-7/ETM': 'LANDSAT/LE07/C02/T1_L2',
      'Landsat-8/OLI': 'LANDSAT/LC08/C02/T1_L2',
      'Sentinel-2/MSI': 'COPERNICUS/S2_SR_HARMONIZED'
    };

    const bands: Record<string, [string, string]> = {
      NDVI: ['SR_B5', 'SR_B4'],
      NBR: ['SR_B5', 'SR_B7']
    };

    const modisBands = {
      NDVI: ['sur_refl_b02', 'sur_refl_b01'],
      NBR: ['sur_refl_b02', 'sur_refl_b07']
    };

    const sentinelBands = {
      NDVI: ['B8', 'B4'],
      NBR: ['B8', 'B12']
    };

    const scaleMap = {
      'Terra/MODIS': 500,
      'Landsat-5/TM': 30,
      'Landsat-7/ETM': 30,
      'Landsat-8/OLI': 30,
      'Sentinel-2/MSI': 20
    };

    const collectionId = collections[satellite];
    if (!collectionId) throw new Error(`Satélite não suportado: ${satellite}`);

    // Escolher bandas
    let b1: string, b2: string;
    if (satellite === 'Terra/MODIS') {
      [b1, b2] = modisBands[index];
    } else if (satellite === 'Sentinel-2/MSI') {
      [b1, b2] = sentinelBands[index];
    } else {
      [b1, b2] = bands[index];
    }

    // Criação da sequência de datas com janelas móveis
    const start = ee.Date(fireDate).advance(windowSize * -1, 'day');
    const end = ee.Date(Date.now());

    const stepMillis = windowSize * 24 * 60 * 60 * 1000;

    const dateSeq = ee.List.sequence(start.millis(), end.millis(), stepMillis).map(m => ee.Date(m));
    const imgCol = ee.ImageCollection(collectionId).filterBounds(region);

    const imgSeq = ee.List.sequence(0, dateSeq.length().subtract(2)).map(i => {
      const ini = ee.Date(dateSeq.get(i));
      const fin = ee.Date(dateSeq.get(ee.Number(i).add(1)));

      return imgCol
        .filterDate(ini, fin)
        .map((img: any) => {
          img = ee.Image(img);
          return img.normalizedDifference([b1, b2]).rename(index).copyProperties(img, ['system:time_start']);
        })
        .median();
    });

    const bandsImg = ee.ImageCollection.fromImages(imgSeq).toBands();

    const reducer = bandsImg.reduceRegion({
      reducer: ee.Reducer.median(),
      geometry: region,
      scale: scaleMap[satellite] ?? 30,
      maxPixels: 1e13
    });

    const values = await new Promise<number[]>((resolve, reject) => {
      reducer.evaluate((res: any, err: any) => {
        if (err) reject(err);
        else resolve(Object.values(res));
      });
    });

    const base = values[0];
    const deltas = values.map((v) => (v != null && base != null ? v - base : null));
    const days = Array.from({ length: deltas.length }, (_, i) => (i + 1) * windowSize);

    return json({ data: { days, deltas } });

  } catch (err: any) {
    console.error('Erro em /api/gee/severity:', err);
    return json({ error: err.message ?? 'Erro desconhecido.' }, { status: 500 });
  }
};
