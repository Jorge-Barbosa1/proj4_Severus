import { getEE } from '$lib/utils/gee-utils';

export async function GET({ url }) {
  try {
    const ee = await getEE();
    
    const type = url.searchParams.get('type');
    const satellite = url.searchParams.get('satellite');
    const preStart = url.searchParams.get('preStart');
    const preEnd = url.searchParams.get('preEnd');
    const postStart = url.searchParams.get('postStart');
    const postEnd = url.searchParams.get('postEnd');
    const geometry = url.searchParams.get('geometry');
    
    if (!type || !satellite || !preStart || !preEnd || !postStart || !postEnd) {
      return new Response('Missing required parameters', { status: 400 });
    }
    
    // Parse geometry if provided, otherwise use the global extent
    const geom = geometry 
      ? ee.Geometry(JSON.parse(geometry))
      : ee.Geometry.Rectangle([-180, -90, 180, 90]);
    
    const scale = getScaleForSatellite(satellite);
    
    // Get image collections for pre and post fire periods
    const col = getImageCollection(ee, satellite, 'NBR')
      .filterBounds(geom);
    
    const pre = col.filterDate(preStart, preEnd).median();
    const post = col.filterDate(postStart, postEnd).median();
    
    // Calculate indices based on the requested type
    let image;
    let description;
    
    switch (type) {
      case 'dNBR':
        image = pre.subtract(post).rename('dNBR');
        description = 'Delta_NBR';
        break;
      case 'RdNBR':
        image = pre.subtract(post).divide(pre.abs().sqrt()).rename('RdNBR');
        description = 'Relativized_Delta_NBR';
        break;
      case 'RBR':
        image = pre.subtract(post).divide(pre.add(1.001)).rename('RBR');
        description = 'Relative_Burn_Ratio';
        break;
      case 'Severity':
        const dNBR = pre.subtract(post);
        image = dNBR
          .where(dNBR.lte(0.1), 1)
          .where(dNBR.gt(0.1).and(dNBR.lte(0.27)), 2)
          .where(dNBR.gt(0.27).and(dNBR.lte(0.44)), 3)
          .where(dNBR.gt(0.44).and(dNBR.lte(0.66)), 4)
          .where(dNBR.gt(0.66), 5)
          .rename('Severity')
          .toInt16();
        description = 'Burn_Severity_Classes';
        break;
      default:
        return new Response('Invalid map type', { status: 400 });
    }
    
    // Clip to the geometry
    image = image.clip(geom);
    
    // Generate download URL
    const downloadUrl = image.getDownloadURL({
      name: `SEverusPT_${satellite.replace(/\//g, '_')}_${description}_${getCurrentDateTime()}`,
      scale: scale,
      region: geom,
      filePerBand: false,
      format: 'GEO_TIFF'
    });
    
    // Redirect to the download URL
    return Response.redirect(downloadUrl);
  } catch (err) {
    console.error('Error generating download:', err);
    return new Response('Server error', { status: 500 });
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

// Helper function to get current date and time in YYYYMMDD_HHMMSS format
function getCurrentDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}