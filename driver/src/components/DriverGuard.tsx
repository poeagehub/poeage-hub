import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useDriverAuth } from '../context/AuthContext';
import { Spinner } from '@poeage/ui';
import { WifiOff, RefreshCw, LogOut } from 'lucide-react';
import { ActionButton } from './ui';

interface DriverGuardProps {
  children: React.ReactNode;
}

/** For onboarding/status screens: only requires a signed-in user, so signing out sends you to /login. */
export const RequireSignedIn: React.FC<DriverGuardProps> = ({ children }) => {
  const { user, loading } = useDriverAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export const DriverGuard: React.FC<DriverGuardProps> = ({ children }) => {
  const { user, status, loading, profileError, refreshDriverState, signOutDriver } = useDriverAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Spinner size="lg" className="text-accent-500" />
        <p className="mt-4 text-sm text-slate-400">Loading driver credentials...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // The profile could not be loaded (no connection). Don't treat that as "new driver" — let the person retry or sign out.
  if (status === 'none' && profileError) {
    return (
      <div className="min-h-screen d-bg flex items-center justify-center p-5 text-center">
        <div className="d-card p-7 max-w-sm w-full">
          <span className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-300 flex items-center justify-center mx-auto"><WifiOff className="w-7 h-7" /></span>
          <h1 className="mt-5 text-xl font-black text-white">Can't reach the server</h1>
          <p className="mt-2 text-sm text-slate-400 leading-relaxed">Check your internet connection, then try again. Your account and jobs are safe.</p>
          <div className="mt-6 flex flex-col gap-2.5">
            <ActionButton onClick={() => void refreshDriverState()}><RefreshCw className="w-4 h-4" /> Try again</ActionButton>
            <ActionButton tone="ghost" onClick={() => void signOutDriver()}><LogOut className="w-4 h-4" /> Sign out</ActionButton>
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
