import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { getDocuments, where, friendlyError } from '@poeage/firebase-client';
import { COLLECTION, APP_CONFIG } from '@poeage/config';
import type { Product, Category, Vendor, Banner } from '@poeage/types';
import { formatMoney } from '@poeage/utils';
import {
  Sparkles,
  ArrowRight,
  Tag,
  Truck,
  ShieldCheck,
  Banknote,
  RotateCcw,
  Flame,
  Clock,
  Store as StoreIcon,
  Star,
  ChevronLeft,
  ChevronRight,
  Package,
} from 'lucide-react';
import { SectionHead, ProductRail } from '../components/shop/Sections';
import { discountPct } from '../components/shop/ProductCard';

const ms = (t: any): number => (t?.toDate ? t.toDate().getTime() : 0);

/* ------------------------------ Hero / banner slider ------------------------------ */
const HeroSlider: React.FC<{ banners: Banner[]; signedIn: boolean; freeAbove: string }> = ({ banners, signedIn, freeAbove }) => {
  const [i, setI] = useState(0);
  const slides = banners.length;
  useEffect(() => {
    if (slides < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides), 5500);
    return () => clearInterval(t);
  }, [slides]);

  if (slides > 0) {
    const b = banners[i % slides]!;
    const Wrap: any = b.linkURL ? (b.linkURL.startsWith('http') ? 'a' : Link) : 'div';
    const wrapProps = b.linkURL ? (b.linkURL.startsWith('http') ? { href: b.linkURL } : { to: b.linkURL }) : {};
    return (
      <div className="relative rounded-3xl overflow-hidden bg-slate-200 aspect-[16/8] sm:aspect-[16/6] shadow-sm">
        {banners.map((x, idx) => (
          <Wrap key={x.id} {...wrapProps} className={`absolute inset-0 transition-opacity duration-700 ${idx === i % slides ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <img src={x.imageURL} alt={x.title} className="w-full h-full object-cover" />
          </Wrap>
        ))}
        {slides > 1 && (
          <>
            <button aria-label="Previous slide" onClick={() => setI((x) => (x - 1 + slides) % slides)} className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow items-center justify-center hover:bg-white"><ChevronLeft className="w-5 h-5" /></button>
            <button aria-label="Next slide" onClick={() => setI((x) => (x + 1) % slides)} className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow items-center justify-center hover:bg-white"><ChevronRight className="w-5 h-5" /></button>
            <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
              {banners.map((x, idx) => (
                <button key={x.id} aria-label={`Slide ${idx + 1}`} onClick={() => setI(idx)} className={`h-1.5 rounded-full transition-all ${idx === i % slides ? 'w-6 bg-white' : 'w-1.5 bg-white/60'}`} />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-3xl bg-slate-950 text-white">
      <div className="absolute -top-24 -right-16 w-[28rem] h-[28rem] rounded-full bg-primary-600/40 blur-3xl" />
      <div className="absolute -bottom-32 -left-10 w-[24rem] h-[24rem] rounded-full bg-fuchsia-600/25 blur-3xl" />
      <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="relative px-5 sm:px-12 py-7 sm:py-16 lg:py-20 grid lg:grid-cols-[1.2fr_1fr] gap-10 items-center">
        <div className="space-y-3.5 sm:space-y-6">
          <span className="inline-flex items-center gap-2 bg-white/10 border border-white/15 backdrop-blur px-3.5 py-1.5 rounded-full text-xs font-semibold text-primary-200">
            <Sparkles className="w-3.5 h-3.5" /> One cart · Many trusted sellers
          </span>
          <h1 className="text-[1.9rem] leading-[1.1] sm:text-5xl lg:text-6xl font-black tracking-tight">
            Discover great stuff.
            <br />
            <span className="bg-gradient-to-r from-primary-300 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent">Delivered fast.</span>
          </h1>
          <p className="text-slate-300 text-sm sm:text-lg max-w-xl leading-relaxed line-clamp-3 sm:line-clamp-none">
            Shop verified products from independent sellers near you. Pay on delivery, track every step, and enjoy free delivery above {freeAbove}.
          </p>
          <div className="flex gap-2.5 sm:gap-3 pt-1">
            <Link to="/products" className="inline-flex items-center gap-2 h-11 sm:h-12 px-5 sm:px-6 rounded-2xl bg-white text-slate-900 font-bold text-sm sm:text-base shadow-lg shadow-black/20 hover:bg-primary-50 active:scale-[0.98] transition">
              Start shopping <ArrowRight className="w-4 h-4" />
            </Link>
            {!signedIn && (
              <Link to="/register" className="inline-flex items-center h-11 sm:h-12 px-4 sm:px-6 rounded-2xl border border-white/25 bg-white/5 font-semibold text-sm sm:text-base hover:bg-white/10 transition">
                Sign up free
              </Link>
            )}
          </div>
        </div>
        <div className="hidden lg:grid grid-cols-2 gap-4">
          {[
            { icon: ShieldCheck, t: 'Verified sellers', d: 'Every store is reviewed' },
            { icon: Banknote, t: 'Cash on delivery', d: 'Pay when it arrives' },
            { icon: Truck, t: 'Live tracking', d: 'From store to doorstep' },
            { icon: RotateCcw, t: 'Easy returns', d: 'Hassle-free policy' },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-2xl bg-white/[0.07] border border-white/10 backdrop-blur p-5">
              <Icon className="w-6 h-6 text-primary-300" />
              <p className="mt-3 font-bold">{t}</p>
              <p className="text-xs text-slate-400 mt-0.5">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ------------------------------------- Page ------------------------------------- */
export const HomePage: React.FC = () => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [cats, prods, vends, bans] = await Promise.all([
          getDocuments<Category>(COLLECTION.CATEGORIES, [where('isActive', '==', true)]),
          getDocuments<Product>(COLLECTION.PRODUCTS, [where('status', '==', 'published')]),
          getDocuments<Vendor>(COLLECTION.VENDORS, [where('status', '==', 'approved')]).catch(() => [] as Vendor[]),
          getDocuments<Banner>(COLLECTION.BANNERS, [where('isActive', '==', true)]).catch(() => [] as Banner[]),
        ]);
        setCategories(cats.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
        setProducts(prods);
        setVendors(vends);
        setBanners(bans.filter((b) => b.imageURL).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
      } catch (err) {
        console.error('Failed to load storefront:', err);
        setLoadError(friendlyError(err, 'Failed to load storefront data.'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const storeNames = useMemo(() => Object.fromEntries(vendors.map((v) => [v.id, v.storeName])), [vendors]);
  const deals = useMemo(() => products.filter((p) => discountPct(p) > 0).sort((a, b) => discountPct(b) - discountPct(a)).slice(0, 12), [products]);
  const fresh = useMemo(() => [...products].sort((a, b) => ms(b.createdAt) - ms(a.createdAt)).slice(0, 12), [products]);
  const popular = useMemo(
    () => [...products].sort((a, b) => (b.metadata?.totalSold ?? 0) + (b.isFeatured ? 100 : 0) - ((a.metadata?.totalSold ?? 0) + (a.isFeatured ? 100 : 0))).slice(0, 12),
    [products],
  );
  const countFor = (c: Category) => products.filter((p) => p.categoryId === c.slug || p.categoryId === c.id).length;
  const freeAbove = formatMoney(settings.freeDeliveryThreshold || 0).replace(/\.00$/, '');

  const trust = [
    { icon: Truck, t: settings.freeDeliveryThreshold > 0 ? `Free delivery ${freeAbove}+` : 'Fast delivery', d: 'Doorstep in days' },
    { icon: Banknote, t: 'Cash on delivery', d: 'Pay when you receive' },
    { icon: ShieldCheck, t: 'Verified sellers', d: 'Authentic products' },
    { icon: RotateCcw, t: 'Easy returns', d: 'Hassle-free policy' },
  ];

  return (
    <div className="pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-10 sm:space-y-14">
        <HeroSlider banners={banners} signedIn={!!user} freeAbove={freeAbove} />

        {/* Trust strip */}
        <div className="-mt-4 sm:-mt-6 flex lg:grid lg:grid-cols-4 gap-2.5 sm:gap-4 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          {trust.map(({ icon: Icon, t, d }) => (
            <div key={t} className="shrink-0 min-w-[200px] lg:min-w-0 flex items-center gap-3 rounded-2xl bg-white border border-slate-200/80 px-3.5 py-3 sm:px-4 sm:py-3.5">
              <span className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></span>
              <span className="min-w-0">
                <span className="block text-[13px] sm:text-sm font-bold text-slate-900 leading-tight">{t}</span>
                <span className="block text-[11px] sm:text-xs text-slate-500 truncate">{d}</span>
              </span>
            </div>
          ))}
        </div>

        {loadError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{loadError}</p>}

        {/* Categories */}
        {(loading || categories.length > 0) && (
          <section>
            <SectionHead title="Shop by category" subtitle="Find exactly what you're looking for" to="/products" linkLabel="All products" />
            <div className="flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 pb-2 sm:flex-wrap">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="shrink-0 w-[76px] sm:w-28 animate-pulse"><div className="w-[76px] h-[76px] sm:w-28 sm:h-28 rounded-full bg-slate-200" /><div className="h-3 w-14 mx-auto bg-slate-200 rounded mt-3" /></div>)
                : categories.map((cat) => (
                    <Link key={cat.id} to={`/products?cat=${cat.slug}`} className="group shrink-0 w-[76px] sm:w-28 text-center">
                      <span className="block w-[76px] h-[76px] sm:w-28 sm:h-28 rounded-full overflow-hidden bg-gradient-to-br from-primary-50 to-slate-100 border border-slate-200 group-hover:border-primary-300 group-hover:shadow-lg transition flex items-center justify-center text-primary-500">
                        {cat.imageURL ? <img src={cat.imageURL} alt="" className="w-full h-full object-cover group-hover:scale-110 transition duration-500" /> : <Tag className="w-7 h-7 sm:w-9 sm:h-9" />}
                      </span>
                      <span className="mt-2.5 block text-[12px] sm:text-sm font-semibold text-slate-800 leading-tight line-clamp-2 group-hover:text-primary-700">{cat.name}</span>
                      <span className="block text-[10px] sm:text-xs text-slate-400 mt-0.5">{countFor(cat)} {countFor(cat) === 1 ? 'item' : 'items'}</span>
                    </Link>
                  ))}
            </div>
          </section>
        )}

        {/* Deals */}
        {(loading || deals.length > 0) && (
          <section>
            <SectionHead title="Today's deals" subtitle="Biggest savings from verified sellers" to="/products?sort=discount" icon={<Flame className="w-5 h-5" />} />
            <ProductRail products={deals} loading={loading} storeNames={storeNames} />
          </section>
        )}

        {/* New arrivals */}
        {(loading || fresh.length > 0) && (
          <section>
            <SectionHead title="New arrivals" subtitle="Just landed in the marketplace" to="/products?sort=new" icon={<Clock className="w-5 h-5" />} />
            <ProductRail products={fresh} loading={loading} storeNames={storeNames} />
          </section>
        )}

        {/* Promo band */}
        <section className="grid md:grid-cols-2 gap-4">
          <a href={APP_CONFIG.urls.vendor} className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white p-7 sm:p-9">
            <StoreIcon className="absolute -right-4 -bottom-4 w-36 h-36 text-white/10 group-hover:scale-110 transition duration-500" />
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-200">For businesses</p>
            <h3 className="mt-2 text-2xl font-extrabold">Sell on {settings.platformName}</h3>
            <p className="mt-1.5 text-emerald-100 text-sm max-w-xs">Open your store, list products and reach customers across the city.</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold bg-white text-emerald-800 px-4 py-2 rounded-xl">Become a seller <ArrowRight className="w-4 h-4" /></span>
          </a>
          <a href={APP_CONFIG.urls.driver} className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800 to-slate-950 text-white p-7 sm:p-9">
            <Truck className="absolute -right-4 -bottom-4 w-36 h-36 text-white/5 group-hover:scale-110 transition duration-500" />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">For riders</p>
            <h3 className="mt-2 text-2xl font-extrabold">Deliver &amp; earn</h3>
            <p className="mt-1.5 text-slate-300 text-sm max-w-xs">Pick your own hours and earn on every delivery you complete.</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold bg-white text-slate-900 px-4 py-2 rounded-xl">Join as a driver <ArrowRight className="w-4 h-4" /></span>
          </a>
        </section>

        {/* Popular */}
        {(loading || popular.length > 0) && (
          <section>
            <SectionHead title="Popular right now" subtitle="Customer favourites and bestsellers" to="/products" icon={<Star className="w-5 h-5" />} />
            <ProductRail products={popular} loading={loading} storeNames={storeNames} />
          </section>
        )}

        {/* Stores */}
        {vendors.length > 0 && (
          <section>
            <SectionHead title="Top stores" subtitle="Shop directly from trusted sellers" to="/stores" icon={<StoreIcon className="w-5 h-5" />} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {vendors.slice(0, 4).map((v) => (
                <Link key={v.id} to={`/store/${v.id}`} className="group rounded-2xl bg-white border border-slate-200/80 p-4 sm:p-5 text-center hover:shadow-lg hover:border-slate-300 transition">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 text-primary-700 font-black text-2xl flex items-center justify-center overflow-hidden">
                    {v.logoURL ? <img src={v.logoURL} alt="" className="w-full h-full object-cover" /> : v.storeName?.[0]?.toUpperCase()}
                  </div>
                  <p className="mt-3 font-bold text-slate-900 truncate group-hover:text-primary-700">{v.storeName}</p>
                  <p className="text-xs text-slate-500 inline-flex items-center gap-1 mt-0.5"><Package className="w-3 h-3" /> {products.filter((p) => p.vendorId === v.id).length} {products.filter((p) => p.vendorId === v.id).length === 1 ? 'product' : 'products'}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {!loading && products.length === 0 && (
          <div className="text-center py-16 text-slate-500">No products are published yet. Check back soon.</div>
        )}
      </div>
    </div>
  );
};
