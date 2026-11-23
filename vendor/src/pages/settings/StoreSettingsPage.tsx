import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useVendorAuth } from '../../context/AuthContext';
import { updateDocument, setDocument, subscribeToDocument, friendlyError } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Vendor, VendorBankDetails } from '@poeage/types';
import { Button, Card, Badge, Spinner, Switch } from '@poeage/ui';
import { compressImageToDataUrl } from '../../lib/imageCompress';
import {
  Store,
  Phone,
  MapPin,
  Landmark,
  Clock,
  ScrollText,
  Power,
  ImagePlus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
type Day = (typeof DAYS)[number];
type Hours = Record<Day, { open: boolean; from: string; to: string }>;

const defaultHours = (): Hours =>
  Object.fromEntries(DAYS.map((d) => [d, { open: d !== 'sunday', from: '09:00', to: '18:00' }])) as Hours;

interface Form {
  storeName: string;
  description: string;
  logoURL: string;
  bannerURL: string;
  email: string;
  phone: string;
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  gstNumber: string;
  panNumber: string;
  accountHolder: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  upiId: string;
  isOpen: boolean;
  pauseReason: string;
  openingHours: Hours;
  prepTimeDays: string;
  shippingPolicy: string;
  returnPolicy: string;
  returnWindowDays: string;
}

const toForm = (v: Vendor | null, bank?: VendorBankDetails | null): Form => ({
  storeName: v?.storeName ?? '',
  description: v?.description ?? '',
  logoURL: v?.logoURL ?? '',
  bannerURL: v?.bannerURL ?? '',
  email: v?.email ?? '',
  phone: v?.phone ?? '',
  line1: v?.address?.line1 ?? '',
  city: v?.address?.city ?? '',
  state: v?.address?.state ?? '',
  postalCode: (v?.address as { postalCode?: string } | undefined)?.postalCode ?? '',
  gstNumber: v?.gstNumber ?? '',
  panNumber: v?.panNumber ?? '',
  accountHolder: bank?.accountHolder ?? '',
  accountNumber: bank?.accountNumber ?? '',
  ifscCode: bank?.ifscCode ?? '',
  bankName: bank?.bankName ?? '',
  upiId: bank?.upiId ?? '',
  isOpen: v?.isOpen !== false,
  pauseReason: v?.pauseReason ?? '',
  openingHours: { ...defaultHours(), ...(v?.openingHours ?? {}) } as Hours,
  prepTimeDays: String(v?.prepTimeDays ?? 1),
  shippingPolicy: v?.shippingPolicy ?? '',
  returnPolicy: v?.returnPolicy ?? '',
  returnWindowDays: String(v?.returnWindowDays ?? 7),
});

type Errors = Partial<Record<keyof Form, string>>;

const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPI_RE = /^[\w.-]{2,}@[a-zA-Z]{2,}$/;

function validate(f: Form): Errors {
  const e: Errors = {};
  if (f.storeName.trim().length < 3) e.storeName = 'Store name must be at least 3 characters.';
  if (f.description.length > 500) e.description = 'Keep the description under 500 characters.';
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Enter a valid email address.';
  const phoneDigits = f.phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  if (phoneDigits.length !== 10) e.phone = 'Enter a 10-digit mobile number.';
  if (!f.line1.trim()) e.line1 = 'Pickup address is required: drivers collect parcels here.';
  if (!f.city.trim()) e.city = 'City is required.';
  if (!f.state.trim()) e.state = 'State is required.';
  if (!/^\d{6}$/.test(f.postalCode.trim())) e.postalCode = 'Enter a 6-digit PIN code.';
  if (f.gstNumber.trim() && !GST_RE.test(f.gstNumber.trim().toUpperCase())) e.gstNumber = 'GSTIN looks wrong (15 characters, e.g. 22AAAAA0000A1Z5).';
  if (f.panNumber.trim() && !PAN_RE.test(f.panNumber.trim().toUpperCase())) e.panNumber = 'PAN looks wrong (e.g. ABCDE1234F).';

  const anyBank = [f.accountHolder, f.accountNumber, f.ifscCode, f.bankName].some((x) => x.trim());
  if (anyBank) {
    if (!f.accountHolder.trim()) e.accountHolder = 'Account holder name is required.';
    if (!/^\d{9,18}$/.test(f.accountNumber.trim())) e.accountNumber = 'Account number must be 9 to 18 digits.';
    if (!IFSC_RE.test(f.ifscCode.trim().toUpperCase())) e.ifscCode = 'IFSC looks wrong (e.g. HDFC0001234).';
    if (!f.bankName.trim()) e.bankName = 'Bank name is required.';
  }
  if (f.upiId.trim() && !UPI_RE.test(f.upiId.trim())) e.upiId = 'UPI ID looks wrong (e.g. name@bank).';

  const prep = Number(f.prepTimeDays);
  if (!Number.isInteger(prep) || prep < 0 || prep > 14) e.prepTimeDays = 'Enter 0 to 14 days.';
  const win = Number(f.returnWindowDays);
  if (!Number.isInteger(win) || win < 0 || win > 30) e.returnWindowDays = 'Enter 0 to 30 days.';
  if (f.shippingPolicy.length > 1000) e.shippingPolicy = 'Keep this under 1000 characters.';
  if (f.returnPolicy.length > 1000) e.returnPolicy = 'Keep this under 1000 characters.';
  for (const d of DAYS) {
    const h = f.openingHours[d];
    if (h.open && h.from >= h.to) {
      e.openingHours = `${d[0]!.toUpperCase()}${d.slice(1)}: closing time must be after opening time.`;
      break;
    }
  }
  return e;
}

/** Only the top-level vendor fields that actually changed, shaped for Firestore. */
/** Bank details live in a private record, not on the public store document. */
function buildBank(f: Form, base: Form): VendorBankDetails | null {
  const changed = (['accountHolder', 'accountNumber', 'ifscCode', 'bankName', 'upiId'] as const).some((k) => f[k] !== base[k]);
  if (!changed || ![f.accountHolder, f.accountNumber, f.ifscCode, f.bankName].some((x) => x.trim())) return null;
  return {
    accountHolder: f.accountHolder.trim(),
    accountNumber: f.accountNumber.trim(),
    ifscCode: f.ifscCode.trim().toUpperCase(),
    bankName: f.bankName.trim(),
    ...(f.upiId.trim() ? { upiId: f.upiId.trim() } : {}),
  };
}

function buildPayload(f: Form, base: Form, vendor: Vendor): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const changed = (...keys: Array<keyof Form>) => keys.some((k) => JSON.stringify(f[k]) !== JSON.stringify(base[k]));

  if (changed('storeName')) payload['storeName'] = f.storeName.trim();
  if (changed('description')) payload['description'] = f.description.trim();
  if (changed('logoURL')) payload['logoURL'] = f.logoURL;
  if (changed('bannerURL')) payload['bannerURL'] = f.bannerURL;
  if (changed('email')) payload['email'] = f.email.trim();
  if (changed('phone')) payload['phone'] = f.phone.trim();
  if (changed('gstNumber')) payload['gstNumber'] = f.gstNumber.trim().toUpperCase();
  if (changed('panNumber')) payload['panNumber'] = f.panNumber.trim().toUpperCase();
  if (changed('line1', 'city', 'state', 'postalCode')) {
    payload['address'] = {
      ...(vendor.address ?? {}),
      line1: f.line1.trim(),
      city: f.city.trim(),
      state: f.state.trim(),
      postalCode: f.postalCode.trim(),
      country: vendor.address?.country || 'India',
    };
  }
  if (changed('isOpen')) payload['isOpen'] = f.isOpen;
  if (changed('pauseReason')) payload['pauseReason'] = f.pauseReason.trim();
  if (changed('openingHours')) payload['openingHours'] = f.openingHours;
  if (changed('prepTimeDays')) payload['prepTimeDays'] = Number(f.prepTimeDays);
  if (changed('shippingPolicy')) payload['shippingPolicy'] = f.shippingPolicy.trim();
  if (changed('returnPolicy')) payload['returnPolicy'] = f.returnPolicy.trim();
  if (changed('returnWindowDays')) payload['returnWindowDays'] = Number(f.returnWindowDays);
  return payload;
}

