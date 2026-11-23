import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDriverAuth } from '../../context/AuthContext';
import {
  subscribeToCollection,
  subscribePlatformSettings,
  where,
  requestPayout,
  cancelPayoutRequest,
  friendlyError,
  DEFAULT_PLATFORM_SETTINGS,
} from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Delivery, PayoutRequest } from '@poeage/types';
import { formatMoney, summarizePayoutBalance, payoutAmountError, PAYOUT_STATUS_LABEL } from '@poeage/utils';
import { AreaChart } from '@poeage/ui';
import { Wallet, Landmark, ShieldCheck, TrendingUp, Route, ArrowRight, CalendarDays, ArrowDownToLine, Clock, CheckCheck, XCircle, Building2 } from 'lucide-react';
import { PageTitle, ActionButton, Notice, Sheet, cx } from '../../components/ui';

const DAY = 86_400_000;
const toMs = (t: any): number => (t?.toMillis ? t.toMillis() : t?.seconds ? t.seconds * 1000 : t instanceof Date ? t.getTime() : 0);
const doneMs = (d: Delivery) => toMs(d.deliveredAt) || toMs(d.updatedAt) || toMs(d.createdAt);
const money = (p: number) => formatMoney(p);
const toPaise = (rupees: string) => Math.round(parseFloat(rupees || '0') * 100);
const when = (t: any) => (toMs(t) ? new Date(toMs(t)).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-accent-400/15 text-accent-200 border-accent-400/30',
  paid: 'bg-emerald-400/15 text-emerald-200 border-emerald-400/30',
  rejected: 'bg-red-500/15 text-red-300 border-red-500/30',
  cancelled: 'bg-white/5 text-slate-400 border-white/10',
};

