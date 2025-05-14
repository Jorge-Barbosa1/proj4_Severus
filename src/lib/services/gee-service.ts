import { getEE } from '$lib/utils/gee-utils';
import ee from '@google/earthengine';


// Types for function parameters
type TimeSeriesParams = {
  satellite: string;
  index: 'NDVI' | 'NBR';
  startDate: string;
  endDate: string;
  geometry: GeoJSON.Geometry;
};

type TimeSeriesPoint = {
  date: Date;
  value: number | null;
};

type SeverityParams = {
  satellite: string;
  index: 'NDVI' | 'NBR';
  fireDate: string; // ISO format: 'YYYY-MM-DD'
  windowSize: number; // in days
  geometry: GeoJSON.Geometry;
};

// Evaluate wrapper for Earth Engine objects
function evaluate<T>(eeObject: any): Promise<T> {
  return new Promise((resolve, reject) => {
    eeObject.evaluate((result: T, err: any) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// Main function to retrieve time series data
export async function getTimeSeriesData({
  satellite,
  index,
  startDate,
  endDate,
  geometry
}: TimeSeriesParams): Promise<TimeSeriesPoint[]> {
  const ee = await getEE();

  const geom = ee.FeatureCollection([ee.Feature(ee.Geometry(geometry))]);

  const col = getImageCollection(ee, satellite, index)
    .filterDate(startDate, endDate)
    .filterBounds(geom)
    .sort('system:time_start'); // Ensures chronological order

  const scale = getScaleForSatellite(satellite);

  const list = ee.List(col.toList(col.size()));
  const images = await evaluate<any[]>(list);

  return await Promise.all(
    images.map(async (_: any, i: number) => {
      const image = ee.Image(list.get(i));

      const mean = image.reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: geom.geometry(),
        scale: scale,
        maxPixels: 1e13
      });

      const val = await evaluate<any>(mean);
      const timestamp = await evaluate<number>(image.get('system:time_start'));

      return {
        date: new Date(timestamp),
        value: val?.[index] ?? null
      };
    })
  );
}

// Chooses image collection and computes index band
function getImageCollection(ee: any, satellite: string, index: string) {
  const collections: Record<string, string> = {
    MODIS: 'MODIS/061/MOD09A1',
    Landsat5: 'LANDSAT/LT05/C02/T1_L2',
    Landsat7: 'LANDSAT/LE07/C02/T1_L2',
    Landsat8: 'LANDSAT/LC08/C02/T1_L2',
    Sentinel2: 'COPERNICUS/S2_SR_HARMONIZED'
  };

  const defaultBands: Record<string, [string, string]> = {
    NDVI: ['SR_B5', 'SR_B4'], // Default for Landsat 8
    NBR: ['SR_B5', 'SR_B7']
  };

  const sentinelBands: Record<string, [string, string]> = {
    NDVI: ['B8', 'B4'],
    NBR: ['B8', 'B12']
  };

  const modisBands: Record<string, [string, string]> = {
    NDVI: ['sur_refl_b02', 'sur_refl_b01'],
    NBR: ['sur_refl_b02', 'sur_refl_b07']
  };

  let b1: string;
  let b2: string;

  if (satellite === 'Sentinel2') {
    [b1, b2] = sentinelBands[index];
  } else if (satellite === 'MODIS') {
    [b1, b2] = modisBands[index];
  } else {
    [b1, b2] = defaultBands[index];
  }

  return ee
    .ImageCollection(collections[satellite])
    .map((img: any) => {
      const image = ee.Image(img);
      const nd = image.normalizedDifference([b1, b2]).rename(index);
      return nd.copyProperties(image, ['system:time_start']);
    })
    .select(index);
}

// Returns pixel scale depending on satellite source
function getScaleForSatellite(sat: string) {
  return {
    MODIS: 500,
    Landsat5: 30,
    Landsat7: 30,
    Landsat8: 30,
    Sentinel2: 20
  }[sat] ?? 30;
}

// Fetch burned area layer (GeoJSON)
export async function fetchBurnedAreaLayer(dataset: 'ICNF' | 'EFFIS', year: number) {
  const res = await fetch('/api/gee/burned-areas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset, year })
  });

  if (!res.ok) throw new Error('Failed to fetch burned area layer');

  return await res.json();
}

// Computes severity trajectory based on moving time windows
export async function getSeverityTrajectory({
  satellite,
  index,
  fireDate,
  windowSize,
  geometry
}: SeverityParams): Promise<{ days: number[]; deltas: (number | null)[] }> {
  const ee = await getEE();
  const geom = ee.Geometry(geometry);

  const start = ee.Date(fireDate).advance(-windowSize, 'day');
  const end = ee.Date(Date.now());

  const dateSeq = ee.List.sequence(
    start.millis(),
    end.millis(),
    windowSize * 24 * 60 * 60 * 1000
  ).map((millis: any) => ee.Date(millis));

  const imgCol = getImageCollection(ee, satellite, index).filterBounds(geom);

  const bands = ee.List.sequence(0, dateSeq.length().subtract(2)).map(i => {
    const ini = ee.Date(dateSeq.get(i));
    const fin = ee.Date(dateSeq.get(ee.Number(i).add(1)));

    const median = imgCol
      .filterDate(ini, fin)
      .median()
      .reduceRegion({
        reducer: ee.Reducer.median(),
        geometry: geom,
        scale: getScaleForSatellite(satellite),
        maxPixels: 1e13
      })
      .get(index);

    return median;
  });

  const values: (number | null)[] = await evaluate(bands);
  const base = values[0];

  const deltas = values.map(v =>
    v != null && base != null ? v - base : null
  );

  const days = Array.from({ length: deltas.length }, (_, i) => (i + 1) * windowSize);

  return { days, deltas };
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

export async function generateSeverityMaps({
  satellite,
  geometry,
  preStart,
  preEnd,
  postStart,
  postEnd,
  applySegmentation = false
}: {
  satellite: string;
  geometry: GeoJSON.Geometry;
  preStart: string;
  preEnd: string;
  postStart: string;
  postEnd: string;
  applySegmentation?: boolean;
}): Promise<any> {
  const ee = await getEE();
  const region = ee.Geometry(geometry);

  const col = getImageCollection(ee, satellite, 'NBR').filterBounds(region);

  const scale = getScaleForSatellite(satellite);

  // PRE e POST composites
  const pre = col.filterDate(preStart, preEnd).median();
  const post = col.filterDate(postStart, postEnd).median();

  // dNBR, RdNBR, RBR
  const dNBR = pre.subtract(post).rename('dNBR');
  const rdNBR = dNBR.divide(pre.sqrt()).rename('rdNBR');
  const rbr = dNBR.divide(pre.add(1.001)).rename('rbr');

  // Classificação
  const classified = dNBR
    .where(dNBR.lte(0.1), 1)
    .where(dNBR.gt(0.1).and(dNBR.lte(0.27)), 2)
    .where(dNBR.gt(0.27).and(dNBR.lte(0.44)), 3)
    .where(dNBR.gt(0.44).and(dNBR.lte(0.66)), 4)
    .where(dNBR.gt(0.66), 5)
    .rename('severity')
    .toInt16();

  const result = {
    deltaNBR: dNBR,
    rdNBR,
    rbr,
    classified
  };

  return result;
}
