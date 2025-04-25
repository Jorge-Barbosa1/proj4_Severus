import { json } from '@sveltejs/kit';
import { getEE } from '$lib/utils/gee-utils';

export async function POST({ request }) {
  try {
    const { dataset, year } = await request.json();
    const ee = await getEE();

    const datasets: Record<string, string> = {
      ICNF: 'users/joaofgo/severus_pt/AA_ICNF_2000_2021_PT_v2',
      EFFIS: 'users/joaofgo/severus_pt/effis_all'
    };

    if (!datasets[dataset]) {
      return json({ error: 'Dataset inválido' }, { status: 400 });
    }

    const collection = ee.FeatureCollection(datasets[dataset])
      .filter(ee.Filter.eq(dataset === 'ICNF' ? 'Ano' : 'year', year));

    const geojson = await new Promise((resolve, reject) => {
      collection.getInfo((res: any, err: any) => {
        if (err) reject(err);
        else resolve(res);
      });
    });

    return json(geojson);
  } catch (err) {
    console.error('Erro ao obter áreas queimadas:', err);
    return json({ message: 'Server error' }, { status: 500 });
  }
}
