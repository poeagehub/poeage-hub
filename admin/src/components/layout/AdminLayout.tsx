import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Store,
  Truck,
  Users,
  Wallet,
  Settings,
  LogOut,
  ExternalLink,
  Tags,
  TicketPercent,
  ShieldCheck,
  MessageSquareText,
  Activity,
  ArrowUpRight,
} from 'lucide-react';
import { subscribeToCollection, where } from '@poeage/firebase-client';
import { COLLECTION, APP_CONFIG } from '@poeage/config';
import { PanelShell, type PanelNavItem } from '@poeage/ui';
import { useAdminAuth } from '../../context/AuthContext';

/** Live count of documents waiting for admin review. */
function usePendingCount(collectionName: string, statusValue = 'pending_review'): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const unsubscribe = subscribeToCollection<{ id: string }>(
      collectionName,
      [where('status', '==', statusValue)],
      (docs) => setCount(docs.length),
      (err) => console.error(`[Admin] pending ${collectionName} listener failed:`, err),
    );
    return () => unsubscribe();
  }, [collectionName, statusValue]);
  return count;
}

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, roles, signOutAdmin } = useAdminAuth();
  const location = useLocation();
  const pendingVendors = usePendingCount(COLLECTION.VENDORS);
  const pendingDrivers = usePendingCount(COLLECTION.DRIVERS);
  const pendingProducts = usePendingCount(COLLECTION.PRODUCTS);
  const pendingReviews = usePendingCount(COLLECTION.REVIEWS, 'pending');
  const pendingPayouts = usePendingCount(COLLECTION.PAYOUT_REQUESTS, 'pending');

  const nav: PanelNavItem[] = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard, end: true, primary: true },
    { label: 'Orders', path: '/orders', icon: ShoppingBag, primary: true },
    { label: 'Vendors', path: '/vendors', icon: Store, badge: pendingVendors, primary: true },
    { label: 'Products', path: '/products', icon: Package, badge: pendingProducts, primary: true },
    { label: 'Drivers', path: '/drivers', icon: Truck, badge: pendingDrivers },
    { label: 'Customers', path: '/customers', icon: Users },
    { label: 'Categories', path: '/categories', icon: Tags },
    { label: 'Reviews', path: '/reviews', icon: MessageSquareText, badge: pendingReviews },
    { label: 'Coupons', path: '/coupons', icon: TicketPercent },
    { label: 'Payouts', path: '/payouts', icon: Wallet, badge: pendingPayouts },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  const initial = (profile?.displayName?.[0] || user?.email?.[0] || 'A').toUpperCase();

  return (
    <PanelShell
      brand={{ first: 'POEAGE', second: 'ADMIN' }}
      sectionLabel="Marketplace Operations"
      nav={nav}
      headerLeft={
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 bg-primary-50/90 border border-primary-200/70 px-2.5 py-1 rounded-full capitalize shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-primary-600" />
            {(roles[0] || 'admin').replace(/_/g, ' ')}
          </span>
          <div className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 bg-slate-100/90 border border-slate-200/60 px-2.5 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-live" />
            <span>Telemetry Online</span>
          </div>
        </div>
      }
      headerRight={
        <>
          <a
            href={APP_CONFIG.urls.user}
            target="_blank"
            rel="noreferrer"
            className="group hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-primary-700 px-3 py-2 rounded-xl hover:bg-primary-50/60 border border-transparent hover:border-primary-100 transition-all duration-200"
          >
            <span>View storefront</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-primary-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </a>
          <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200/80">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white font-bold flex items-center justify-center text-xs shadow-sm ring-2 ring-primary-500/20 hover:ring-primary-500/50 transition-all cursor-pointer">
                {initial}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
            <div className="hidden md:block text-left leading-tight">
              <p className="text-xs font-bold text-slate-900 truncate max-w-[140px]">{profile?.displayName || 'Admin'}</p>
              <p className="text-[10px] text-slate-500 truncate max-w-[140px] font-mono">{user?.email}</p>
            </div>
            <button
              onClick={signOutAdmin}
              title="Sign out"
              aria-label="Sign out"
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50/80 rounded-xl transition-all duration-200 active:scale-95 ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </>
      }
      sidebarFooter={
        <div className="rounded-xl bg-gradient-to-b from-white/[0.08] to-white/[0.03] border border-white/10 p-3 text-xs shadow-inner backdrop-blur-sm">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-[11px] tracking-wide">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse-live" />
              Live · Secured
            </div>
            <span className="text-[10px] text-slate-400 font-mono bg-white/10 px-1.5 py-0.5 rounded">v2.4</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-tight">
            Admin RBAC and tamper-proof audit trail active.
          </p>
        </div>
      }
    >
      <div key={location.pathname} className="animate-page-enter flex-1 flex flex-col min-h-full">
        {children}
      </div>
    </PanelShell>
  );
};
