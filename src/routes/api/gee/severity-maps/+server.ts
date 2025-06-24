// src/routes/api/gee/severity-maps/+server.ts
import { json, type RequestHandler } from '@sveltejs/kit';

import ee from '@google/earthengine';
import {
  generateSeverityMaps,
  normalizeSatelliteLabel
} from '$lib/services/gee-service';



/* ------------------------------------------------------------------ */
/*  Paletas de visualização                                            */
/* ------------------------------------------------------------------ */
const VIS = {
  deltaNBR: { min: 0,   max: 0.85, palette: ['b6cdff', 'efcc4b', 'c03838'] },
  rdNBR   : { min: -0.5, max: 1.5, palette: ['b6cdff', 'efcc4b', 'c03838'] },
  rbr     : { min: 0,   max: 0.6,  palette: ['b6cdff', 'efcc4b', 'c03838'] },
  classified: {
    min: 1, max: 5,
    palette: ['3385ff', 'ffff4d', 'ff8000', 'b30000', '330000']
  }
};

/* ------------------------------------------------------------------ */
/*  POST /api/gee/severity-maps                                        */
/* ------------------------------------------------------------------ */
export const POST: RequestHandler = async ({ request }) => {
  try {
    /* ---------- 1. Body ---------- */
    const {
      satellite,
      geometry,
      preStart, preEnd,
      postStart, postEnd,

      /*––– parâmetros opcionais –––*/
      applySegmentation = false,
      segmKernel,
      segmDnbrThresh,
      segmCvaThresh,
      segmMinPix
    } = await request.json();

    /* ---------- 2. Normalizar e delegar ---------- */
    const sat = normalizeSatelliteLabel(satellite);

    const imgs = await generateSeverityMaps({
      satellite      : sat,
      geometry,
      preStart, preEnd,
      postStart, postEnd,
      applySegmentation,
      segmKernel, segmDnbrThresh, segmCvaThresh, segmMinPix
    });
    

    /* ---------- 3. Gerar tiles ---------- */
    const toTile = (
      name: keyof typeof imgs,
      image: any
    ) => new Promise<{ name: string; tileUrl: string }>((ok, err) => {
      ee.data.getMapId(
        { image: image.visualize(VIS[name]) },
        (info: any, e: any) =>
          e || !info?.urlFormat ? err(e ?? new Error('getMapId falhou'))
                                : ok({ name, tileUrl: info.urlFormat })
      );
    });

    const maps = await Promise.all([
      toTile('deltaNBR', imgs.deltaNBR),
      toTile('rdNBR'   , imgs.rdNBR),
      toTile('rbr'     , imgs.rbr),
      toTile('classified', imgs.classified)
    ]);

    /* ---------- 4. Done ---------- */
    return json({ maps });
  } catch (e: any) {
    console.error('❌ severity-maps:', e);
    return json({ error: e.message ?? 'Erro desconhecido' }, { status: 500 });
  }
};
