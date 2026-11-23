import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToCollection, updateDocument, where, friendlyError } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Inventory, VendorOrder } from '@poeage/types';
import { formatMoney } from '@poeage/utils';
import { PanelShell, StatusPill, type PanelNavItem } from '@poeage/ui';
import { useVendorAuth } from '../../context/AuthContext';
import { LayoutDashboard, Package, ShoppingBag, Layers, Wallet, Settings, BellRing, X, LogOut, Power, BadgeCheck } from 'lucide-react';

interface OrderToast {
  id: string;
  title: string;
  detail: string;
}

/** Live counts for nav badges, plus a popup whenever a new order arrives. */
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
        if (seen.current === null) {
          seen.current = new Set(pending.map((o) => o.id));
          return;
        }
        for (const o of pending) {
          if (seen.current.has(o.id)) continue;
          seen.current.add(o.id);
          const units = o.items.reduce((n, i) => n + i.quantity, 0);
          setToasts((t) => [
            ...t,
            { id: o.id, title: 'New order received', detail: `${units} ${units === 1 ? 'item' : 'items'} · ${formatMoney(o.subtotal)} · ${o.items[0]?.name ?? ''}` },
          ]);
          setTimeout(() => setToasts((t) => t.filter((x) => x.id !== o.id)), 9000);
        }
      },
      (err) => console.error('[VendorLayout] orders listener failed:', err),
    );
    const unsubStock = subscribeToCollection<Inventory>(
      COLLECTION.INVENTORY,
      scope,
      (inv) => setStockAlerts(inv.filter((i) => i.quantity - (i.reservedQuantity ?? 0) <= (i.reorderLevel ?? 5)).length),
      (err) => console.error('[VendorLayout] inventory listener failed:', err),
    );
    return () => {
      unsubOrders();
      unsubStock();
    };
  }, [vendorId]);

  return { newOrders, stockAlerts, toasts, dismiss };
}

export const VendorLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { vendor, signOutVendor } = useVendorAuth();
  const { newOrders, stockAlerts, toasts, dismiss } = useVendorAlerts();
  const navigate = useNavigate();
  const isOpen = vendor?.isOpen !== false;
  const [busy, setBusy] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const toggleStore = async () => {
    if (!vendor || busy) return;
    setBusy(true);
    setToggleError(null);
    try {
      await updateDocument(COLLECTION.VENDORS, vendor.id, { isOpen: !isOpen });
    } catch (err) {
      setToggleError(friendlyError(err, 'Could not change store status.'));
      setTimeout(() => setToggleError(null), 5000);
    } finally {
      setBusy(false);
    }
  };

  const nav: PanelNavItem[] = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard, end: true, primary: true },
    { label: 'Orders', path: '/orders', icon: ShoppingBag, badge: newOrders, primary: true },
    { label: 'Products', path: '/products', icon: Package, primary: true },
    { label: 'Inventory', path: '/inventory', icon: Layers, badge: stockAlerts, badgeTone: 'warning', primary: true },
    { label: 'Finance & Payouts', path: '/settlements', icon: Wallet },
    { label: 'Store Settings', path: '/settings', icon: Settings },
  ];

  const commission = vendor?.commissionRate != null ? `${Math.round(vendor.commissionRate * 1000) / 10}%` : '10%';

  return (
    <>
      <PanelShell
        brand={{ first: 'POEAGE', second: 'SELLER' }}
        sectionLabel="Seller hub"
        nav={nav}
        headerLeft={
          <>
            <h1 className="text-[15px] sm:text-base font-extrabold text-slate-900 truncate max-w-[40vw] sm:max-w-none">{vendor?.storeName || 'Seller Hub'}</h1>
            {vendor?.status === 'approved' ? (
              <span className="hidden sm:inline-flex"><StatusPill tone="green" dot={false}><BadgeCheck className="w-3 h-3" /> Verified</StatusPill></span>
            ) : (
              <StatusPill tone="amber">Pending review</StatusPill>
            )}
          </>
        }
        headerRight={
          <>
            {toggleError && <span className="hidden md:block text-xs text-red-600">{toggleError}</span>}
            <button
              onClick={toggleStore}
              disabled={busy}
              className={`flex items-center gap-2 pl-3 pr-3.5 h-9 rounded-full text-xs font-bold border transition-all duration-200 ${
                isOpen
                  ? 'bg-teal-50 text-teal-800 border-teal-200/90 hover:bg-teal-100/80 shadow-xs'
                  : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
              }`}
            >
              {isOpen ? (
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
              ) : (
                <Power className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>{isOpen ? 'Open' : 'Paused'}</span>
              <span className="hidden sm:inline font-medium text-[11px] text-teal-700/80">
                {isOpen ? '· Live orders active' : '— not taking orders'}
              </span>
            </button>
            <div className="flex items-center gap-1.5 pl-2 sm:pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-teal-500 to-teal-700 text-white font-bold flex items-center justify-center text-xs overflow-hidden ring-2 ring-teal-500/20 shadow-xs">
                {vendor?.logoURL ? <img src={vendor.logoURL} alt="" className="w-full h-full object-cover" /> : (vendor?.storeName?.[0]?.toUpperCase() || 'V')}
              </div>
              <button onClick={signOutVendor} title="Sign out" aria-label="Sign out" className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </>
        }
        sidebarFooter={
          <div className="rounded-xl bg-gradient-to-br from-teal-950/40 via-slate-900 to-slate-900 border border-teal-500/20 p-3.5 text-xs shadow-inner">
            <p className="text-slate-400 text-[11px] font-medium">Your platform commission</p>
            <p className="text-xl font-black text-teal-400 leading-tight mt-0.5">{commission}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">per delivered customer order</p>
          </div>
        }
      >
        <div className="animate-page-enter">
          {children}
        </div>
      </PanelShell>

      {/* New-order popups */}
      <div className="fixed top-16 sm:top-4 right-3 sm:right-4 z-[70] space-y-3 w-80 max-w-[calc(100vw-1.5rem)]">
        {toasts.map((t) => (
          <div key={t.id} role="status" className="bg-white/95 backdrop-blur-md border border-teal-200 shadow-2xl rounded-2xl p-4 flex items-start gap-3 animate-[slideIn_.25s_ease-out]">
            <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0 shadow-inner">
              <BellRing className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">{t.title}</p>
              <p className="text-xs text-slate-500 truncate">{t.detail}</p>
              <button onClick={() => { dismiss(t.id); navigate('/orders'); }} className="mt-2 text-xs font-bold text-teal-700 hover:text-teal-800 transition-colors">
                View order →
              </button>
            </div>
            <button onClick={() => dismiss(t.id)} className="p-1 text-slate-400 hover:text-slate-700 rounded-md transition-colors" aria-label="Dismiss">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
};
