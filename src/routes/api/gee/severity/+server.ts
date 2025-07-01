// src/routes/api/gee/severity/+server.ts
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getEE } from '$lib/utils/gee-utils';
import { normalizeSatelliteLabel, SAT_CONF } from '$lib/services/gee-service';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const ee = await getEE();
    const {
      satellite: satLabel,
      index, fireDate, windowSize, geometry
    } = await request.json();

    const sat  = normalizeSatelliteLabel(satLabel);      // ex.: "Landsat8"
    const cfg  = SAT_CONF[sat];
    if (!cfg) throw new Error(`Satélite não suportado: ${satLabel}`);

    const region       = ee.Geometry(geometry);
    const collectionId = cfg.ic;
    const scale        = cfg.scale;
    const [b1, b2]     = cfg.bands[index];               // bandas correctas

    /* ───── sequência de janelas temporais ───── */
    const start      = ee.Date(fireDate).advance(-windowSize, 'day');
    const end        = ee.Date(Date.now());
    const stepMillis = windowSize * 24 * 60 * 60 * 1000;

    const dateSeq = ee.List
      .sequence(start.millis(), end.millis(), stepMillis)
      .map(m => ee.Date(m));

    const imgCol = ee.ImageCollection(collectionId).filterBounds(region);

    const imgSeq = ee.List.sequence(0, dateSeq.length().subtract(2)).map(i => {
      const ini = ee.Date(dateSeq.get(i));
      const fin = ee.Date(dateSeq.get(ee.Number(i).add(1)));

      return imgCol
        .filterDate(ini, fin)
        .map((img: any) =>
          ee.Image(img)
            .normalizedDifference([b1, b2])
            .rename(index)
            .copyProperties(img, ['system:time_start'])
        )
        .median();
    });

    const bandsImg = ee.ImageCollection.fromImages(imgSeq).toBands();

    const reducer = bandsImg.reduceRegion({
      reducer: ee.Reducer.median(),
      geometry: region,
      scale,
      maxPixels: 1e13
    });

    const values: number[] = await new Promise((ok, err) =>
      reducer.evaluate((v: any, e: any) => (e ? err(e) : ok(Object.values(v))))
    );

    const base   = values[0];
    const deltas = values.map(v => (v != null && base != null ? v - base : null));
    const days   = Array.from({ length: deltas.length }, (_, i) => (i + 1) * windowSize);

    return json({ data: { days, deltas } });

  } catch (err: any) {
    console.error('Erro em /api/gee/severity:', err);
    return json({ error: err.message ?? 'Erro desconhecido.' }, { status: 500 });
  }
};
