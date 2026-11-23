import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, LayoutGrid, ShoppingCart, PackageSearch, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';

/** Screens that have their own sticky action bar, or need the full screen for a task. */
const HIDE_ON = [/^\/checkout/, /^\/product\//, /^\/order-success/, /^\/login/, /^\/register/, /^\/forgot-password/];

/** Phone-only bottom navigation. */
export const MobileTabBar: React.FC = () => {
  const { user } = useAuth();
  const { itemCount } = useCart();
  const { pathname } = useLocation();
  if (HIDE_ON.some((re) => re.test(pathname))) return null;

  const tabs = [
    { label: 'Home', to: '/', icon: Home, end: true },
    { label: 'Shop', to: '/products', icon: LayoutGrid, end: false },
    { label: 'Cart', to: '/cart', icon: ShoppingCart, end: false, badge: itemCount },
    { label: 'Orders', to: user ? '/account/orders' : '/login', icon: PackageSearch, end: false },
    { label: 'Account', to: user ? '/account/profile' : '/login', icon: User, end: false },
  ];

  return (
    <nav
      aria-label="Main"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200 pb-safe"
    >
      <ul className="grid grid-cols-5 h-14">
        {tabs.map((t) => (
          <li key={t.label}>
            <NavLink
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `h-full flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
                  isActive ? 'text-primary-600' : 'text-gray-500 active:text-primary-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative">
                    <t.icon className={`w-[22px] h-[22px] ${isActive ? 'stroke-[2.4]' : ''}`} />
                    {!!t.badge && t.badge > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 bg-primary-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                        {t.badge > 9 ? '9+' : t.badge}
                      </span>
                    )}
                  </span>
                  {t.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};
