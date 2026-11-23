import {
  getDocuments,
  updateDocument,
  createDocument,
  subscribeToCollection,
  callFunction,
  where,
  orderBy,
  serverTimestamp,
  db,
  type Unsubscribe,
} from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { UserProfile, Order, Address, AuditLog, AccountStatus } from '@poeage/types';
import { formatMoney, generateId, formatDate, formatDateTime } from '@poeage/utils';

/**
 * Safely format Firestore timestamp or date object into formatted date string
 */
export function safeFormatDate(ts: any): string {
  if (!ts) return 'N/A';
  if (typeof ts?.toDate === 'function') {
    return formatDate(ts.toDate());
  }
  if (typeof ts?.seconds === 'number') {
    return formatDate(new Date(ts.seconds * 1000));
  }
  if (ts instanceof Date) {
    return formatDate(ts);
  }
  return 'N/A';
}

/**
 * Safely format Firestore timestamp or date object into formatted date-time string
 */
export function safeFormatDateTime(ts: any): string {
  if (!ts) return 'N/A';
  if (typeof ts?.toDate === 'function') {
    return formatDateTime(ts.toDate());
  }
  if (typeof ts?.seconds === 'number') {
    return formatDateTime(new Date(ts.seconds * 1000));
  }
  if (ts instanceof Date) {
    return formatDateTime(ts);
  }
  return 'N/A';
}

/**
 * Normalizes customer document to ensure safe defaults for all fields
 */
