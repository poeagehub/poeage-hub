import React, { useEffect, useMemo, useState } from 'react';
import { subscribeToCollection, processPayoutRequest, friendlyError, where } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { PayoutRequest, Vendor, Driver, VendorOrder, Delivery } from '@poeage/types';
import { formatMoney, summarizePayoutBalance, PAYOUT_STATUS_LABEL } from '@poeage/utils';
import { PageHeader, StatCard, Section, Pills, DataTable, StatusPill, EmptyState, Modal, Skeleton, Button, type Column } from '@poeage/ui';
import { Wallet, Clock, CheckCheck, Percent, Store, Truck, Copy, Check, AlertTriangle, X, Landmark, ShieldCheck, MessageSquareText } from 'lucide-react';
import { useAdminAuth } from '../../context/AuthContext';

const ms = (t: any): number => (t?.toMillis ? t.toMillis() : t?.seconds ? t.seconds * 1000 : 0);
const when = (t: any) => (ms(t) ? new Date(ms(t)).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
const tone = (s: string) => (s === 'paid' ? 'green' : s === 'pending' ? 'amber' : s === 'rejected' ? 'red' : 'slate');
const money = (p: number) => formatMoney(p);

const CopyBtn: React.FC<{ value: string; label: string }> = ({ value, label }) => {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      aria-label={`Copy ${label}`}
      className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-slate-100"
    >
      {done ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

export const AdminPayoutsPage: React.FC = () => {
  const { user } = useAdminAuth();
  const [requests, setRequests] = useState<PayoutRequest[] | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vOrders, setVOrders] = useState<VendorOrder[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [tab, setTab] = useState('pending');
  const [target, setTarget] = useState<{ req: PayoutRequest; action: 'paid' | 'rejected' } | null>(null);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const onErr = (e: Error) => {
      console.error('[Payouts]', e);
      setToast({ ok: false, text: friendlyError(e, 'Some payout data could not be loaded.') });
    };
    const u = [
      subscribeToCollection<PayoutRequest>(COLLECTION.PAYOUT_REQUESTS, [], setRequests, (e) => { onErr(e); setRequests([]); }),
      subscribeToCollection<Vendor>(COLLECTION.VENDORS, [], setVendors, onErr),
      subscribeToCollection<Driver>(COLLECTION.DRIVERS, [], setDrivers, onErr),
      subscribeToCollection<VendorOrder>(COLLECTION.VENDOR_ORDERS, [where('status', '==', 'delivered')], setVOrders, onErr),
      subscribeToCollection<Delivery>(COLLECTION.DELIVERIES, [where('status', '==', 'delivered')], setDeliveries, onErr),
    ];
    return () => u.forEach((f) => f());
  }, []);

  // Verified earnings, straight from delivered orders / deliveries (not from anything the requester typed).
  const earnedOf = useMemo(() => {
    const v = new Map<string, number>();
    vOrders.forEach((o) => v.set(o.vendorId, (v.get(o.vendorId) ?? 0) + (o.vendorEarning || 0)));
    const d = new Map<string, number>();
    deliveries.forEach((x) => x.driverId && d.set(x.driverId, (d.get(x.driverId) ?? 0) + (x.driverEarning || 0)));
    return (type: string, id: string) => (type === 'vendor' ? v.get(id) : d.get(id)) ?? 0;
  }, [vOrders, deliveries]);

  const all = requests ?? [];
  const balanceFor = (type: string, id: string) =>
    summarizePayoutBalance(earnedOf(type, id), all.filter((r) => r.requesterType === type && r.requesterId === id));

  /** Money that was really available when this request was made: earned − paid − OTHER pending requests. */
  const eligibleFor = (r: PayoutRequest) => {
    const others = all.filter((x) => x.requesterType === r.requesterType && x.requesterId === r.requesterId && x.id !== r.id);
    return summarizePayoutBalance(earnedOf(r.requesterType, r.requesterId), others).available;
  };

  const rows = useMemo(() => {
    const sorted = [...all].sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
    return tab === 'all' ? sorted : sorted.filter((r) => r.status === tab);
  }, [all, tab]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, paid: 0, rejected: 0, cancelled: 0, all: all.length };
    all.forEach((r) => (c[r.status] = (c[r.status] ?? 0) + 1));
    return c;
  }, [all]);

  const stats = useMemo(() => {
    const pend = all.filter((r) => r.status === 'pending');
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const paid = all.filter((r) => r.status === 'paid');
    return {
      pendingAmt: pend.reduce((s, r) => s + r.amount, 0),
      pendingN: pend.length,
      paidMonth: paid.filter((r) => ms(r.processedAt) >= monthStart.getTime()).reduce((s, r) => s + r.amount, 0),
      paidTotal: paid.reduce((s, r) => s + r.amount, 0),
      commission: vOrders.reduce((s, o) => s + (o.commissionAmount || 0), 0),
    };
  }, [all, vOrders]);

  // Balances tab: everyone who has earned something
  const balances = useMemo(() => {
    const list: { key: string; type: 'vendor' | 'driver'; id: string; name: string; bal: ReturnType<typeof summarizePayoutBalance> }[] = [];
    vendors.forEach((v) => list.push({ key: `v${v.id}`, type: 'vendor', id: v.id, name: v.storeName, bal: balanceFor('vendor', v.id) }));
    drivers.forEach((d) => list.push({ key: `d${d.id}`, type: 'driver', id: d.id, name: d.displayName, bal: balanceFor('driver', d.id) }));
    return list.filter((x) => x.bal.earned > 0 || x.bal.paid > 0 || x.bal.pending > 0).sort((a, b) => b.bal.available - a.bal.available);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendors, drivers, vOrders, deliveries, requests]);

  const open = (req: PayoutRequest, action: 'paid' | 'rejected') => {
    setError(null);
    setReference('');
    setNote('');
    setTarget({ req, action });
  };

  const confirm = async () => {
    if (!target || !user) return;
    const { req, action } = target;
    if (action === 'paid' && reference.trim().length < 4) return setError('Enter the bank transfer / UTR reference (at least 4 characters).');
    if (action === 'rejected' && note.trim().length < 5) return setError('Give the requester a short reason (at least 5 characters).');
    setSaving(true);
    setError(null);
    try {
      await processPayoutRequest({ request: req, action, adminId: user.uid, adminEmail: user.email ?? '', referenceNumber: reference, adminNote: note });
      setToast({ ok: true, text: action === 'paid' ? `Marked ${money(req.amount)} as paid to ${req.requesterName}.` : `Request from ${req.requesterName} rejected.` });
      setTimeout(() => setToast(null), 5000);
      setTarget(null);
    } catch (e: any) {
      setError(e?.code === 'permission-denied' ? 'This request was already processed or cancelled. Refresh and check its status.' : friendlyError(e, 'Could not update the request.'));
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<PayoutRequest>[] = [
    {
      key: 'who',
      header: 'Requester',
      primary: true,
      render: (r) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${r.requesterType === 'vendor' ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600'}`}>
            {r.requesterType === 'vendor' ? <Store className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
          </span>
          <div className="min-w-0">
            <p className="font-bold text-slate-900 truncate">{r.requesterName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] text-slate-400 capitalize">{r.requesterType}</span>
              {r.note && (
                <span className="md:hidden inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 rounded truncate max-w-[160px]" title={r.note}>
                  <MessageSquareText className="w-3 h-3 text-amber-600 shrink-0" />
                  <span className="truncate">{r.note}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      ),
    },
    { key: 'amount', header: 'Amount', render: (r) => <span className="text-base font-extrabold text-slate-900 tabular-nums">{money(r.amount)}</span> },
    { key: 'date', header: 'Requested', render: (r) => <span className="text-xs text-slate-600">{when(r.createdAt)}</span> },
    {
      key: 'note',
      header: 'Note',
      render: (r) =>
        r.note ? (
          <div className="max-w-[240px]" title={r.note}>
            <div className="inline-flex items-start gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50/90 border border-amber-200/80 text-amber-900 text-xs shadow-xs">
              <MessageSquareText className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span className="font-medium truncate leading-tight">{r.note}</span>
            </div>
          </div>
        ) : (
          <span className="text-xs text-slate-400 italic">—</span>
        ),
    },
    {
      key: 'check',
      header: 'Verified balance',
      render: (r) => {
        if (r.status !== 'pending') return <span className="text-xs text-slate-400">—</span>;
        const eligible = eligibleFor(r);
        return r.amount <= eligible ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><ShieldCheck className="w-3.5 h-3.5" /> OK · {money(eligible)} available</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600"><AlertTriangle className="w-3.5 h-3.5" /> Exceeds · only {money(eligible)}</span>
        );
      },
    },
    { key: 'status', header: 'Status', render: (r) => <StatusPill tone={tone(r.status)}>{PAYOUT_STATUS_LABEL[r.status] ?? r.status}</StatusPill> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) =>
        r.status === 'pending' ? (
          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" onClick={() => open(r, 'paid')}><CheckCheck className="w-3.5 h-3.5 mr-1" /> Pay</Button>
            <Button size="sm" variant="outline" onClick={() => open(r, 'rejected')}><X className="w-3.5 h-3.5 mr-1" /> Reject</Button>
          </div>
        ) : r.status === 'paid' ? (
          <span className="text-[11px] text-slate-500">Ref <span className="font-mono font-bold text-slate-800">{r.referenceNumber}</span></span>
        ) : r.status === 'rejected' ? (
          <span className="text-[11px] text-red-500 max-w-[160px] inline-block truncate" title={r.adminNote}>{r.adminNote}</span>
        ) : null,
    },
  ];

  const balanceColumns: Column<(typeof balances)[number]>[] = [
    {
      key: 'name',
      header: 'Vendor / driver',
      primary: true,
      render: (b) => (
        <div className="flex items-center gap-2.5">
          <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${b.type === 'vendor' ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600'}`}>{b.type === 'vendor' ? <Store className="w-4 h-4" /> : <Truck className="w-4 h-4" />}</span>
          <div><p className="font-bold text-slate-900">{b.name}</p><p className="text-[11px] text-slate-400 capitalize">{b.type}</p></div>
        </div>
      ),
    },
    { key: 'earned', header: 'Earned', align: 'right', render: (b) => <span className="tabular-nums">{money(b.bal.earned)}</span> },
    { key: 'paid', header: 'Paid out', align: 'right', render: (b) => <span className="tabular-nums text-slate-600">{money(b.bal.paid)}</span> },
    { key: 'pending', header: 'In review', align: 'right', render: (b) => <span className="tabular-nums text-amber-600">{money(b.bal.pending)}</span> },
    { key: 'avail', header: 'Available', align: 'right', render: (b) => <span className="tabular-nums font-extrabold text-emerald-700">{money(b.bal.available)}</span> },
  ];

  const target_eligible = target ? eligibleFor(target.req) : 0;
  const overBalance = !!target && target.req.amount > target_eligible;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1300px] mx-auto space-y-6">
      <PageHeader title="Payouts" description="Review withdrawal requests from sellers and delivery partners, send the money, and record the transfer." />

      {toast && (
        <div role="status" className={`flex items-start gap-2.5 rounded-xl border text-sm p-3.5 ${toast.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {toast.ok ? <CheckCheck className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />} {toast.text}
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Awaiting payout" value={money(stats.pendingAmt)} icon={Clock} tone="amber" hint={`${stats.pendingN} request${stats.pendingN === 1 ? '' : 's'}`} loading={requests === null} />
        <StatCard label="Paid this month" value={money(stats.paidMonth)} icon={CheckCheck} tone="green" hint="Marked as paid" loading={requests === null} />
        <StatCard label="Total paid out" value={money(stats.paidTotal)} icon={Wallet} tone="primary" hint="All time" loading={requests === null} />
        <StatCard label="Platform commission" value={money(stats.commission)} icon={Percent} tone="violet" hint="Earned on delivered orders" loading={requests === null} />
      </div>

      <Pills
        value={tab}
        onChange={setTab}
        options={[
          { value: 'pending', label: 'Pending', count: counts.pending ?? 0 },
          { value: 'paid', label: 'Paid', count: counts.paid ?? 0 },
          { value: 'rejected', label: 'Rejected', count: counts.rejected ?? 0 },
          { value: 'cancelled', label: 'Cancelled', count: counts.cancelled ?? 0 },
          { value: 'all', label: 'All requests', count: counts.all ?? 0 },
          { value: 'balances', label: 'Balances' },
        ]}
      />

      {tab === 'balances' ? (
        <Section title="Verified balances" icon={Landmark} flush>
          <DataTable columns={balanceColumns} rows={balances} rowKey={(b) => b.key} empty={<EmptyState icon={Wallet} title="No earnings yet" description="Balances appear once orders are delivered." />} />
        </Section>
      ) : (
        <Section flush>
          {requests === null ? (
            <div className="p-5 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : (
            <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} empty={<EmptyState icon={Wallet} title={tab === 'pending' ? 'No pending requests' : 'Nothing here'} description={tab === 'pending' ? 'New withdrawal requests will show up here.' : undefined} />} />
          )}
        </Section>
      )}

      {/* Pay / reject dialog */}
      <Modal
        open={!!target}
        onClose={() => !saving && setTarget(null)}
        title={target?.action === 'paid' ? 'Mark payout as paid' : 'Reject payout request'}
        description={target ? `${target.req.requesterName} · ${money(target.req.amount)}` : ''}
        footer={
          <>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={saving}>Cancel</Button>
            <Button variant={target?.action === 'rejected' ? 'danger' : 'primary'} onClick={confirm} isLoading={saving}>
              {target?.action === 'paid' ? 'Confirm — money sent' : 'Reject request'}
            </Button>
          </>
        }
      >
        {target && (
          <div className="space-y-4">
            {error && <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            {overBalance && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm p-3">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <p><b>This request is larger than the verified balance.</b> Delivered orders only support {money(target_eligible)}. Check before paying, or reject it.</p>
              </div>
            )}

            {target.action === 'paid' && (
              <>
                <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100 text-sm">
                  {[
                    ['Pay exactly', money(target.req.amount), String(target.req.amount / 100)],
                    ['Account holder', target.req.bank.accountHolder, target.req.bank.accountHolder],
                    ['Account number', target.req.bank.accountNumber, target.req.bank.accountNumber],
                    ['IFSC', target.req.bank.ifscCode, target.req.bank.ifscCode],
                    ['Bank', target.req.bank.bankName, target.req.bank.bankName],
                    ...(target.req.bank.upiId ? [['UPI', target.req.bank.upiId, target.req.bank.upiId]] : []),
                  ].map(([l, v, copy]) => (
                    <div key={l} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{l}</span>
                      <span className="flex items-center gap-1 min-w-0"><span className="font-mono font-bold text-slate-900 truncate">{v}</span><CopyBtn value={copy as string} label={l as string} /></span>
                    </div>
                  ))}
                </div>
                {target.req.note && (
                  <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200/90 text-xs text-amber-900 shadow-xs">
                    <MessageSquareText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-amber-950">Requester's Note</p>
                      <p className="mt-0.5 text-amber-800 break-words leading-relaxed">{target.req.note}</p>
                    </div>
                  </div>
                )}
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Transfer reference (UTR / transaction ID)</span>
                  <input value={reference} onChange={(e) => setReference(e.target.value)} autoFocus placeholder="e.g. UTR123456789012" className="mt-1.5 w-full h-11 px-3.5 rounded-xl border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Note <span className="font-normal text-slate-400">(optional)</span></span>
                  <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className="mt-1.5 w-full h-11 px-3.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500" />
                </label>
                <p className="text-xs text-slate-500">Send the money from your bank first, then confirm here. The requester is shown the reference.</p>
              </>
            )}

            {target.action === 'rejected' && (
              <div className="space-y-3">
                {target.req.note && (
                  <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200/90 text-xs text-amber-900 shadow-xs">
                    <MessageSquareText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-amber-950">Requester's Note</p>
                      <p className="mt-0.5 text-amber-800 break-words leading-relaxed">{target.req.note}</p>
                    </div>
                  </div>
                )}
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Reason (shown to the requester)</span>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} autoFocus maxLength={300} rows={3} placeholder="e.g. Bank details do not match the account holder name." className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500" />
                </label>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
