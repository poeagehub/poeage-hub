import React from 'react';
import { Navigate } from 'react-router-dom';
import { Clock, XCircle, AlertTriangle, RefreshCw, LogOut } from 'lucide-react';
import { useDriverAuth } from '../../context/AuthContext';
import { ActionButton, AuthShell } from '../../components/ui';

export const DriverStatusPage: React.FC = () => {
  const { driver, status, signOutDriver, refreshDriverState, loading } = useDriverAuth();

  if (status === 'approved' || status === 'active' || status === 'offline') {
    return <Navigate to="/" replace />;
  }

  const info = (() => {
    switch (status) {
      case 'pending_review':
        return { icon: <Clock className="w-9 h-9" />, tone: 'amber', title: 'Verification in progress', desc: 'Our team is checking your driving licence and vehicle registration. You can start delivering as soon as the checks are complete.' };
      case 'rejected':
        return { icon: <XCircle className="w-9 h-9" />, tone: 'red', title: 'Verification rejected', desc: 'We could not verify your details. Please check that your registration and licence numbers are valid and contact support.' };
      case 'suspended':
        return { icon: <AlertTriangle className="w-9 h-9" />, tone: 'red', title: 'Account suspended', desc: 'Your delivery partner account has been suspended by the operations team.' };
      default:
        return { icon: <Clock className="w-9 h-9" />, tone: 'sky', title: 'Profile under review', desc: 'We are verifying your documentation.' };
    }
  })();
  const ring = { amber: 'bg-accent-400/15 text-accent-300 border-accent-400/30', red: 'bg-red-500/15 text-red-300 border-red-500/30', sky: 'bg-sky-400/15 text-sky-300 border-sky-400/30' }[info.tone]!;

  return (
    <AuthShell>
      <div className="d-card p-8 text-center">
        <div className={`w-20 h-20 rounded-3xl border flex items-center justify-center mx-auto ${ring}`}>{info.icon}</div>
        <h1 className="mt-6 text-2xl font-black tracking-tight text-white">{info.title}</h1>
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-accent-300">
          {driver?.displayName || 'Partner'} · {driver?.vehicleNumber || 'Vehicle'}
        </p>
        <p className="mt-4 text-sm text-slate-400 leading-relaxed">{info.desc}</p>
        <div className="mt-8 flex flex-col gap-2.5">
          <ActionButton tone="outline" onClick={refreshDriverState} loading={loading}><RefreshCw className="w-4 h-4" /> Check status</ActionButton>
          <ActionButton tone="ghost" onClick={signOutDriver}><LogOut className="w-4 h-4" /> Sign out</ActionButton>
        </div>
      </div>
    </AuthShell>
  );
};
