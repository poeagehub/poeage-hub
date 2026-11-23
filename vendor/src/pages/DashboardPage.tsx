import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useVendorAuth } from '../context/AuthContext';
import { subscribeToCollection, where } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { VendorOrder, Product, Inventory } from '@poeage/types';
import { formatMoney } from '@poeage/utils';
import { PageHeader, StatCard, Section, AreaChart, BarList, EmptyState, StatusPill, toneForStatus, Skeleton, Button } from '@poeage/ui';
import { IndianRupee, ShoppingBag, Package, Wallet, AlertTriangle, ArrowRight, Plus, Layers } from 'lucide-react';

const DAY = 86_400_000;
const ms = (t: any): number => (t?.toDate ? t.toDate().getTime() : 0);
const pct = (cur: number, prev: number) => (prev === 0 ? (cur === 0 ? 0 : null) : ((cur - prev) / prev) * 100);
const label = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export const DashboardPage: React.FC = () => {
  const { vendor, user } = useVendorAuth();
  const vendorId = vendor?.id || user?.uid;
  const [orders, setOrders] = useState<VendorOrder[] | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [days, setDays] = useState(14);

  useEffect(() => {
    if (!vendorId) return;
    const scope = [where('vendorId', '==', vendorId)];
    const u = [
      subscribeToCollection<VendorOrder>(COLLECTION.VENDOR_ORDERS, scope, setOrders, (e) => { console.error(e); setOrders([]); }),
      subscribeToCollection<Product>(COLLECTION.PRODUCTS, scope, setProducts, (e) => { console.error(e); setProducts([]); }),
      subscribeToCollection<Inventory>(COLLECTION.INVENTORY, scope, setInventory, () => {}),
    ];
    return () => u.forEach((f) => f());
  }, [vendorId]);

  const loading = orders === null || products === null;

  const m = useMemo(() => {
    const all = orders ?? [];
    const valid = all.filter((o) => o.status !== 'cancelled' && o.status !== 'returned');
    const now = Date.now();
    const sum = (l: VendorOrder[]) => l.reduce((s, o) => s + (o.subtotal || 0), 0);
    const win = (from: number, to: number) => valid.filter((o) => ms(o.createdAt) >= from && ms(o.createdAt) < to);
    const cur = win(now - days * DAY, now + DAY);
    const prev = win(now - 2 * days * DAY, now - days * DAY);

    const series = Array.from({ length: days }, (_, i) => {
      const d = new Date(now - (days - 1 - i) * DAY);
      d.setHours(0, 0, 0, 0);
      const f = d.getTime();
      return { label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), value: sum(valid.filter((o) => ms(o.createdAt) >= f && ms(o.createdAt) < f + DAY)) / 100 };
    });

    const byProduct = new Map<string, { name: string; qty: number; rev: number }>();
    valid.forEach((o) => o.items.forEach((i) => {
      const e = byProduct.get(i.productId) ?? { name: i.name, qty: 0, rev: 0 };
      e.qty += i.quantity;
      e.rev += i.totalPrice;
      byProduct.set(i.productId, e);
    }));

    const delivered = all.filter((o) => o.status === 'delivered');
    return {
      sales: sum(valid),
      salesDelta: pct(sum(cur), sum(prev)),
      rangeTotal: sum(cur),
      toPack: all.filter((o) => ['pending', 'confirmed', 'processing'].includes(o.status)).length,
      pending: all.filter((o) => o.status === 'pending').length,
      payable: delivered.reduce((s, o) => s + (o.vendorEarning || 0), 0),
      series,
      top: [...byProduct.values()].sort((a, b) => b.rev - a.rev).slice(0, 5),
      recent: [...all].sort((a, b) => ms(b.createdAt) - ms(a.createdAt)).slice(0, 6),
    };
  }, [orders, days]);

  const live = (products ?? []).filter((p) => p.status === 'published').length;
  const lowStock = inventory.filter((i) => i.quantity - (i.reservedQuantity ?? 0) <= (i.reorderLevel ?? 5));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <PageHeader
        title={`Welcome back${vendor?.storeName ? `, ${vendor.storeName}` : ''}`}
        description="Your store at a glance — sales, orders to pack and stock that needs attention."
        actions={
          <>
            <div className="inline-flex rounded-xl bg-white border border-slate-200 p-1">
              {[7, 14, 30].map((d) => (
                <button key={d} onClick={() => setDays(d)} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${days === d ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}>{d}D</button>
              ))}
            </div>
            <Link to="/products/new"><Button size="sm" className="h-9"><Plus className="w-4 h-4 mr-1" /> Add product</Button></Link>
          </>
        }
      />

      {/* Modern Merchant Command Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-950 via-slate-900 to-slate-950 p-6 sm:p-7 text-white shadow-xl border border-teal-500/20">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 uppercase tracking-wider">
                Phase 4 Seller Hub
              </span>
              <span className="flex items-center gap-1.5 text-xs text-teal-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                Live Telemetry Active
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {vendor?.storeName || 'Merchant Command'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              Real-time catalog oversight, instant packaging queue, stock alerts, and automated payout disbursements.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link to="/products/new">
              <Button size="sm" className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-black h-10 px-4 rounded-xl shadow-lg shadow-teal-950/40 active:scale-95 transition-all">
                <Plus className="w-4 h-4 mr-1.5" />
                Add Product
              </Button>
            </Link>
            <Link to="/orders">
              <Button size="sm" variant="outline" className="h-10 px-4 rounded-xl border-slate-700 bg-slate-800/80 text-white hover:bg-slate-700/80 font-bold text-xs transition-all">
                <ShoppingBag className="w-4 h-4 mr-1.5 text-teal-400" />
                View Orders ({m.toPack})
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total sales" value={formatMoney(m.sales)} icon={IndianRupee} tone="primary" delta={loading ? undefined : m.salesDelta} hint={`vs prev ${days}d`} loading={loading} />
        <StatCard label="Orders to pack" value={m.toPack} icon={ShoppingBag} tone="amber" hint={m.pending ? `${m.pending} new` : 'All caught up'} loading={loading} />
        <StatCard label="Live products" value={live} icon={Package} tone="sky" hint={`${(products ?? []).length} total`} loading={loading} />
        <StatCard label="Payout pending" value={formatMoney(m.payable)} icon={Wallet} tone="violet" hint="From delivered orders" loading={loading} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        <Section className="lg:col-span-2" title="Sales trend" actions={<span className="text-sm font-extrabold text-slate-900">{formatMoney(m.rangeTotal)}<span className="text-xs font-medium text-slate-400"> · last {days}d</span></span>}>
          {loading ? <Skeleton className="h-[220px]" /> : <AreaChart data={m.series} format={(n) => `₹${n.toLocaleString('en-IN')}`} />}
        </Section>

        <Section title="Stock alerts" icon={AlertTriangle} actions={<Link to="/inventory" className="text-xs font-bold text-primary-600 hover:underline">Manage</Link>}>
          {lowStock.length === 0 ? (
            <EmptyState icon={Layers} title="Stock looks healthy" description="You'll be alerted when a product runs low." className="py-6" />
          ) : (
            <ul className="space-y-2.5">
              {lowStock.slice(0, 5).map((i) => {
                const avail = i.quantity - (i.reservedQuantity ?? 0);
                const name = (products ?? []).find((p) => p.id === i.productId)?.name ?? 'Product';
                return (
                  <li key={i.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
                    <span className="text-sm font-semibold text-slate-800 truncate">{name}</span>
                    <StatusPill tone={avail <= 0 ? 'red' : 'amber'}>{avail <= 0 ? 'Out of stock' : `${avail} left`}</StatusPill>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        <Section title="Incoming orders" icon={ShoppingBag} flush actions={<Link to="/orders" className="text-xs font-bold text-primary-600 hover:underline">View all</Link>}>
          {loading ? (
            <div className="p-5 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : m.recent.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="No orders yet" description="Orders from customers will show up here for packing." className="py-10" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {m.recent.map((o) => (
                <li key={o.id}>
                  <Link to="/orders" className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{o.items[0]?.name ?? 'Order'}{o.items.length > 1 ? ` +${o.items.length - 1}` : ''}</p>
                      <p className="text-xs text-slate-500">{ms(o.createdAt) ? new Date(ms(o.createdAt)).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <p className="text-sm font-extrabold text-slate-900">{formatMoney(o.subtotal)}</p>
                      <StatusPill tone={toneForStatus(o.status)}>{label(o.status)}</StatusPill>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 hidden sm:block" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Best sellers" icon={Package}>
          {loading ? (
            <Skeleton className="h-40" />
          ) : m.top.length === 0 ? (
            <EmptyState icon={Package} title="No sales yet" description="Your top products by revenue will appear here." className="py-8" />
          ) : (
            <BarList items={m.top.map((t) => ({ label: t.name, value: t.rev / 100, sub: `${t.qty} sold` }))} format={(n) => `₹${n.toLocaleString('en-IN')}`} />
          )}
        </Section>
      </div>
    </div>
  );
};
