import { json } from '@sveltejs/kit';
import { getEE } from '$lib/utils/gee-utils';

export async function POST({ request }) {
  try {
    const {
      geometry,
      satellite,
      preStart,
      preEnd,
      postStart,
      postEnd,
      applySegmentation
    } = await request.json();

    console.log('📥 Dados recebidos para gerar mapa de severidade:', {
      geometry, satellite, preStart, preEnd, postStart, postEnd, applySegmentation
    });

    const ee = await getEE();
    const geom = ee.Geometry(geometry);

    // SATÉLITES E BANDAS PARA NBR
    const satelliteConfig: Record<string, { collection: string; bands: [string, string] }> = {
      'Sentinel-2/MSI': {
        collection: 'COPERNICUS/S2_SR_HARMONIZED',
        bands: ['B8', 'B12']
      },
      'Landsat-5/TM': {
        collection: 'LANDSAT/LT05/C02/T1_L2',
        bands: ['SR_B4', 'SR_B7']
      },
      'Landsat-7/ETM': {
        collection: 'LANDSAT/LE07/C02/T1_L2',
        bands: ['SR_B4', 'SR_B7']
      },
      'Landsat-8/OLI': {
        collection: 'LANDSAT/LC08/C02/T1_L2',
        bands: ['SR_B5', 'SR_B7']
      },
      'Terra/MODIS': {
        collection: 'MODIS/061/MOD09GA',
        bands: ['sur_refl_b02', 'sur_refl_b07']
      }
    };

    const config = satelliteConfig[satellite];
    if (!config) throw new Error(`Satélite não suportado: ${satellite}`);

    const { collection, bands } = config;

    // Função auxiliar para preparar a imagem
    function prepareImage(image: any) {
      let img = image.select(bands).divide(10000);
      return img.normalizedDifference(bands).rename('NBR');
    }

    const pre = ee.ImageCollection(collection)
      .filterBounds(geom)
      .filterDate(preStart, preEnd)
      .map(prepareImage)
      .median();

    const post = ee.ImageCollection(collection)
      .filterBounds(geom)
      .filterDate(postStart, postEnd)
      .map(prepareImage)
      .median();

    const dNBR = pre.subtract(post).rename('dNBR');

    let severity = dNBR
      .where(dNBR.lte(0.1), 1)
      .where(dNBR.gt(0.1).and(dNBR.lte(0.27)), 2)
      .where(dNBR.gt(0.27).and(dNBR.lte(0.44)), 3)
      .where(dNBR.gt(0.44).and(dNBR.lte(0.66)), 4)
      .where(dNBR.gt(0.66), 5);

    if (applySegmentation) {
      severity = severity.focal_mode(1.5, 'circle', 'pixels', 2);
    }

    const visualized = severity.visualize({
      min: 1,
      max: 5,
      palette: ['3385ff', 'ffff4d', 'ff8000', 'b30000', '330000']
    });

    return new Promise((resolve, reject) => {
      ee.data.getMapId({ image: visualized }, (mapInfo: any, err: any) => {
        if (err || !mapInfo?.urlFormat) {
          console.error('Erro ao gerar tile:', err || mapInfo);
          resolve(
            json({ error: 'Erro ao gerar tile com GEE.' }, { status: 500 })
          );
        } else {
          const tileUrl = mapInfo.urlFormat;
          resolve(
            json({
              maps: [
                {
                  name: 'Mapa de Severidade',
                  tileUrl,
                  previewUrl: null
                }
              ]
            })
          );
        }
      }); 
    });

  } catch (err) {
    console.error('❌ Erro ao gerar mapa de severidade:', err);
    return json({ error: 'Erro ao gerar mapa de severidade' }, { status: 500 });
  }
}
