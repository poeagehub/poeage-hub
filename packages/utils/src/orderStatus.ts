/**
 * Order status derived from the live state of an order's vendor sub-orders and deliveries.
 *
 * The vendor and the driver each update their own record (vendorOrders / deliveries). The master order
 * document is only writable by admins, so every screen that shows an order's progress derives it from
 * those records instead of trusting a stale copy. Works for single- and multi-vendor orders.
 */

export type DerivedOrderStatus =
  | 'pending_payment'
  | 'payment_failed'
  | 'confirmed'
  | 'processing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'return_requested'
  | 'returned'
  | 'refunded'
  | (string & {});

export interface DerivedOrder {
  /** Overall status to show to the customer / admin. */
  status: DerivedOrderStatus;
  /** One short sentence describing exactly where the order is right now. */
  detail: string;
  /** Short, precise stage name, e.g. "Ready for pickup" or "Driver assigned". */
  stage: string;
}

interface OrderLike {
  status: string;
}
interface VendorOrderLike {
  status: string;
}
interface DeliveryLike {
  status: string;
  driverName?: string | undefined;
}

const TERMINAL_MASTER = new Set(['pending_payment', 'payment_failed', 'cancelled', 'return_requested', 'returned', 'refunded']);
const ON_THE_ROAD = new Set(['picked_up', 'in_transit', 'out_for_delivery']);

export function deriveOrderStatus(
  order: OrderLike,
  vendorOrders: VendorOrderLike[],
  deliveries: DeliveryLike[],
): DerivedOrder {
  if (TERMINAL_MASTER.has(order.status)) {
    return { status: order.status, detail: '', stage: order.status.replace(/_/g, ' ') };
  }

  const live = vendorOrders.filter((v) => v.status !== 'cancelled');
  if (vendorOrders.length > 0 && live.length === 0) {
    return { status: 'cancelled', detail: 'The seller could not fulfil this order.', stage: 'Cancelled' };
  }

  // Nothing loaded yet (or an old order without sub-records): trust the master document.
  if (vendorOrders.length === 0 && deliveries.length === 0) {
    return { status: order.status, detail: '', stage: order.status.replace(/_/g, ' ') };
  }

  const allVendorDelivered = live.length > 0 && live.every((v) => v.status === 'delivered');
  const allDeliveriesDelivered = deliveries.length > 0 && deliveries.every((d) => d.status === 'delivered');
  if (allVendorDelivered || allDeliveriesDelivered) {
    return { status: 'delivered', detail: 'Your package was handed over.', stage: 'Delivered' };
  }

  const roadCount = deliveries.filter((d) => ON_THE_ROAD.has(d.status)).length;
  if (roadCount > 0 || live.some((v) => v.status === 'dispatched')) {
    const outNow = deliveries.some((d) => d.status === 'out_for_delivery');
    return {
      status: 'out_for_delivery',
      detail: 'Your package has been picked up and is on its way.',
      stage: outNow ? 'Out for delivery' : 'Picked up',
    };
  }

  const assigned = deliveries.find((d) => ['assigned', 'driver_accepted', 'driver_at_vendor'].includes(d.status));
  const vendorReady = live.some((v) => v.status === 'ready_for_pickup');
  if (vendorReady) {
    return {
      status: 'processing',
      stage: assigned ? 'Driver assigned' : 'Ready for pickup',
      detail: assigned
        ? `Packed and ready. ${assigned.driverName ?? 'Your delivery partner'} is collecting it.`
        : 'Packed and ready. Waiting for a delivery partner to collect it.',
    };
  }

  if (live.some((v) => v.status === 'processing')) {
    return { status: 'processing', detail: 'The seller is packing your items.', stage: 'Packing' };
  }

  if (live.some((v) => v.status === 'confirmed')) {
    return { status: 'confirmed', detail: 'The seller accepted your order and will start packing soon.', stage: 'Accepted by seller' };
  }

  return { status: 'confirmed', detail: 'Order placed. Waiting for the seller to accept it.', stage: 'Order placed' };
}
