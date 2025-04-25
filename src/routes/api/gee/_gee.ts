import ee from '@google/earthengine';
import { JWT } from 'google-auth-library';
import { env } from '$env/dynamic/private';   // runtime

const SERVICE_ACCOUNT = env.SERVICE_ACCOUNT;
const PRIVATE_KEY = env.PRIVATE_KEY?.replace(/\\n/g, '\n'); // escapa \n

let initialised = false;

export async function initEE() {
    if (initialised) return;

    console.time('ee-auth');          // mede tempo

    const jwt = new JWT({
        email: SERVICE_ACCOUNT,
        key: PRIVATE_KEY,
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    await new Promise<void>((res, rej) => {
        console.log('[initEE] a autenticar…');
        ee.data.authenticateViaPrivateKey(
            jwt,
            () => {
                console.log('[initEE] auth OK, a inicializar EE…');
                ee.initialize(null, null,
                    () => { console.log('[initEE] EE ready'); /* … */ },
                    (err) => console.error('[initEE] ee.initialize ERRO', err)
                );
            },
            (err) => console.error('[initEE] authenticateViaPrivateKey ERRO', err)
        );
    });
}
