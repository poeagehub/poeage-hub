import React, { useEffect, useState } from 'react';
import { useDriverAuth } from '../../context/AuthContext';
import { updateDocument, friendlyError } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import { formatMoney } from '@poeage/utils';
import { Spinner } from '@poeage/ui';
import { ActionButton, Notice } from '../../components/ui';
import {
  User as UserIcon,
  Phone,
  Mail,
  Truck,
  IdCard,
  ShieldCheck,
  HeartPulse,
  Landmark,
  Star,
  Package,
  Wallet,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Lock,
} from 'lucide-react';

const inputCls = 'd-input';
const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5';

const digits = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max);
const maskTail = (v: string) => (v.length > 4 ? `•••• ${v.slice(-4)}` : v);

const VEHICLE_LABEL: Record<string, string> = {
  bicycle: 'Bicycle',
  motorcycle: 'Motorcycle',
  scooter: 'Scooter',
  car: 'Car',
  van: 'Van',
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  approved: { label: 'Verified', cls: 'bg-green-500/15 text-green-300 border-green-500/30' },
  active: { label: 'Verified · Online', cls: 'bg-green-500/15 text-green-300 border-green-500/30' },
  offline: { label: 'Verified', cls: 'bg-green-500/15 text-green-300 border-green-500/30' },
  pending_review: { label: 'Under review', cls: 'bg-accent-500/15 text-accent-300 border-accent-500/30' },
  suspended: { label: 'Suspended', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
  rejected: { label: 'Rejected', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
};

export const DriverProfilePage: React.FC = () => {
  const { driver, user, signOutDriver } = useDriverAuth();

  // personal
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceArea, setServiceArea] = useState('');
  // emergency contact
  const [ecName, setEcName] = useState('');
  const [ecPhone, setEcPhone] = useState('');
  const [ecRelation, setEcRelation] = useState('');
  // bank
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [upiId, setUpiId] = useState('');

  const [saving, setSaving] = useState<null | 'personal' | 'emergency' | 'bank'>(null);
  const [notice, setNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [editingBank, setEditingBank] = useState(false);

  // Fill the forms whenever the live profile changes.
  useEffect(() => {
    if (!driver) return;
    setDisplayName(driver.displayName ?? '');
    setPhone(driver.phone ?? '');
    setServiceArea(driver.serviceArea ?? '');
    setEcName(driver.emergencyContact?.name ?? '');
    setEcPhone(driver.emergencyContact?.phone ?? '');
    setEcRelation(driver.emergencyContact?.relation ?? '');
    setAccountHolder(driver.bankDetails?.accountHolder ?? driver.displayName ?? '');
    setAccountNumber(driver.bankDetails?.accountNumber ?? '');
    setIfscCode(driver.bankDetails?.ifscCode ?? '');
    setBankName(driver.bankDetails?.bankName ?? '');
    setUpiId(driver.bankDetails?.upiId ?? '');
  }, [driver]);

  if (!driver || !user) {
    return (
      <div className="py-24 flex justify-center">
        <Spinner size="lg" className="text-accent-400" />
      </div>
    );
  }

  const flash = (type: 'ok' | 'error', text: string) => {
    setNotice({ type, text });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (type === 'ok') setTimeout(() => setNotice(null), 3500);
  };

  const save = async (section: 'personal' | 'emergency' | 'bank', data: Record<string, unknown>) => {
    setSaving(section);
    setNotice(null);
    try {
      await updateDocument(COLLECTION.DRIVERS, user.uid, data);
      flash('ok', 'Saved successfully.');
      return true;
    } catch (err) {
      console.error('Failed to save driver profile:', err);
      flash('error', friendlyError(err, 'Could not save changes.'));
      return false;
    } finally {
      setSaving(null);
    }
  };

  const savePersonal = (e: React.FormEvent) => {
    e.preventDefault();
    if (displayName.trim().length < 2) return flash('error', 'Please enter your full name.');
    if (phone.length !== 10) return flash('error', 'Phone number must be 10 digits.');
    void save('personal', { displayName: displayName.trim(), phone, serviceArea: serviceArea.trim() });
  };

  const saveEmergency = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ecName.trim()) return flash('error', 'Enter the emergency contact name.');
    if (ecPhone.length !== 10) return flash('error', 'Emergency contact phone must be 10 digits.');
    void save('emergency', {
      emergencyContact: { name: ecName.trim(), phone: ecPhone, relation: ecRelation.trim() },
    });
  };

  const saveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    const ifsc = ifscCode.trim().toUpperCase();
    if (!accountHolder.trim()) return flash('error', 'Enter the account holder name.');
    if (accountNumber.length < 9 || accountNumber.length > 18) return flash('error', 'Account number must be 9–18 digits.');
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return flash('error', 'Enter a valid IFSC code (e.g. SBIN0001234).');
    if (!bankName.trim()) return flash('error', 'Enter the bank name.');
    const bankDetails: Record<string, string> = {
      accountHolder: accountHolder.trim(),
      accountNumber,
      ifscCode: ifsc,
      bankName: bankName.trim(),
    };
    if (upiId.trim()) bankDetails['upiId'] = upiId.trim();
    if (await save('bank', { bankDetails })) setEditingBank(false);
  };

  const badge = STATUS_BADGE[driver.status] ?? STATUS_BADGE['pending_review']!;
  const m = driver.metadata;
  const hasBank = Boolean(driver.bankDetails?.accountNumber);
  const completenessItems = [
    { label: 'Mobile number', done: driver.phone?.length === 10 },
    { label: 'Service area', done: Boolean(driver.serviceArea) },
    { label: 'Emergency contact', done: Boolean(driver.emergencyContact?.phone) },
    { label: 'Payout account', done: hasBank },
  ];
  const completeness = {
    items: completenessItems,
    percent: Math.round((completenessItems.filter((i) => i.done).length / completenessItems.length) * 100),
  };

  return (
    <div className="px-3 min-[380px]:px-4 sm:px-6 lg:px-10 pt-4 lg:pt-10 max-w-[1100px] mx-auto space-y-4 lg:space-y-5 text-white">
      {notice && (
        <Notice tone={notice.type === 'ok' ? 'success' : 'error'}>{notice.text}</Notice>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6 items-start">
        <div className="space-y-5 min-w-0">
      {/* Identity */}
      <section className="d-card p-5 sm:p-6 text-white relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-accent-500/10 blur-2xl pointer-events-none" />
        <div className="flex items-center gap-4 relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-accent-500/25">
            {(driver.displayName || user.email || 'D')[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black tracking-tight truncate">{driver.displayName}</h1>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 truncate">
              <Mail className="w-3.5 h-3.5" /> {driver.email || user.email}
            </p>
            <span className={`inline-flex items-center gap-1 mt-2 text-[11px] font-bold border rounded-full px-2.5 py-0.5 ${badge.cls}`}>
              <ShieldCheck className="w-3 h-3" /> {badge.label}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 min-[380px]:gap-3 mt-5 text-center">
          <div className="bg-black/25 border border-white/10 rounded-2xl p-3">
            <Package className="w-4 h-4 text-accent-400 mx-auto" />
            <p className="text-base font-black mt-1">{m?.totalDeliveries ?? 0}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Deliveries</p>
          </div>
          <div className="bg-black/25 border border-white/10 rounded-2xl p-3">
            <Star className="w-4 h-4 text-accent-400 mx-auto" />
            <p className="text-base font-black mt-1">
              {(m?.totalRatings ?? 0) > 0 ? m?.averageRating?.toFixed(1) : '–'}
            </p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Rating</p>
          </div>
          <div className="bg-black/25 border border-white/10 rounded-2xl p-3">
            <Wallet className="w-4 h-4 text-accent-400 mx-auto" />
            <p className="text-sm min-[380px]:text-base font-black mt-1 truncate">{formatMoney(m?.totalEarnings ?? 0)}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Earned</p>
          </div>
        </div>
      </section>

      {/* Profile completeness */}
      <section className="d-card p-5 sm:p-6 text-white">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-white">Profile completeness</h2>
          <span className="text-sm font-black text-accent-400">{completeness.percent}%</span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent-400 to-accent-200 transition-all duration-500"
            style={{ width: `${completeness.percent}%` }}
          />
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-2 text-xs">
          {completeness.items.map((it) => (
            <li
              key={it.label}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${
                it.done ? 'border-green-500/20 bg-green-500/5 text-green-300' : 'border-white/10 bg-white/[0.03] text-slate-400'
              }`}
            >
              {it.done ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
              {it.label}
            </li>
          ))}
        </ul>
      </section>

      {/* Vehicle & documents (read only) */}
      <section className="d-card p-5 sm:p-6 text-white">
        <h2 className="text-sm font-extrabold text-white flex items-center gap-2 mb-4">
          <Truck className="w-4 h-4 text-accent-400" /> Vehicle & documents
        </h2>
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-slate-400 flex items-center gap-2"><Truck className="w-4 h-4" /> Vehicle</dt>
            <dd className="font-semibold">{VEHICLE_LABEL[driver.vehicleType] ?? driver.vehicleType}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-400">Registration no.</dt>
            <dd className="font-mono font-semibold">{driver.vehicleNumber || 'Not provided'}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-400 flex items-center gap-2"><IdCard className="w-4 h-4" /> Licence no.</dt>
            <dd className="font-mono font-semibold">{driver.licenseNumber ? maskTail(driver.licenseNumber) : 'Not provided'}</dd>
          </div>
        </dl>
        <p className="mt-4 text-[11px] text-slate-500 flex items-start gap-1.5">
          <Lock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          Vehicle and licence details were verified by our operations team. To change them, contact support so your
          profile can be re-verified.
        </p>
      </section>

        </div>
        <div className="space-y-5 min-w-0">
      {/* Personal details */}
      <section className="d-card p-5 sm:p-6 text-white">
        <h2 className="text-sm font-extrabold text-white flex items-center gap-2 mb-4">
          <UserIcon className="w-4 h-4 text-accent-400" /> Personal details
        </h2>
        <form onSubmit={savePersonal} className="space-y-3">
          <div>
            <label className={labelCls}>Full name</label>
            <input className={inputCls} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Mobile number</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className={`${inputCls} pl-9`}
                inputMode="numeric"
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(e) => setPhone(digits(e.target.value, 10))}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Preferred service area / city</label>
            <input
              className={inputCls}
              placeholder="e.g. Chennai – T. Nagar, Adyar"
              value={serviceArea}
              onChange={(e) => setServiceArea(e.target.value)}
            />
          </div>
          <ActionButton type="submit" loading={saving === 'personal'} className="w-full">
            Save details
          </ActionButton>
        </form>
      </section>

      {/* Emergency contact */}
      <section className="d-card p-5 sm:p-6 text-white">
        <h2 className="text-sm font-extrabold text-white flex items-center gap-2 mb-4">
          <HeartPulse className="w-4 h-4 text-accent-400" /> Emergency contact
        </h2>
        <form onSubmit={saveEmergency} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Contact name</label>
              <input className={inputCls} value={ecName} onChange={(e) => setEcName(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Relationship</label>
              <input
                className={inputCls}
                placeholder="e.g. Spouse, Father"
                value={ecRelation}
                onChange={(e) => setEcRelation(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Contact mobile number</label>
            <input
              className={inputCls}
              inputMode="numeric"
              placeholder="10-digit mobile number"
              value={ecPhone}
              onChange={(e) => setEcPhone(digits(e.target.value, 10))}
            />
          </div>
          <ActionButton type="submit" loading={saving === 'emergency'} className="w-full">
            Save emergency contact
          </ActionButton>
        </form>
      </section>

      {/* Payout account */}
      <section className="d-card p-5 sm:p-6 text-white">
        <h2 className="text-sm font-extrabold text-white flex items-center gap-2 mb-4">
          <Landmark className="w-4 h-4 text-accent-400" /> Payout bank account
        </h2>

        {hasBank && !editingBank ? (
          <div className="space-y-3">
            <div className="p-4 bg-white/[0.04] border border-white/10 rounded-2xl text-xs space-y-1">
              <p className="font-bold text-white">{driver.bankDetails?.bankName}</p>
              <p className="text-slate-300">{driver.bankDetails?.accountHolder}</p>
              <p className="text-slate-400 font-mono">
                {maskTail(driver.bankDetails?.accountNumber ?? '')} · {driver.bankDetails?.ifscCode}
              </p>
              {driver.bankDetails?.upiId && <p className="text-slate-400">UPI: {driver.bankDetails.upiId}</p>}
            </div>
            <ActionButton type="button" tone="outline" className="w-full" onClick={() => setEditingBank(true)}>
              Change bank account
            </ActionButton>
          </div>
        ) : (
          <form onSubmit={saveBank} className="space-y-3">
            <div>
              <label className={labelCls}>Account holder name</label>
              <input className={inputCls} value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Account number</label>
                <input
                  className={inputCls}
                  inputMode="numeric"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(digits(e.target.value, 18))}
                />
              </div>
              <div>
                <label className={labelCls}>IFSC code</label>
                <input
                  className={`${inputCls} uppercase`}
                  placeholder="SBIN0001234"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 11))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Bank name</label>
                <input className={inputCls} value={bankName} onChange={(e) => setBankName(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>UPI ID (optional)</label>
                <input className={inputCls} placeholder="name@bank" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              {hasBank && (
                <ActionButton type="button" tone="outline" className="flex-1" onClick={() => setEditingBank(false)}>
                  Cancel
                </ActionButton>
              )}
              <ActionButton type="submit" loading={saving === 'bank'} className="flex-1">
                Save bank account
              </ActionButton>
            </div>
          </form>
        )}
      </section>

        </div>
      </div>

      <ActionButton type="button" tone="danger" onClick={signOutDriver} className="w-full lg:hidden">
        <LogOut className="w-4 h-4" /> Sign out
      </ActionButton>
    </div>
  );
};
