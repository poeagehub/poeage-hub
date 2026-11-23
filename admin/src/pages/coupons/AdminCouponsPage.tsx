import React, { useEffect, useMemo, useState } from 'react';
import {
  subscribeToCollection,
  setDocument,
  updateDocument,
  deleteDocument,
  Timestamp,
  friendlyError,
} from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Coupon } from '@poeage/types';
import { formatMoney } from '@poeage/utils';
import { Button, PageHeader, Section, EmptyState, Modal, StatusPill, Pills, DataTable, Skeleton, type Column } from '@poeage/ui';
import { TicketPercent, Plus, Pencil, Trash2, AlertCircle, Copy } from 'lucide-react';
import { Switch } from '../../components/ui/Switch';

interface FormState {
  id?: string;
  code: string;
  description: string;
  discountType: 'percentage' | 'flat';
  discountValue: string;
  maxDiscount: string;
  minOrder: string;
  usageLimit: string;
  perUserLimit: string;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
}

const toInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const ms = (t: any): number => (t?.toDate ? t.toDate().getTime() : 0);
const blank = (): FormState => ({
  code: '',
  description: '',
  discountType: 'percentage',
  discountValue: '10',
  maxDiscount: '',
  minOrder: '0',
  usageLimit: '',
  perUserLimit: '1',
  validFrom: toInput(new Date()),
  validUntil: toInput(new Date(Date.now() + 30 * 86_400_000)),
  isActive: true,
});

function state(c: Coupon): { label: string; tone: 'green' | 'amber' | 'red' | 'slate' } {
  const now = Date.now();
  if (!c.isActive) return { label: 'Paused', tone: 'slate' };
  if (ms(c.validUntil) && ms(c.validUntil) < now) return { label: 'Expired', tone: 'red' };
  if (ms(c.validFrom) > now) return { label: 'Scheduled', tone: 'amber' };
  return { label: 'Live', tone: 'green' };
}

