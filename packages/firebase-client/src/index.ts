// Firebase Client — public API
export { firebase, firebaseApp, firebaseAuth, firebaseDb, firebaseStorage, firebaseFunctions } from './config.ts';

export {
  auth,
  signIn,
  register,
  signInWithGoogle,
  logout,
  resetPassword,
  onAuthChange,
  getIdToken,
  getIdTokenResult,
  type User,
} from './auth.ts';

export {
  db,
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  runTransaction,
  writeBatch,
  serverTimestamp,
  arrayUnion,
  deleteField,
  Timestamp,
  getDocument,
  getDocuments,
  createDocument,
  setDocument,
  updateDocument,
  deleteDocument,
  subscribeToDocument,
  subscribeToCollection,
  type DocumentReference,
  type CollectionReference,
  type Query,
  type QueryConstraint,
  type DocumentSnapshot,
  type QuerySnapshot,
  type Unsubscribe,
  type FieldValue,
} from './firestore.ts';

export {
  storage,
  uploadFile,
  uploadUserAvatar,
  uploadProductImage,
  uploadVendorProductImage,
  isStorageAvailable,
  uploadVendorAsset,
  deleteFile,
  getFileURL,
  type UploadProgress,
} from './storage.ts';

export { callFunction, httpsCallable } from './functions.ts';


export { friendlyError } from './errors.ts';

export {
  DEFAULT_PLATFORM_SETTINGS,
  getPlatformSettings,
  subscribePlatformSettings,
  type PlatformSettingsData,
} from './platformSettings.ts';

export {
  requestPayout,
  cancelPayoutRequest,
  processPayoutRequest,
  payoutLockId,
  type RequestPayoutInput,
  type ProcessPayoutInput,
} from './payouts.ts';
