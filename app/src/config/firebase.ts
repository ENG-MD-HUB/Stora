import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

// Firebase web config is public by design; access is controlled by Firestore security rules.
const firebaseConfig = {
  apiKey: 'AIzaSyAD8Ej-IzT9LzM3TCDOAdeaeiyNoJmfcmU',
  authDomain: 'storix-md.firebaseapp.com',
  projectId: 'storix-md',
  storageBucket: 'storix-md.appspot.com',
  messagingSenderId: '685068495158',
  appId: '1:685068495158:web:937cdf81305d127c906b97',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
// Offline cache shared across tabs: the app keeps working in warehouses with poor signal.
export const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export const COL = {
  companies: 'companies',
  joinCodes: 'joinCodes',
  users: 'users',
  warehouses: 'warehouses',
  items: 'items',
  movements: 'movements',
  releases: 'releases',
  auditLogs: 'auditLogs',
  notifications: 'notifications',
  settings: 'company_settings',
} as const;
