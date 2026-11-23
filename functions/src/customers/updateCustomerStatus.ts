import { https } from 'firebase-functions/v2';
import { HttpsError } from 'firebase-functions/v2/https';
import { adminDb, adminAuth, FieldValue } from '../shared/admin.js';

interface UpdateCustomerStatusInput {
  customerId: string;
  status: 'active' | 'suspended' | 'pending_verification';
  reason?: string;
}

export const updateCustomerStatus = https.onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const uid = request.auth.uid;
  const token = request.auth.token;
  const roles = (token['roles'] as string[]) || [];
  const isAdmin =
    roles.includes('admin') ||
    roles.includes('super_admin') ||
    roles.includes('operations_admin') ||
    roles.includes('support_admin');

  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'Only administrators can update customer accounts.');
  }

  const { customerId, status, reason } = (request.data || {}) as UpdateCustomerStatusInput;
  if (!customerId || !status) {
    throw new HttpsError('invalid-argument', 'customerId and status are required.');
  }

  const allowedStatuses = ['active', 'suspended', 'pending_verification'];
  if (!allowedStatuses.includes(status)) {
    throw new HttpsError('invalid-argument', `Invalid status. Must be one of: ${allowedStatuses.join(', ')}`);
  }

  const userRef = adminDb.collection('users').doc(customerId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError('not-found', 'Customer account not found.');
  }

  const prevData = userSnap.data() || {};
  const prevStatus = prevData['status'] || 'active';

  // Update customer record
  await userRef.update({
    status,
    statusReason: reason || null,
    statusUpdatedAt: FieldValue.serverTimestamp(),
    statusUpdatedBy: uid,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // If suspended, revoke refresh tokens to invalidate current sessions
  if (status === 'suspended') {
    try {
      await adminAuth.revokeRefreshTokens(customerId);
    } catch (authErr) {
      console.warn(`[updateCustomerStatus] Could not revoke auth tokens for ${customerId}:`, authErr);
    }
  }

  // Create immutable audit log entry
  try {
    await adminDb.collection('auditLogs').add({
      actorId: uid,
      actorEmail: token.email || 'admin123@gmail.com',
      actorRole: roles[0] || 'admin',
      action: 'customer_status_updated',
      entityType: 'customer',
      entityId: customerId,
      before: { status: prevStatus },
      after: { status, reason: reason || null },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (auditErr) {
    console.warn('[updateCustomerStatus] Could not write audit log:', auditErr);
  }

  return {
    success: true,
    customerId,
    status,
    previousStatus: prevStatus,
  };
});
