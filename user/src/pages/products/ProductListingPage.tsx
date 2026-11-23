import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getDocuments, where, friendlyError } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Product, Category, Vendor } from '@poeage/types';
import { SlidersHorizontal, X, SearchX, Check, Star } from 'lucide-react';
import { ProductCard, ProductCardSkeleton, discountPct } from '../../components/shop/ProductCard';

type Sort = 'relevance' | 'new' | 'price_asc' | 'price_desc' | 'rating' | 'discount' | 'popular';
const SORTS: { v: Sort; l: string }[] = [
  { v: 'relevance', l: 'Relevance' },
  { v: 'new', l: 'Newest first' },
  { v: 'price_asc', l: 'Price: low to high' },
  { v: 'price_desc', l: 'Price: high to low' },
  { v: 'rating', l: 'Top rated' },
  { v: 'discount', l: 'Biggest discount' },
  { v: 'popular', l: 'Best selling' },
];
const PAGE = 24;
const ms = (t: any): number => (t?.toDate ? t.toDate().getTime() : 0);
const rupees = (paise: number) => Math.round(paise / 100);

export const ProductListingPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const cat = params.get('cat') ?? 'all';
  const sort = (params.get('sort') as Sort) || 'relevance';
  const store = params.get('store') ?? '';
  const min = params.get('min') ?? '';
  const max = params.get('max') ?? '';
  const onlyOffers = params.get('offers') === '1';
  const minRating = Number(params.get('rating') ?? 0);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [visible, setVisible] = useState(PAGE);

  useEffect(() => {
    (async () => {
      try {
        const [p, c, v] = await Promise.all([
          getDocuments<Product>(COLLECTION.PRODUCTS, [where('status', '==', 'published')]),
          getDocuments<Category>(COLLECTION.CATEGORIES, [where('isActive', '==', true)]),
          getDocuments<Vendor>(COLLECTION.VENDORS, [where('status', '==', 'approved')]).catch(() => [] as Vendor[]),
        ]);
        setProducts(p);
        setCategories(c.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
        setVendors(v);
      } catch (err) {
        console.error('Failed to load catalog:', err);
        setError(friendlyError(err, 'Failed to load the catalog.'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => setVisible(PAGE), [q, cat, sort, store, min, max, onlyOffers, minRating]);
  useEffect(() => {
    document.body.style.overflow = sheet ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sheet]);

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, val]) => (val ? next.set(k, val) : next.delete(k)));
    setParams(next, { replace: true });
  };

  const storeNames = useMemo(() => Object.fromEntries(vendors.map((v) => [v.id, v.storeName])), [vendors]);
  const catObj = categories.find((c) => c.slug === cat || c.id === cat);

  const filtered = useMemo(() => {
    const lq = q.trim().toLowerCase();
    const lo = min ? Number(min) * 100 : 0;
    const hi = max ? Number(max) * 100 : Infinity;
    let list = products.filter((p) => {
      if (cat !== 'all' && p.categoryId !== cat && p.categoryId !== catObj?.id && p.categoryId !== catObj?.slug) return false;
      if (store && p.vendorId !== store) return false;
      if (p.basePrice < lo || p.basePrice > hi) return false;
      if (onlyOffers && discountPct(p) === 0) return false;
      if (minRating && (p.metadata?.averageRating ?? 0) < minRating) return false;
      if (lq && !(p.name.toLowerCase().includes(lq) || p.tags?.some((t) => t.toLowerCase().includes(lq)) || p.description?.toLowerCase().includes(lq) || (storeNames[p.vendorId] ?? '').toLowerCase().includes(lq))) return false;
      return true;
    });
    const rel = (p: Product) => (lq ? (p.name.toLowerCase().startsWith(lq) ? 2 : p.name.toLowerCase().includes(lq) ? 1 : 0) : 0) + (p.isFeatured ? 0.5 : 0);
    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'new': return ms(b.createdAt) - ms(a.createdAt);
        case 'price_asc': return a.basePrice - b.basePrice;
        case 'price_desc': return b.basePrice - a.basePrice;
        case 'rating': return (b.metadata?.averageRating ?? 0) - (a.metadata?.averageRating ?? 0);
        case 'discount': return discountPct(b) - discountPct(a);
        case 'popular': return (b.metadata?.totalSold ?? 0) - (a.metadata?.totalSold ?? 0);
        default: return rel(b) - rel(a);
      }
    });
    return list;
  }, [products, q, cat, catObj, store, min, max, onlyOffers, minRating, sort, storeNames]);

  const activeChips: { k: string; label: string; clear: Record<string, null> }[] = [];
  if (catObj) activeChips.push({ k: 'cat', label: catObj.name, clear: { cat: null } });
  if (store) activeChips.push({ k: 'store', label: storeNames[store] ?? 'Store', clear: { store: null } });
  if (min || max) activeChips.push({ k: 'price', label: `₹${min || 0} – ${max ? '₹' + max : 'any'}`, clear: { min: null, max: null } });
  if (onlyOffers) activeChips.push({ k: 'offers', label: 'On offer', clear: { offers: null } });
  if (minRating) activeChips.push({ k: 'rating', label: `${minRating}★ & up`, clear: { rating: null } });

  const maxPrice = useMemo(() => rupees(Math.max(0, ...products.map((p) => p.basePrice))), [products]);
  const priceBands = [
    { l: 'Under ₹500', min: null, max: '500' },
    { l: '₹500 – ₹1,000', min: '500', max: '1000' },
    { l: '₹1,000 – ₹5,000', min: '1000', max: '5000' },
    { l: 'Over ₹5,000', min: '5000', max: null },
  ];

  const FilterBody = (
    <div className="space-y-7">
      <div>
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">Category</h3>
        <div className="space-y-0.5">
          {[{ slug: 'all', name: 'All products', id: 'all' }, ...categories].map((c) => {
            const active = c.slug === 'all' ? !catObj : catObj?.id === c.id;
            return (
              <button key={c.id} onClick={() => set({ cat: c.slug === 'all' ? null : c.slug })} className={`w-full flex items-center justify-between text-left px-3 py-2.5 rounded-xl text-sm transition ${active ? 'bg-primary-50 text-primary-700 font-bold' : 'text-slate-700 hover:bg-slate-100'}`}>
                {c.name}
                {active && <Check className="w-4 h-4" />}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">Price</h3>
        <div className="flex items-center gap-2">
          <input type="number" inputMode="numeric" min={0} placeholder="Min" value={min} onChange={(e) => set({ min: e.target.value || null })} className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500" />
          <span className="text-slate-400">–</span>
          <input type="number" inputMode="numeric" min={0} placeholder={maxPrice ? String(maxPrice) : 'Max'} value={max} onChange={(e) => set({ max: e.target.value || null })} className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {priceBands.map((b) => {
            const on = (b.min ?? '') === min && (b.max ?? '') === max;
            return <button key={b.l} onClick={() => set({ min: on ? null : b.min, max: on ? null : b.max })} className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${on ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}>{b.l}</button>;
          })}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">Customer rating</h3>
        <div className="flex flex-wrap gap-2">
          {[4, 3, 2].map((r) => (
            <button key={r} onClick={() => set({ rating: minRating === r ? null : String(r) })} className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border transition ${minRating === r ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}>
              {r} <Star className="w-3 h-3 fill-current" /> & up
            </button>
          ))}
        </div>
      </div>

      {vendors.length > 1 && (
        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">Store</h3>
          <div className="space-y-0.5">
            {vendors.map((v) => (
              <button key={v.id} onClick={() => set({ store: store === v.id ? null : v.id })} className={`w-full flex items-center justify-between text-left px-3 py-2.5 rounded-xl text-sm transition ${store === v.id ? 'bg-primary-50 text-primary-700 font-bold' : 'text-slate-700 hover:bg-slate-100'}`}>
                <span className="truncate">{v.storeName}</span>
                {store === v.id && <Check className="w-4 h-4 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 cursor-pointer">
        <span className="text-sm font-semibold text-slate-800">Only items on offer</span>
        <input type="checkbox" checked={onlyOffers} onChange={(e) => set({ offers: e.target.checked ? '1' : null })} className="w-4 h-4 accent-indigo-600" />
      </label>
    </div>
  );

  const title = q ? `Results for “${q}”` : catObj ? catObj.name : 'All products';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      <nav className="hidden sm:flex items-center gap-2 text-xs text-slate-500 mb-3" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-primary-600">Home</Link>/<Link to="/products" className="hover:text-primary-600">Products</Link>{catObj && <>/<span className="text-slate-800 font-semibold">{catObj.name}</span></>}
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4 mb-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-slate-900 break-words">{title}</h1>
          <p className="text-sm text-slate-500 mt-1">{loading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? 'product' : 'products'}`}</p>
        </div>
        <div className="flex items-center gap-2 sm:shrink-0">
          <button onClick={() => setSheet(true)} className="md:hidden inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold">
            <SlidersHorizontal className="w-4 h-4" /> Filters{activeChips.length > 0 && <span className="w-5 h-5 rounded-full bg-primary-600 text-white text-[11px] flex items-center justify-center">{activeChips.length}</span>}
          </button>
          <select value={sort} onChange={(e) => set({ sort: e.target.value === 'relevance' ? null : e.target.value })} aria-label="Sort by" className="h-10 flex-1 sm:flex-none rounded-xl border border-slate-300 bg-white pl-3 pr-8 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500/30">
            {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </div>
      </div>

      {/* Phone category chips */}
      <div className="md:hidden -mx-4 px-4 overflow-x-auto no-scrollbar mb-3">
        <div className="flex gap-2 w-max pb-1">
          {[{ id: 'all', slug: 'all', name: 'All' }, ...categories].map((c) => {
            const active = c.slug === 'all' ? !catObj : catObj?.id === c.id;
            return <button key={c.id} onClick={() => set({ cat: c.slug === 'all' ? null : c.slug })} className={`px-4 h-9 rounded-full text-[13px] font-semibold whitespace-nowrap border transition ${active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'}`}>{c.name}</button>;
          })}
        </div>
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {activeChips.map((c) => (
            <button key={c.k} onClick={() => set(c.clear)} className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-primary-50 text-primary-700 text-xs font-bold hover:bg-primary-100">
              {c.label} <X className="w-3.5 h-3.5" />
            </button>
          ))}
          <button onClick={() => setParams(q ? { q } : {}, { replace: true })} className="text-xs font-bold text-slate-500 hover:text-slate-800 underline ml-1">Clear all</button>
        </div>
      )}

      <div className="grid md:grid-cols-[250px_1fr] gap-8">
        <aside className="hidden md:block">
          <div className="sticky top-32 rounded-2xl bg-white border border-slate-200/80 p-5 max-h-[calc(100vh-9rem)] overflow-y-auto">{FilterBody}</div>
        </aside>

        <section>
          {error ? (
            <div className="rounded-2xl bg-white border border-red-200 text-center py-14 px-6">
              <h2 className="font-bold text-red-600">Could not load the catalog</h2>
              <p className="text-sm text-slate-500 mt-1">{error}</p>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">{Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl bg-white border border-slate-200 text-center py-16 px-6">
              <span className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto"><SearchX className="w-8 h-8" /></span>
              <h2 className="mt-4 text-lg font-bold text-slate-900">No products found</h2>
              <p className="text-sm text-slate-500 mt-1">Try a different search or remove some filters.</p>
              {(activeChips.length > 0 || q) && <button onClick={() => setParams({}, { replace: true })} className="mt-5 h-11 px-5 rounded-xl bg-primary-600 text-white font-bold hover:bg-primary-700">Reset everything</button>}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
                {filtered.slice(0, visible).map((p) => <ProductCard key={p.id} product={p} storeName={storeNames[p.vendorId]} />)}
              </div>
              {visible < filtered.length && (
                <div className="mt-8 text-center">
                  <button onClick={() => setVisible((v) => v + PAGE)} className="h-11 px-7 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 hover:border-slate-900">
                    Load more ({filtered.length - visible} left)
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* Phone filter sheet */}
      {sheet && (
        <div className="md:hidden fixed inset-0 z-[60] flex items-end">
          <div className="absolute inset-0 bg-slate-950/50 animate-[fadeIn_.15s_ease-out]" onClick={() => setSheet(false)} />
          <div className="relative w-full max-h-[88vh] bg-white rounded-t-3xl flex flex-col animate-[slideUp_.2s_ease-out]">
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-slate-300" />
            <div className="flex items-center justify-between px-5 py-3">
              <h2 className="text-lg font-extrabold">Filters</h2>
              <button onClick={() => setSheet(false)} aria-label="Close" className="p-2 -mr-2 text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-5 pb-4 overflow-y-auto">{FilterBody}</div>
            <div className="p-4 border-t border-slate-100 pb-safe flex gap-3">
              <button onClick={() => setParams(q ? { q } : {}, { replace: true })} className="flex-1 h-12 rounded-xl border border-slate-300 font-bold">Clear</button>
              <button onClick={() => setSheet(false)} className="flex-[2] h-12 rounded-xl bg-primary-600 text-white font-bold">Show {filtered.length} results</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
