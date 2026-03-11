// this file is used to initialize the Google Earth Engine API
// and authenticate using a service account. It exports a function `getEE`
import ee from '@google/earthengine';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedEE: any = null;

// Load private key from file or environment variable
function loadPrivateKey() {
  // Try to load from environment variable first
  if (process.env.GEE_PRIVATE_KEY) {
    try {
      return JSON.parse(process.env.GEE_PRIVATE_KEY);
    } catch (e) {
      console.error('Failed to parse GEE_PRIVATE_KEY from environment');
    }
  }

  // Try to load from file
  const keyPath = path.join(__dirname, '../config/severus-457615-83acf40ce029.json');
  if (fs.existsSync(keyPath)) {
    return JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
  }

  throw new Error('GEE private key not found. Set GEE_PRIVATE_KEY environment variable or place key file at src/lib/config/');
}

export async function getEE(): Promise<any> {
  if (cachedEE) return cachedEE;

  const privateKey = loadPrivateKey();

  return new Promise((resolve, reject) => {
    ee.data.authenticateViaPrivateKey(privateKey, () => {
      ee.initialize(null, null, () => {
        cachedEE = ee;
        resolve(ee);
      }, (initErr: any) => {
        console.error('Earth Engine initialization failed:', initErr);
        reject(initErr);
      });
    }, (authErr: any) => {
      console.error('Authentication failed:', authErr);
      reject(authErr);
    });
  });
}
