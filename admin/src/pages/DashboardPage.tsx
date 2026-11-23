import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { subscribeToCollection } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Vendor, Driver, Product, VendorOrder, PayoutRequest } from '@poeage/types';
import { formatMoney } from '@poeage/utils';
import {
  PageHeader,
  StatCard,
  Section,
  AreaChart,
  BarList,
  Donut,
  EmptyState,
  StatusPill,
  toneForStatus,
  Skeleton,
} from '@poeage/ui';
import {
  IndianRupee,
  ShoppingBag,
  Store,
  Truck,
  Percent,
  ArrowRight,
  ShieldAlert,
  PackageCheck,
  Receipt,
  Wallet,
  AlertCircle,
} from 'lucide-react';
import { subscribeOrdersWithLiveStatus, type LiveOrder } from '../lib/liveOrders';

const DAY = 86_400_000;
const ms = (t: any): number => (t?.toDate ? t.toDate().getTime() : typeof t === 'number' ? t : 0);
const short = (n: number) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(2)}Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(2)}L` : n >= 1e3 ? `₹${(n / 1e3).toFixed(1)}K` : `₹${Math.round(n)}`);
const pctChange = (cur: number, prev: number) => (prev === 0 ? (cur === 0 ? 0 : null) : ((cur - prev) / prev) * 100);

const RANGES = [
  { label: '7D', days: 7 },
  { label: '14D', days: 14 },
  { label: '30D', days: 30 },
];

export const DashboardPage: React.FC = () => {
  const [orders, setOrders] = useState<LiveOrder[] | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [vendorOrders, setVendorOrders] = useState<VendorOrder[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(14);

  useEffect(() => {
    const onErr = (e: Error) => {
      console.error('[Dashboard]', e);
      setError('Some live data could not be loaded. Check your connection and permissions.');
    };
    const u = [
      subscribeOrdersWithLiveStatus(setOrders, onErr),
      subscribeToCollection<Vendor>(COLLECTION.VENDORS, [], setVendors, onErr),
      subscribeToCollection<Driver>(COLLECTION.DRIVERS, [], setDrivers, onErr),
      subscribeToCollection<Product>(COLLECTION.PRODUCTS, [], setProducts, onErr),
      subscribeToCollection<VendorOrder>(COLLECTION.VENDOR_ORDERS, [], setVendorOrders, onErr),
      subscribeToCollection<PayoutRequest>(COLLECTION.PAYOUT_REQUESTS, [], setPayouts, () => {}),
    ];
    return () => u.forEach((f) => f());
  }, []);

  const loading = orders === null;

  const m = useMemo(() => {
    const all = orders ?? [];
    const valid = all.filter((o) => o.status !== 'cancelled');
    const now = Date.now();
    const sum = (list: LiveOrder[]) => list.reduce((s, o) => s + (o.pricing?.grandTotal || 0), 0);
    const inWindow = (list: LiveOrder[], from: number, to: number) => list.filter((o) => ms(o.createdAt) >= from && ms(o.createdAt) < to);
    const curWin = inWindow(valid, now - days * DAY, now + DAY);
    const prevWin = inWindow(valid, now - 2 * days * DAY, now - days * DAY);

    const liveIds = new Set(valid.map((o) => o.id));
    const commission = vendorOrders
      .filter((v) => liveIds.has(v.orderId) && v.status !== 'cancelled')
      .reduce((s, v) => s + (v.commissionAmount || 0), 0);

    // Daily series for the chart
    const series = Array.from({ length: days }, (_, i) => {
      const start = new Date(now - (days - 1 - i) * DAY);
      start.setHours(0, 0, 0, 0);
      const from = start.getTime();
      const dayOrders = valid.filter((o) => ms(o.createdAt) >= from && ms(o.createdAt) < from + DAY);
      return {
        label: start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        value: sum(dayOrders) / 100,
      };
    });

    const byStage = new Map<string, number>();
    all.forEach((o) => byStage.set(o.stage, (byStage.get(o.stage) ?? 0) + 1));

    // GMV by vendor
    const vendorGmv = new Map<string, number>();
    valid.forEach((o) => (o.items ?? []).forEach((i) => vendorGmv.set(i.vendorId, (vendorGmv.get(i.vendorId) ?? 0) + (i.totalPrice || 0))));

    return {
      gmv: sum(valid),
      gmvDelta: pctChange(sum(curWin), sum(prevWin)),
      ordersDelta: pctChange(curWin.length, prevWin.length),
      aov: valid.length ? sum(valid) / valid.length : 0,
      commission,
      series,
      rangeTotal: sum(curWin),
      byStage: [...byStage.entries()].sort((a, b) => b[1] - a[1]),
      vendorGmv: [...vendorGmv.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      active: all.filter((o) => !['Delivered', 'Cancelled'].includes(o.stage)).length,
      recent: [...all].sort((a, b) => ms(b.createdAt) - ms(a.createdAt)).slice(0, 6),
      total: all.length,
    };
  }, [orders, vendorOrders, days]);

  const approvedVendors = vendors.filter((v) => v.status === 'approved').length;
  const pendingVendors = vendors.filter((v) => v.status === 'pending_review').length;
  const onlineDrivers = drivers.filter((d: any) => d.isOnline).length;
  const pendingDrivers = drivers.filter((d) => d.status === 'pending_review').length;
  const pendingProducts = products.filter((p) => p.status === 'pending_review').length;
  const vendorName = (id: string) => vendors.find((v) => v.id === id)?.storeName ?? 'Unknown store';

  const STAGE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#0ea5e9', '#ec4899', '#8b5cf6', '#94a3b8'];

  const pendingPayouts = payouts.filter((p) => p.status === 'pending');
  const queues = [
    { label: 'Seller applications', n: pendingVendors, to: '/vendors', icon: Store, tone: 'text-violet-600 bg-violet-50' },
    { label: 'Driver applications', n: pendingDrivers, to: '/drivers', icon: Truck, tone: 'text-sky-600 bg-sky-50' },
    { label: 'Products to review', n: pendingProducts, to: '/products', icon: PackageCheck, tone: 'text-amber-600 bg-amber-50' },
    { label: 'Payout requests', n: pendingPayouts.length, to: '/payouts', icon: Wallet, tone: 'text-emerald-600 bg-emerald-50', note: pendingPayouts.length ? `${formatMoney(pendingPayouts.reduce((s, p) => s + p.amount, 0))} to pay` : undefined },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <PageHeader
        title="Dashboard"
        description="Live view of sales, sellers, delivery partners and the review queues."
        actions={
          <div className="inline-flex rounded-xl bg-white border border-slate-200/80 p-1 shadow-xs">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 active:scale-95 ${
                  days === r.days
                    ? 'bg-primary-600 text-white shadow-xs shadow-primary-500/30'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm p-3.5">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Gross sales" value={formatMoney(m.gmv)} icon={IndianRupee} tone="primary" delta={loading ? undefined : m.gmvDelta} hint={`vs prev ${days}d`} loading={loading} />
        <StatCard label="Orders" value={m.total} icon={ShoppingBag} tone="amber" delta={loading ? undefined : m.ordersDelta} hint={`${m.active} in progress`} loading={loading} />
        <StatCard label="Avg. order value" value={formatMoney(Math.round(m.aov))} icon={Receipt} tone="violet" hint="Excl. cancelled" loading={loading} />
        <StatCard label="Platform commission" value={formatMoney(m.commission)} icon={Percent} tone="green" hint="Earned on orders" loading={loading} />
      </div>

      {/* Revenue + status */}
      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        <Section
          className="lg:col-span-2"
          title="Sales trend"
          actions={<span className="text-sm font-extrabold text-slate-900">{short(m.rangeTotal / 100)}<span className="text-xs font-medium text-slate-400"> · last {days}d</span></span>}
        >
          {loading ? <Skeleton className="h-[220px] w-full" /> : <AreaChart data={m.series} format={(n) => `₹${n.toLocaleString('en-IN')}`} />}
        </Section>

        <Section title="Orders by stage">
          {loading ? (
            <Skeleton className="h-[150px] w-full" />
          ) : m.byStage.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="No orders yet" className="py-6" />
          ) : (
            <Donut
              centre={{ value: String(m.total), label: 'Orders' }}
              slices={m.byStage.map(([label, value], i) => ({ label, value, color: STAGE_COLORS[i % STAGE_COLORS.length] ?? '#94a3b8' }))}
            />
          )}
        </Section>
      </div>

      {/* Queues + top sellers + recent */}
      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        <Section title="Needs your attention" icon={ShieldAlert}>
          <ul className="space-y-2.5 -my-1">
            {queues.map((q) => {
              const Icon = q.icon;
              return (
                <li key={q.label}>
                  <Link to={q.to} className="flex items-center gap-3 rounded-xl p-3 border border-slate-100 hover:border-primary-200 hover:bg-primary-50/40 card-modern-hover transition group">
                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${q.tone}`}><Icon className="w-5 h-5" /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-slate-900">{q.label}</span>
                      <span className="block text-xs text-slate-500">{q.n === 0 ? 'All clear' : (q as { note?: string }).note ?? `${q.n} waiting for review`}</span>
                    </span>
                    {q.n > 0 && <span className="min-w-[24px] h-6 px-2 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">{q.n}</span>}
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary-500 transition" />
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              { v: approvedVendors, l: 'Live sellers' },
              { v: onlineDrivers, l: 'Drivers online' },
              { v: products.filter((p) => p.status === 'published').length, l: 'Live products' },
            ].map((x) => (
              <div key={x.l} className="rounded-xl bg-slate-50 py-3">
                <div className="text-xl font-extrabold text-slate-900">{x.v}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{x.l}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Top sellers" icon={Store}>
          {m.vendorGmv.length === 0 ? (
            <EmptyState icon={Store} title="No sales yet" description="Top sellers by sales will appear here." className="py-6" />
          ) : (
            <BarList items={m.vendorGmv.map(([id, v]) => ({ label: vendorName(id), value: v / 100 }))} format={(n) => `₹${n.toLocaleString('en-IN')}`} />
          )}
        </Section>

        <Section
          title="Recent orders"
          icon={ShoppingBag}
          flush
          actions={<Link to="/orders" className="text-xs font-bold text-primary-600 hover:underline">View all</Link>}
        >
          {m.recent.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="No orders yet" className="py-8" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {m.recent.map((o) => (
                <li key={o.id}>
                  <Link to="/orders" className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="font-mono text-[13px] font-bold text-slate-900 truncate">{o.orderNumber}</p>
                      <p className="text-xs text-slate-500 truncate">{o.shippingAddress?.recipientName ?? 'Customer'}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <p className="text-sm font-extrabold text-slate-900">{formatMoney(o.pricing?.grandTotal || 0)}</p>
                      <StatusPill tone={toneForStatus(o.stage)}>{o.stage}</StatusPill>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
};
