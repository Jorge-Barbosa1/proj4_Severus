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
      postEnd,
      applySegmentation = false
    } = await request.json();

    const geom = ee.Geometry(geometry);
    const scale = getScaleForSatellite(satellite);

    // Get image collections for pre and post fire periods
    const col = getImageCollection(ee, satellite, 'NBR')
      .filterBounds(geom);
    
    const pre = col.filterDate(preStart, preEnd).median();
    const post = col.filterDate(postStart, postEnd).median();

    // Calculate burn severity indices
    const dNBR = pre.subtract(post).rename('dNBR');
    const RdNBR = dNBR.divide(pre.abs().sqrt()).rename('RdNBR');
    const RBR = dNBR.divide(pre.add(1.001)).rename('RBR');

    // Classify dNBR into severity classes
    const classified = dNBR
      .where(dNBR.lte(0.1), 1)
      .where(dNBR.gt(0.1).and(dNBR.lte(0.27)), 2)
      .where(dNBR.gt(0.27).and(dNBR.lte(0.44)), 3)
      .where(dNBR.gt(0.44).and(dNBR.lte(0.66)), 4)
      .where(dNBR.gt(0.66), 5)
      .rename('Severity')
      .toInt16();

    // Apply segmentation if requested
    let finalDNBR = dNBR;
    let finalRdNBR = RdNBR;
    let finalRBR = RBR;
    let finalClassified = classified;

    if (applySegmentation) {
      // Apply median filter to smooth the results
      const medianKernelSize = 3;
      const dnbrThreshold = 0.1;
      const minAreaSize = 100;

      // Calculate delta NBR mask
      const deltaMask = dNBR
        .focalMedian({kernelType: 'square', radius: medianKernelSize})
        .gte(dnbrThreshold);
      
      // Analyze connected components
      const pixelCountImage = deltaMask.eq(1).connectedPixelCount(minAreaSize, true);
      
      // Keep only larger connected components
      const largerClumpsMask = pixelCountImage.gte(minAreaSize);
      
      // Apply mask to all layers
      finalDNBR = dNBR.updateMask(deltaMask.and(largerClumpsMask));
      finalRdNBR = RdNBR.updateMask(deltaMask.and(largerClumpsMask));
      finalRBR = RBR.updateMask(deltaMask.and(largerClumpsMask));
      finalClassified = classified.updateMask(deltaMask.and(largerClumpsMask));
    }

    // Clip to the geometry
    finalDNBR = finalDNBR.clip(geom);
    finalRdNBR = finalRdNBR.clip(geom);
    finalRBR = finalRBR.clip(geom);
    finalClassified = finalClassified.clip(geom);

    // Visualization parameters
    const visParams = {
      dNBR: { min: 0, max: 0.85, palette: ['b6cdff', 'efcc4b', 'c03838'] },
      RdNBR: { min: -0.5, max: 1.5, palette: ['b6cdff', 'efcc4b', 'c03838'] },
      RBR: { min: 0, max: 0.6, palette: ['b6cdff', 'efcc4b', 'c03838'] },
      Severity: { min: 1, max: 5, palette: ['3385ff', 'ffff4d', 'ff8000', 'b30000', '330000'] }
    };

    // Generate map URLs
    const mapPromises = [
      getTileUrl(ee, finalDNBR, visParams.dNBR, 'dNBR'),
      getTileUrl(ee, finalRdNBR, visParams.RdNBR, 'RdNBR'),
      getTileUrl(ee, finalRBR, visParams.RBR, 'RBR'),
      getTileUrl(ee, finalClassified, visParams.Severity, 'Severity')
    ];

    const mapResults = await Promise.all(mapPromises);
    
    return json({ maps: mapResults });
  } catch (err) {
    console.error('Error generating severity maps:', err);
    return json({ error: 'Server error' }, { status: 500 });
  }
}

// Helper function to get tile URL for a map layer
async function getTileUrl(ee, image, visParams, name) {
  return new Promise((resolve, reject) => {
    image.visualize(visParams).getMapId((mapid, error) => {
      if (error) reject(error);
      else resolve({
        name,
        tileUrl: mapid.tile_fetcher.url_format
      });
    });
  });
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