import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  subscribePlatformSettings,
  DEFAULT_PLATFORM_SETTINGS,
  updateDocument,
  setDocument,
  createDocument,
  getDocuments,
  where,
  resetPassword,
  friendlyError,
  type PlatformSettingsData,
} from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { AuditLog } from '@poeage/types';
import { Card, CardContent, Spinner } from '@poeage/ui';
import { useAdminAuth } from '../../context/AuthContext';
import {
  Store,
  Truck,
  Percent,
  CreditCard,
  Power,
  ShieldCheck,
  History,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Mail,
  KeyRound,
} from 'lucide-react';

// ---------- form model (display units: rupees / percent) ----------

interface Form {
  platformName: string;
  supportEmail: string;
  supportPhone: string;
  supportHours: string;
  deliveryCharge: string; // ₹
  freeDeliveryThreshold: string; // ₹
  maxDeliveryRadiusKm: string;
  defaultCommissionPct: string; // %
  gstOnCommissionPct: string; // %
  driverEarning: string; // ₹
  defaultGstPct: string; // %
  razorpayKeyId: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
}

const rupees = (paise: number) => String(Number((paise / 100).toFixed(2)));
const pct = (rate: number) => String(Number((rate * 100).toFixed(2)));

function toForm(s: PlatformSettingsData): Form {
  return {
    platformName: s.platformName,
    supportEmail: s.supportEmail,
    supportPhone: s.supportPhone,
    supportHours: s.supportHours,
    deliveryCharge: rupees(s.deliveryChargeFlat),
    freeDeliveryThreshold: rupees(s.freeDeliveryThreshold),
    maxDeliveryRadiusKm: String(s.maxDeliveryRadiusKm),
    defaultCommissionPct: pct(s.defaultCommissionRate),
    gstOnCommissionPct: pct(s.gstOnCommission),
    driverEarning: rupees(s.driverEarningPerDelivery),
    defaultGstPct: pct(s.defaultGstRate),
    razorpayKeyId: s.razorpayKeyId,
    maintenanceMode: s.maintenanceMode,
    maintenanceMessage: s.maintenanceMessage,
  };
}

const toPaise = (v: string) => Math.round((parseFloat(v) || 0) * 100);
const toRate = (v: string) => Math.round((parseFloat(v) || 0) * 100) / 10000;

function toSettings(f: Form): PlatformSettingsData {
  return {
    platformName: f.platformName.trim(),
    supportEmail: f.supportEmail.trim(),
    supportPhone: f.supportPhone.trim(),
    supportHours: f.supportHours.trim(),
    deliveryChargeFlat: toPaise(f.deliveryCharge),
    freeDeliveryThreshold: toPaise(f.freeDeliveryThreshold),
    maxDeliveryRadiusKm: parseInt(f.maxDeliveryRadiusKm, 10) || 0,
    defaultCommissionRate: toRate(f.defaultCommissionPct),
    gstOnCommission: toRate(f.gstOnCommissionPct),
    driverEarningPerDelivery: toPaise(f.driverEarning),
    defaultGstRate: toRate(f.defaultGstPct),
    razorpayKeyId: f.razorpayKeyId.trim(),
    maintenanceMode: f.maintenanceMode,
    maintenanceMessage: f.maintenanceMessage.trim(),
  };
}

const FIELD_LABELS: Record<keyof PlatformSettingsData, string> = {
  platformName: 'Platform name',
  supportEmail: 'Support email',
  supportPhone: 'Support phone',
  supportHours: 'Support hours',
  deliveryChargeFlat: 'Delivery charge',
  freeDeliveryThreshold: 'Free-delivery threshold',
  maxDeliveryRadiusKm: 'Max delivery radius',
  defaultCommissionRate: 'Default commission',
  gstOnCommission: 'GST on commission',
  driverEarningPerDelivery: 'Driver earning / delivery',
  defaultGstRate: 'Default product GST',
  razorpayKeyId: 'Razorpay key ID',
  maintenanceMode: 'Maintenance mode',
  maintenanceMessage: 'Maintenance message',
  updatedBy: 'Updated by',
  updatedByEmail: 'Updated by (email)',
};

const EDITABLE_KEYS = Object.keys(toSettings(toForm(DEFAULT_PLATFORM_SETTINGS))) as (keyof PlatformSettingsData)[];

// ---------- input helpers ----------

