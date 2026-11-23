import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button, Modal } from '@poeage/ui';
import {
  updateDocument,
  createDocument,
  deleteDocument,
  subscribeToCollection,
  where,
  resetPassword,
  friendlyError,
} from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Address } from '@poeage/types';
import { Package, Heart, LifeBuoy, LogOut, MapPin, Plus, Pencil, Trash2, Home, Briefcase, CheckCircle2, ShieldCheck, KeyRound, Star } from 'lucide-react';

const field = 'mt-1.5 w-full h-11 px-3.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 text-sm';

interface AddrForm {
  id?: string;
  label: 'home' | 'work' | 'other';
  recipientName: string;
  phone: string;
  line1: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
}
const blank = (name = '', phone = ''): AddrForm => ({ label: 'home', recipientName: name, phone, line1: '', landmark: '', city: '', state: '', pincode: '' });

export const ProfilePage: React.FC = () => {
  const { user, profile, signOutUser } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName || user?.displayName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [form, setForm] = useState<AddrForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingAddr, setSavingAddr] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.displayName || user?.displayName || '');
    setPhone(profile?.phone || '');
  }, [profile, user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToCollection<Address>(COLLECTION.ADDRESSES, [where('userId', '==', user.uid)], (l) => setAddresses(l), () => setAddresses([]));
  }, [user]);

  const flash = (ok: boolean, text: string) => {
    setNote({ ok, text });
    setTimeout(() => setNote(null), 3500);
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (phone && !/^\d{10}$/.test(phone.replace(/\D/g, '').slice(-10))) return flash(false, 'Enter a valid 10-digit mobile number.');
    setSaving(true);
    try {
      await updateDocument(COLLECTION.USERS, user.uid, { displayName: displayName.trim(), phone });
      flash(true, 'Profile updated.');
    } catch (err) {
      flash(false, friendlyError(err, 'Could not update your profile.'));
    } finally {
      setSaving(false);
    }
  };

  const sendReset = async () => {
    if (!user?.email) return;
    try {
      await resetPassword(user.email);
      flash(true, `Password reset link sent to ${user.email}.`);
    } catch (err) {
      flash(false, friendlyError(err, 'Could not send the reset email.'));
    }
  };

  const saveAddress = async () => {
    if (!form || !user) return;
    const f = form;
    if (f.recipientName.trim().length < 2) return setFormError('Enter the recipient name.');
    if (!/^\d{10}$/.test(f.phone.trim())) return setFormError('Enter a 10-digit mobile number.');
    if (f.line1.trim().length < 5) return setFormError('Enter the street address.');
    if (!f.city.trim() || !f.state.trim()) return setFormError('Enter city and state.');
    if (!/^\d{6}$/.test(f.pincode.trim())) return setFormError('Enter a 6-digit PIN code.');
    setSavingAddr(true);
    setFormError(null);
    try {
      const data = { userId: user.uid, label: f.label, recipientName: f.recipientName.trim(), phone: f.phone.trim(), line1: f.line1.trim(), landmark: f.landmark.trim(), city: f.city.trim(), state: f.state.trim(), pincode: f.pincode.trim(), country: 'India' };
      if (f.id) await updateDocument(COLLECTION.ADDRESSES, f.id, data);
      else await createDocument(COLLECTION.ADDRESSES, { ...data, isDefault: (addresses?.length ?? 0) === 0 });
      setForm(null);
    } catch (err) {
      setFormError(friendlyError(err, 'Could not save the address.'));
    } finally {
      setSavingAddr(false);
    }
  };

  const makeDefault = async (a: Address) => {
    try {
      await Promise.all((addresses ?? []).filter((x) => x.isDefault && x.id !== a.id).map((x) => updateDocument(COLLECTION.ADDRESSES, x.id, { isDefault: false })));
      await updateDocument(COLLECTION.ADDRESSES, a.id, { isDefault: true });
    } catch (err) {
      flash(false, friendlyError(err, 'Could not change the default address.'));
    }
  };

  const removeAddress = async (a: Address) => {
    if (!window.confirm('Delete this address?')) return;
    try {
      await deleteDocument(COLLECTION.ADDRESSES, a.id);
    } catch (err) {
      flash(false, friendlyError(err, 'Could not delete the address.'));
    }
  };

  const initial = (displayName?.[0] || user?.email?.[0] || 'U').toUpperCase();
  const labelIcon = (l: string) => (l === 'work' ? <Briefcase className="w-4 h-4" /> : l === 'other' ? <MapPin className="w-4 h-4" /> : <Home className="w-4 h-4" />);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-10">
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">My account</h1>

      {note && (
        <div role="status" className={`fixed top-20 left-1/2 -translate-x-1/2 z-[70] max-w-[92vw] flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold animate-[slideUp_.2s_ease-out] ${note.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {note.text}
        </div>
      )}

      <div className="mt-6 grid md:grid-cols-[280px_1fr] gap-6">
        <aside className="space-y-4 md:sticky md:top-32 self-start">
          <div className="rounded-2xl bg-white border border-slate-200/80 p-5 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white font-black text-3xl flex items-center justify-center shadow-lg shadow-primary-600/25">{initial}</div>
            <h2 className="mt-3 font-extrabold text-slate-900 truncate">{displayName || 'Customer'}</h2>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            <span className={`mt-3 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${user?.emailVerified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              <ShieldCheck className="w-3.5 h-3.5" /> {user?.emailVerified ? 'Email verified' : 'Email not verified'}
            </span>
          </div>
          <nav className="rounded-2xl bg-white border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
            {[
              { to: '/account/orders', icon: Package, label: 'My orders' },
              { to: '/wishlist', icon: Heart, label: 'Wishlist' },
              { to: '/support', icon: LifeBuoy, label: 'Help & support' },
            ].map(({ to, icon: Icon, label }) => (
              <Link key={to} to={to} className="flex items-center gap-3 px-4 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <Icon className="w-[18px] h-[18px] text-slate-400" /> {label}
              </Link>
            ))}
            <button onClick={() => void signOutUser()} className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-semibold text-red-600 hover:bg-red-50 text-left">
              <LogOut className="w-[18px] h-[18px]" /> Sign out
            </button>
          </nav>
        </aside>

        <div className="space-y-6 min-w-0">
          {/* Personal info */}
          <section className="rounded-2xl bg-white border border-slate-200/80 p-5 sm:p-6">
            <h2 className="text-lg font-extrabold text-slate-900">Personal information</h2>
            <form onSubmit={saveProfile} className="mt-4 grid sm:grid-cols-2 gap-4">
              <label className="block"><span className="text-sm font-semibold text-slate-700">Full name</span><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={field} required /></label>
              <label className="block"><span className="text-sm font-semibold text-slate-700">Mobile number</span><input value={phone} inputMode="tel" autoComplete="tel" onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" className={field} /></label>
              <label className="block sm:col-span-2"><span className="text-sm font-semibold text-slate-700">Email</span><input value={user?.email ?? ''} disabled className={`${field} bg-slate-100 text-slate-500`} /></label>
              <div className="sm:col-span-2"><Button type="submit" isLoading={saving} className="h-11 px-6 rounded-xl">Save changes</Button></div>
            </form>
          </section>

          {/* Addresses */}
          <section className="rounded-2xl bg-white border border-slate-200/80 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Saved addresses</h2>
                <p className="text-sm text-slate-500">Used to speed up checkout.</p>
              </div>
              <Button onClick={() => { setFormError(null); setForm(blank(displayName, phone)); }} className="h-10 rounded-xl"><Plus className="w-4 h-4 mr-1" /> Add</Button>
            </div>
            {addresses === null ? (
              <div className="mt-4 h-24 rounded-xl bg-slate-100 animate-pulse" />
            ) : addresses.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500"><MapPin className="w-6 h-6 mx-auto text-slate-300 mb-2" />No saved addresses yet.</div>
            ) : (
              <ul className="mt-4 grid sm:grid-cols-2 gap-3">
                {[...addresses].sort((a, b) => Number(b.isDefault) - Number(a.isDefault)).map((a) => (
                  <li key={a.id} className={`rounded-xl border p-4 ${a.isDefault ? 'border-primary-300 bg-primary-50/40' : 'border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">{labelIcon(a.label)} {a.label}</span>
                      {a.isDefault && <span className="text-[10px] font-bold bg-primary-600 text-white px-2 py-0.5 rounded-full">DEFAULT</span>}
                    </div>
                    <p className="mt-2 font-bold text-slate-900 text-sm">{a.recipientName}</p>
                    <p className="text-sm text-slate-600 leading-snug">{a.line1}{a.landmark ? `, ${a.landmark}` : ''}<br />{a.city}, {a.state} {a.pincode}</p>
                    <p className="text-xs text-slate-500 mt-1">{a.phone}</p>
                    <div className="mt-3 flex items-center gap-1.5">
                      <button onClick={() => { setFormError(null); setForm({ id: a.id, label: a.label, recipientName: a.recipientName, phone: a.phone, line1: a.line1, landmark: a.landmark ?? '', city: a.city, state: a.state, pincode: a.pincode }); }} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"><Pencil className="w-3 h-3" /> Edit</button>
                      {!a.isDefault && <button onClick={() => makeDefault(a)} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"><Star className="w-3 h-3" /> Make default</button>}
                      <button onClick={() => removeAddress(a)} aria-label="Delete address" className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Security */}
          <section className="rounded-2xl bg-white border border-slate-200/80 p-5 sm:p-6">
            <h2 className="text-lg font-extrabold text-slate-900">Security</h2>
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
              <div className="flex items-start gap-3"><KeyRound className="w-5 h-5 text-slate-400 mt-0.5" /><div><p className="text-sm font-bold text-slate-900">Password</p><p className="text-xs text-slate-500">We'll email you a secure link to set a new password.</p></div></div>
              <button onClick={sendReset} className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-sm font-bold hover:border-slate-900">Send reset link</button>
            </div>
          </section>
        </div>
      </div>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Edit address' : 'Add address'}
        footer={<><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button onClick={saveAddress} isLoading={savingAddr}>Save address</Button></>}
      >
        {form && (
          <div className="space-y-4">
            {formError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>}
            <div className="grid grid-cols-3 gap-2">
              {(['home', 'work', 'other'] as const).map((l) => (
                <button key={l} type="button" onClick={() => setForm({ ...form, label: l })} className={`h-10 rounded-xl border text-sm font-semibold capitalize inline-flex items-center justify-center gap-1.5 ${form.label === l ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-600'}`}>{labelIcon(l)} {l}</button>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block"><span className="text-sm font-semibold text-slate-700">Full name</span><input value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} autoComplete="name" className={field} /></label>
              <label className="block"><span className="text-sm font-semibold text-slate-700">Mobile</span><input value={form.phone} inputMode="tel" maxLength={10} autoComplete="tel-national" onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })} className={field} /></label>
            </div>
            <label className="block"><span className="text-sm font-semibold text-slate-700">Street address</span><input value={form.line1} autoComplete="address-line1" onChange={(e) => setForm({ ...form, line1: e.target.value })} className={field} placeholder="House no., building, street, area" /></label>
            <label className="block"><span className="text-sm font-semibold text-slate-700">Landmark <span className="font-normal text-slate-400">(optional)</span></span><input value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} className={field} /></label>
            <div className="grid grid-cols-3 gap-3">
              <label className="block"><span className="text-sm font-semibold text-slate-700">City</span><input value={form.city} autoComplete="address-level2" onChange={(e) => setForm({ ...form, city: e.target.value })} className={field} /></label>
              <label className="block"><span className="text-sm font-semibold text-slate-700">State</span><input value={form.state} autoComplete="address-level1" onChange={(e) => setForm({ ...form, state: e.target.value })} className={field} /></label>
              <label className="block"><span className="text-sm font-semibold text-slate-700">PIN</span><input value={form.pincode} inputMode="numeric" maxLength={6} autoComplete="postal-code" onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, '') })} className={field} /></label>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