export const DriverEarningsPage: React.FC = () => {
  const { driver, user } = useDriverAuth();
  const driverId = driver?.id || user?.uid || '';
  const [trips, setTrips] = useState<Delivery[] | null>(null);
  const [requests, setRequests] = useState<PayoutRequest[] | null>(null);
  const [minPayout, setMinPayout] = useState(DEFAULT_PLATFORM_SETTINGS.minPayoutAmount);
  const [days, setDays] = useState(7);

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    if (!driverId || !user) return;
    const u = [
      subscribeToCollection<Delivery>(COLLECTION.DELIVERIES, [where('driverId', '==', driverId), where('status', '==', 'delivered')], setTrips, () => setTrips([])),
      subscribeToCollection<PayoutRequest>(COLLECTION.PAYOUT_REQUESTS, [where('userId', '==', user.uid)], (l) => setRequests(l.filter((r) => r.requesterType === 'driver')), () => setRequests([])),
      subscribePlatformSettings((s) => setMinPayout(s.minPayoutAmount)),
    ];
    return () => u.forEach((f) => f());
  }, [driverId, user]);

  const loading = trips === null || requests === null;
  const bank = driver?.bankDetails;
  const hasBank = !!(bank?.accountNumber && bank.ifscCode && bank.accountHolder);
  const status = driver?.status;
  const canRequest = status === 'approved' || status === 'active' || status === 'offline';

  const m = useMemo(() => {
    const all = trips ?? [];
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const sum = (l: Delivery[]) => l.reduce((s, d) => s + (d.driverEarning || 0), 0);
    const inRange = all.filter((d) => doneMs(d) >= midnight.getTime() - (days - 1) * DAY);
    const series = Array.from({ length: days }, (_, i) => {
      const day = new Date(midnight.getTime() - (days - 1 - i) * DAY);
      return { label: day.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), value: sum(all.filter((d) => doneMs(d) >= day.getTime() && doneMs(d) < day.getTime() + DAY)) / 100 };
    });
    const earned = sum(all);
    return {
      earned,
      balance: summarizePayoutBalance(earned, requests ?? []),
      today: sum(all.filter((d) => doneMs(d) >= midnight.getTime())),
      rangeTotal: sum(inRange),
      rangeTrips: inRange.length,
      series,
      recent: [...all].sort((a, b) => doneMs(b) - doneMs(a)).slice(0, 6),
    };
  }, [trips, requests, days]);

  const sorted = useMemo(() => [...(requests ?? [])].sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt)), [requests]);
  const openRequest = (requests ?? []).find((r) => r.status === 'pending');
  const amountPaise = toPaise(amount);
  const amountError = amount ? payoutAmountError(amountPaise, m.balance.available, minPayout, money) : null;
  const blocked = loading || !!openRequest || !canRequest;

  const openSheet = () => {
    setError(null);
    setNote('');
    setAmount(m.balance.available >= minPayout ? String(m.balance.available / 100) : '');
    setOpen(true);
  };

  const flash = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 6000);
  };

  const submit = async () => {
    const err = payoutAmountError(amountPaise, m.balance.available, minPayout, money);
    if (err) return setError(err);
    if (!hasBank || !bank || !user) return setError('Add your bank account in Profile first.');
    setSaving(true);
    setError(null);
    try {
      await requestPayout({
        requesterType: 'driver',
        requesterId: driverId,
        requesterName: driver?.displayName || 'Driver',
        userId: user.uid,
        amount: amountPaise,
        bank: { accountHolder: bank.accountHolder, accountNumber: bank.accountNumber, ifscCode: bank.ifscCode, bankName: bank.bankName, ...(bank.upiId ? { upiId: bank.upiId } : {}) },
        note,
      });
      setOpen(false);
      flash(true, `Payout request for ${money(amountPaise)} sent. It will show as paid here once processed.`);
    } catch (e: any) {
      setError(e?.code === 'permission-denied' ? 'This request was refused. You may already have one in review, or the amount is below the minimum.' : friendlyError(e, 'Could not send the payout request.'));
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (r: PayoutRequest) => {
    if (!window.confirm(`Cancel your payout request for ${money(r.amount)}?`)) return;
    setCancelling(r.id);
    try {
      await cancelPayoutRequest(r);
    } catch (e) {
      flash(false, friendlyError(e, 'Could not cancel the request.'));
    } finally {
      setCancelling(null);
    }
  };

  return (
    <div className="px-3 min-[380px]:px-4 sm:px-6 lg:px-10 pt-4 lg:pt-10 max-w-[1100px] mx-auto space-y-5 lg:space-y-6">
      <PageTitle title="Earnings" subtitle="Your balance, payouts and trends." />

      {toast && <Notice tone={toast.ok ? 'success' : 'error'}>{toast.text}</Notice>}

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-4 lg:gap-6">
        {/* Balance hero */}
        <section className="relative overflow-hidden rounded-3xl border border-accent-400/25 bg-gradient-to-br from-accent-500/25 via-accent-600/[0.08] to-transparent p-4 min-[380px]:p-6 lg:p-7">
          <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-accent-400/20 blur-3xl pointer-events-none" />
          <div className="relative flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent-200">Available to withdraw</span>
            <span className="w-10 h-10 rounded-2xl bg-accent-400/15 text-accent-200 flex items-center justify-center"><Wallet className="w-5 h-5" /></span>
          </div>
          {loading ? <div className="relative mt-4 h-12 w-48 rounded-xl bg-white/10 animate-pulse" /> : (
            <p className="relative mt-3 text-[clamp(2.1rem,12vw,2.75rem)] leading-none font-black tracking-tight text-white tabular-nums truncate">{money(m.balance.available)}</p>
          )}
          <p className="relative mt-3 text-sm text-slate-300">{money(m.earned)} earned from {(trips ?? []).length} {(trips ?? []).length === 1 ? 'trip' : 'trips'}</p>

          <div className="relative mt-5">
            <ActionButton size="lg" className="w-full" onClick={openSheet} disabled={blocked || m.balance.available < minPayout || !hasBank}>
              <ArrowDownToLine className="w-5 h-5" /> Request payout
            </ActionButton>
            <p className="mt-2.5 text-xs text-slate-400 text-center">
              {openRequest ? 'You have a request in review.' : !canRequest ? 'Your account must be verified to request payouts.' : !hasBank ? 'Add a bank account to request a payout.' : m.balance.available < minPayout ? `Minimum payout is ${money(minPayout)}.` : 'Sent to your saved bank account.'}
            </p>
          </div>

          <div className="relative mt-5 grid grid-cols-3 max-[299px]:grid-cols-1 divide-x max-[299px]:divide-x-0 max-[299px]:divide-y divide-white/10 rounded-2xl bg-black/25 border border-white/10 text-center">
            {[
              { l: 'Today', v: money(m.today) },
              { l: 'In review', v: money(m.balance.pending) },
              { l: 'Paid out', v: money(m.balance.paid) },
            ].map((c) => (
              <div key={c.l} className="min-w-0 px-1.5 py-3">
                <p className="text-[13px] min-[380px]:text-sm font-black text-white tabular-nums truncate">{c.v}</p>
                <p className="text-[10px] uppercase tracking-wide text-slate-400 mt-0.5">{c.l}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Payout account */}
        <section className="d-card p-4 min-[380px]:p-6 flex flex-col">
          <div className="flex items-center gap-2.5 text-sm font-extrabold text-white"><Landmark className="w-4 h-4 text-emerald-300" /> Payout account</div>
          {hasBank && bank ? (
            <div className="mt-4 rounded-2xl bg-white/[0.04] border border-white/10 p-4 flex items-center gap-3">
              <span className="w-11 h-11 rounded-xl bg-white/5 text-slate-300 flex items-center justify-center shrink-0"><Building2 className="w-5 h-5" /></span>
              <div className="min-w-0">
                <p className="font-extrabold text-white truncate">{bank.bankName}</p>
                <p className="text-sm text-slate-300 truncate">{bank.accountHolder}</p>
                <p className="text-xs text-slate-400 font-mono">•••• {bank.accountNumber.slice(-4)} · {bank.ifscCode}</p>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-white/15 p-5 text-sm text-slate-400">
              <p>No bank account added yet. Add one so your payouts can be sent.</p>
              <Link to="/profile" className="mt-3 inline-flex items-center gap-1.5 font-bold text-accent-300 hover:text-accent-200">Add bank account <ArrowRight className="w-4 h-4" /></Link>
            </div>
          )}
          {hasBank && <Link to="/profile" className="mt-3 text-xs font-bold text-accent-300 hover:text-accent-200 self-start">Change account</Link>}
          <p className="mt-auto pt-5 text-xs text-slate-500 flex items-start gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-px" /> An admin reviews each request and sends the money to this account.</p>
        </section>
      </div>

      {/* Payout requests */}
      <section className="d-card overflow-hidden">
        <div className="px-4 min-[380px]:px-5 sm:px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-extrabold text-white flex items-center gap-2"><ArrowDownToLine className="w-4 h-4 text-accent-300" /> Payout requests</h2>
        </div>
        {loading ? (
          <div className="p-5"><div className="h-14 rounded-2xl bg-white/5 animate-pulse" /></div>
        ) : sorted.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-500">When you request a withdrawal, its progress shows up here.</p>
        ) : (
          <ul>
            {sorted.map((r) => (
              <li key={r.id} className="px-4 min-[380px]:px-5 sm:px-6 py-4 border-b border-white/[0.05] last:border-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-black text-white tabular-nums">{money(r.amount)}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{when(r.createdAt)}</p>
                  </div>
                  <span className={cx('shrink-0 inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-1 rounded-full border', STATUS_STYLE[r.status])}>
                    {r.status === 'paid' ? <CheckCheck className="w-3 h-3" /> : r.status === 'pending' ? <Clock className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {PAYOUT_STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
                <div className="mt-2 text-xs text-slate-400 space-y-1">
                  {r.status === 'paid' && <p>Reference <span className="font-mono font-bold text-slate-200">{r.referenceNumber}</span> · {when(r.processedAt)}</p>}
                  {r.status === 'rejected' && <p className="text-red-300 font-semibold">{r.adminNote || 'Rejected by admin'}</p>}
                  {r.status === 'pending' && <p>To A/C •••• {r.bank.accountNumber.slice(-4)} · waiting for review</p>}
                  {r.status === 'cancelled' && <p>Cancelled by you</p>}
                  {r.note && (
                    <p className="text-[11px] text-accent-200 bg-accent-500/15 border border-accent-400/25 px-2 py-0.5 rounded-md inline-block mt-0.5 max-w-xs truncate" title={r.note}>
                      Note: <span className="font-medium text-white">{r.note}</span>
                    </p>
                  )}
                </div>
                {r.status === 'pending' && (
                  <ActionButton tone="outline" size="sm" className="mt-3" loading={cancelling === r.id} onClick={() => cancel(r)}><XCircle className="w-3.5 h-3.5" /> Cancel request</ActionButton>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Trend */}
      <section className="d-card p-4 min-[380px]:p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-sm font-extrabold text-white flex items-center gap-2"><TrendingUp className="w-4 h-4 text-accent-300" /> Earnings trend</h2>
            <p className="text-xs text-slate-500 mt-1">{money(m.rangeTotal)} from {m.rangeTrips} {m.rangeTrips === 1 ? 'trip' : 'trips'} in the last {days} days</p>
          </div>
          <div className="inline-flex rounded-xl bg-white/5 border border-white/10 p-1">
            {[7, 14, 30].map((d) => (
              <button key={d} onClick={() => setDays(d)} className={cx('px-3.5 py-1.5 text-xs font-bold rounded-lg transition', days === d ? 'bg-accent-500 text-white' : 'text-slate-400 hover:text-white')}>{d}D</button>
            ))}
          </div>
        </div>
        {loading ? <div className="h-[220px] rounded-2xl bg-white/5 animate-pulse" /> : <AreaChart data={m.series} format={(n) => `₹${n.toLocaleString('en-IN')}`} />}
      </section>

      {/* Per-trip ledger */}
      <section className="d-card overflow-hidden">
        <div className="px-4 min-[380px]:px-5 sm:px-6 py-4 flex items-center justify-between border-b border-white/[0.06]">
          <h2 className="text-sm font-extrabold text-white flex items-center gap-2"><CalendarDays className="w-4 h-4 text-accent-300" /> Recent credits</h2>
          <Link to="/history" className="text-xs font-bold text-accent-300 hover:text-accent-200">All trips</Link>
        </div>
        {m.recent.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-500">Your trip earnings will be listed here.</p>
        ) : (
          <ul>
            {m.recent.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 min-[380px]:px-5 sm:px-6 py-3.5 border-b border-white/[0.05] last:border-0">
                <span className="w-10 h-10 rounded-xl bg-emerald-400/10 text-emerald-300 flex items-center justify-center shrink-0"><Route className="w-[18px] h-[18px]" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">Delivery to {d.deliveryAddress?.recipientName || 'customer'}</p>
                  <p className="text-[11px] text-slate-500">{when(d.deliveredAt ?? d.updatedAt)} · #{d.id.slice(0, 6).toUpperCase()}</p>
                </div>
                <span className="font-black text-accent-300 tabular-nums">+{money(d.driverEarning || 0)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Request a payout"
        subtitle="Choose how much to withdraw to your bank."
        footer={
          <>
            <ActionButton tone="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</ActionButton>
            <ActionButton className="flex-[1.6]" loading={saving} disabled={!amount || !!amountError} onClick={submit}>Send request</ActionButton>
          </>
        }
      >
        <div className="space-y-4">
          {error && <Notice tone="error">{error}</Notice>}
          <div className="rounded-2xl bg-emerald-400/10 border border-emerald-400/20 p-4 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-emerald-200">Available</span>
            <span className="text-xl font-black text-emerald-300 tabular-nums">{money(m.balance.available)}</span>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="drv-payout-amount" className="text-xs font-bold uppercase tracking-wider text-slate-400">Amount</label>
              <button type="button" onClick={() => setAmount(String(m.balance.available / 100))} className="text-xs font-bold text-accent-300 hover:text-accent-200">Withdraw all</button>
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-500">₹</span>
              <input id="drv-payout-amount" className="d-input !h-14 !pl-10 text-xl font-black tabular-nums" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, '').replace(/^(\d*\.\d{0,2}).*$/, '$1'))} placeholder="0" />
            </div>
            {amountError ? <p className="mt-1.5 text-xs text-red-300">{amountError}</p> : <p className="mt-1.5 text-xs text-slate-500">Minimum {money(minPayout)} per request.</p>}
          </div>
          <label className="block">
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Note <span className="font-normal normal-case text-slate-500">(optional)</span></span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} className="d-input !h-auto py-3" placeholder="Anything the finance team should know" />
          </label>
          {hasBank && bank && (
            <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3.5 text-sm">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">Paying to</p>
              <p className="font-bold text-white">{bank.bankName} · {bank.accountHolder}</p>
              <p className="text-xs text-slate-400 font-mono">•••• {bank.accountNumber.slice(-4)} · {bank.ifscCode}</p>
            </div>
          )}
        </div>
      </Sheet>
    </div>
  );
};