const decimal = (raw: string) => {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const [i = '', ...rest] = cleaned.split('.');
  const int = i.replace(/^0+(?=\d)/, '');
  return rest.length ? `${int === '' ? '0' : int}.${rest.join('').slice(0, 2)}` : int;
};
const integer = (raw: string) => raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');

const inputCls =
  'w-full px-3.5 py-2 text-sm rounded-lg border bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

interface FieldProps {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  prefix?: string;
  suffix?: string;
  children?: React.ReactNode;
}

const Field: React.FC<FieldProps & { input?: React.InputHTMLAttributes<HTMLInputElement> }> = ({
  label,
  hint,
  error,
  prefix,
  suffix,
  input,
  children,
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    {children ?? (
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{prefix}</span>}
        <input
          {...input}
          className={`${inputCls} ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-10' : ''} ${error ? 'border-red-400' : 'border-gray-300'}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{suffix}</span>}
      </div>
    )}
    {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : hint ? <p className="mt-1 text-[11px] text-gray-400">{hint}</p> : null}
  </div>
);

const SectionCard: React.FC<{ id: string; icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }> = ({
  id,
  icon,
  title,
  desc,
  children,
}) => (
  <Card id={id} className="scroll-mt-24 border-gray-200">
    <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">{icon}</div>
      <div>
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
    </div>
    <CardContent className="p-6 space-y-4">{children}</CardContent>
  </Card>
);

const NAV = [
  { id: 'general', label: 'General & Support', icon: Store },
  { id: 'delivery', label: 'Delivery', icon: Truck },
  { id: 'commission', label: 'Commission & Tax', icon: Percent },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'operations', label: 'Operations', icon: Power },
  { id: 'security', label: 'Security', icon: ShieldCheck },
  { id: 'activity', label: 'Activity', icon: History },
];

// ---------- page ----------

export const PlatformSettingsPage: React.FC = () => {
  const { user, roles } = useAdminAuth();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saved, setSaved] = useState<PlatformSettingsData | null>(null);
  const [docExists, setDocExists] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [activity, setActivity] = useState<AuditLog[]>([]);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  // Live settings. Only overwrite the form from the server when the admin has no unsaved edits.
  useEffect(() => {
    let first = true;
    const unsubscribe = subscribePlatformSettings(
      (settings, exists) => {
        setSaved(settings);
        setDocExists(exists);
        setForm((current) => (first || current === null ? toForm(settings) : current));
        first = false;
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load platform settings:', err);
        setLoadError(friendlyError(err, 'Failed to load settings.'));
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, []);

  const loadActivity = useCallback(async () => {
    try {
      const logs = await getDocuments<AuditLog>(COLLECTION.AUDIT_LOGS, [where('entityType', '==', 'platformSettings')]);
      logs.sort((a, b) => ((b.createdAt as any)?.seconds ?? 0) - ((a.createdAt as any)?.seconds ?? 0));
      setActivity(logs.slice(0, 8));
    } catch (err) {
      console.error('Failed to load settings activity:', err);
    }
  }, []);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));

  const next = useMemo(() => (form ? toSettings(form) : null), [form]);

  const changedKeys = useMemo(() => {
    if (!next || !saved) return [] as (keyof PlatformSettingsData)[];
    return EDITABLE_KEYS.filter((k) => next[k] !== saved[k]);
  }, [next, saved]);
  const dirty = changedKeys.length > 0;

  // ----- validation -----
  const errors = useMemo(() => {
    const e: Partial<Record<keyof Form, string>> = {};
    if (!form) return e;
    if (form.platformName.trim().length < 2) e.platformName = 'Enter the platform name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.supportEmail.trim())) e.supportEmail = 'Enter a valid email address.';
    if (form.supportPhone.trim() && !/^\+?[\d\s-]{7,16}$/.test(form.supportPhone.trim())) e.supportPhone = 'Enter a valid phone number.';
    const commission = parseFloat(form.defaultCommissionPct);
    if (!(commission >= 0 && commission <= 50)) e.defaultCommissionPct = 'Commission must be between 0% and 50%.';
    const gstC = parseFloat(form.gstOnCommissionPct);
    if (!(gstC >= 0 && gstC <= 40)) e.gstOnCommissionPct = 'Enter a rate between 0% and 40%.';
    const gst = parseFloat(form.defaultGstPct);
    if (!(gst >= 0 && gst <= 40)) e.defaultGstPct = 'Enter a rate between 0% and 40%.';
    if (!(parseInt(form.maxDeliveryRadiusKm, 10) > 0)) e.maxDeliveryRadiusKm = 'Enter a radius greater than 0 km.';
    if (form.freeDeliveryThreshold && toPaise(form.freeDeliveryThreshold) > 0 && toPaise(form.deliveryCharge) < 0) e.deliveryCharge = 'Invalid amount.';
    if (form.razorpayKeyId.trim() && !/^rzp_(test|live)_[A-Za-z0-9]+$/.test(form.razorpayKeyId.trim()))
      e.razorpayKeyId = 'Key ID should look like rzp_test_xxxxx or rzp_live_xxxxx.';
    if (form.maintenanceMode && form.maintenanceMessage.trim().length < 5) e.maintenanceMessage = 'Add a short message customers will see.';
    return e;
  }, [form]);
  const hasErrors = Object.keys(errors).length > 0;

  const flash = (type: 'ok' | 'error', text: string) => {
    setNotice({ type, text });
    if (type === 'ok') setTimeout(() => setNotice(null), 4000);
  };

  const handleSave = async () => {
    if (!form || !next || !saved || !user || !dirty || hasErrors) return;
    if (next.maintenanceMode && !saved.maintenanceMode) {
      const ok = window.confirm(
        'Turn ON maintenance mode?\n\nThe customer storefront will show the maintenance message and stop taking orders until you switch it off.',
      );
      if (!ok) return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const payload: Record<string, unknown> = { ...next, id: 'global', updatedBy: user.uid, updatedByEmail: user.email ?? '' };
      if (docExists) await updateDocument(COLLECTION.PLATFORM_SETTINGS, 'global', payload);
      else await setDocument(COLLECTION.PLATFORM_SETTINGS, 'global', payload);

      // Audit trail (best-effort: settings are already saved if this fails)
      try {
        const before: Record<string, unknown> = {};
        const after: Record<string, unknown> = {};
        changedKeys.forEach((k) => {
          before[k] = saved[k];
          after[k] = next[k];
        });
        await createDocument(COLLECTION.AUDIT_LOGS, {
          actorId: user.uid,
          actorRole: roles[0] ?? 'admin',
          actorEmail: user.email ?? '',
          action: 'settings.update',
          entityType: 'platformSettings',
          entityId: 'global',
          changedFields: changedKeys,
          before,
          after,
        });
        void loadActivity();
      } catch (auditErr) {
        console.error('Audit log write failed:', auditErr);
      }

      setForm(toForm(next));
      flash('ok', 'Settings saved. All apps will pick up the changes automatically.');
    } catch (err) {
      console.error('Failed to save settings:', err);
      flash('error', friendlyError(err, 'Could not save settings.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (saved) setForm(toForm(saved));
    setNotice(null);
  };

  const sendReset = async () => {
    if (!user?.email) return;
    setResetMsg(null);
    try {
      await resetPassword(user.email);
      setResetMsg(`Password reset link sent to ${user.email}.`);
    } catch (err) {
      setResetMsg(friendlyError(err, 'Could not send the reset email.'));
    }
  };

  if (loading || !form) {
    return (
      <div className="py-32 flex justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const formatValue = (k: keyof PlatformSettingsData, v: unknown): string => {
    if (typeof v === 'boolean') return v ? 'On' : 'Off';
    if (k === 'deliveryChargeFlat' || k === 'freeDeliveryThreshold' || k === 'driverEarningPerDelivery') return `₹${rupees(Number(v))}`;
    if (k === 'defaultCommissionRate' || k === 'gstOnCommission' || k === 'defaultGstRate') return `${pct(Number(v))}%`;
    if (k === 'maxDeliveryRadiusKm') return `${v} km`;
    const text = String(v ?? '');
    return text === '' ? '—' : text.length > 28 ? `${text.slice(0, 28)}…` : text;
  };

  return (
    <div className="p-6 sm:p-8 pb-28 bg-gray-50 min-h-[calc(100vh-4rem)]">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Platform Settings</h1>
            <p className="text-xs text-gray-500 mt-1">
              Marketplace identity, delivery, commission, payments and operations. Changes apply live to the shop, vendor and driver apps.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center gap-1.5 font-semibold rounded-full px-3 py-1 border ${
                saved?.maintenanceMode
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-green-50 text-green-700 border-green-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${saved?.maintenanceMode ? 'bg-red-500' : 'bg-green-500'}`} />
              {saved?.maintenanceMode ? 'Storefront in maintenance' : 'Storefront live'}
            </span>
          </div>
        </div>

        {loadError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {loadError}
          </div>
        )}
        {!docExists && !loadError && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
            No settings have been saved yet — the defaults below are in use. Review them and press <b>Save changes</b> to publish.
          </div>
        )}
        {notice && (
          <div
            className={`mb-4 p-3 rounded-lg border text-xs flex items-start gap-2 ${
              notice.type === 'ok' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {notice.type === 'ok' ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertCircle className="w-4 h-4 mt-0.5" />}
            <span>{notice.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[210px_1fr] gap-6">
          {/* Section nav */}
          <nav className="hidden lg:block sticky top-24 self-start space-y-1">
            {NAV.map((n) => {
              const Icon = n.icon;
              return (
                <a
                  key={n.id}
                  href={`#${n.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(n.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-sm transition"
                >
                  <Icon className="w-4 h-4 text-gray-400" />
                  {n.label}
                </a>
              );
            })}
          </nav>

          <div className="space-y-6 min-w-0">
            <SectionCard id="general" icon={<Store className="w-5 h-5" />} title="General & Support" desc="Brand name and the contact details shown to customers.">
              <Field label="Platform name" error={errors.platformName} input={{ value: form.platformName, onChange: (e) => set('platformName', e.target.value) }} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Support email"
                  error={errors.supportEmail}
                  input={{ type: 'email', value: form.supportEmail, placeholder: 'support@yourdomain.com', onChange: (e) => set('supportEmail', e.target.value) }}
                />
                <Field
                  label="Support phone"
                  error={errors.supportPhone}
                  input={{ value: form.supportPhone, placeholder: '+91 98765 43210', onChange: (e) => set('supportPhone', e.target.value) }}
                />
              </div>
              <Field
                label="Support hours"
                input={{ value: form.supportHours, placeholder: 'Mon–Sat 9AM–8PM IST', onChange: (e) => set('supportHours', e.target.value) }}
              />
            </SectionCard>

            <SectionCard id="delivery" icon={<Truck className="w-5 h-5" />} title="Delivery" desc="Charges applied at cart and checkout.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Delivery charge"
                  prefix="₹"
                  hint="Flat fee added to orders below the free-delivery threshold."
                  error={errors.deliveryCharge}
                  input={{ inputMode: 'decimal', value: form.deliveryCharge, placeholder: '0', onChange: (e) => set('deliveryCharge', decimal(e.target.value)) }}
                />
                <Field
                  label="Free delivery above"
                  prefix="₹"
                  hint="Orders at or above this subtotal ship free. Use 0 to always charge."
                  input={{ inputMode: 'decimal', value: form.freeDeliveryThreshold, placeholder: '0', onChange: (e) => set('freeDeliveryThreshold', decimal(e.target.value)) }}
                />
              </div>
              <Field
                label="Max delivery radius"
                suffix="km"
                error={errors.maxDeliveryRadiusKm}
                input={{ inputMode: 'numeric', value: form.maxDeliveryRadiusKm, onChange: (e) => set('maxDeliveryRadiusKm', integer(e.target.value)) }}
              />
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 border border-gray-100">
                Customers currently pay <b>{form.deliveryCharge ? `₹${form.deliveryCharge}` : 'nothing'}</b> for delivery on orders under{' '}
                <b>₹{form.freeDeliveryThreshold || '0'}</b>, and <b>free</b> above that.
              </p>
            </SectionCard>

            <SectionCard id="commission" icon={<Percent className="w-5 h-5" />} title="Commission & Tax" desc="Platform revenue share, driver pay and default tax rates.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Default vendor commission"
                  suffix="%"
                  hint="Applied to newly approved vendors. Existing vendors keep their own rate."
                  error={errors.defaultCommissionPct}
                  input={{ inputMode: 'decimal', value: form.defaultCommissionPct, onChange: (e) => set('defaultCommissionPct', decimal(e.target.value)) }}
                />
                <Field
                  label="GST on commission"
                  suffix="%"
                  error={errors.gstOnCommissionPct}
                  input={{ inputMode: 'decimal', value: form.gstOnCommissionPct, onChange: (e) => set('gstOnCommissionPct', decimal(e.target.value)) }}
                />
                <Field
                  label="Driver earning per delivery"
                  prefix="₹"
                  hint="Paid to the driver for each completed delivery."
                  input={{ inputMode: 'decimal', value: form.driverEarning, placeholder: '0', onChange: (e) => set('driverEarning', decimal(e.target.value)) }}
                />
                <Field
                  label="Default product GST"
                  suffix="%"
                  hint="Used when a product has no GST rate of its own."
                  error={errors.defaultGstPct}
                  input={{ inputMode: 'decimal', value: form.defaultGstPct, onChange: (e) => set('defaultGstPct', decimal(e.target.value)) }}
                />
              </div>
            </SectionCard>

            <SectionCard id="payments" icon={<CreditCard className="w-5 h-5" />} title="Payments" desc="Payment gateway configuration.">
              <Field
                label="Razorpay Key ID (public)"
                hint="Only the public key ID goes here. The secret key must be set in Cloud Functions configuration — never in this form."
                error={errors.razorpayKeyId}
                input={{ value: form.razorpayKeyId, placeholder: 'rzp_live_xxxxxxxxxxxx', onChange: (e) => set('razorpayKeyId', e.target.value) }}
              />
              {form.razorpayKeyId.startsWith('rzp_test_') && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> This is a <b>test</b> key — no real money will be collected.
                </p>
              )}
            </SectionCard>

            <SectionCard id="operations" icon={<Power className="w-5 h-5" />} title="Operations" desc="Take the storefront offline for maintenance.">
              <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-gray-200 bg-gray-50">
                <div>
                  <p className="text-sm font-bold text-gray-900">Maintenance mode</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    When on, customers see the message below instead of the shop. Vendor, driver and admin apps keep working.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.maintenanceMode}
                  onClick={() => set('maintenanceMode', !form.maintenanceMode)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${form.maintenanceMode ? 'bg-red-500' : 'bg-gray-300'}`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform mt-0.5 ${
                      form.maintenanceMode ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
              <Field label="Message shown to customers" error={errors.maintenanceMessage}>
                <textarea
                  rows={3}
                  value={form.maintenanceMessage}
                  onChange={(e) => set('maintenanceMessage', e.target.value)}
                  className={`${inputCls} ${errors.maintenanceMessage ? 'border-red-400' : 'border-gray-300'}`}
                />
              </Field>
              {form.maintenanceMode && !saved?.maintenanceMode && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Maintenance mode will go live when you save.
                </p>
              )}
            </SectionCard>

            <SectionCard id="security" icon={<ShieldCheck className="w-5 h-5" />} title="Security" desc="Your administrator account.">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-gray-200">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 flex items-center gap-2 truncate">
                    <Mail className="w-4 h-4 text-gray-400" /> {user?.email}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 capitalize">Role: {roles.length ? roles.join(', ').replace(/_/g, ' ') : 'admin'}</p>
                </div>
                <button
                  type="button"
                  onClick={sendReset}
                  className="inline-flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
                >
                  <KeyRound className="w-4 h-4" /> Send password reset email
                </button>
              </div>
              {resetMsg && <p className="text-xs text-gray-600">{resetMsg}</p>}
            </SectionCard>

            <SectionCard id="activity" icon={<History className="w-5 h-5" />} title="Recent changes" desc="Audit trail of who changed platform settings.">
              {activity.length === 0 ? (
                <p className="text-sm text-gray-400">No changes recorded yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {activity.map((log) => {
                    const secs = (log.createdAt as any)?.seconds;
                    const when = secs ? new Date(secs * 1000).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'just now';
                    return (
                      <li key={log.id} className="py-3 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-gray-800 truncate">{log.actorEmail || log.actorId}</span>
                          <span className="text-gray-400 flex-shrink-0">{when}</span>
                        </div>
                        <ul className="mt-1 text-gray-500 space-y-0.5">
                          {(log.changedFields ?? []).map((k) => (
                            <li key={k}>
                              <b className="text-gray-700">{FIELD_LABELS[k as keyof PlatformSettingsData] ?? k}</b>:{' '}
                              {formatValue(k as keyof PlatformSettingsData, (log.before as any)?.[k])} →{' '}
                              {formatValue(k as keyof PlatformSettingsData, (log.after as any)?.[k])}
                            </li>
                          ))}
                        </ul>
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>
          </div>
        </div>
      </div>

      {/* Sticky save bar */}
      {dirty && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4 lg:pl-[calc(16rem+1.5rem)]">
            <p className="text-xs text-gray-600">
              <b className="text-gray-900">{changedKeys.length}</b> unsaved change{changedKeys.length > 1 ? 's' : ''}
              {hasErrors && <span className="text-red-600 ml-2">· fix the highlighted fields to save</span>}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDiscard}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || hasErrors}
                className="px-5 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {saving && <Spinner size="sm" />}
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
