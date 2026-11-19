import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { subscribeToCollection, where } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Order, VendorOrder, Delivery } from '@poeage/types';
import { formatMoney, deriveOrderStatus } from '@poeage/utils';
import { Button, Card, Badge, Spinner } from '@poeage/ui';
import { Package, ChevronRight, ShoppingBag, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

export const OrderHistoryPage: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [vendorOrders, setVendorOrders] = useState<VendorOrder[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  // Live: statuses move as sellers pack and drivers deliver, no refresh needed.
  useEffect(() => {
    if (!user) return;
    const mine = [where('customerId', '==', user.uid)];
    const unsubOrders = subscribeToCollection<Order>(
      COLLECTION.ORDERS,
      mine,
      (list) => {
        setOrders(
          [...list].sort((a, b) => ((b.createdAt as any)?.seconds || 0) - ((a.createdAt as any)?.seconds || 0)),
        );
        setLoading(false);
      },
      (err) => {
        console.error('Failed to fetch user orders:', err);
        setLoading(false);
      },
    );
    const unsubVendor = subscribeToCollection<VendorOrder>(COLLECTION.VENDOR_ORDERS, mine, setVendorOrders, () => {});
    const unsubDelivery = subscribeToCollection<Delivery>(COLLECTION.DELIVERIES, mine, setDeliveries, () => {});
    return () => {
      unsubOrders();
      unsubVendor();
      unsubDelivery();
    };
  }, [user]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-24 flex flex-col items-center justify-center">
        <Spinner size="lg" />
        <p className="text-xs text-gray-500 mt-4">Loading your purchase history...</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">No Orders Yet</h2>
        <p className="text-xs text-gray-500 max-w-sm mx-auto mb-6">
          You haven't placed any orders yet. Discover our marketplace catalog and explore verified seller products.
        </p>
        <Link to="/products">
          <Button className="bg-blue-600 text-white font-semibold">Start Shopping</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">My Orders</h1>
        <p className="text-xs text-gray-500 mt-1">
          Review previous purchases, live shipment statuses, and digital invoices.
        </p>
      </div>

      <div className="space-y-4">
        {orders.map((order) => {
          const progress = deriveOrderStatus(
            order,
            vendorOrders.filter((v) => v.orderId === order.id),
            deliveries.filter((d) => d.orderId === order.id),
          );
          const shownStatus = progress.status;
          return (
            <Card key={order.id} className="p-5 sm:p-6 hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4 mb-4">
                <div>
                  <span className="text-xs text-gray-400 font-mono">ORDER #{order.orderNumber}</span>
                  <div className="flex items-center gap-3 mt-1">
                    <Badge
                      variant={
                        shownStatus === 'delivered'
                          ? 'success'
                          : shownStatus === 'cancelled'
                          ? 'danger'
                          : 'default'
                      }
                      className="capitalize text-xs font-semibold"
                    >
                      {progress.stage}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      Payment: {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online'}
                    </span>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-xs text-gray-400">Total Amount</span>
                  <p className="text-lg font-black text-gray-900">{formatMoney(order.pricing.grandTotal)}</p>
                </div>
              </div>

              {/* Items Preview */}
              <div className="space-y-3">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <img
                      src={item.imageURL}
                      alt={item.name}
                      className="w-12 h-12 object-cover rounded-lg border border-gray-100 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">{item.name}</p>
                      <p className="text-[11px] text-gray-500">
                        Qty: {item.quantity} • {formatMoney(item.unitPrice)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action */}
              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                <Link to={`/account/orders/${order.id}`}>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-xs font-bold flex items-center gap-1.5"
                  >
                    Track Live Shipment
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
