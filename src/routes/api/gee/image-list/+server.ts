import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getEE } from '$lib/utils/gee-utils';
import { SAT_CONF, normalizeSatelliteLabel } from '$lib/services/gee-service';

export const POST: RequestHandler = async ({ request }) => {
    const ee = await getEE();
    const { satellite, preStart, preEnd, postStart, postEnd, geometry } =
        await request.json();

    const region = ee.Geometry(geometry);

    // ---- 1. obter a coleção certa ----------------------------------
    const sat = normalizeSatelliteLabel(satellite);
    const cfg = SAT_CONF[sat];   

    if (!cfg) return json({ error: 'Satélite não suportado' }, { status: 400 });

    const col = ee.ImageCollection(cfg.ic).filterBounds(region);

    const preCol = col.filterDate(preStart, preEnd);
    const postCol = col.filterDate(postStart, postEnd);

    // ---- 2. extrair system:index para JS ----------------------------
    const toArray = (c: any) => new Promise<string[]>((ok, fail) =>
        c.aggregate_array('system:index').distinct()
            .evaluate((res: any, err: any) => err ? fail(err) : ok(res as string[]))
    );

    const [preIds, postIds] = await Promise.all([toArray(preCol), toArray(postCol)]);

    return json({ preImageIds: preIds, postImageIds: postIds });
};
