import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type UploadTaskSnapshot,
} from 'firebase/storage';
import { firebaseStorage } from './config.ts';

export const storage = firebaseStorage;

/**
 * Quick check that the project's Storage bucket exists and is reachable.
 * Uploads are sent as a pre-flighted cross-origin POST; a missing bucket answers that pre-flight
 * with a bare 404 (no CORS headers), which makes the request throw. We send the same kind of request
 * with no file and no credentials, so it can never create an object.
 */
export async function isStorageAvailable(): Promise<boolean> {
  const bucket = firebaseStorage.app.options.storageBucket;
  if (!bucket) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    await fetch(`https://firebasestorage.googleapis.com/v0/b/${bucket}/o`, {
      method: 'POST',
      headers: { 'X-Goog-Upload-Protocol': 'resumable' },
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  state: UploadTaskSnapshot['state'];
}

/**
 * Upload a file to Firebase Storage with progress tracking.
 */
export function uploadFile(
  storagePath: string,
  file: File,
  onProgress?: (progress: UploadProgress) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const storageRef = ref(firebaseStorage, storagePath);
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
    });

    // If Storage isn't set up (no bucket) the SDK just retries silently and progress stays at 0%.
    // Fail fast with a clear error instead of spinning forever.
    let settled = false;
    const stallTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      task.cancel();
      reject(
        Object.assign(new Error('Firebase Storage is not reachable or not enabled for this project.'), {
          code: 'storage/bucket-not-found',
        }),
      );
    }, 15000);

    task.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.bytesTransferred > 0) clearTimeout(stallTimer);
        if (onProgress) {
          onProgress({
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes,
            percentage: Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
            state: snapshot.state,
          });
        }
      },
      (error) => {
        clearTimeout(stallTimer);
        if (settled) return;
        settled = true;
        reject(error);
      },
      async () => {
        clearTimeout(stallTimer);
        if (settled) return;
        settled = true;
        try {
          resolve(await getDownloadURL(task.snapshot.ref));
        } catch (err) {
          reject(err);
        }
      },
    );
  });
}

/**
 * Upload a user avatar.
 */
export async function uploadUserAvatar(
  userId: string,
  file: File,
  onProgress?: (progress: UploadProgress) => void,
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `users/${userId}/avatar/avatar.${ext}`;
  return uploadFile(path, file, onProgress);
}

/**
 * Upload a product image.
 */
export async function uploadProductImage(
  productId: string,
  file: File,
  index: number,
  onProgress?: (progress: UploadProgress) => void,
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `products/${productId}/${index}-${Date.now()}.${ext}`;
  return uploadFile(path, file, onProgress);
}

/**
 * Upload an image for a vendor's product. Stored under the vendor's own folder so
 * storage rules can restrict writes to that vendor.
 */
export async function uploadVendorProductImage(
  vendorId: string,
  productId: string,
  file: File,
  index: number,
  onProgress?: (progress: UploadProgress) => void,
): Promise<string> {
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `products/${vendorId}/${productId}/${index}-${Date.now()}.${ext}`;
  return uploadFile(path, file, onProgress);
}

/**
 * Upload a vendor logo or banner.
 */
export async function uploadVendorAsset(
  vendorId: string,
  assetType: 'logo' | 'banner',
  file: File,
  onProgress?: (progress: UploadProgress) => void,
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `vendors/${vendorId}/${assetType}.${ext}`;
  return uploadFile(path, file, onProgress);
}

/**
 * Delete a file from storage.
 */
export async function deleteFile(storagePath: string): Promise<void> {
  const storageRef = ref(firebaseStorage, storagePath);
  await deleteObject(storageRef);
}

/**
 * Get the download URL of an existing file.
 */
export async function getFileURL(storagePath: string): Promise<string> {
  const storageRef = ref(firebaseStorage, storagePath);
  return getDownloadURL(storageRef);
}
