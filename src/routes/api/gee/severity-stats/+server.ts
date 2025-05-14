import { json } from '@sveltejs/kit';
import { getEE } from '$lib/utils/gee-utils';

export async function POST({ request }) {
  try {
    const ee = await getEE();
    const {
      geometry,
      satellite,
      preStart,
      preEnd,
      postStart,
      postEnd
    } = await request.json();

    const geom = ee.Geometry(geometry);
    const scale = getScaleForSatellite(satellite);

    // Get image collections for pre and post fire periods
    const col = getImageCollection(ee, satellite, 'NBR')
      .filterBounds(geom);
    
    const pre = col.filterDate(preStart, preEnd).median();
    const post = col.filterDate(postStart, postEnd).median();

    // Calculate dNBR
    const dNBR = pre.subtract(post).rename('dNBR');

    // Classify dNBR into severity classes
    const classified = dNBR
      .where(dNBR.lte(0.1), 1)
      .where(dNBR.gt(0.1).and(dNBR.lte(0.27)), 2)
      .where(dNBR.gt(0.27).and(dNBR.lte(0.44)), 3)
      .where(dNBR.gt(0.44).and(dNBR.lte(0.66)), 4)
      .where(dNBR.gt(0.66), 5)
      .rename('Severity')
      .toInt16();

    // Calculate area statistics
    const pixelArea = ee.Image.pixelArea().divide(10000); // Convert to hectares
    
    // Calculate total area
    const totalArea = classified
      .multiply(pixelArea)
      .reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: geom,
        scale: scale,
        maxPixels: 1e13
      });
    
    // Calculate area by class
    const areaByClass = ee.Image.pixelArea()
      .divide(10000) // Convert to hectares
      .addBands(classified)
      .reduceRegion({
        reducer: ee.Reducer.sum().group({
          groupField: 1,
          groupName: 'class',
        }),
        geometry: geom,
        scale: scale,
        maxPixels: 1e13
      });
    
    // Get the results
    const stats = await new Promise<any>((resolve, reject) => {
      ee.data.computeValue(areaByClass, (result, error) => {
        if (error) reject(error);
        else resolve(result);
      });
    }) as { groups: Array<{ class: number, sum: number }> };
    
    const totalAreaValue = await new Promise<any>((resolve, reject) => {
      ee.data.computeValue(totalArea, (result, error) => {
        if (error) reject(error);
        else resolve(result);
      });
    });

    // Process the results
    const classTotals: Record<number, number> = {};
    let maxClassTotal = 0;
    
    stats.groups.forEach(group => {
      const classValue = group.class;
      const area = group.sum;
      classTotals[classValue] = area;
      if (area > maxClassTotal) maxClassTotal = area;
    });

    return json({
      totalArea: totalAreaValue.Severity,
      classTotals,
      maxClassTotal
    });
  } catch (err) {
    console.error('Error calculating severity statistics:', err);
    return json({ error: 'Server error' }, { status: 500 });
  }
}

// Helper function to get the appropriate scale for a satellite
function getScaleForSatellite(sat) {
  return {
    'Terra/MODIS': 500,
    'Landsat-5/TM': 30,
    'Landsat-7/ETM': 30,
    'Landsat-8/OLI': 30,
    'Sentinel-2/MSI': 20
  }[sat] || 30;
}

// Helper function to get the appropriate image collection and calculate NBR
function getImageCollection(ee, satellite, index) {
  const collections = {
    'Terra/MODIS': 'MODIS/061/MOD09A1',
    'Landsat-5/TM': 'LANDSAT/LT05/C02/T1_L2',
    'Landsat-7/ETM': 'LANDSAT/LE07/C02/T1_L2',
    'Landsat-8/OLI': 'LANDSAT/LC08/C02/T1_L2',
    'Sentinel-2/MSI': 'COPERNICUS/S2_SR_HARMONIZED'
  };

  const bands = {
    'Terra/MODIS': ['sur_refl_b02', 'sur_refl_b07'],
    'Landsat-5/TM': ['SR_B4', 'SR_B7'],
    'Landsat-7/ETM': ['SR_B4', 'SR_B7'],
    'Landsat-8/OLI': ['SR_B5', 'SR_B7'],
    'Sentinel-2/MSI': ['B8', 'B12']
  };

  const [b1, b2] = bands[satellite];

  return ee.ImageCollection(collections[satellite])
    .map(img => {
      const image = ee.Image(img);
      return image.normalizedDifference([b1, b2]).rename('NBR')
        .copyProperties(image, ['system:time_start']);
    })
    .select('NBR');
}