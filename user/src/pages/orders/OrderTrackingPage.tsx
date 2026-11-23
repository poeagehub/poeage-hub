import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useParams, Link } from 'react-router-dom';
import { subscribeToDocument, subscribeToCollection, where, getDocument } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Order, Delivery, OrderStatus, VendorOrder } from '@poeage/types';
import { formatMoney, deriveOrderStatus } from '@poeage/utils';
import { Button, Card, Badge, Spinner } from '@poeage/ui';
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  ChevronLeft,
  ShieldCheck,
  Phone,
  AlertCircle,
  KeyRound,
} from 'lucide-react';

const ORDER_STEPS: Array<{ key: OrderStatus; label: string; description: string }> = [
  { key: 'confirmed', label: 'Order Confirmed', description: 'Your order has been verified and placed with sellers.' },
  { key: 'processing', label: 'Preparing & Packed', description: 'Vendor is packing your goods at the fulfillment depot.' },
  { key: 'out_for_delivery', label: 'Out for Delivery', description: 'Courier partner is heading to your doorstep.' },
  { key: 'delivered', label: 'Delivered', description: 'Package handed over with OTP verification.' },
];

export const OrderTrackingPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [vendorOrders, setVendorOrders] = useState<VendorOrder[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [deliveryPin, setDeliveryPin] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const delivery = deliveries[0] ?? null;

  useEffect(() => {
    if (!orderId || !user) return;

    // Everything is live: the order, the seller's sub-order(s) and the delivery. When the seller
    // packs the parcel or the driver picks it up, this screen changes on its own.
    const unsubOrder = subscribeToDocument<Order>(
      COLLECTION.ORDERS,
      orderId,
      (docData) => {
        setOrder(docData);
        setLoading(false);
      },
      () => setLoading(false),
    );
    const scope = [where('customerId', '==', user.uid), where('orderId', '==', orderId)];
    const unsubVendor = subscribeToCollection<VendorOrder>(COLLECTION.VENDOR_ORDERS, scope, setVendorOrders, (e) =>
      console.warn('Vendor order listener:', e),
    );
    const unsubDelivery = subscribeToCollection<Delivery>(COLLECTION.DELIVERIES, scope, setDeliveries, (e) =>
      console.warn('Delivery listener:', e),
    );
    return () => {
      unsubOrder();
      unsubVendor();
      unsubDelivery();
    };
  }, [orderId, user]);

  // The handover PIN lives in its own document that only the customer can read.
  const deliveryId = delivery?.id;
  useEffect(() => {
    if (!deliveryId) {
      setDeliveryPin(null);
      return;
    }
    let cancelled = false;
    getDocument<{ otp: string }>('deliveryOtps', deliveryId)
      .then((d) => !cancelled && setDeliveryPin(d?.otp ?? null))
      .catch(() => !cancelled && setDeliveryPin(null));
    return () => {
      cancelled = true;
    };
  }, [deliveryId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-24 flex flex-col items-center justify-center">
        <Spinner size="lg" />
        <p className="text-xs text-gray-500 mt-4">Loading real-time order tracking details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Order Not Found</h2>
        <p className="text-xs text-gray-500 mb-6">The order reference does not exist or you do not have permission to view it.</p>
        <Link to="/account/orders">
          <Button>Back to My Orders</Button>
        </Link>
      </div>
    );
  }

  // Determine current timeline progress index
  const statusRank: Record<string, number> = {
    pending_payment: 0,
    confirmed: 1,
    processing: 2,
    ready_for_pickup: 2,
    shipped: 2,
    out_for_delivery: 3,
    delivered: 4,
  };

  const progress = deriveOrderStatus(order, vendorOrders, deliveries);
  const currentRank = statusRank[progress.status] ?? 1;
  const shownStatus = progress.status;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
      {/* Top Header */}
      <div className="border-b border-gray-200 pb-4">
        <Link
          to="/account/orders"
          className="text-xs font-semibold text-primary-600 hover:text-primary-700 inline-flex items-center gap-1 mb-3 -ml-1 py-1"
        >
          <ChevronLeft className="w-4 h-4" />
          All orders
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Order</p>
            <h1 className="text-lg sm:text-2xl font-extrabold text-gray-900 tracking-tight break-all leading-tight">
              {order.orderNumber}
            </h1>
          </div>
          <Badge
            variant={shownStatus === 'delivered' ? 'success' : shownStatus === 'cancelled' ? 'danger' : 'default'}
            className="capitalize whitespace-nowrap flex-shrink-0 mt-1"
          >
            {progress.stage}
          </Badge>
        </div>
        {progress.detail && <p className="text-xs sm:text-sm text-gray-500 mt-2">{progress.detail}</p>}
        <div className="mt-3 flex items-end justify-between gap-3 p-3 sm:p-0 bg-white sm:bg-transparent border sm:border-0 border-gray-200 rounded-xl">
          <div>
            <p className="text-[11px] text-gray-400">Total amount</p>
            <p className="text-xl sm:text-2xl font-black text-primary-600 leading-tight">{formatMoney(order.pricing.grandTotal)}</p>
          </div>
          <span className="text-[11px] font-semibold text-gray-600 bg-gray-100 rounded-full px-2.5 py-1">
            {order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Paid online'}
          </span>
        </div>
      </div>

      {/* 4-Digit Delivery Verification OTP Banner (Crucial for Doorstep Handover) */}
      {delivery && deliveryPin && shownStatus !== 'delivered' && shownStatus !== 'cancelled' && (
        <div className="p-4 sm:p-5 bg-gradient-to-br from-primary-600 to-indigo-700 text-white rounded-2xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <KeyRound className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium text-primary-100">Delivery Handover PIN</p>
              <h3 className="text-sm font-bold text-white">Share this OTP with driver at delivery</h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-2" aria-label={`Delivery PIN ${deliveryPin}`}>
              {deliveryPin.split('').map((d, i) => (
                <span key={i} className="w-12 h-14 sm:w-14 sm:h-16 flex items-center justify-center font-mono text-3xl font-black bg-white text-primary-700 rounded-xl shadow-inner">
                  {d}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Live Order Timeline Stepper */}
      <Card className="p-4 sm:p-6">
        <h2 className="text-sm sm:text-base font-bold text-gray-900 mb-5 flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary-600" />
          Delivery progress
        </h2>

        <ol className="md:grid md:grid-cols-4 md:gap-4">
          {ORDER_STEPS.map((step, idx) => {
            const stepIndex = idx + 1;
            // Done = a later stage has been reached; the stage in progress gets the blue ring.
            const isCompleted =
              shownStatus === 'delivered' || currentRank > stepIndex || (stepIndex === 1 && currentRank >= 1);
            const isCurrent = !isCompleted && currentRank === stepIndex;
            const last = idx === ORDER_STEPS.length - 1;
            const nextDone = currentRank > stepIndex || shownStatus === 'delivered';

            return (
              <li key={step.key} className="relative flex md:flex-col gap-3.5 md:gap-3 pb-6 md:pb-0 last:pb-0">
                {/* connector: vertical on phones, horizontal from md up */}
                {!last && (
                  <>
                    <span
                      aria-hidden
                      className={`md:hidden absolute left-[17px] top-9 bottom-0 w-0.5 rounded ${nextDone ? 'bg-green-500' : 'bg-gray-200'}`}
                    />
                    <span
                      aria-hidden
                      className={`hidden md:block absolute top-[17px] left-10 right-[-1rem] h-0.5 rounded ${nextDone ? 'bg-green-500' : 'bg-gray-200'}`}
                    />
                  </>
                )}

                <div
                  className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 transition-colors ${
                    isCompleted
                      ? 'bg-green-600 text-white shadow-sm'
                      : isCurrent
                      ? 'bg-primary-600 text-white ring-4 ring-primary-100 animate-pulse'
                      : 'bg-gray-100 text-gray-400 border border-gray-200'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : stepIndex}
                </div>

                <div className="min-w-0 pt-1 md:pt-0">
                  <h3 className={`text-sm md:text-xs font-bold ${isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-400'}`}>
                    {step.label}
                    {isCurrent && <span className="ml-2 text-[10px] font-bold text-primary-600 bg-primary-50 rounded-full px-2 py-0.5 align-middle">Now</span>}
                  </h3>
                  <p className="text-xs md:text-[11px] text-gray-500 leading-relaxed mt-0.5">{step.description}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left 2 Cols: Order Items */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4 sm:p-6">
            <h2 className="text-sm sm:text-base font-bold text-gray-900 pb-3 border-b border-gray-100 mb-2 sm:mb-4 flex items-center gap-2">
              <Package className="w-4 h-4 text-primary-600" />
              Items in this Shipment ({(order.items ?? []).length})
            </h2>

            <div className="divide-y divide-gray-100">
              {(order.items ?? []).map((item, idx) => (
                <div key={idx} className="py-3.5 sm:py-4 flex items-center gap-3 sm:gap-4">
                  {item.imageURL ? (
                    <img
                      src={item.imageURL}
                      alt={item.name}
                      loading="lazy"
                      className="w-16 h-16 sm:w-16 sm:h-16 object-cover rounded-xl border border-gray-100 flex-shrink-0 bg-gray-50"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-center flex-shrink-0 text-gray-300">
                      <Package className="w-6 h-6" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/product/${item.productId}`}
                      className="font-bold text-gray-900 text-sm hover:text-primary-600 line-clamp-2 leading-snug"
                    >
                      {item.name}
                    </Link>
                    <p className="text-xs text-gray-500 mt-1">
                      Qty {item.quantity} × {formatMoney(item.unitPrice)}
                    </p>
                  </div>
                  <span className="font-bold text-sm text-gray-900 flex-shrink-0">{formatMoney(item.totalPrice)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Col: Logistics & Destination */}
        <div className="space-y-4">
          {/* Delivery Address */}
          <Card className="p-5 space-y-3">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-primary-600" />
              Delivery Destination
            </h3>
            <div className="text-xs text-gray-600 leading-relaxed">
              <p className="font-bold text-gray-900">{order.shippingAddress.recipientName}</p>
              <p>{order.shippingAddress.line1}</p>
              {order.shippingAddress.landmark && <p className="text-gray-500">Landmark: {order.shippingAddress.landmark}</p>}
              <p>
                {order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pincode}
              </p>
              <p className="mt-2 text-gray-500 font-medium">📞 {order.shippingAddress.phone}</p>
            </div>
          </Card>

          {/* Assigned Driver Card */}
          {delivery && (delivery as any).driverName && (
            <Card className="p-5 space-y-3 border-primary-200 bg-primary-50/30">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-primary-600" />
                Delivery Partner
              </h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-600 text-white font-bold flex items-center justify-center text-sm">
                  {(delivery as any).driverName[0]}
                </div>
                <div>
                  <p className="font-bold text-xs text-gray-900">{(delivery as any).driverName}</p>
                  <p className="text-[11px] text-gray-500">Logistics Fleet Associate</p>
                </div>
              </div>
            </Card>
          )}

          {/* Payment Summary */}
          <Card className="p-5 space-y-3">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Payment Breakdown
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatMoney(order.pricing.subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Delivery Charge</span>
                <span>
                  {order.pricing.deliveryCharge === 0 ? 'FREE' : formatMoney(order.pricing.deliveryCharge)}
                </span>
              </div>
              {order.pricing.couponDiscount > 0 && (
                <div className="flex justify-between text-green-600 font-semibold">
                  <span>Discount</span>
                  <span>-{formatMoney(order.pricing.couponDiscount)}</span>
                </div>
              )}
              <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-gray-900 text-sm">
                <span>Total Amount</span>
                <span className="text-primary-600">{formatMoney(order.pricing.grandTotal)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
