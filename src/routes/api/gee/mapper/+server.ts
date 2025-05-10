import { json } from '@sveltejs/kit';
import { getEE } from '$lib/utils/gee-utils';

export async function POST({ request }) {

  const ee = await getEE();
  if (!ee) {
    return json({ error: 'Erro ao inicializar o Earth Engine' }, { status: 500 });
  }
  
  const { lat, lon, dataset, year } = await request.json();

  const datasetPath = dataset === 'ICNF'
    ? 'users/joaofgo/severus_pt/AA_ICNF_2000_2021_PT_v2'
    : 'users/joaofgo/severus_pt/effis_all';

  const yearField = dataset === 'ICNF' ? 'Ano' : 'year';

  const fc = ee.FeatureCollection(datasetPath)
    .filter(ee.Filter.eq(yearField, year))
    .filterBounds(ee.Geometry.Point([lon, lat]));

  const firstFeature = fc.first();

  const geojson = await firstFeature.getInfo();
  if (!geojson) return json({ error: 'Nenhuma área encontrada' }, { status: 404 });

  return json(geojson);
}
