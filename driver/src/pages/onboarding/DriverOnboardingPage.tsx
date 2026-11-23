import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bike, Car, Truck, Zap, Leaf } from 'lucide-react';
import type { VehicleType } from '@poeage/types';
import { friendlyError } from '@poeage/firebase-client';
import { useDriverAuth } from '../../context/AuthContext';
import { ActionButton, AuthShell, Field, Notice, cx } from '../../components/ui';

const VEHICLES: { v: VehicleType; label: string; icon: React.ReactNode }[] = [
  { v: 'motorcycle', label: 'Motorcycle', icon: <Bike className="w-5 h-5" /> },
  { v: 'scooter', label: 'Scooter', icon: <Zap className="w-5 h-5" /> },
  { v: 'bicycle', label: 'Bicycle', icon: <Leaf className="w-5 h-5" /> },
  { v: 'car', label: 'Car', icon: <Car className="w-5 h-5" /> },
  { v: 'van', label: 'Van', icon: <Truck className="w-5 h-5" /> },
];

export const DriverOnboardingPage: React.FC = () => {
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('motorcycle');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { submitDriverOnboarding, signOutDriver } = useDriverAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      await submitDriverOnboarding({ displayName, phone, vehicleType, vehicleNumber, licenseNumber });
      navigate('/status', { replace: true });
    } catch (err: unknown) {
      setErrorMsg(friendlyError(err, 'Failed to submit your details.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell wide>
      <div className="d-card p-4 min-[380px]:p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent-300">
            <span className="w-5 h-5 rounded-full bg-accent-500 text-white flex items-center justify-center text-[10px]">2</span> of 2 · Vehicle
          </div>
          <button onClick={signOutDriver} className="text-xs font-bold text-slate-400 hover:text-white">Sign out</button>
        </div>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-white">Vehicle &amp; verification</h1>
        <p className="text-sm text-slate-400 mt-1.5">Our team verifies these details before you can start delivering.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4 min-[380px]:space-y-5">
          {errorMsg && <Notice tone="error">{errorMsg}</Notice>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-[380px]:gap-5">
            <Field label="Full name"><input className="d-input" required placeholder="Vikram Singh" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></Field>
            <Field label="Mobile number"><input className="d-input" required type="tel" inputMode="numeric" placeholder="9876543210" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          </div>

          <div>
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Vehicle type</span>
            <div className="grid grid-cols-2 min-[330px]:grid-cols-3 sm:grid-cols-5 gap-2">
              {VEHICLES.map((x) => (
                <button key={x.v} type="button" onClick={() => setVehicleType(x.v)} aria-pressed={vehicleType === x.v}
                  className={cx('flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-3 text-[11px] min-w-0 font-bold transition', vehicleType === x.v ? 'bg-accent-400/15 border-accent-400/60 text-accent-200' : 'bg-white/[0.03] border-white/10 text-slate-400 hover:bg-white/[0.06]')}>
                  {x.icon}{x.label}
                </button>
              ))}
            </div>
          </div>

          <Field label="Registration plate number"><input className="d-input font-mono uppercase" required placeholder="DL 01 AB 1234" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())} /></Field>
          <Field label="Driving licence number"><input className="d-input font-mono uppercase" required placeholder="DL-1420110012345" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value.toUpperCase())} /></Field>

          <ActionButton type="submit" size="lg" className="w-full" loading={loading}>Submit for verification</ActionButton>
        </form>
      </div>
    </AuthShell>
  );
};
