/**
 * Client-safe GEE constants and utilities
 * No server-side dependencies - safe to import in React components
 */

/**
 * Normalize satellite labels from UI format to internal format
 */
export function normalizeSatelliteLabel(label: string): string {
  return ({
    'Landsat-9/OLI': 'Landsat9',
    'Landsat-8/OLI': 'Landsat8',
    'Landsat-7/ETM': 'Landsat7',
    'Landsat-5/TM': 'Landsat5',
    'Sentinel-2/MSI': 'Sentinel2',
    'Terra/MODIS': 'MODIS',
    'HLS (S2+L8)': 'HLS'
  } as Record<string, string>)[label] ?? label;
}

/**
 * Satellite configuration type
 */
export type SatConf = {
  ic: string;
  scale: number;
  bands: Record<'NDVI' | 'NBR', [string, string]>;
};

/**
 * Satellite configurations (client-safe subset)
 */
export const SAT_CONF: Record<string, SatConf> = {
  Sentinel2: {
    ic: 'COPERNICUS/S2_SR_HARMONIZED',
    scale: 20,
    bands: { NDVI: ['B8', 'B4'], NBR: ['B8', 'B12'] }
  },
  Landsat5: {
    ic: 'LANDSAT/LT05/C02/T1_L2',
    scale: 30,
    bands: { NDVI: ['SR_B4', 'SR_B3'], NBR: ['SR_B4', 'SR_B7'] }
  },
  Landsat7: {
    ic: 'LANDSAT/LE07/C02/T1_L2',
    scale: 30,
    bands: { NDVI: ['SR_B4', 'SR_B3'], NBR: ['SR_B4', 'SR_B7'] }
  },
  Landsat8: {
    ic: 'LANDSAT/LC08/C02/T1_L2',
    scale: 30,
    bands: { NDVI: ['SR_B5', 'SR_B4'], NBR: ['SR_B5', 'SR_B7'] }
  },
  Landsat9: {
    ic: 'LANDSAT/LC09/C02/T1_L2',
    scale: 30,
    bands: { NDVI: ['SR_B5', 'SR_B4'], NBR: ['SR_B5', 'SR_B7'] }
  },
  MODIS: {
    ic: 'MODIS/061/MOD09GA',
    scale: 500,
    bands: { NDVI: ['sur_refl_b02', 'sur_refl_b01'], NBR: ['sur_refl_b02', 'sur_refl_b06'] }
  },
  HLS: {
    ic: 'NASA/HLS/HLSS30/v002',
    scale: 30,
    bands: { NDVI: ['B8A', 'B4'], NBR: ['B8A', 'B12'] }
  }
};
