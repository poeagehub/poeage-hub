import React, { useMemo, useState, useEffect } from 'react';
import { useDriverAuth } from '../../context/AuthContext';
import { getDocuments, where } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Delivery } from '@poeage/types';
import { formatMoney } from '@poeage/utils';
import { CheckCircle2, MapPin, Store, Truck, ShieldCheck, Wallet, Route } from 'lucide-react';
import { PageTitle, cx } from '../../components/ui';

const toMs = (t: any): number => (t?.toMillis ? t.toMillis() : t?.seconds ? t.seconds * 1000 : t instanceof Date ? t.getTime() : 0);
const doneMs = (d: Delivery) => toMs(d.deliveredAt) || toMs(d.updatedAt) || toMs(d.createdAt);
const DAY = 86_400_000;

const RANGES = [
  { v: 'all', l: 'All time' },
  { v: 'today', l: 'Today' },
  { v: '7', l: '7 days' },
  { v: '30', l: '30 days' },
];

function dayLabel(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / DAY);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
}

export const DriverHistoryPage: React.FC = () => {
  const { driver, user } = useDriverAuth();
  const [history, setHistory] = useState<Delivery[] | null>(null);
  const [range, setRange] = useState('all');

  useEffect(() => {
    (async () => {
      try {
        const driverId = driver?.id || user?.uid;
        if (!driverId) return;
        const past = await getDocuments<Delivery>(COLLECTION.DELIVERIES, [where('driverId', '==', driverId), where('status', '==', 'delivered')]);
        setHistory(past.sort((a, b) => doneMs(b) - doneMs(a)));
      } catch (err) {
        console.error('Could not fetch delivery history:', err);
        setHistory([]);
      }
    })();
  }, [driver, user]);

  const filtered = useMemo(() => {
    const all = history ?? [];
    if (range === 'all') return all;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const from = range === 'today' ? start.getTime() : start.getTime() - (Number(range) - 1) * DAY;
    return all.filter((d) => doneMs(d) >= from);
  }, [history, range]);

  const total = filtered.reduce((s, d) => s + (d.driverEarning || 0), 0);
  const avg = filtered.length ? Math.round(total / filtered.length) : 0;

  const groups = useMemo(() => {
    const m = new Map<string, Delivery[]>();
    filtered.forEach((d) => {
      const k = doneMs(d) ? dayLabel(doneMs(d)) : 'Earlier';
      m.set(k, [...(m.get(k) ?? []), d]);
    });
    return [...m.entries()];
  }, [filtered]);

  const time = (d: Delivery) => (doneMs(d) ? new Date(doneMs(d)).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '');

  return (
    <div className="px-3 min-[380px]:px-4 sm:px-6 lg:px-10 pt-4 lg:pt-10 max-w-[1100px] mx-auto space-y-5 lg:space-y-6">
      <PageTitle title="Delivery history" subtitle="Every completed trip, confirmed with the customer's PIN." />

      <div className="relative overflow-hidden rounded-[1.75rem] border border-accent-400/25 bg-gradient-to-br from-accent-500/25 via-accent-600/10 to-transparent">
        <div className="absolute -top-10 -right-6 w-36 h-36 rounded-full bg-accent-400/20 blur-3xl pointer-events-none" />
        <div className="relative grid grid-cols-3 max-[299px]:grid-cols-1 divide-x max-[299px]:divide-x-0 max-[299px]:divide-y divide-white/10">
          {[
            { l: 'Trips', v: String(filtered.length), icon: <Route className="w-3.5 h-3.5" /> },
            { l: 'Earned', v: formatMoney(total), icon: <Wallet className="w-3.5 h-3.5" /> },
            { l: 'Avg / trip', v: formatMoney(avg), icon: <ShieldCheck className="w-3.5 h-3.5" /> },
          ].map((c) => (
            <div key={c.l} className="min-w-0 px-2 min-[380px]:px-4 py-4">
              <p className="flex items-center gap-1.5 text-[10px] min-[380px]:text-[11px] font-bold uppercase tracking-wider text-accent-200"><span className="hidden min-[360px]:inline-flex">{c.icon}</span><span className="truncate">{c.l}</span></p>
              <p className="mt-1.5 text-[clamp(1.05rem,5.2vw,1.6rem)] font-black text-white tabular-nums leading-none truncate">{c.v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-3 px-3 min-[380px]:-mx-4 min-[380px]:px-4 sm:mx-0 sm:px-0">
        {RANGES.map((r) => (
          <button key={r.v} onClick={() => setRange(r.v)} className={cx('shrink-0 h-10 px-4 rounded-full text-[13px] font-bold border transition', range === r.v ? 'bg-accent-500 text-white border-accent-400' : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10')}>
            {r.l}
          </button>
        ))}
      </div>

      {history === null ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-3xl bg-white/5 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="d-card py-14 px-6 text-center">
          <span className="w-16 h-16 rounded-2xl bg-white/5 text-slate-500 flex items-center justify-center mx-auto"><Truck className="w-8 h-8" /></span>
          <p className="mt-4 font-extrabold text-white">No trips {range === 'all' ? 'yet' : 'in this period'}</p>
          <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">Deliveries confirmed with the customer's 4-digit PIN are recorded here.</p>
        </div>
      ) : (
        <div className="space-y-7">
          {groups.map(([label, list]) => (
            <section key={label}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">{label}</h2>
                <span className="text-xs font-bold text-accent-300">{formatMoney(list.reduce((s, d) => s + (d.driverEarning || 0), 0))}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {list.map((d) => (
                  <article key={d.id} className="d-card p-3.5 min-[380px]:p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-bold text-slate-300">#{d.id.slice(0, 8).toUpperCase()}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{time(d)}</p>
                      </div>
                      <span className="text-xl font-black text-accent-300 leading-none tabular-nums">+{formatMoney(d.driverEarning || 0)}</span>
                    </div>
                    <div className="mt-4 space-y-2 text-[13px]">
                      {d.pickupAddress?.label && (
                        <p className="flex items-center gap-2.5 text-slate-300 min-w-0"><Store className="w-4 h-4 text-accent-300 shrink-0" /><span className="truncate">{d.pickupAddress.label}</span></p>
                      )}
                      <p className="flex items-center gap-2.5 text-slate-300 min-w-0"><MapPin className="w-4 h-4 text-emerald-300 shrink-0" /><span className="truncate">{d.deliveryAddress?.recipientName} · {d.deliveryAddress?.city}</span></p>
                    </div>
                    <p className="mt-3 pt-3 border-t border-white/[0.06] text-[11px] font-bold text-emerald-300 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Delivered · PIN verified</p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
