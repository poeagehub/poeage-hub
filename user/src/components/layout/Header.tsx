import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useSettings } from '../../context/SettingsContext';
import { useWishlist } from '../../context/WishlistContext';
import { getDocuments, where } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Product, Category } from '@poeage/types';
import { formatMoney } from '@poeage/utils';
import { Button } from '@poeage/ui';
import { ShoppingBag, ShoppingCart, User as UserIcon, Search, LogOut, ChevronDown, X, Heart, Store, ArrowUpRight, LifeBuoy } from 'lucide-react';

/** Catalog snapshot used for instant search suggestions and the category strip (loaded once). */
let catalogCache: Promise<{ products: Product[]; categories: Category[] }> | null = null;
const loadCatalog = () => {
  catalogCache ??= Promise.all([
    getDocuments<Product>(COLLECTION.PRODUCTS, [where('status', '==', 'published')]).catch(() => [] as Product[]),
    getDocuments<Category>(COLLECTION.CATEGORIES, [where('isActive', '==', true)]).catch(() => [] as Category[]),
  ]).then(([products, categories]) => ({ products, categories: categories.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) }));
  return catalogCache;
};

export const Header: React.FC = () => {
  const { user, profile, signOutUser } = useAuth();
  const { itemCount } = useCart();
  const { count: wishCount } = useWishlist();
  const { settings } = useSettings();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [catalog, setCatalog] = useState<{ products: Product[]; categories: Category[] }>({ products: [], categories: [] });
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    loadCatalog().then((c) => alive && setCatalog(c));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;
    const close = (e: Event) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [dropdownOpen]);
  useEffect(() => {
    setDropdownOpen(false);
    setFocused(false);
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname === '/search') setSearchQuery(new URLSearchParams(location.search).get('q') ?? '');
  }, [location.pathname, location.search]);

  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return { products: [] as Product[], cats: [] as Category[] };
    return {
      products: catalog.products.filter((p) => p.name.toLowerCase().includes(q) || p.tags?.some((t) => t.toLowerCase().includes(q))).slice(0, 5),
      cats: catalog.categories.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 2),
    };
  }, [searchQuery, catalog]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setFocused(false);
      (document.activeElement as HTMLElement | null)?.blur();
    }
  };

  const threshold = settings.freeDeliveryThreshold > 0 ? Math.round(settings.freeDeliveryThreshold / 100) : 0;
  const initial = profile?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U';
  const showSuggest = focused && searchQuery.trim().length >= 2;

  const searchBox = (cls: string) => (
    <form onSubmit={handleSearch} role="search" className={cls}>
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Search products, stores, categories"
          value={searchQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-10 md:h-11 pl-10 pr-9 rounded-xl md:rounded-2xl bg-slate-100 border border-transparent text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-400 [&::-webkit-search-cancel-button]:hidden"
        />
        {searchQuery && (
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setSearchQuery('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        )}
        {showSuggest && (
          <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden z-50 animate-[slideUp_.12s_ease-out]">
            {suggestions.products.length === 0 && suggestions.cats.length === 0 ? (
              <p className="px-4 py-5 text-sm text-slate-500">No matches for “{searchQuery}”. Press enter to search everything.</p>
            ) : (
              <>
                {suggestions.cats.map((c) => (
                  <Link key={c.id} to={`/products?cat=${c.slug}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-sm">
                    <span className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center"><Search className="w-4 h-4" /></span>
                    <span className="flex-1">in <b>{c.name}</b></span>
                    <ArrowUpRight className="w-4 h-4 text-slate-300" />
                  </Link>
                ))}
                {suggestions.products.map((p) => (
                  <Link key={p.id} to={`/product/${p.slug}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                    <span className="w-9 h-9 rounded-lg bg-slate-100 overflow-hidden shrink-0">{p.images?.[0] && <img src={p.images[0]} alt="" className="w-full h-full object-cover" />}</span>
                    <span className="flex-1 min-w-0 text-sm font-medium text-slate-800 truncate">{p.name}</span>
                    <span className="text-sm font-bold text-slate-900">{formatMoney(p.basePrice)}</span>
                  </Link>
                ))}
                <button type="submit" className="w-full text-left px-4 py-3 text-sm font-bold text-primary-600 border-t border-slate-100 hover:bg-slate-50">
                  See all results for “{searchQuery}”
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </form>
  );

  const iconBtn = 'relative w-10 h-10 flex items-center justify-center text-slate-700 hover:text-primary-600 hover:bg-slate-100 rounded-xl transition-colors';
  const bubble = 'absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white';

  return (
    <>
      {threshold > 0 && (
        <div className="bg-slate-950 text-white text-[11px] sm:text-xs py-1.5 px-4 text-center truncate">
          Free delivery on orders over ₹{threshold.toLocaleString('en-IN')} · Cash on delivery available
        </div>
      )}

      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-[68px] gap-3 md:gap-6">
            <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="Home">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-black text-lg md:text-xl shadow-md shadow-primary-600/30">P</div>
              <span className="font-extrabold text-base md:text-lg tracking-tight leading-none whitespace-nowrap">
                <span className="text-slate-900">POEAGE</span>
                <span className="text-primary-600 ml-1">HUB</span>
              </span>
            </Link>

            {searchBox('hidden md:block flex-1 max-w-xl')}

            <div className="flex items-center gap-0.5 sm:gap-1.5">
              <Link to="/stores" className="hidden lg:inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-primary-600">
                <Store className="w-4 h-4" /> Stores
              </Link>
              <Link to="/wishlist" aria-label={`Wishlist, ${wishCount} saved`} className={`${iconBtn} hidden sm:flex`}>
                <Heart className="w-5 h-5" />
                {wishCount > 0 && <span className={`${bubble} bg-rose-500`}>{wishCount > 9 ? '9+' : wishCount}</span>}
              </Link>
              <Link to="/cart" aria-label={`Cart, ${itemCount} items`} className={iconBtn}>
                <ShoppingCart className="w-5 h-5" />
                {itemCount > 0 && <span className={`${bubble} bg-primary-600`}>{itemCount > 9 ? '9+' : itemCount}</span>}
              </Link>

              {user ? (
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setDropdownOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={dropdownOpen}
                    className="flex items-center gap-1.5 h-10 pl-1 pr-1.5 sm:pr-2.5 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <span className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 text-primary-700 font-bold flex items-center justify-center text-xs">{initial}</span>
                    <span className="hidden sm:inline max-w-[100px] truncate text-sm font-semibold text-slate-700">{profile?.displayName || 'Account'}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {dropdownOpen && (
                    <div role="menu" className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl py-2 z-50 animate-[slideUp_.15s_ease-out]">
                      <div className="px-4 py-2.5 border-b border-slate-100">
                        <p className="text-[11px] text-slate-500">Signed in as</p>
                        <p className="text-sm font-semibold text-slate-900 truncate">{user.email}</p>
                      </div>
                      {[
                        { to: '/account/profile', icon: UserIcon, label: 'Profile & addresses' },
                        { to: '/account/orders', icon: ShoppingBag, label: 'My orders' },
                        { to: '/wishlist', icon: Heart, label: 'Wishlist' },
                        { to: '/support', icon: LifeBuoy, label: 'Help & support' },
                      ].map(({ to, icon: Icon, label }) => (
                        <Link key={to} to={to} className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 active:bg-slate-100">
                          <Icon className="w-4 h-4 text-slate-400" /> {label}
                        </Link>
                      ))}
                      <div className="border-t border-slate-100 my-1" />
                      <button onClick={() => { setDropdownOpen(false); void signOutUser(); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 text-left">
                        <LogOut className="w-4 h-4" /> Sign out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Link to="/login"><Button variant="ghost" size="sm" className="px-3">Sign in</Button></Link>
                  <Link to="/register" className="hidden sm:block"><Button variant="primary" size="sm" className="rounded-xl">Register</Button></Link>
                </div>
              )}
            </div>
          </div>

          {searchBox('md:hidden pb-2.5')}
        </div>

        {/* Category strip (desktop) */}
        {catalog.categories.length > 0 && (
          <nav aria-label="Categories" className="hidden md:block border-t border-slate-100">
            <div className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center gap-1 overflow-x-auto no-scrollbar h-11">
              <NavLink to="/products" end className={({ isActive }) => `shrink-0 px-3 py-1.5 rounded-lg text-[13px] font-bold ${isActive && !location.search ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>All</NavLink>
              {catalog.categories.map((c) => (
                <Link key={c.id} to={`/products?cat=${c.slug}`} className={`shrink-0 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${new URLSearchParams(location.search).get('cat') === c.slug ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
                  {c.name}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </header>
    </>
  );
};