export function normalizeCustomer(doc: Partial<UserProfile> & { id: string }): UserProfile {
  const result: UserProfile = {
    id: doc.id || doc.uid || '',
    uid: doc.uid || doc.id || '',
    email: doc.email || '',
    displayName: doc.displayName || doc.email?.split('@')[0] || 'Customer',
    phone: doc.phone || '',
    roles: doc.roles && Array.isArray(doc.roles) ? doc.roles : ['customer'],
    status: (doc.status as AccountStatus) || 'active',
    createdAt: (doc.createdAt as any) || { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
    updatedAt: (doc.updatedAt as any) || { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
    metadata: {
      totalOrders: Number(doc.metadata?.totalOrders) || 0,
      totalSpent: Number(doc.metadata?.totalSpent) || 0,
      ...(doc.metadata?.lastOrderAt ? { lastOrderAt: doc.metadata.lastOrderAt } : {}),
    },
  };

  if (doc.photoURL) {
    result.photoURL = doc.photoURL;
  }
  if (doc.defaultAddressId) {
    result.defaultAddressId = doc.defaultAddressId;
  }

  return result;
}

/**
 * Real-time listener for all users/customers from Firestore
 */
export function subscribeToCustomers(
  onData: (customers: UserProfile[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return subscribeToCollection<UserProfile>(
    COLLECTION.USERS,
    [],
    (users) => {
      const normalized = users.map(normalizeCustomer);
      onData(normalized);
    },
    onError
  );
}

/**
 * One-time fetch of all customers
 */
export async function getCustomersList(): Promise<UserProfile[]> {
  try {
    const rawUsers = await getDocuments<UserProfile>(COLLECTION.USERS);
    return rawUsers.map(normalizeCustomer);
  } catch (err) {
    console.warn('[customers] Failed to fetch users list:', err);
    throw err;
  }
}

/**
 * Fetch all orders belonging to a specific customer
 */
export async function getCustomerOrders(customerId: string): Promise<Order[]> {
  try {
    // Try querying by customerId first
    let orders = await getDocuments<Order>(COLLECTION.ORDERS, [
      where('customerId', '==', customerId),
    ]);

    // Fallback: If no orders found, check if they were saved with userId
    if (!orders || orders.length === 0) {
      const fallbackOrders = await getDocuments<Order>(COLLECTION.ORDERS, [
        where('userId', '==', customerId),
      ]);
      orders = fallbackOrders;
    }

    // Sort descending by creation date
    return orders.sort((a, b) => {
      const timeA = (a.createdAt as any)?.seconds || 0;
      const timeB = (b.createdAt as any)?.seconds || 0;
      return timeB - timeA;
    });
  } catch (err) {
    console.warn(`[customers] Error fetching orders for customer ${customerId}:`, err);
    return [];
  }
}

/**
 * Fetch saved delivery addresses for a customer
 */
export async function getCustomerAddresses(userId: string): Promise<Address[]> {
  try {
    const addresses = await getDocuments<Address>(COLLECTION.ADDRESSES, [
      where('userId', '==', userId),
    ]);
    return addresses;
  } catch (err) {
    console.warn(`[customers] Error fetching addresses for customer ${userId}:`, err);
    return [];
  }
}

/**
 * Fetch audit logs related to this customer
 */
export async function getCustomerAuditLogs(entityId: string): Promise<AuditLog[]> {
  try {
    const logs = await getDocuments<AuditLog>(COLLECTION.AUDIT_LOGS, [
      where('entityId', '==', entityId),
    ]);
    return logs.sort((a, b) => {
      const timeA = (a.createdAt as any)?.seconds || 0;
      const timeB = (b.createdAt as any)?.seconds || 0;
      return timeB - timeA;
    });
  } catch (err) {
    console.warn(`[customers] Error fetching audit logs for entity ${entityId}:`, err);
    return [];
  }
}

/**
 * Update customer account status (e.g. active, suspended) with audit logging
 */
export async function updateCustomerStatus(
  customerId: string,
  status: AccountStatus,
  reason?: string,
  actor?: { uid: string; email: string; role?: string }
): Promise<void> {
  // 1. Try Cloud Function first
  try {
    await callFunction('updateCustomerStatus', {
      customerId,
      status,
      reason: reason || undefined,
    });
    return;
  } catch (fnErr) {
    console.warn('[customers] Cloud Function updateCustomerStatus unavailable, executing client fallback:', fnErr);
  }

  // 2. Client fallback direct to Firestore
  await updateDocument(COLLECTION.USERS, customerId, {
    status,
    statusReason: reason || null,
    statusUpdatedAt: new Date(),
    statusUpdatedBy: actor?.uid || 'admin',
    updatedAt: new Date(),
  });

  // 3. Write audit log
  try {
    await createDocument(COLLECTION.AUDIT_LOGS, {
      actorId: actor?.uid || 'admin',
      actorEmail: actor?.email || 'admin123@gmail.com',
      actorRole: actor?.role || 'admin',
      action: 'customer_status_updated',
      entityType: 'customer',
      entityId: customerId,
      after: { status, reason: reason || null },
    });
  } catch (logErr) {
    console.warn('[customers] Failed to write audit log:', logErr);
  }
}

/**
 * Update customer profile details (name, phone, etc.)
 */
export async function updateCustomerProfile(
  customerId: string,
  data: { displayName?: string; phone?: string; status?: AccountStatus },
  actor?: { uid: string; email: string; role?: string }
): Promise<void> {
  const updatePayload: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (data.displayName !== undefined) updatePayload['displayName'] = data.displayName.trim();
  if (data.phone !== undefined) updatePayload['phone'] = data.phone.trim();
  if (data.status !== undefined) updatePayload['status'] = data.status;

  await updateDocument(COLLECTION.USERS, customerId, updatePayload);

  // Write audit record
  try {
    await createDocument(COLLECTION.AUDIT_LOGS, {
      actorId: actor?.uid || 'admin',
      actorEmail: actor?.email || 'admin123@gmail.com',
      actorRole: actor?.role || 'admin',
      action: 'customer_profile_updated',
      entityType: 'customer',
      entityId: customerId,
      after: updatePayload,
    });
  } catch (logErr) {
    console.warn('[customers] Audit log write failed:', logErr);
  }
}

/**
 * Create a new customer record directly in Firestore
 */
export async function createCustomer(
  data: {
    displayName: string;
    email: string;
    phone?: string;
    status?: AccountStatus;
    address?: {
      label: 'home' | 'work' | 'other';
      line1: string;
      city: string;
      state: string;
      pincode: string;
    };
  },
  actor?: { uid: string; email: string; role?: string }
): Promise<string> {
  const customerUid = 'cust_' + generateId(16);

  let defaultAddressId: string | undefined = undefined;

  // If address provided, create address document
  if (data.address && data.address.line1 && data.address.city) {
    const addressId = await createDocument(COLLECTION.ADDRESSES, {
      userId: customerUid,
      label: data.address.label || 'home',
      recipientName: data.displayName,
      phone: data.phone || '',
      line1: data.address.line1,
      city: data.address.city,
      state: data.address.state || 'Karnataka',
      pincode: data.address.pincode || '560001',
      country: 'India',
      isDefault: true,
    });
    defaultAddressId = addressId;
  }

  // Create user document
  const userPayload = {
    uid: customerUid,
    email: data.email.toLowerCase().trim(),
    displayName: data.displayName.trim(),
    phone: data.phone?.trim() || '',
    roles: ['customer'],
    status: data.status || 'active',
    defaultAddressId: defaultAddressId || null,
    metadata: {
      totalOrders: 0,
      totalSpent: 0,
      lastOrderAt: null,
    },
  };

  await createDocument(COLLECTION.USERS, userPayload);

  // Write audit log
  try {
    await createDocument(COLLECTION.AUDIT_LOGS, {
      actorId: actor?.uid || 'admin',
      actorEmail: actor?.email || 'admin123@gmail.com',
      actorRole: actor?.role || 'admin',
      action: 'customer_created',
      entityType: 'customer',
      entityId: customerUid,
      after: { email: userPayload.email, displayName: userPayload.displayName },
    });
  } catch (logErr) {
    console.warn('[customers] Audit log write failed:', logErr);
  }

  return customerUid;
}

/**
 * Add an administrative compliance note or security flag to customer audit trail
 */
export async function addCustomerAdminNote(
  customerId: string,
  note: string,
  actor?: { uid: string; email: string; role?: string }
): Promise<void> {
  await createDocument(COLLECTION.AUDIT_LOGS, {
    actorId: actor?.uid || 'admin',
    actorEmail: actor?.email || 'admin123@gmail.com',
    actorRole: actor?.role || 'admin',
    action: 'customer_admin_note',
    entityType: 'customer',
    entityId: customerId,
    after: { note },
  });
}

/**
 * Export customer list to CSV format and trigger instant browser download
 */
export function exportCustomersToCSV(customers: UserProfile[]): void {
  const headers = [
    'User ID',
    'Display Name',
    'Email Address',
    'Phone Number',
    'Account Status',
    'Roles',
    'Total Orders',
    'Total Spent (INR)',
    'Last Order Date',
    'Created At',
  ];

  const rows = customers.map((c) => {
    const totalSpentRupees = ((c.metadata?.totalSpent || 0) / 100).toFixed(2);
    const createdDate = c.createdAt && (c.createdAt as any).seconds
      ? new Date((c.createdAt as any).seconds * 1000).toISOString().split('T')[0]
      : 'N/A';
    const lastOrder = c.metadata?.lastOrderAt && (c.metadata.lastOrderAt as any).seconds
      ? new Date((c.metadata.lastOrderAt as any).seconds * 1000).toISOString().split('T')[0]
      : 'Never';

    return [
      `"${c.uid || c.id}"`,
      `"${(c.displayName || '').replace(/"/g, '""')}"`,
      `"${c.email || ''}"`,
      `"${c.phone || ''}"`,
      `"${c.status}"`,
      `"${(c.roles || []).join('; ')}"`,
      c.metadata?.totalOrders || 0,
      totalSpentRupees,
      `"${lastOrder}"`,
      `"${createdDate}"`,
    ];
  });

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `poeage_customers_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
