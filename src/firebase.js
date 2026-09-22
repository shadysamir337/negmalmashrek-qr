import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import {
    initializeAppCheck,
    ReCaptchaV3Provider,
} from 'firebase/app-check'

export const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyClDnCsYwf04vSO-dpI6ReWiU74oKAJSIo',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'qr-attendance-2a659.firebaseapp.com',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'qr-attendance-2a659',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'qr-attendance-2a659.firebasestorage.app',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '707890146596',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:707890146596:web:35345ca5c1a40a3ddf57b1',
}

// The root admin account. Additional admins/scanners are created from the
// Users page and live in the /users collection with a role field.
export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'admin@negmalmashrek.com'

const app = initializeApp(firebaseConfig)

// --- App Check (optional) ---
// To enable, register a reCAPTCHA v3 site key in Firebase Console
// (App Check -> Apps -> reCAPTCHA v3) and put it in a `.env` file:
//   VITE_RECAPTCHA_V3_SITE_KEY=YOUR_SITE_KEY
// The app will automatically activate App Check when the env var is present.
const recaptchaKey = import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY
if (recaptchaKey) {
    try {
        // Allow debug token in dev
        if (import.meta.env.DEV) {
            // eslint-disable-next-line no-undef
            self.FIREBASE_APPCHECK_DEBUG_TOKEN = true
        }
        initializeAppCheck(app, {
            provider: new ReCaptchaV3Provider(recaptchaKey),
            isTokenAutoRefreshEnabled: true,
        })
        if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.log('[firebase] App Check initialized')
        }
    } catch (e) {
        if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.warn('[firebase] App Check init failed:', e)
        }
    }
}

export const db = getFirestore(app)
export const auth = getAuth(app)
export default app
