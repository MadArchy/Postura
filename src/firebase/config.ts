/**
 * Configuración Firebase para piloto multiusuario.
 * Las credenciales reales se inyectan vía variables de entorno en despliegue.
 */
import { assertNonProductionFirebaseProjectForE2E } from './productionGuard';

export interface FirebaseRuntimeConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
  useEmulators: boolean;
}

export function readFirebaseConfig(): FirebaseRuntimeConfig | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  if (!apiKey || !projectId) return null;
  const config: FirebaseRuntimeConfig = {
    apiKey,
    authDomain: String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`),
    projectId,
    storageBucket: String(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`),
    messagingSenderId: String(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || ''),
    appId: String(import.meta.env.VITE_FIREBASE_APP_ID || ''),
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined,
    useEmulators: import.meta.env.VITE_FIREBASE_USE_EMULATORS === 'true',
  };
  if (isE2EFirebaseContext()) {
    assertNonProductionFirebaseProjectForE2E(config, 'Firebase init');
  }
  return config;
}

/** Vite `--mode test` (Playwright webServer) or explicit E2E flag. */
export function isE2EFirebaseContext(): boolean {
  return import.meta.env.MODE === 'test' || import.meta.env.VITE_POSTURA_E2E === 'true';
}

export const FIREBASE_ENABLED = Boolean(readFirebaseConfig());
