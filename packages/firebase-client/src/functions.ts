import { httpsCallable } from 'firebase/functions';
import { firebase } from './config.ts';

/**
 * Cloud Functions need the Blaze plan. Until they are deployed, every app writes to Firestore directly
 * (security rules do the checking). Set VITE_USE_CLOUD_FUNCTIONS=true once the functions are deployed.
 * While disabled, calls fail immediately with no network request, so there are no CORS errors or delays.
 */
export const CLOUD_FUNCTIONS_ENABLED = import.meta.env['VITE_USE_CLOUD_FUNCTIONS'] === 'true';

export async function callFunction<TResponse = unknown, TRequest = unknown>(
  name: string,
  data?: TRequest,
): Promise<TResponse> {
  if (!CLOUD_FUNCTIONS_ENABLED) {
    throw new Error(`Cloud Function "${name}" is not enabled for this project.`);
  }
  const callable = httpsCallable<TRequest, TResponse>(firebase.functions, name);
  const result = await callable(data);
  return result.data;
}

export { httpsCallable };
