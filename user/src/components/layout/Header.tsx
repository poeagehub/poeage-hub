import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useSettings } from '../../context/SettingsContext';
import { Button } from '@poeage/ui';
import { ShoppingBag, ShoppingCart, User as UserIcon, Search, LogOut, ChevronDown, X } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, profile, signOutUser } = useAuth();
  const { itemCount } = useCart();
  const { settings } = useSettings();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the account menu on outside tap (works for touch, unlike hover) and when the page changes.
  useEffect(() => {
    if (!dropdownOpen) return;
    const close = (e: Event) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [dropdownOpen]);
  useEffect(() => setDropdownOpen(false), [location.pathname]);

  // Keep the search box in sync when you land on a results page.
  useEffect(() => {
    if (location.pathname === '/search') {
      setSearchQuery(new URLSearchParams(location.search).get('q') ?? '');
    }
  }, [location.pathname, location.search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      (document.activeElement as HTMLElement | null)?.blur();
    }
  };

  const threshold = settings.freeDeliveryThreshold > 0 ? Math.round(settings.freeDeliveryThreshold / 100) : 0;
  const initial = profile?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U';

  const searchBox = (cls: string) => (
    <form onSubmit={handleSearch} role="search" className={cls}>
      <div className="relative">
      <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="search"
        enterKeyHint="search"
        placeholder="Search products, brands, categories"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full h-10 pl-10 pr-9 rounded-xl bg-gray-100 md:bg-white border border-transparent md:border-gray-300 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {searchQuery && (
        <button
          type="button"
          onClick={() => setSearchQuery('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      </div>
    </form>
  );

  return (
    <>
      {/* Announcement strip scrolls away; only the header below stays pinned. */}
      {threshold > 0 && (
        <div className="bg-slate-900 text-white text-[11px] sm:text-xs py-1.5 px-4 text-center truncate">
          Free delivery on orders over ₹{threshold.toLocaleString('en-IN')}
        </div>
      )}

      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16 gap-3">
            <Link to="/" className="flex items-center gap-2 flex-shrink-0" aria-label="Poeage Hub home">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg md:text-xl shadow-sm">
                P
              </div>
              <span className="font-extrabold text-base md:text-lg tracking-tight leading-none whitespace-nowrap">
                <span className="text-slate-900">POEAGE</span>
                <span className="text-blue-600 ml-1">HUB</span>
              </span>
            </Link>

            {/* Desktop search */}
            {searchBox('hidden md:block flex-1 max-w-lg')}

            <div className="flex items-center gap-1 sm:gap-2">
              <Link
                to="/cart"
                aria-label={`Cart, ${itemCount} items`}
                className="relative w-10 h-10 flex items-center justify-center text-gray-700 hover:text-blue-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <ShoppingCart className="w-5 h-5" />
                {itemCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </Link>

              {user ? (
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setDropdownOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={dropdownOpen}
                    className="flex items-center gap-1.5 h-10 pl-1 pr-1.5 sm:pr-2.5 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                      {initial}
                    </span>
                    <span className="hidden sm:inline max-w-[100px] truncate text-sm font-medium text-gray-700">
                      {profile?.displayName || 'My Account'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {dropdownOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 mt-2 w-60 bg-white border border-gray-200 rounded-2xl shadow-xl py-2 z-50 animate-[slideUp_.15s_ease-out]"
                    >
                      <div className="px-4 py-2.5 border-b border-gray-100">
                        <p className="text-[11px] text-gray-500">Signed in as</p>
                        <p className="text-sm font-semibold text-gray-900 truncate">{user.email}</p>
                      </div>
                      <Link to="/account/profile" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 active:bg-gray-50 hover:bg-gray-50">
                        <UserIcon className="w-4 h-4 text-gray-500" />
                        Profile & Security
                      </Link>
                      <Link to="/account/orders" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 active:bg-gray-50 hover:bg-gray-50">
                        <ShoppingBag className="w-4 h-4 text-gray-500" />
                        My Orders
                      </Link>
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          void signOutUser();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 active:bg-red-50 hover:bg-red-50 text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Link to="/login">
                    <Button variant="ghost" size="sm" className="px-3">
                      Sign In
                    </Button>
                  </Link>
                  <Link to="/register" className="hidden sm:block">
                    <Button variant="primary" size="sm">
                      Register
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Phone search: always visible, like every shopping app */}
          {searchBox('md:hidden pb-2.5')}
        </div>
      </header>
    </>
  );
};
