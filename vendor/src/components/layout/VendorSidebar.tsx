import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { subscribeToCollection, where } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Inventory, VendorOrder } from '@poeage/types';
import { formatMoney } from '@poeage/utils';
import { useVendorAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Layers,
  Wallet,
  Store,
  Settings,
  BellRing,
  X,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Products', path: '/products', icon: Package },
  { label: 'Orders', path: '/orders', icon: ShoppingBag },
  { label: 'Inventory', path: '/inventory', icon: Layers },
  { label: 'Finance & Payouts', path: '/settlements', icon: Wallet },
  { label: 'Store Settings', path: '/settings', icon: Store },
];

interface OrderToast {
  id: string;
  title: string;
  detail: string;
}

/** Live counts for the sidebar badges, plus a popup whenever a new order arrives. */
function useVendorAlerts() {
  const { vendor, user } = useVendorAuth();
  const vendorId = vendor?.id || user?.uid;
  const [newOrders, setNewOrders] = useState(0);
  const [stockAlerts, setStockAlerts] = useState(0);
  const [toasts, setToasts] = useState<OrderToast[]>([]);
  const seen = useRef<Set<string> | null>(null);

  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  useEffect(() => {
    if (!vendorId) return;
    seen.current = null;
    const scope = [where('vendorId', '==', vendorId)];
    const unsubOrders = subscribeToCollection<VendorOrder>(
      COLLECTION.VENDOR_ORDERS,
      scope,
      (orders) => {
        const pending = orders.filter((o) => o.status === 'pending');
        setNewOrders(pending.length);
        // The first snapshot only records what already exists; later arrivals pop up.
        if (seen.current === null) {
          seen.current = new Set(pending.map((o) => o.id));
          return;
        }
        for (const o of pending) {
          if (seen.current.has(o.id)) continue;
          seen.current.add(o.id);
          const units = o.items.reduce((n, i) => n + i.quantity, 0);
          const toast: OrderToast = {
            id: o.id,
            title: 'New order received',
            detail: `${units} ${units === 1 ? 'item' : 'items'} · ${formatMoney(o.subtotal)} · ${o.items[0]?.name ?? ''}`,
          };
          setToasts((t) => [...t, toast]);
          setTimeout(() => setToasts((t) => t.filter((x) => x.id !== o.id)), 9000);
        }
      },
      (err) => console.error('[VendorSidebar] orders listener failed:', err),
    );
    const unsubStock = subscribeToCollection<Inventory>(
      COLLECTION.INVENTORY,
      scope,
      (inv) => setStockAlerts(inv.filter((i) => i.quantity - (i.reservedQuantity ?? 0) <= (i.reorderLevel ?? 5)).length),
      (err) => console.error('[VendorSidebar] inventory listener failed:', err),
    );
    return () => {
      unsubOrders();
      unsubStock();
    };
  }, [vendorId]);

  return { newOrders, stockAlerts, toasts, dismiss };
}

export const VendorSidebar: React.FC = () => {
  const { newOrders, stockAlerts, toasts, dismiss } = useVendorAlerts();
  const navigate = useNavigate();
  const badges: Record<string, { count: number; tone: string; label: string }> = {
    '/orders': { count: newOrders, tone: 'bg-red-500', label: 'new order' },
    '/inventory': { count: stockAlerts, tone: 'bg-amber-500', label: 'low-stock product' },
  };

  return (
    <>
    <aside className="w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col flex-shrink-0 sticky top-0 h-screen self-start">
      <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow">
          P
        </div>
        <div>
          <span className="font-extrabold text-white text-base tracking-tight">POEAGE</span>
          <span className="text-emerald-400 font-extrabold text-base tracking-tight ml-1">VENDOR</span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1">
        <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Seller Management
        </div>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span className="flex-1">{item.label}</span>
              {(badges[item.path]?.count ?? 0) > 0 && (
                <span
                  className="relative flex items-center justify-center"
                  title={`${badges[item.path]!.count} ${badges[item.path]!.label}${badges[item.path]!.count > 1 ? 's' : ''}`}
                >
                  <span className={`absolute inline-flex h-5 w-5 rounded-full opacity-60 animate-ping ${badges[item.path]!.tone}`} />
                  <span className={`relative min-w-[20px] h-5 px-1.5 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${badges[item.path]!.tone}`}>
                    {badges[item.path]!.count > 99 ? '99+' : badges[item.path]!.count}
                  </span>
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 text-xs">
          <p className="font-semibold text-slate-300 mb-1">Commission Tier</p>
          <p className="text-emerald-400 font-bold">Standard 10% (1,000 bps)</p>
        </div>
      </div>
    </aside>

    {/* New-order popups */}
    <div className="fixed top-4 right-4 z-[60] space-y-3 w-80 max-w-[calc(100vw-2rem)]">
      {toasts.map((t) => (
        <div key={t.id} role="status" className="bg-white border border-emerald-200 shadow-xl rounded-2xl p-4 flex items-start gap-3 animate-[slideIn_.25s_ease-out]">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
            <BellRing className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900">{t.title}</p>
            <p className="text-xs text-gray-500 truncate">{t.detail}</p>
            <button
              onClick={() => {
                dismiss(t.id);
                navigate('/orders');
              }}
              className="mt-2 text-xs font-bold text-emerald-700 hover:text-emerald-600"
            >
              View order →
            </button>
          </div>
          <button onClick={() => dismiss(t.id)} className="p-1 text-gray-400 hover:text-gray-700 rounded-md" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
    </>
  );
};
