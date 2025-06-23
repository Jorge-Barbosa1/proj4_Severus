import { json } from '@sveltejs/kit';
import { getEE } from '$lib/utils/gee-utils';

import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
  const { geometry, severityRasterId } = await request.json();
  const ee = await getEE();

  const raster = ee.Image(severityRasterId);        // ou passa o raster inteiro como JSON-string
  const region = ee.Geometry(geometry);

  const hist = raster.reduceRegion({
    reducer: ee.Reducer.frequencyHistogram(),
    geometry: region,
    scale: 20,
    maxPixels: 1e13
  });

  const counts = await hist.get('Severity').getInfo();
  const ha     = Object.fromEntries(
    Object.entries(counts).map(([k,v]:[string,any]) => [k, v*20*20/10000])
  );

  return json({ areaHa: ha });
};
