import { db, collection, doc, writeBatch, serverTimestamp } from './firestore.ts';
import type { PayoutBankSnapshot, PayoutRequest, PayoutRequesterType } from '@poeage/types';

const REQUESTS = 'payoutRequests';
const LOCKS = 'payoutLocks';

/** One open request per vendor/driver. The lock document is created and removed together with the request. */
export const payoutLockId = (type: PayoutRequesterType, requesterId: string) => `${type}_${requesterId}`;

export interface RequestPayoutInput {
  requesterType: PayoutRequesterType;
  requesterId: string;
  requesterName: string;
  userId: string;
  amount: number; // paise
  bank: PayoutBankSnapshot;
  note?: string;
}

/** Create a pending payout request (and its lock) in one atomic write. Returns the new request id. */
export async function requestPayout(input: RequestPayoutInput): Promise<string> {
  const ref = doc(collection(db, REQUESTS));
  const batch = writeBatch(db);
  const bank: Record<string, string> = {
    accountHolder: input.bank.accountHolder,
    accountNumber: input.bank.accountNumber,
    ifscCode: input.bank.ifscCode,
    bankName: input.bank.bankName,
  };
  if (input.bank.upiId) bank['upiId'] = input.bank.upiId;
  const data: Record<string, unknown> = {
    requesterType: input.requesterType,
    requesterId: input.requesterId,
    requesterName: input.requesterName,
    userId: input.userId,
    amount: input.amount,
    status: 'pending',
    bank,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.note?.trim()) data['note'] = input.note.trim().slice(0, 300);
  batch.set(ref, data);
  batch.set(doc(db, LOCKS, payoutLockId(input.requesterType, input.requesterId)), {
    requestId: ref.id,
    userId: input.userId,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return ref.id;
}

/** The requester withdraws their own pending request. */
export async function cancelPayoutRequest(req: Pick<PayoutRequest, 'id' | 'requesterType' | 'requesterId'>): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, REQUESTS, req.id), { status: 'cancelled', cancelledAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.delete(doc(db, LOCKS, payoutLockId(req.requesterType, req.requesterId)));
  await batch.commit();
}

export interface ProcessPayoutInput {
  request: Pick<PayoutRequest, 'id' | 'requesterType' | 'requesterId'>;
  action: 'paid' | 'rejected';
  adminId: string;
  adminEmail: string;
  /** Bank transfer / UTR reference — required when marking as paid. */
  referenceNumber?: string;
  /** Short note; the reason when rejecting. */
  adminNote?: string;
}

/** Admin decision. Frees the requester's lock so they can raise another request. */
export async function processPayoutRequest(input: ProcessPayoutInput): Promise<void> {
  const batch = writeBatch(db);
  const update: Record<string, unknown> = {
    status: input.action,
    processedBy: input.adminId,
    processedByEmail: input.adminEmail,
    processedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.action === 'paid') update['referenceNumber'] = (input.referenceNumber ?? '').trim();
  if (input.adminNote?.trim()) update['adminNote'] = input.adminNote.trim().slice(0, 300);
  batch.update(doc(db, REQUESTS, input.request.id), update);
  batch.delete(doc(db, LOCKS, payoutLockId(input.request.requesterType, input.request.requesterId)));
  await batch.commit();
}
