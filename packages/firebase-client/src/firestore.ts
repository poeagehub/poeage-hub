import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  deleteField,
  Timestamp,
  runTransaction,
  writeBatch,
  type DocumentReference,
  type CollectionReference,
  type Query,
  type QueryConstraint,
  type DocumentSnapshot,
  type QuerySnapshot,
  type Unsubscribe,
  type FieldValue,
} from 'firebase/firestore';
import { firebaseDb } from './config.ts';

export const db = firebaseDb;

// Re-export commonly used Firestore helpers
export {
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
  Timestamp,
  type DocumentReference,
  type CollectionReference,
  type Query,
  type QueryConstraint,
  type DocumentSnapshot,
  type QuerySnapshot,
  type Unsubscribe,
  type FieldValue,
};

// Generic helpers

export async function getDocument<T>(
  collectionPath: string,
  docId: string,
): Promise<T | null> {
  const snap = await getDoc(doc(firebaseDb, collectionPath, docId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as T;
}

export async function getDocuments<T>(
  collectionPath: string,
  constraints: QueryConstraint[] = [],
): Promise<T[]> {
  const ref = collection(firebaseDb, collectionPath) as CollectionReference;
  const snap = await getDocs(query(ref, ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

export async function createDocument<T extends Record<string, unknown>>(
  collectionPath: string,
  data: T,
): Promise<string> {
  const docRef = await addDoc(collection(firebaseDb, collectionPath), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function setDocument<T extends Record<string, unknown>>(
  collectionPath: string,
  docId: string,
  data: T,
  merge = false,
): Promise<void> {
  await setDoc(
    doc(firebaseDb, collectionPath, docId),
    {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge },
  );
}

export async function updateDocument(
  collectionPath: string,
  docId: string,
  data: Record<string, unknown>,
): Promise<void> {
  await updateDoc(doc(firebaseDb, collectionPath, docId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDocument(collectionPath: string, docId: string): Promise<void> {
  await deleteDoc(doc(firebaseDb, collectionPath, docId));
}

export function subscribeToDocument<T>(
  collectionPath: string,
  docId: string,
  callback: (data: T | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(firebaseDb, collectionPath, docId),
    (snap) => callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null),
    onError,
  );
}

export function subscribeToCollection<T>(
  collectionPath: string,
  constraints: QueryConstraint[],
  callback: (data: T[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const ref = collection(firebaseDb, collectionPath) as CollectionReference;
  return onSnapshot(
    query(ref, ...constraints),
    (snap: QuerySnapshot) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T)),
    onError,
  );
}

export { arrayUnion, deleteField };
