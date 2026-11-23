import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useVendorAuth } from '../context/AuthContext';
import { Spinner, Button } from '@poeage/ui';
import { WifiOff, RefreshCw, LogOut } from 'lucide-react';

interface VendorGuardProps {
  children: React.ReactNode;
}

/** For onboarding/status screens: only requires a signed-in user, so signing out sends you to /login. */
export const RequireSignedIn: React.FC<VendorGuardProps> = ({ children }) => {
  const { user, loading } = useVendorAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export const VendorGuard: React.FC<VendorGuardProps> = ({ children }) => {
  const { user, status, loading, profileError, refreshVendorState, signOutVendor } = useVendorAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <Spinner size="lg" className="text-teal-400" />
        <p className="mt-4 text-sm text-slate-400">Loading merchant credentials...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Could not load the store profile (no connection) — don't mistake that for "new seller".
  if (status === 'none' && profileError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-5 text-center">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-7 max-w-sm w-full">
          <span className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-300 flex items-center justify-center mx-auto"><WifiOff className="w-7 h-7" /></span>
          <h1 className="mt-5 text-xl font-black text-white">Can't reach the server</h1>
          <p className="mt-2 text-sm text-slate-400 leading-relaxed">Check your internet connection, then try again. Your store and orders are safe.</p>
          <div className="mt-6 flex flex-col gap-2.5">
            <Button onClick={() => void refreshVendorState()} className="h-11"><RefreshCw className="w-4 h-4 mr-2" /> Try again</Button>
            <Button variant="ghost" onClick={() => void signOutVendor()} className="h-11 text-slate-300"><LogOut className="w-4 h-4 mr-2" /> Sign out</Button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'none') {
    return <Navigate to="/onboarding" replace />;
  }

  if (status === 'pending_review' || status === 'rejected' || status === 'suspended') {
    return <Navigate to="/status" replace />;
  }

  return <>{children}</>;
};
