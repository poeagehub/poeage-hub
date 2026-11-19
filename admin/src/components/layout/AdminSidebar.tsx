import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Store,
  Truck,
  Users,
  Wallet,
  Settings,
  Shield,
} from 'lucide-react';
import { subscribeToCollection, where } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Orders', path: '/orders', icon: ShoppingBag },
  { label: 'Products', path: '/products', icon: Package },
  { label: 'Vendors', path: '/vendors', icon: Store },
  { label: 'Drivers', path: '/drivers', icon: Truck },
  { label: 'Customers', path: '/customers', icon: Users },
  { label: 'Settlements', path: '/settlements', icon: Wallet },
  { label: 'Settings', path: '/settings', icon: Settings },
];

/** Live count of documents waiting for admin review in a collection. */
function usePendingCount(collectionName: string): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const unsubscribe = subscribeToCollection<{ id: string }>(
      collectionName,
      [where('status', '==', 'pending_review')],
      (docs) => setCount(docs.length),
      (err) => console.error(`[Sidebar] pending ${collectionName} listener failed:`, err),
    );
    return () => unsubscribe();
  }, [collectionName]);
  return count;
}

export const AdminSidebar: React.FC = () => {
  const pendingVendors = usePendingCount(COLLECTION.VENDORS);
  const pendingDrivers = usePendingCount(COLLECTION.DRIVERS);
  const badges: Record<string, number> = {
    '/vendors': pendingVendors,
    '/drivers': pendingDrivers,
  };

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col flex-shrink-0 sticky top-0 h-screen self-start">
      {/* Brand */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow">
          P
        </div>
        <div>
          <span className="font-extrabold text-white text-base tracking-tight">POEAGE</span>
          <span className="text-blue-400 font-extrabold text-base tracking-tight ml-1">ADMIN</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Marketplace Operations
        </div>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const pending = badges[item.path] ?? 0;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span className="flex-1">{item.label}</span>
              {pending > 0 && (
                <span
                  className="relative flex items-center justify-center"
                  title={`${pending} pending approval request${pending > 1 ? 's' : ''}`}
                >
                  <span className="absolute inline-flex h-5 w-5 rounded-full bg-red-500 opacity-60 animate-ping" />
                  <span className="relative min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {pending > 99 ? '99+' : pending}
                  </span>
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Security Status Box */}
      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 text-xs">
          <div className="flex items-center gap-2 text-green-400 font-semibold mb-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Security Enforced
          </div>
          <p className="text-[11px] text-slate-400">Strict RBAC & audit logging active.</p>
        </div>
      </div>
    </aside>
  );
};
