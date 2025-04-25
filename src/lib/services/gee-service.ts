import { getEE } from '$lib/utils/gee-utils';

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

// Função auxiliar para await em evaluate()
function evaluate<T>(eeObject: any): Promise<T> {
  return new Promise((resolve, reject) => {
    eeObject.evaluate((result: T, err: any) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// Função principal para obter dados da série temporal
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
    .filterBounds(geom);

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

// Seleciona a coleção e o índice
function getImageCollection(ee: any, satellite: string, index: string) {
  const collections: Record<string, string> = {
    MODIS: 'MODIS/061/MOD09A1',
    Landsat5: 'LANDSAT/LT05/C02/T1_L2',
    Landsat7: 'LANDSAT/LE07/C02/T1_L2',
    Landsat8: 'LANDSAT/LC08/C02/T1_L2',
    Sentinel2: 'COPERNICUS/S2_SR_HARMONIZED'
  };

  const bandsByIndex: Record<string, [string, string]> = {
    NDVI: ['B8', 'B4'],
    NBR: ['B8', 'B12']
  };

  const [b1, b2] = bandsByIndex[index];

  return ee
    .ImageCollection(collections[satellite])
    .map((img: any) => {
      const image = ee.Image(img);
      const nd = image.normalizedDifference([b1, b2]).rename(index);
      return nd.copyProperties(image, ['system:time_start']);
    })
    .select(index);
}

// Define a escala por satélite
function getScaleForSatellite(sat: string) {
  return {
    MODIS: 500,
    Landsat5: 30,
    Landsat7: 30,
    Landsat8: 30,
    Sentinel2: 20
  }[sat] ?? 30;
}

//Função para obter os dataset de áreas queimadas
export async function fetchBurnedAreaLayer(dataset: 'ICNF' | 'EFFIS', year: number) {
  const res = await fetch('/api/gee/burned-areas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset, year })
  });

  if (!res.ok) throw new Error('Erro ao obter camada de área queimada');

  return await res.json(); // GeoJSON
}

