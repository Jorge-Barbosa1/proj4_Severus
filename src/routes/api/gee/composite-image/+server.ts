import type { RequestHandler } from '@sveltejs/kit';
import { getEE } from '$lib/utils/gee-utils';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const ee = await getEE();
    const { satellite, index, startDate, endDate } = await request.json();

    if (!satellite || !index || !startDate || !endDate) {
      return new Response(JSON.stringify({ error: 'Parâmetros incompletos.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Região de interesse: Portugal Continental
    const roi = ee.Geometry.Polygon([
      [[-9.6, 42.2], [-6.2, 42.2], [-6.2, 36.8], [-9.6, 36.8], [-9.6, 42.2]]
    ]);

    // Coleções disponíveis
    const collections: Record<string, string> = {
      'Terra/MODIS': 'MODIS/061/MOD09A1',
      'Landsat-5/TM': 'LANDSAT/LT05/C02/T1_L2',
      'Landsat-7/ETM': 'LANDSAT/LE07/C02/T1_L2',
      'Landsat-8/OLI': 'LANDSAT/LC08/C02/T1_L2',
      'Sentinel-2/MSI': 'COPERNICUS/S2_SR_HARMONIZED'
    };

    const collectionId = collections[satellite];
    if (!collectionId) {
      return new Response(JSON.stringify({ error: `Satélite não suportado: ${satellite}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let imageCollection = ee.ImageCollection(collectionId)
      .filterBounds(roi)
      .filterDate(startDate, endDate);

    // Confirmar que existem imagens
    const count = await imageCollection.size().getInfo();
    if (count === 0) {
      console.warn('Nenhuma imagem encontrada no intervalo selecionado.');
      return new Response(JSON.stringify({ error: 'Nenhuma imagem encontrada no intervalo selecionado.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Mapeamento índice espectral
    const processed = imageCollection.map((img: any) => {
      img = ee.Image(img);
      switch (satellite) {
        case 'Terra/MODIS':
          return (index === 'NBR'
            ? img.normalizedDifference(['sur_refl_b02', 'sur_refl_b07']).rename('NBR')
            : img.normalizedDifference(['sur_refl_b02', 'sur_refl_b01']).rename('NDVI')
          ).copyProperties(img, ['system:time_start']);
        case 'Landsat-5/TM':
        case 'Landsat-7/ETM':
          return (index === 'NBR'
            ? img.normalizedDifference(['SR_B4', 'SR_B7']).rename('NBR')
            : img.normalizedDifference(['SR_B4', 'SR_B3']).rename('NDVI')           
           ).copyProperties(img, ['system:time_start']);
        case 'Landsat-8/OLI':
           return (index === 'NBR'
            ? img.normalizedDifference(['SR_B5', 'SR_B7']).rename('NBR')
            : img.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI')
          ).copyProperties(img, ['system:time_start']);
        case 'Sentinel-2/MSI':
          return (index === 'NBR'
            ? img.normalizedDifference(['B8', 'B12']).rename('NBR')
            : img.normalizedDifference(['B8', 'B4']).rename('NDVI')
          ).copyProperties(img, ['system:time_start']);
        default:
          throw new Error('Combinação inválida de satélite e índice.');
      }
    });

    // Gerar composite (imagem média)
    const composite = processed.mean().clip(roi);

    // Parâmetros de visualização
    let visParams;
    
    if (index === 'NDVI') {
      visParams = satellite.includes('MODIS') ? 
        { min: -0.2, max: 0.8, palette: ['red', 'orange', 'yellow', 'green', 'darkgreen'] } :
        { min: 0.0, max: 0.8, palette: ['brown', 'yellow', 'green', 'darkgreen'] }; // melhor para Landsat/Sentinel
    } else if (index === 'NBR') {
      visParams = { min: -1.0, max: 1.0, palette: ['red', 'orange', 'yellow', 'green', 'blue'] };
    } else {
      throw new Error('Índice desconhecido.');
    }

    // Criar mapa
    return new Promise((resolve, reject) => {
      ee.data.getMapId(
        { image: composite.visualize(visParams) },
        (mapInfo: any, err: any) => {
          if (err || !mapInfo?.urlFormat) {
            console.error('Erro ao gerar mapa:', err || mapInfo);
            resolve(
              new Response(JSON.stringify({ error: 'Erro ao gerar mapa no Earth Engine.' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
              })
            );
          } else {
            const tileUrl = mapInfo.urlFormat;
            resolve(
              new Response(JSON.stringify({ tileUrl }), {
                headers: { 'Content-Type': 'application/json' }
              })
            );
          }
        }
      );
    });
  } catch (err: any) {
    console.error('Erro geral:', err.message || err);
    return new Response(JSON.stringify({ error: 'Erro geral ao gerar imagem composta.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
