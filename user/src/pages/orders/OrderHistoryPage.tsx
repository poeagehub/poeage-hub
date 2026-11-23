import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { subscribeToCollection, getDocument, where } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Order, VendorOrder, Delivery, Product } from '@poeage/types';
import { formatMoney, deriveOrderStatus } from '@poeage/utils';
import { ChevronRight, ShoppingBag, RotateCw, Truck, CheckCircle2, XCircle, PackageCheck, Clock } from 'lucide-react';

const ms = (t: any): number => (t?.toDate ? t.toDate().getTime() : t?.seconds ? t.seconds * 1000 : 0);

type Tone = { cls: string; icon: React.ReactNode };
function tone(status: string): Tone {
  if (status === 'delivered') return { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
  if (status === 'cancelled') return { cls: 'bg-red-50 text-red-700 ring-red-600/20', icon: <XCircle className="w-3.5 h-3.5" /> };
  if (['out_for_delivery', 'in_transit', 'picked_up', 'dispatched'].includes(status)) return { cls: 'bg-sky-50 text-sky-700 ring-sky-600/20', icon: <Truck className="w-3.5 h-3.5" /> };
  if (['ready_for_pickup', 'processing'].includes(status)) return { cls: 'bg-violet-50 text-violet-700 ring-violet-600/20', icon: <PackageCheck className="w-3.5 h-3.5" /> };
  return { cls: 'bg-amber-50 text-amber-700 ring-amber-600/20', icon: <Clock className="w-3.5 h-3.5" /> };
}

export const OrderHistoryPage: React.FC = () => {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendorOrders, setVendorOrders] = useState<VendorOrder[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'delivered' | 'cancelled'>('all');
  const [busy, setBusy] = useState<string | null>(null);

  // Live: statuses move as sellers pack and drivers deliver, no refresh needed.
  useEffect(() => {
    if (!user) return;
    const mine = [where('customerId', '==', user.uid)];
    const u1 = subscribeToCollection<Order>(
      COLLECTION.ORDERS,
      mine,
      (list) => {
        setOrders([...list].sort((a, b) => ms(b.createdAt) - ms(a.createdAt)));
        setLoading(false);
      },
      (err) => {
        console.error('Failed to fetch user orders:', err);
        setLoading(false);
      },
    );
    const u2 = subscribeToCollection<VendorOrder>(COLLECTION.VENDOR_ORDERS, mine, setVendorOrders, () => {});
    const u3 = subscribeToCollection<Delivery>(COLLECTION.DELIVERIES, mine, setDeliveries, () => {});
    return () => {
      u1();
      u2();
      u3();
    };
  }, [user]);

  const rows = useMemo(
    () =>
      orders.map((order) => ({
        order,
        progress: deriveOrderStatus(order, vendorOrders.filter((v) => v.orderId === order.id), deliveries.filter((d) => d.orderId === order.id)),
      })),
    [orders, vendorOrders, deliveries],
  );

  const counts = useMemo(
    () => ({
      all: rows.length,
      active: rows.filter((r) => !['delivered', 'cancelled'].includes(r.progress.status)).length,
      delivered: rows.filter((r) => r.progress.status === 'delivered').length,
      cancelled: rows.filter((r) => r.progress.status === 'cancelled').length,
    }),
    [rows],
  );

  const shown = rows.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'active') return !['delivered', 'cancelled'].includes(r.progress.status);
    return r.progress.status === filter;
  });

  /** Put every item of a past order back in the cart (using today's live product details). */
  const buyAgain = async (order: Order) => {
    setBusy(order.id);
    try {
      let added = 0;
      for (const item of order.items ?? []) {
        const p = await getDocument<Product>(COLLECTION.PRODUCTS, item.productId).catch(() => null);
        if (p && p.status === 'published') {
          addToCart(p, item.quantity);
          added++;
        }
      }
      if (added > 0) navigate('/cart');
      else window.alert('These items are not available right now.');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        {[0, 1, 2].map((i) => <div key={i} className="h-40 rounded-2xl bg-slate-200/70 animate-pulse" />)}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <span className="w-16 h-16 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center mx-auto"><ShoppingBag className="w-8 h-8" /></span>
        <h2 className="mt-4 text-xl font-extrabold text-slate-900">No orders yet</h2>
        <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">When you place an order it will show up here, and you can follow it live until it reaches you.</p>
        <Link to="/products" className="mt-6 inline-flex items-center h-11 px-6 rounded-xl bg-primary-600 text-white font-bold hover:bg-primary-700">Start shopping</Link>
      </div>
    );
  }

  const tabs: { v: typeof filter; l: string }[] = [
    { v: 'all', l: 'All' },
    { v: 'active', l: 'In progress' },
    { v: 'delivered', l: 'Delivered' },
    { v: 'cancelled', l: 'Cancelled' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-10">
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">My orders</h1>
      <p className="text-sm text-slate-500 mt-1">Track deliveries, view details and buy again.</p>

      <div className="mt-5 flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        {tabs.map((t) => (
          <button key={t.v} onClick={() => setFilter(t.v)} className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold border transition ${filter === t.v ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
            {t.l} <span className={`text-[11px] px-1.5 rounded-full ${filter === t.v ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{counts[t.v]}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        {shown.length === 0 && <p className="text-center text-slate-500 py-12">No orders in this view.</p>}
        {shown.map(({ order, progress }) => {
          const t = tone(progress.status);
          const items = order.items ?? [];
          const date = ms(order.createdAt);
          return (
            <article key={order.id} className="rounded-2xl bg-white border border-slate-200/80 overflow-hidden hover:shadow-md transition-shadow">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 sm:px-5 py-3.5 bg-slate-50/70 border-b border-slate-100">
                <div className="min-w-0">
                  <p className="font-mono text-[13px] font-bold text-slate-900 truncate">#{order.orderNumber}</p>
                  <p className="text-xs text-slate-500">{date ? new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${t.cls}`}>{t.icon}{progress.stage}</span>
              </div>

              <div className="px-4 sm:px-5 py-4 flex items-center gap-4">
                <div className="flex -space-x-3 shrink-0">
                  {items.slice(0, 3).map((it, i) => (
                    <span key={i} className="w-14 h-14 rounded-xl bg-slate-100 border-2 border-white overflow-hidden flex items-center justify-center text-slate-300 shadow-sm">
                      {it.imageURL ? <img src={it.imageURL} alt="" className="w-full h-full object-cover" /> : <ShoppingBag className="w-5 h-5" />}
                    </span>
                  ))}
                  {items.length > 3 && <span className="w-14 h-14 rounded-xl bg-slate-900 text-white text-sm font-bold border-2 border-white flex items-center justify-center">+{items.length - 3}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{items[0]?.name ?? 'Order'}{items.length > 1 ? ` + ${items.length - 1} more` : ''}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{items.reduce((n, i) => n + (i.quantity || 0), 0)} item(s) · {order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Paid online'}</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{progress.detail}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] text-slate-400">Total</p>
                  <p className="text-lg font-extrabold text-slate-900">{formatMoney(order.pricing?.grandTotal ?? 0)}</p>
                </div>
              </div>

              <div className="px-4 sm:px-5 pb-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                {items.length > 0 && (
                  <button onClick={() => buyAgain(order)} disabled={busy === order.id} className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 hover:border-slate-900 disabled:opacity-60">
                    <RotateCw className={`w-4 h-4 ${busy === order.id ? 'animate-spin' : ''}`} /> Buy again
                  </button>
                )}
                <Link to={`/account/orders/${order.id}`} className="inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800">
                  {progress.status === 'delivered' || progress.status === 'cancelled' ? 'View details' : 'Track order'} <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
