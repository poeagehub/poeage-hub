import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  subscribeToCollection,
  subscribeToDocument,
  subscribePlatformSettings,
  where,
  requestPayout,
  cancelPayoutRequest,
  friendlyError,
  DEFAULT_PLATFORM_SETTINGS,
} from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { VendorBankDetails, VendorOrder, PayoutRequest } from '@poeage/types';
import { formatMoney, summarizePayoutBalance, payoutAmountError, PAYOUT_STATUS_LABEL } from '@poeage/utils';
import {
  PageHeader,
  StatCard,
  Section,
  Modal,
  StatusPill,
  EmptyState,
  DataTable,
  Skeleton,
  Button,
  type Column,
} from '@poeage/ui';
import { Wallet, ArrowDownToLine, Clock, CheckCheck, Banknote, Building2, Receipt, AlertCircle, Landmark, XCircle } from 'lucide-react';
import { useVendorAuth } from '../../context/AuthContext';

const ms = (t: any): number => (t?.toMillis ? t.toMillis() : t?.seconds ? t.seconds * 1000 : 0);
const when = (t: any) => (ms(t) ? new Date(ms(t)).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
const payoutTone = (s: string) => (s === 'paid' ? 'green' : s === 'pending' ? 'amber' : s === 'rejected' ? 'red' : 'slate');
const toPaise = (rupees: string) => Math.round(parseFloat(rupees || '0') * 100);
const money = (paise: number) => formatMoney(paise);

export const VendorSettlementsPage: React.FC = () => {
  const { vendor, user } = useVendorAuth();
  const vendorId = vendor?.id || user?.uid || '';

  const [orders, setOrders] = useState<VendorOrder[] | null>(null);
  const [requests, setRequests] = useState<PayoutRequest[] | null>(null);
  const [bank, setBank] = useState<VendorBankDetails | null>(null);
  const [minPayout, setMinPayout] = useState(DEFAULT_PLATFORM_SETTINGS.minPayoutAmount);

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    if (!vendorId || !user) return;
    const u = [
      subscribeToCollection<VendorOrder>(COLLECTION.VENDOR_ORDERS, [where('vendorId', '==', vendorId)], setOrders, () => setOrders([])),
      subscribeToCollection<PayoutRequest>(COLLECTION.PAYOUT_REQUESTS, [where('userId', '==', user.uid)], (l) => setRequests(l.filter((r) => r.requesterType === 'vendor')), () => setRequests([])),
      subscribeToDocument<{ bankDetails?: VendorBankDetails }>(COLLECTION.VENDOR_PRIVATE, vendorId, (d) => setBank(d?.bankDetails ?? null), () => setBank(null)),
      subscribePlatformSettings((s) => setMinPayout(s.minPayoutAmount)),
    ];
    return () => u.forEach((f) => f());
  }, [vendorId, user]);

  const loading = orders === null || requests === null;

  const calc = useMemo(() => {
    const delivered = (orders ?? []).filter((o) => o.status === 'delivered');
    const upcoming = (orders ?? []).filter((o) => !['delivered', 'cancelled', 'returned', 'return_requested'].includes(o.status));
    const earned = delivered.reduce((s, o) => s + (o.vendorEarning || 0), 0);
    const upcomingAmt = upcoming.reduce((s, o) => s + (o.vendorEarning || 0), 0);
    return { earned, upcomingAmt, balance: summarizePayoutBalance(earned, requests ?? []) };
  }, [orders, requests]);

  const sortedRequests = useMemo(() => [...(requests ?? [])].sort((a, b) => ms(b.createdAt) - ms(a.createdAt)), [requests]);
  const openRequest = (requests ?? []).find((r) => r.status === 'pending');
  const hasBank = !!(bank?.accountNumber && bank.ifscCode && bank.accountHolder);

  const amountPaise = toPaise(amount);
  const amountError = amount ? payoutAmountError(amountPaise, calc.balance.available, minPayout, money) : null;

  const openModal = () => {
    setError(null);
    setNote('');
    setAmount(calc.balance.available >= minPayout ? String(calc.balance.available / 100) : '');
    setOpen(true);
  };

  const submit = async () => {
    const err = payoutAmountError(amountPaise, calc.balance.available, minPayout, money);
    if (err) return setError(err);
    if (!hasBank || !bank || !user) return setError('Add your bank account in Store Settings first.');
    setSaving(true);
    setError(null);
    try {
      await requestPayout({
        requesterType: 'vendor',
        requesterId: vendorId,
        requesterName: vendor?.storeName || 'Vendor',
        userId: user.uid,
        amount: amountPaise,
        bank: { accountHolder: bank.accountHolder, accountNumber: bank.accountNumber, ifscCode: bank.ifscCode, bankName: bank.bankName, ...(bank.upiId ? { upiId: bank.upiId } : {}) },
        note,
      });
      setOpen(false);
      setToast(`Payout request for ${money(amountPaise)} sent. We'll notify you here once it's processed.`);
      setTimeout(() => setToast(null), 6000);
    } catch (e: any) {
      setError(
        e?.code === 'permission-denied'
          ? 'This request was refused. You may already have one in review, or the amount is below the minimum.'
          : friendlyError(e, 'Could not send the payout request.'),
      );
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
      setToast(friendlyError(e, 'Could not cancel the request.'));
      setTimeout(() => setToast(null), 5000);
    } finally {
      setCancelling(null);
    }
  };

  const requestColumns: Column<PayoutRequest>[] = [
    { key: 'date', header: 'Requested', primary: true, render: (r) => <span className="font-semibold text-slate-900">{when(r.createdAt)}</span> },
    { key: 'amount', header: 'Amount', render: (r) => <span className="font-extrabold text-slate-900 tabular-nums">{money(r.amount)}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusPill tone={payoutTone(r.status)}>{PAYOUT_STATUS_LABEL[r.status] ?? r.status}</StatusPill> },
    {
      key: 'detail',
      header: 'Details',
      render: (r) => (
        <div className="text-xs text-slate-500 space-y-1">
          {r.status === 'paid' && <p>Ref: <span className="font-mono font-bold text-slate-800">{r.referenceNumber}</span> · {when(r.processedAt)}</p>}
          {r.status === 'rejected' && <p className="text-red-600 font-semibold">{r.adminNote || 'Rejected by admin'}</p>}
          {r.status === 'pending' && <p>To A/C •••• {r.bank.accountNumber.slice(-4)}</p>}
          {r.status === 'cancelled' && <p>Cancelled by you</p>}
          {r.note && (
            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md inline-block max-w-xs truncate" title={r.note}>
              Note: <span className="font-medium text-slate-800">{r.note}</span>
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) =>
        r.status === 'pending' ? (
          <Button size="sm" variant="outline" disabled={cancelling === r.id} onClick={() => cancel(r)}>
            <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel
          </Button>
        ) : null,
    },
  ];

  const ledger = useMemo(() => [...(orders ?? [])].filter((o) => o.status !== 'cancelled').sort((a, b) => ms(b.createdAt) - ms(a.createdAt)).slice(0, 50), [orders]);
  const ledgerColumns: Column<VendorOrder>[] = [
    { key: 'order', header: 'Order', primary: true, render: (o) => <span className="font-mono font-bold text-slate-900">#{(o.orderId || o.id).slice(0, 8).toUpperCase()}</span> },
    { key: 'date', header: 'Date', render: (o) => <span className="text-slate-600">{when(o.createdAt)}</span> },
    { key: 'gross', header: 'Sales', align: 'right', render: (o) => <span className="tabular-nums">{money(o.subtotal)}</span> },
    { key: 'fee', header: 'Platform fee', align: 'right', render: (o) => <span className="text-red-500 tabular-nums">-{money(o.commissionAmount || 0)}</span> },
    { key: 'net', header: 'You earn', align: 'right', render: (o) => <span className="font-extrabold text-emerald-700 tabular-nums">{money(o.vendorEarning || 0)}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (o) =>
        o.status === 'delivered' ? <StatusPill tone="green">Credited</StatusPill> : <StatusPill tone="slate">{o.status === 'returned' || o.status === 'return_requested' ? 'Returned' : 'Upcoming'}</StatusPill>,
    },
  ];

  const amountInput = 'w-full h-12 pl-9 pr-3 rounded-xl border border-slate-300 text-lg font-extrabold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto space-y-6">
      <PageHeader
        title="Finance & payouts"
        description="Your earnings from delivered orders, and withdrawals to your bank account."
        actions={
          <Button onClick={openModal} disabled={loading || !!openRequest || calc.balance.available < minPayout || !hasBank} className="h-10">
            <ArrowDownToLine className="w-4 h-4 mr-1.5" /> Request payout
          </Button>
        }
      />

      {toast && (
        <div role="status" className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm p-3.5">
          <CheckCheck className="w-4 h-4 mt-0.5 shrink-0" /> {toast}
        </div>
      )}

      {!loading && !hasBank && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-900 flex-1"><b>Add your bank account to get paid.</b> Payouts are sent to the account saved in Store Settings.</p>
          <Link to="/settings" className="inline-flex items-center justify-center h-9 px-4 rounded-lg bg-amber-500 text-white text-sm font-bold hover:bg-amber-600">Add bank account</Link>
        </div>
      )}

      {!loading && openRequest && (
        <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          <Clock className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
          <p>Your request for <b>{money(openRequest.amount)}</b> is waiting for review. You can send another one after it's processed or cancelled.</p>
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Available to withdraw" value={money(calc.balance.available)} icon={Wallet} tone="green" hint={calc.balance.available >= minPayout ? 'Ready to request' : `Minimum ${money(minPayout)}`} loading={loading} />
        <StatCard label="In review" value={money(calc.balance.pending)} icon={Clock} tone="amber" hint="Requested, not paid yet" loading={loading} />
        <StatCard label="Paid out" value={money(calc.balance.paid)} icon={CheckCheck} tone="sky" hint="Sent to your bank" loading={loading} />
        <StatCard label="Lifetime earnings" value={money(calc.earned)} icon={Banknote} tone="violet" hint={calc.upcomingAmt > 0 ? `+ ${money(calc.upcomingAmt)} upcoming` : 'From delivered orders'} loading={loading} />
      </div>

      <Section title="Payout account" icon={Landmark}>
        {loading ? (
          <Skeleton className="h-12" />
        ) : hasBank && bank ? (
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0"><Building2 className="w-5 h-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-900 truncate">{bank.bankName} · {bank.accountHolder}</p>
              <p className="text-xs text-slate-500 font-mono">A/C •••• {bank.accountNumber.slice(-4)} · IFSC {bank.ifscCode}</p>
            </div>
            <Link to="/settings" className="text-xs font-bold text-primary-600 hover:underline shrink-0">Change</Link>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No bank account saved yet.</p>
        )}
      </Section>

      <Section title="Payout requests" icon={ArrowDownToLine} flush>
        {loading ? (
          <div className="p-5 space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (
          <DataTable columns={requestColumns} rows={sortedRequests} rowKey={(r) => r.id} empty={<EmptyState icon={ArrowDownToLine} title="No payout requests yet" description="When you request a withdrawal, its progress shows up here." />} />
        )}
      </Section>

      <Section title="Earnings ledger" icon={Receipt} flush>
        {loading ? (
          <div className="p-5 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (
          <DataTable columns={ledgerColumns} rows={ledger} rowKey={(o) => o.id} empty={<EmptyState icon={Receipt} title="No orders yet" description="Each order you fulfil is listed here with the platform fee and your earning." />} />
        )}
      </Section>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Request a payout"
        description="Choose how much to withdraw. We'll send it to your saved bank account."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} isLoading={saving} disabled={!amount || !!amountError}>Send request</Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-emerald-900">Available balance</span>
            <span className="text-xl font-black text-emerald-700 tabular-nums">{money(calc.balance.available)}</span>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="payout-amount" className="text-sm font-semibold text-slate-700">Amount</label>
              <button type="button" onClick={() => setAmount(String(calc.balance.available / 100))} className="text-xs font-bold text-primary-600 hover:underline">Withdraw all</button>
            </div>
            <div className="relative mt-1.5">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-extrabold text-slate-400">₹</span>
              <input id="payout-amount" inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, '').replace(/^(\d*\.\d{0,2}).*$/, '$1'))} className={amountInput} placeholder="0" />
            </div>
            {amountError ? <p className="mt-1.5 text-xs text-red-600">{amountError}</p> : <p className="mt-1.5 text-xs text-slate-500">Minimum {money(minPayout)} per request.</p>}
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Note <span className="font-normal text-slate-400">(optional)</span></span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500" placeholder="Anything the finance team should know" />
          </label>
          {bank && (
            <div className="rounded-xl border border-slate-200 p-3.5 text-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Paying to</p>
              <p className="font-bold text-slate-900">{bank.bankName} · {bank.accountHolder}</p>
              <p className="text-xs text-slate-500 font-mono">A/C •••• {bank.accountNumber.slice(-4)} · IFSC {bank.ifscCode}</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
