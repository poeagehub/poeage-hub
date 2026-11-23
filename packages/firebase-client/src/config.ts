import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions';

declare global {
  interface ImportMeta {
    readonly env: Record<string, string | boolean | undefined>;
  }
}

function requireEnv(name: string): string {
  const value = import.meta.env[name] as string | undefined;
  if (!value) {
    throw new Error(
      `[Firebase] Missing ${name}. Copy .env.example to .env and fill in your Firebase project values.`,
    );
  }
  return value;
}

const firebaseConfig: FirebaseOptions = {
  apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
  authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: requireEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: requireEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requireEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requireEnv('VITE_FIREBASE_APP_ID'),
  ...(import.meta.env['VITE_FIREBASE_MEASUREMENT_ID'] ? { measurementId: import.meta.env['VITE_FIREBASE_MEASUREMENT_ID'] as string } : {}),
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let functions: Functions;

function initFirebase() {
  if (getApps().length > 0) {
    app = getApps()[0]!;
  } else {
    app = initializeApp(firebaseConfig);
  }

  auth = getAuth(app);
  // Some networks, proxies and VPNs block Firestore's streaming connection, which shows up as
  // "Could not reach Cloud Firestore backend". Let the SDK fall back to long-polling automatically.
  try {
    db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  } catch {
    db = getFirestore(app); // already initialised (e.g. after a hot reload)
  }
  storage = getStorage(app);
  functions = getFunctions(app, 'asia-south1');

  const useEmulators = import.meta.env['VITE_USE_EMULATORS'] === 'true';

  if (useEmulators && import.meta.env.DEV) {
    try {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
      connectStorageEmulator(storage, '127.0.0.1', 9199);
      connectFunctionsEmulator(functions, '127.0.0.1', 5001);
      console.info('[Firebase] Connected to emulators');
    } catch {
      // Already connected
    }
  }

  return { app, auth, db, storage, functions };
}

const firebase = initFirebase();

export { firebase };
export const { app: firebaseApp, auth: firebaseAuth, db: firebaseDb, storage: firebaseStorage, functions: firebaseFunctions } = firebase;
