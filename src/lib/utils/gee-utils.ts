// this file is used to initialize the Google Earth Engine API
// and authenticate using a service account. It exports a function `getEE`
import ee from '@google/earthengine';
import privateKey from '$lib/config/severus-457615-9206f875b449.json';

let cachedEE: any = null;

export async function getEE(): Promise<any> {
  if (cachedEE) return cachedEE;

  return new Promise((resolve, reject) => {
    ee.data.authenticateViaPrivateKey(privateKey, () => {
      ee.initialize(null, null, () => {
        cachedEE = ee;
        resolve(ee);
      }, (initErr) => {
        console.error('Earth Engine initialization failed:', initErr);
        reject(initErr);
      });
    }, (authErr) => {
      console.error('Authentication failed:', authErr);
      reject(authErr);
    });
  });
}
