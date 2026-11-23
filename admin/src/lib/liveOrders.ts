import { getDocuments, subscribeToCollection } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Order, VendorOrder, Delivery } from '@poeage/types';
import { deriveOrderStatus } from '@poeage/utils';

/** An order plus its real, current progress. */
export type LiveOrder = Order & { stage: string; stageDetail: string };

/**
 * Sellers and drivers update their own records (vendorOrders / deliveries); the master order's stored
 * status is only a starting point, so the real status is derived from those records.
 */
export function withLiveStatus(orders: Order[], vendorOrders: VendorOrder[], deliveries: Delivery[]): LiveOrder[] {
  return orders.map((o) => {
    const p = deriveOrderStatus(
      o,
      vendorOrders.filter((v) => v.orderId === o.id),
      deliveries.filter((d) => d.orderId === o.id),
    );
    return { ...o, status: p.status as Order['status'], stage: p.stage, stageDetail: p.detail };
  });
}

export async function getOrdersWithLiveStatus(): Promise<LiveOrder[]> {
  const [orders, vendorOrders, deliveries] = await Promise.all([
    getDocuments<Order>(COLLECTION.ORDERS),
    getDocuments<VendorOrder>(COLLECTION.VENDOR_ORDERS).catch(() => [] as VendorOrder[]),
    getDocuments<Delivery>(COLLECTION.DELIVERIES).catch(() => [] as Delivery[]),
  ]);
  return withLiveStatus(orders, vendorOrders, deliveries);
}

/** Live feed of all orders with derived status. Returns an unsubscribe function. */
export function subscribeOrdersWithLiveStatus(
  callback: (orders: LiveOrder[]) => void,
  onError?: (err: Error) => void,
): () => void {
  let orders: Order[] = [];
  let vendorOrders: VendorOrder[] = [];
  let deliveries: Delivery[] = [];
  let ordersReady = false;
  const emit = () => ordersReady && callback(withLiveStatus(orders, vendorOrders, deliveries));
  const u1 = subscribeToCollection<Order>(
    COLLECTION.ORDERS,
    [],
    (l) => {
      orders = l;
      ordersReady = true;
      emit();
    },
    onError,
  );
  const u2 = subscribeToCollection<VendorOrder>(COLLECTION.VENDOR_ORDERS, [], (l) => { vendorOrders = l; emit(); }, onError);
  const u3 = subscribeToCollection<Delivery>(COLLECTION.DELIVERIES, [], (l) => { deliveries = l; emit(); }, onError);
  return () => {
    u1();
    u2();
    u3();
  };
}
