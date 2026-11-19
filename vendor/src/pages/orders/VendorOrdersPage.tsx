import React, { useState, useEffect } from 'react';
import { useVendorAuth } from '../../context/AuthContext';
import {
  subscribeToCollection,
  updateDocument,
  arrayUnion,
  where,
  friendlyError,
  runTransaction,
  db,
  doc,
  collection,
  serverTimestamp,
} from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { VendorOrder, VendorOrderStatus } from '@poeage/types';
import { formatMoney } from '@poeage/utils';
import { Button, Card, Badge, Spinner } from '@poeage/ui';
import {
  Package,
  Clock,
  CheckCircle,
  Truck,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  Boxes,
} from 'lucide-react';

export const VendorOrdersPage: React.FC = () => {
  const { user, vendor } = useVendorAuth();
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [actionError, setActionError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Live feed: new orders, and the driver's pickup / delivery updates, show up without refreshing.
  useEffect(() => {
    const vendorId = vendor?.id || user?.uid;
    if (!vendorId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const unsubscribe = subscribeToCollection<VendorOrder>(
      COLLECTION.VENDOR_ORDERS,
      [where('vendorId', '==', vendorId)],
      (list) => {
        setOrders(
          [...list].sort((a, b) => ((b.createdAt as any)?.seconds || 0) - ((a.createdAt as any)?.seconds || 0)),
        );
        setLoading(false);
      },
      (err) => {
        console.error('Could not load vendor orders:', err);
        setLoadError(friendlyError(err, 'Could not load your orders. Please try again.'));
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [vendor?.id, user?.uid, reloadKey]);

  const fetchVendorOrders = () => setReloadKey((k) => k + 1);

  const STATUS_LABEL: Record<string, string> = {
    confirmed: 'Order accepted by seller',
    processing: 'Seller started packing',
    ready_for_pickup: 'Packed and ready for pickup',
  };

  const handleUpdateStatus = async (orderId: string, targetStatus: VendorOrderStatus) => {
    setUpdatingId(orderId);
    setActionError(null);
    try {
      const entry = {
        status: targetStatus,
        timestamp: new Date().toISOString(),
        note: STATUS_LABEL[targetStatus] ?? `Status changed to ${targetStatus}`,
        actorId: user?.uid ?? '',
      };
      const order = orders.find((o) => o.id === orderId);

      if (targetStatus === 'confirmed' && order) {
        // Accepting an order and deducting its stock happen together, or not at all.
        await runTransaction(db, async (tx) => {
          const orderRef = doc(db, COLLECTION.VENDOR_ORDERS, orderId);
          const orderSnap = await tx.get(orderRef);
          if (!orderSnap.exists() || orderSnap.data()['status'] !== 'pending') {
            throw Object.assign(new Error('This order was already accepted.'), { code: 'already-moved' });
          }
          const wanted = new Map<string, { qty: number; name: string }>();
          for (const it of order.items) {
            const w = wanted.get(it.productId) ?? { qty: 0, name: it.name };
            w.qty += it.quantity;
            wanted.set(it.productId, w);
          }
          const reads = await Promise.all(
            [...wanted.keys()].map(async (pid) => {
              const ref = doc(db, COLLECTION.INVENTORY, pid);
              return { pid, ref, snap: await tx.get(ref) };
            }),
          );
          for (const { pid, ref, snap } of reads) {
            if (!snap.exists()) continue; // stock not tracked for this product
            const inv = snap.data() as { quantity: number; reservedQuantity?: number };
            const need = wanted.get(pid)!;
            if (inv.quantity < need.qty) {
              throw Object.assign(
                new Error(`Not enough stock for "${need.name}" (have ${inv.quantity}, need ${need.qty}). Add stock in Inventory first.`),
                { code: 'low-stock' },
              );
            }
            tx.update(ref, { quantity: inv.quantity - need.qty, updatedAt: serverTimestamp() });
            tx.set(doc(collection(db, COLLECTION.INVENTORY_LOGS)), {
              vendorId: order.vendorId,
              productId: pid,
              productName: need.name,
              type: 'order',
              change: -need.qty,
              before: inv.quantity,
              after: inv.quantity - need.qty,
              reason: 'Order accepted',
              note: `Sub-order #${orderId.slice(0, 8).toUpperCase()}`,
              actorId: user?.uid ?? '',
              createdAt: serverTimestamp(),
            });
          }
          tx.update(orderRef, { status: 'confirmed', statusHistory: arrayUnion(entry), updatedAt: serverTimestamp() });
        });
      } else {
        // Security rules only allow the next valid step (accept -> pack -> ready), so a stale screen cannot skip steps.
        await updateDocument(COLLECTION.VENDOR_ORDERS, orderId, {
          status: targetStatus,
          statusHistory: arrayUnion(entry),
        });
      }
      // The live listener refreshes the card; no manual state patching needed.
    } catch (err: any) {
      console.error('Failed to update status:', err);
      setActionError(
        err?.code === 'low-stock' || err?.code === 'already-moved'
          ? err.message
          : err?.code === 'permission-denied'
          ? 'This order has already moved on or can no longer be changed. The list has been refreshed.'
          : friendlyError(err, 'Could not update the order status. Please try again.'),
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchesTab = activeTab === 'all' || o.status === activeTab;
    const matchesSearch =
      searchQuery === '' ||
      o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.items.some((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  const getStatusBadge = (status: VendorOrderStatus) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">New Order</Badge>;
      case 'confirmed':
        return <Badge variant="info">Confirmed</Badge>;
      case 'processing':
        return <Badge variant="default" className="bg-purple-100 text-purple-700">Packing</Badge>;
      case 'ready_for_pickup':
        return <Badge variant="info" className="bg-sky-100 text-sky-800">Ready for Pickup</Badge>;
      case 'dispatched':
        return <Badge variant="default" className="bg-blue-100 text-blue-700">Dispatched</Badge>;
      case 'delivered':
        return <Badge variant="success">Delivered</Badge>;
      case 'cancelled':
        return <Badge variant="danger">Cancelled</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Title & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Order Fulfillment</h1>
          <p className="text-xs text-gray-500 mt-1">
            Accept incoming orders, package shipments, and mark goods ready for logistics courier pickup.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={fetchVendorOrders}
          className="flex items-center gap-2 self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Orders
        </Button>
      </div>

      {(actionError || loadError) && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{actionError || loadError}</span>
        </div>
      )}

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {[
            { id: 'all', label: 'All Orders', count: orders.length },
            { id: 'pending', label: 'New Orders', count: orders.filter((o) => o.status === 'pending').length },
            { id: 'confirmed', label: 'Confirmed', count: orders.filter((o) => o.status === 'confirmed').length },
            { id: 'processing', label: 'Packing', count: orders.filter((o) => o.status === 'processing').length },
            { id: 'ready_for_pickup', label: 'Ready for Pickup', count: orders.filter((o) => o.status === 'ready_for_pickup').length },
            { id: 'dispatched', label: 'On the Way', count: orders.filter((o) => o.status === 'dispatched').length },
            { id: 'delivered', label: 'Delivered', count: orders.filter((o) => o.status === 'delivered').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    activeTab === tab.id ? 'bg-white/30 text-white' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search order or item..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <Spinner size="lg" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card className="p-12 text-center max-w-md mx-auto">
          <Boxes className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900 mb-1">No Orders in this View</h3>
          <p className="text-xs text-gray-500">
            {activeTab === 'all'
              ? 'New orders placed by customers across the marketplace will appear here automatically.'
              : `There are currently no orders in "${activeTab.replace(/_/g, ' ')}" status.`}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isUpdating = updatingId === order.id;

            return (
              <Card key={order.id} className="p-5 hover:shadow-md transition-shadow">
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-gray-700">
                      SUB-ORDER #{order.id.slice(0, 8).toUpperCase()}
                    </span>
                    {getStatusBadge(order.status)}
                  </div>

                  <div className="flex items-center gap-6 text-xs">
                    <div>
                      <span className="text-gray-400 block text-[10px]">Gross Subtotal</span>
                      <span className="font-bold text-gray-900">{formatMoney(order.subtotal)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Commission</span>
                      <span className="font-medium text-red-500">-{formatMoney(order.commissionAmount)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Net Payout Earning</span>
                      <span className="font-black text-emerald-600 text-sm">{formatMoney(order.vendorEarning)}</span>
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="divide-y divide-gray-50">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="py-2.5 flex items-center gap-3">
                      <img
                        src={item.imageURL}
                        alt={item.name}
                        className="w-12 h-12 object-cover rounded-lg border border-gray-100 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs text-gray-900 truncate">{item.name}</p>
                        <p className="text-[11px] text-gray-500">
                          Qty: <strong>{item.quantity}</strong> × {formatMoney(item.unitPrice)}
                        </p>
                      </div>
                      <span className="font-bold text-xs text-gray-900">{formatMoney(item.totalPrice)}</span>
                    </div>
                  ))}
                </div>

                {/* State Machine Action Bar */}
                <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                    <Truck className="w-3.5 h-3.5 text-gray-400" />
                    <span>
                      {order.status === 'ready_for_pickup'
                        ? 'Dispatch alert sent! Logistics driver will arrive for collection.'
                        : order.status === 'dispatched'
                        ? 'Picked up by the delivery partner and on its way to the customer.'
                        : order.status === 'delivered'
                        ? 'Order successfully delivered to customer doorstep.'
                        : 'Manage package status step-by-step to alert delivery fleet.'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end">
                    {order.status === 'pending' && (
                      <Button
                        size="sm"
                        disabled={isUpdating}
                        onClick={() => handleUpdateStatus(order.id, 'confirmed')}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5"
                      >
                        {isUpdating ? <Spinner size="sm" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        Accept Order
                      </Button>
                    )}

                    {order.status === 'confirmed' && (
                      <Button
                        size="sm"
                        disabled={isUpdating}
                        onClick={() => handleUpdateStatus(order.id, 'processing')}
                        className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5"
                      >
                        {isUpdating ? <Spinner size="sm" /> : <Package className="w-3.5 h-3.5" />}
                        Start Packing
                      </Button>
                    )}

                    {order.status === 'processing' && (
                      <Button
                        size="sm"
                        disabled={isUpdating}
                        onClick={() => handleUpdateStatus(order.id, 'ready_for_pickup')}
                        className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5"
                      >
                        {isUpdating ? <Spinner size="sm" /> : <Truck className="w-3.5 h-3.5" />}
                        Mark Ready for Pickup
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