const inputCls = (err?: string) =>
  `w-full px-3 py-2 text-sm rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 ${
    err ? 'border-red-400' : 'border-gray-300 hover:border-gray-400'
  }`;

const Field: React.FC<{ label: string; error?: string | undefined; hint?: string; children: React.ReactNode }> = ({
  label,
  error,
  hint,
  children,
}) => (
  <div>
    <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
    {children}
    {error ? <p className="mt-1 text-[11px] text-red-600 font-medium">{error}</p> : hint ? <p className="mt-1 text-[11px] text-gray-400">{hint}</p> : null}
  </div>
);

const Section: React.FC<{ icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }> = ({
  icon,
  title,
  subtitle,
  children,
}) => (
  <Card className="p-6">
    <div className="flex items-start gap-3 mb-5">
      <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">{icon}</div>
      <div>
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
    </div>
    <div className="space-y-4">{children}</div>
  </Card>
);

export const StoreSettingsPage: React.FC = () => {
  const { vendor } = useVendorAuth();
  const [bank, setBank] = useState<VendorBankDetails | null>(null);
  const [form, setForm] = useState<Form>(() => toForm(vendor));
  const baseline = useRef<Form>(toForm(vendor));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [imageBusy, setImageBusy] = useState<'logo' | 'banner' | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    if (!vendor?.id) return;
    return subscribeToDocument<{ bankDetails?: VendorBankDetails }>(
      COLLECTION.VENDOR_PRIVATE,
      vendor.id,
      (d) => setBank(d?.bankDetails ?? null),
      () => setBank(null),
    );
  }, [vendor?.id]);

  // Follow live changes made elsewhere (e.g. the header Store Open toggle) as long as nothing is being edited.
  useEffect(() => {
    const fresh = toForm(vendor, bank);
    setForm((cur) => (JSON.stringify(cur) === JSON.stringify(baseline.current) ? fresh : cur));
    baseline.current = fresh;
  }, [vendor, bank]);

  const dirty = JSON.stringify(form) !== JSON.stringify(baseline.current);
  const errors = useMemo(() => validate(form), [form]);
  const errorCount = Object.keys(errors).length;
  const e = (k: keyof Form) => (showErrors ? errors[k] : undefined);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: value }));
  };

  const pickImage = async (kind: 'logo' | 'banner', file: File | undefined) => {
    if (!file) return;
    setImageError(null);
    if (!file.type.startsWith('image/')) return setImageError('Please choose an image file (JPG, PNG or WebP).');
    if (file.size > 10 * 1024 * 1024) return setImageError('That image is over 10 MB. Choose a smaller one.');
    setImageBusy(kind);
    try {
      const url =
        kind === 'logo'
          ? await compressImageToDataUrl(file, { maxDimension: 400, maxBytes: 60_000 })
          : await compressImageToDataUrl(file, { maxDimension: 1400, maxBytes: 180_000 });
      set(kind === 'logo' ? 'logoURL' : 'bannerURL', url);
    } catch (err) {
      setImageError(friendlyError(err, 'Could not process that image.'));
    } finally {
      setImageBusy(null);
    }
  };

  const save = async () => {
    if (!vendor) return;
    setShowErrors(true);
    setSubmitError(null);
    if (errorCount > 0) {
      setSubmitError(`Please fix ${errorCount} highlighted ${errorCount === 1 ? 'field' : 'fields'} before saving.`);
      return;
    }
    const payload = buildPayload(form, baseline.current, vendor);
    const bankPayload = buildBank(form, baseline.current);
    if (Object.keys(payload).length === 0 && !bankPayload) return;
    setSaving(true);
    try {
      if (Object.keys(payload).length > 0) await updateDocument(COLLECTION.VENDORS, vendor.id, payload);
      if (bankPayload) {
        await setDocument(COLLECTION.VENDOR_PRIVATE, vendor.id, { userId: vendor.userId, bankDetails: bankPayload }, true);
      }
      baseline.current = form;
      setSaved(true);
      setShowErrors(false);
      setTimeout(() => setSaved(false), 4000);
    } catch (err: any) {
      console.error('Store settings save failed:', err);
      setSubmitError(
        err?.code === 'permission-denied'
          ? 'Your store could not be updated. Please sign in again; if it continues, contact support.'
          : friendlyError(err, 'Could not save your settings. Please try again.'),
      );
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setForm(baseline.current);
    setShowErrors(false);
    setSubmitError(null);
  };

  if (!vendor) {
    return (
      <div className="py-24 flex justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const textarea = (k: 'description' | 'shippingPolicy' | 'returnPolicy', rows: number, placeholder: string, max: number) => (
    <>
      <textarea
        rows={rows}
        value={form[k]}
        onChange={(ev) => set(k, ev.target.value)}
        placeholder={placeholder}
        className={inputCls(e(k))}
      />
      <p className="text-right text-[10px] text-gray-400">
        {form[k].length}/{max}
      </p>
    </>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6 pb-28">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Store Settings</h1>
          <p className="text-xs text-gray-500 mt-1">Your public store profile, pickup address, payout details, hours and policies.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Badge variant={vendor.status === 'approved' ? 'success' : 'warning'} className="capitalize">
            {vendor.status.replace(/_/g, ' ')}
          </Badge>
          <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-semibold">
            Commission {(vendor.commissionRate * 100).toFixed(vendor.commissionRate * 100 % 1 ? 1 : 0)}%
          </span>
        </div>
      </div>

      {/* Store status */}
      <Section icon={<Power className="w-4 h-4" />} title="Store availability" subtitle="Pause your store to stop new orders without losing your listings.">
        <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80 card-modern-hover">
          <div>
            <p className="text-sm font-bold text-slate-900">{form.isOpen ? 'Store is open' : 'Store is paused'}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {form.isOpen ? 'Customers can view and purchase your products.' : 'Customers cannot place new orders. Existing orders continue normally.'}
            </p>
          </div>
          <div className="shrink-0 pt-0.5">
            <Switch
              checked={form.isOpen}
              onChange={(checked) => set('isOpen', checked)}
              tone="teal"
              size="md"
            />
          </div>
        </div>
        {!form.isOpen && (
          <Field label="Reason (optional)" hint="For your own reference.">
            <input className={inputCls()} value={form.pauseReason} maxLength={120} onChange={(ev) => set('pauseReason', ev.target.value)} placeholder="e.g. Holiday until Monday" />
          </Field>
        )}
      </Section>

      {/* Profile */}
      <Section icon={<Store className="w-4 h-4" />} title="Store profile" subtitle="How your store appears to customers.">
        <div className="relative">
          <div className="h-36 rounded-xl bg-gradient-to-r from-teal-100 to-sky-100 overflow-hidden border border-gray-100">
            {form.bannerURL && <img src={form.bannerURL} alt="Store banner" className="w-full h-full object-cover" />}
          </div>
          <div className="absolute right-3 top-3 flex gap-2">
            <label className="px-2.5 py-1.5 rounded-lg bg-white/90 text-xs font-semibold text-gray-700 cursor-pointer hover:bg-white shadow-sm flex items-center gap-1.5">
              {imageBusy === 'banner' ? <Spinner size="sm" /> : <ImagePlus className="w-3.5 h-3.5" />}
              Banner
              <input type="file" accept="image/*" className="hidden" onChange={(ev) => { void pickImage('banner', ev.target.files?.[0]); ev.target.value = ''; }} />
            </label>
            {form.bannerURL && (
              <button type="button" onClick={() => set('bannerURL', '')} className="p-1.5 rounded-lg bg-white/90 text-red-600 hover:bg-white shadow-sm" title="Remove banner">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="absolute -bottom-8 left-5 flex items-end gap-2">
            <div className="w-20 h-20 rounded-2xl bg-white border-4 border-white shadow-md overflow-hidden flex items-center justify-center text-2xl font-black text-teal-700 bg-teal-50">
              {form.logoURL ? <img src={form.logoURL} alt="Logo" className="w-full h-full object-cover" /> : form.storeName[0]?.toUpperCase() || 'S'}
            </div>
            <div className="pb-1 flex gap-1.5">
              <label className="px-2 py-1 rounded-lg bg-white border border-gray-200 text-[11px] font-semibold text-gray-700 cursor-pointer hover:bg-gray-50 flex items-center gap-1">
                {imageBusy === 'logo' ? <Spinner size="sm" /> : <ImagePlus className="w-3 h-3" />}
                Logo
                <input type="file" accept="image/*" className="hidden" onChange={(ev) => { void pickImage('logo', ev.target.files?.[0]); ev.target.value = ''; }} />
              </label>
              {form.logoURL && (
                <button type="button" onClick={() => set('logoURL', '')} className="p-1 rounded-lg bg-white border border-gray-200 text-red-600 hover:bg-red-50" title="Remove logo">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="h-6" />
        {imageError && <p className="text-xs text-red-600">{imageError}</p>}

        <Field label="Store name" error={e('storeName')}>
          <input className={inputCls(e('storeName'))} value={form.storeName} maxLength={60} onChange={(ev) => set('storeName', ev.target.value)} />
        </Field>
        <Field label="About your store" error={e('description')}>
          {textarea('description', 3, 'Tell customers what you sell and what makes your store special.', 500)}
        </Field>
        <p className="text-[11px] text-gray-400">
          Store link: <span className="font-mono">/{vendor.storeSlug}</span>
        </p>
      </Section>

      {/* Contact & address */}
      <Section icon={<Phone className="w-4 h-4" />} title="Contact" subtitle="Used by customers, delivery partners and Poeage support.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Business email" error={e('email')}>
            <input type="email" className={inputCls(e('email'))} value={form.email} onChange={(ev) => set('email', ev.target.value)} />
          </Field>
          <Field label="Phone" error={e('phone')}>
            <input type="tel" className={inputCls(e('phone'))} value={form.phone} onChange={(ev) => set('phone', ev.target.value)} placeholder="10-digit mobile" />
          </Field>
        </div>
      </Section>

      <Section icon={<MapPin className="w-4 h-4" />} title="Pickup address" subtitle="Delivery partners collect parcels from here. Shown on every delivery job.">
        <Field label="Address line" error={e('line1')}>
          <input className={inputCls(e('line1'))} value={form.line1} onChange={(ev) => set('line1', ev.target.value)} placeholder="Shop no., street, area" />
        </Field>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="City" error={e('city')}>
            <input className={inputCls(e('city'))} value={form.city} onChange={(ev) => set('city', ev.target.value)} />
          </Field>
          <Field label="State" error={e('state')}>
            <input className={inputCls(e('state'))} value={form.state} onChange={(ev) => set('state', ev.target.value)} />
          </Field>
          <Field label="PIN code" error={e('postalCode')}>
            <input inputMode="numeric" maxLength={6} className={inputCls(e('postalCode'))} value={form.postalCode} onChange={(ev) => set('postalCode', ev.target.value.replace(/\D/g, ''))} />
          </Field>
        </div>
      </Section>

      {/* Business & payout */}
      <Section icon={<ShieldCheck className="w-4 h-4" />} title="Business & tax" subtitle="Needed for invoices and GST compliance.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="GSTIN (optional)" error={e('gstNumber')}>
            <input className={`${inputCls(e('gstNumber'))} uppercase font-mono`} maxLength={15} value={form.gstNumber} onChange={(ev) => set('gstNumber', ev.target.value.toUpperCase())} />
          </Field>
          <Field label="PAN (optional)" error={e('panNumber')}>
            <input className={`${inputCls(e('panNumber'))} uppercase font-mono`} maxLength={10} value={form.panNumber} onChange={(ev) => set('panNumber', ev.target.value.toUpperCase())} />
          </Field>
        </div>
      </Section>

      <Section icon={<Landmark className="w-4 h-4" />} title="Payout bank account" subtitle="Your earnings are settled here. Visible only to you and Poeage admins.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Account holder" error={e('accountHolder')}>
            <input className={inputCls(e('accountHolder'))} value={form.accountHolder} onChange={(ev) => set('accountHolder', ev.target.value)} />
          </Field>
          <Field label="Bank name" error={e('bankName')}>
            <input className={inputCls(e('bankName'))} value={form.bankName} onChange={(ev) => set('bankName', ev.target.value)} />
          </Field>
          <Field label="Account number" error={e('accountNumber')}>
            <input inputMode="numeric" className={`${inputCls(e('accountNumber'))} font-mono`} value={form.accountNumber} maxLength={18} onChange={(ev) => set('accountNumber', ev.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field label="IFSC code" error={e('ifscCode')}>
            <input className={`${inputCls(e('ifscCode'))} uppercase font-mono`} maxLength={11} value={form.ifscCode} onChange={(ev) => set('ifscCode', ev.target.value.toUpperCase())} />
          </Field>
          <Field label="UPI ID (optional)" error={e('upiId')}>
            <input className={inputCls(e('upiId'))} value={form.upiId} onChange={(ev) => set('upiId', ev.target.value)} placeholder="name@bank" />
          </Field>
        </div>
      </Section>

      {/* Hours */}
      <Section icon={<Clock className="w-4 h-4" />} title="Opening hours & preparation" subtitle="Shown to customers and used to set delivery expectations.">
        <div className="rounded-xl border border-gray-100 divide-y divide-gray-100">
          {DAYS.map((d) => {
            const h = form.openingHours[d];
            const update = (patch: Partial<typeof h>) => set('openingHours', { ...form.openingHours, [d]: { ...h, ...patch } });
            return (
              <div key={d} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <label className="flex items-center gap-2 w-32 text-xs font-bold text-gray-800 capitalize cursor-pointer">
                  <input type="checkbox" checked={h.open} onChange={(ev) => update({ open: ev.target.checked })} className="accent-teal-600" />
                  {d}
                </label>
                {h.open ? (
                  <div className="flex items-center gap-2 text-xs">
                    <input type="time" value={h.from} onChange={(ev) => update({ from: ev.target.value })} className="px-2 py-1 border border-gray-300 rounded-lg" />
                    <span className="text-gray-400">to</span>
                    <input type="time" value={h.to} onChange={(ev) => update({ to: ev.target.value })} className="px-2 py-1 border border-gray-300 rounded-lg" />
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">Closed</span>
                )}
              </div>
            );
          })}
        </div>
        {showErrors && errors.openingHours && <p className="text-[11px] text-red-600 font-medium">{errors.openingHours}</p>}
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Preparation time (days)" error={e('prepTimeDays')} hint="How long you usually need to pack an order.">
            <input inputMode="numeric" className={inputCls(e('prepTimeDays'))} value={form.prepTimeDays} onChange={(ev) => set('prepTimeDays', ev.target.value.replace(/\D/g, ''))} />
          </Field>
        </div>
      </Section>

      {/* Policies */}
      <Section icon={<ScrollText className="w-4 h-4" />} title="Shipping & return policy" subtitle="Shown on your product pages.">
        <Field label="Shipping policy" error={e('shippingPolicy')}>
          {textarea('shippingPolicy', 3, 'e.g. Orders are packed within 1 working day.', 1000)}
        </Field>
        <Field label="Return policy" error={e('returnPolicy')}>
          {textarea('returnPolicy', 3, 'e.g. Unused items can be returned in original packaging.', 1000)}
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Return window (days)" error={e('returnWindowDays')} hint="0 means no returns.">
            <input inputMode="numeric" className={inputCls(e('returnWindowDays'))} value={form.returnWindowDays} onChange={(ev) => set('returnWindowDays', ev.target.value.replace(/\D/g, ''))} />
          </Field>
        </div>
      </Section>

      {/* Modern floating save dock */}
      {(dirty || saving || submitError || saved) && (
        <div className="fixed bottom-4 sm:bottom-6 inset-x-0 lg:left-64 z-50 flex justify-center pointer-events-none px-4 pb-safe animate-page-enter">
          <div className="pointer-events-auto w-full max-w-xl rounded-2xl bg-white/95 text-slate-900 shadow-[0_12px_36px_-6px_rgba(15,23,42,0.18),0_4px_12px_-2px_rgba(15,23,42,0.08)] border border-slate-200/90 backdrop-blur-xl p-3 sm:px-5 sm:py-3.5 flex items-center justify-between gap-4">
            <div className="text-xs sm:text-sm min-w-0 flex items-center gap-2.5">
              {submitError ? (
                <span className="text-rose-600 font-semibold flex items-center gap-2 truncate">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span className="truncate">{submitError}</span>
                </span>
              ) : saved ? (
                <span className="text-teal-600 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-teal-500" />
                  <span>Saved. Your store is updated.</span>
                </span>
              ) : dirty ? (
                <span className="text-amber-600 font-semibold flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse-live shrink-0" />
                  <span>You have unsaved changes</span>
                </span>
              ) : (
                <span className="text-slate-400">All changes saved</span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={discard}
                disabled={!dirty || saving}
                className="text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 active:scale-95 transition-all"
              >
                Discard
              </Button>
              <Button
                size="sm"
                onClick={save}
                disabled={!dirty || saving}
                className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-teal-600/20 active:scale-95 transition-all min-w-[110px]"
              >
                {saving ? <Spinner size="sm" /> : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