export const AdminCouponsPage: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [del, setDel] = useState<Coupon | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [used, setUsed] = useState<Record<string, number>>({});

  useEffect(() => {
    const a = subscribeToCollection<Coupon>(COLLECTION.COUPONS, [], setCoupons, (e) => setError(friendlyError(e, 'Could not load coupons.')));
    const b = subscribeToCollection<{ id: string; couponCode: string }>('couponRedemptions', [], (rs) => {
      const m: Record<string, number> = {};
      rs.forEach((r) => { m[r.couponCode] = (m[r.couponCode] ?? 0) + 1; });
      setUsed(m);
    }, () => {});
    return () => { a(); b(); };
  }, []);

  const rows = useMemo(() => {
    const all = [...(coupons ?? [])].sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
    return filter === 'all' ? all : all.filter((c) => state(c).label.toLowerCase() === filter);
  }, [coupons, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: coupons?.length ?? 0 };
    (coupons ?? []).forEach((x) => { const k = state(x).label.toLowerCase(); c[k] = (c[k] ?? 0) + 1; });
    return c;
  }, [coupons]);

  const edit = (c: Coupon) => {
    setError(null);
    setForm({
      id: c.id,
      code: c.code,
      description: c.description ?? '',
      discountType: c.discountType,
      discountValue: String(c.discountType === 'flat' ? c.discountValue / 100 : c.discountValue),
      maxDiscount: c.maxDiscountAmount ? String(c.maxDiscountAmount / 100) : '',
      minOrder: String((c.minOrderAmount ?? 0) / 100),
      usageLimit: '',
      perUserLimit: '1',
      validFrom: toInput(c.validFrom?.toDate?.() ?? new Date()),
      validUntil: toInput(c.validUntil?.toDate?.() ?? new Date()),
      isActive: c.isActive,
    });
  };

  const save = async () => {
    if (!form) return;
    const code = form.code.trim().toUpperCase().replace(/\s+/g, '');
    const val = Number(form.discountValue);
    if (code.length < 3) return setError('Coupon code must be at least 3 characters.');
    if (!/^[A-Z0-9_-]+$/.test(code)) return setError('Use only letters, numbers, - and _ in the code.');
    if (!(val > 0)) return setError('Enter a discount greater than 0.');
    if (form.discountType === 'percentage' && val > 90) return setError('Percentage discount cannot exceed 90%.');
    if (!form.id && (coupons ?? []).some((c) => c.id === code || c.code === code)) return setError('That code already exists.');
    const from = new Date(form.validFrom + 'T00:00:00');
    const until = new Date(form.validUntil + 'T23:59:59');
    if (until <= from) return setError('The end date must be after the start date.');

    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        code,
        description: form.description.trim(),
        discountType: form.discountType,
        discountValue: form.discountType === 'flat' ? Math.round(val * 100) : val,
        minOrderAmount: Math.round((Number(form.minOrder) || 0) * 100),
        perUserLimit: 1,
        isActive: form.isActive,
        validFrom: Timestamp.fromDate(from),
        validUntil: Timestamp.fromDate(until),
        ...(form.discountType === 'percentage' && form.maxDiscount ? { maxDiscountAmount: Math.round(Number(form.maxDiscount) * 100) } : {}),
      };
      if (form.id) {
        // Clear optional caps that were removed
        const extra: Record<string, unknown> = {};
        if (form.discountType !== 'percentage' || !form.maxDiscount) extra.maxDiscountAmount = null;
        await updateDocument(COLLECTION.COUPONS, form.id, { ...payload, ...extra });
      } else {
        // The code is the document id, so checkout can look it up directly.
        await setDocument(COLLECTION.COUPONS, code, { ...payload, usedCount: 0 });
      }
      setForm(null);
    } catch (e) {
      setError(friendlyError(e, 'Could not save the coupon.'));
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<Coupon>[] = [
    {
      key: 'code',
      header: 'Code',
      primary: true,
      render: (c) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-[13px] font-extrabold tracking-wide px-2 py-1 rounded-lg bg-primary-50 text-primary-700 border border-primary-100">{c.code}</span>
          <button onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(c.code); setCopied(c.code); setTimeout(() => setCopied(null), 1200); }} className="text-slate-400 hover:text-slate-700" aria-label="Copy code">
            {copied === c.code ? <span className="text-[11px] text-emerald-600 font-bold">Copied</span> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      ),
    },
    { key: 'offer', header: 'Offer', render: (c) => <div><div className="font-bold text-slate-900">{c.discountType === 'percentage' ? `${c.discountValue}% off` : `${formatMoney(c.discountValue)} off`}</div><div className="text-xs text-slate-500">{c.minOrderAmount ? `Min ${formatMoney(c.minOrderAmount)}` : 'No minimum'}{c.maxDiscountAmount ? ` · up to ${formatMoney(c.maxDiscountAmount)}` : ''}</div></div> },
    { key: 'valid', header: 'Valid', render: (c) => <span className="text-xs text-slate-600">{c.validFrom?.toDate?.().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} → {c.validUntil?.toDate?.().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</span> },
    { key: 'used', header: 'Redeemed', render: (c) => <span className="text-sm font-semibold">{used[c.code] ?? 0}<span className="text-slate-400 font-normal"> times</span></span> },
    { key: 'status', header: 'Status', render: (c) => { const s = state(c); return <StatusPill tone={s.tone}>{s.label}</StatusPill>; } },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (c) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200/80 bg-slate-50/70" title={c.isActive ? 'Pause coupon' : 'Activate coupon'}>
            <Switch
              size="sm"
              tone="emerald"
              checked={c.isActive}
              onChange={() => updateDocument(COLLECTION.COUPONS, c.id, { isActive: !c.isActive }).catch((e) => setError(friendlyError(e, 'Update failed.')))}
            />
            <span className="text-[11px] font-semibold text-slate-600 select-none">
              {c.isActive ? 'Active' : 'Paused'}
            </span>
          </div>
          <button onClick={() => edit(c)} aria-label="Edit" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 active:scale-95 transition-all"><Pencil className="w-4 h-4" /></button>
          <button onClick={() => setDel(c)} aria-label="Delete" className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  const input = 'mt-1.5 w-full h-11 px-3.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <PageHeader
        title="Coupons"
        description="Create discount codes customers can apply at checkout."
        actions={<Button onClick={() => { setError(null); setForm(blank()); }}><Plus className="w-4 h-4 mr-1.5" /> New coupon</Button>}
      />
      {error && !form && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm p-3.5"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</div>
      )}
      <Pills
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'All', count: counts.all ?? 0 },
          { value: 'live', label: 'Live', count: counts.live ?? 0 },
          { value: 'scheduled', label: 'Scheduled', count: counts.scheduled ?? 0 },
          { value: 'paused', label: 'Paused', count: counts.paused ?? 0 },
          { value: 'expired', label: 'Expired', count: counts.expired ?? 0 },
        ]}
      />
      <Section flush>
        {coupons === null ? (
          <div className="p-5 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(c) => c.id}
            empty={<EmptyState icon={TicketPercent} title="No coupons here" description="Create a code like WELCOME10 to run a promotion." action={<Button onClick={() => setForm(blank())}><Plus className="w-4 h-4 mr-1.5" /> New coupon</Button>} />}
          />
        )}
      </Section>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Edit coupon' : 'New coupon'}
        footer={<><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button onClick={save} isLoading={saving}>{form?.id ? 'Save changes' : 'Create coupon'}</Button></>}
      >
        {form && (
          <div className="space-y-4">
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <label className="block"><span className="text-sm font-semibold text-slate-700">Code</span>
              <input value={form.code} disabled={!!form.id} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className={`${input} font-mono uppercase tracking-wider disabled:bg-slate-100 disabled:text-slate-500`} placeholder="WELCOME10" />
            </label>
            <label className="block"><span className="text-sm font-semibold text-slate-700">Description</span>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={input} placeholder="10% off your first order" />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-semibold text-slate-700">Type</span>
                <div className="mt-1.5 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                  {(['percentage', 'flat'] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setForm({ ...form, discountType: t })} className={`h-9 rounded-lg text-sm font-semibold ${form.discountType === t ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>{t === 'percentage' ? '% Off' : '₹ Off'}</button>
                  ))}
                </div>
              </div>
              <label className="block"><span className="text-sm font-semibold text-slate-700">{form.discountType === 'percentage' ? 'Percent' : 'Amount (₹)'}</span>
                <input type="number" inputMode="decimal" min="0" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} className={input} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="block"><span className="text-sm font-semibold text-slate-700">Min. order (₹)</span>
                <input type="number" inputMode="decimal" min="0" value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: e.target.value })} className={input} />
              </label>
              {form.discountType === 'percentage' && (
                <label className="block"><span className="text-sm font-semibold text-slate-700">Max discount (₹)</span>
                  <input type="number" inputMode="decimal" min="0" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} className={input} placeholder="No cap" />
                </label>
              )}
            </div>
            <p className="text-xs text-slate-500 -mt-1">Each customer can use a code once.</p>
            <div className="grid grid-cols-2 gap-4">
              <label className="block"><span className="text-sm font-semibold text-slate-700">Starts</span>
                <input type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} className={input} />
              </label>
              <label className="block"><span className="text-sm font-semibold text-slate-700">Ends</span>
                <input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} className={input} />
              </label>
            </div>
            <div className="rounded-xl border border-slate-200/80 p-3.5 bg-slate-50/70 card-modern-hover">
              <Switch
                checked={form.isActive}
                onChange={(checked) => setForm({ ...form, isActive: checked })}
                tone="emerald"
                size="md"
                label="Active for shoppers"
                description="Customers can apply this promotional code at checkout"
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!del} onClose={() => setDel(null)} size="sm" title="Delete coupon?" description={del ? `${del.code} will stop working immediately.` : ''}
        footer={<><Button variant="outline" onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" onClick={async () => { if (del) { await deleteDocument(COLLECTION.COUPONS, del.id).catch((e) => setError(friendlyError(e, 'Delete failed.'))); setDel(null); } }}>Delete</Button></>}
      ><p className="text-sm text-slate-600">Past orders that used this code are not affected.</p></Modal>
    </div>
  );
};
