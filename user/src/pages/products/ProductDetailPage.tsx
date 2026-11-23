import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { getDocuments, getDocument, where, friendlyError } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Product, Vendor, Category } from '@poeage/types';
import { formatMoney } from '@poeage/utils';
import { useSettings } from '../../context/SettingsContext';
import { useWishlist } from '../../context/WishlistContext';
import { ProductReviews } from '../../components/shop/ProductReviews';
import { ProductRail, SectionHead } from '../../components/shop/Sections';
import { Button, Card, CardContent, Badge, Spinner } from '@poeage/ui';
import {
  Star,
  Truck,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Zap,
  CheckCircle,
  ArrowLeft,
  Heart,
  Share2,
  Store as StoreIcon,
  BadgeCheck,
  Package,
} from 'lucide-react';

export const ProductDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [addedNotice, setAddedNotice] = useState(false);
  const [slide, setSlide] = useState(0);
  const slider = useRef<HTMLDivElement>(null);
  const { settings } = useSettings();
  const { has, toggle } = useWishlist();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [related, setRelated] = useState<{ store: Product[]; similar: Product[] }>({ store: [], similar: [] });
  const [shared, setShared] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        let match: Product | null = null;
        if (slug) {
          const bySlug = await getDocuments<Product>(COLLECTION.PRODUCTS, [
            where('status', '==', 'published'),
            where('slug', '==', slug),
          ]);
          match = bySlug[0] ?? null;
          if (!match) {
            const byId = await getDocument<Product>(COLLECTION.PRODUCTS, slug).catch(() => null);
            if (byId && byId.status === 'published') match = byId;
          }
        }
        setProduct(match);
        setSelectedImage(match?.images?.[0] ?? '');
      } catch (err) {
        console.error('Failed to load product:', err);
        setLoadError(friendlyError(err, 'Failed to load product.'));
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [slug]);

  // Store, category and related products
  useEffect(() => {
    if (!product) return;
    let alive = true;
    (async () => {
      const [v, cats, all] = await Promise.all([
        getDocument<Vendor>(COLLECTION.VENDORS, product.vendorId).catch(() => null),
        getDocuments<Category>(COLLECTION.CATEGORIES, [where('isActive', '==', true)]).catch(() => [] as Category[]),
        getDocuments<Product>(COLLECTION.PRODUCTS, [where('status', '==', 'published')]).catch(() => [] as Product[]),
      ]);
      if (!alive) return;
      setVendor(v);
      setCategory(cats.find((c) => c.slug === product.categoryId || c.id === product.categoryId) ?? null);
      const others = all.filter((p) => p.id !== product.id);
      setRelated({
        store: others.filter((p) => p.vendorId === product.vendorId).slice(0, 10),
        similar: others.filter((p) => p.categoryId === product.categoryId && p.vendorId !== product.vendorId).slice(0, 10),
      });
    })();
    return () => {
      alive = false;
    };
  }, [product]);

  const share = async () => {
    if (!product) return;
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: product.name, url });
      else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        setTimeout(() => setShared(false), 1800);
      }
    } catch {
      /* cancelled */
    }
  };

  const handleAddToCart = () => {
    if (!product) return;
    addToCart(product, quantity);
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 2500);
  };

  const handleBuyNow = () => {
    if (!product) return;
    addToCart(product, quantity);
    navigate('/checkout');
  };

  if (loading) {
    return (
      <div className="py-32 text-center">
        <Spinner size="lg" className="mx-auto text-primary-600" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center space-y-3">
        <h1 className="text-xl font-bold text-gray-800">
          {loadError ? 'Could not load this product' : 'Product not found'}
        </h1>
        {loadError && <p className="text-xs text-red-600">{loadError}</p>}
        <Link to="/products" className="text-sm font-semibold text-primary-600 hover:text-primary-500">
          Back to catalog
        </Link>
      </div>
    );
  }

  const discountPercent = product.salePrice
    ? Math.round(((product.salePrice - product.basePrice) / product.salePrice) * 100)
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 pb-28 sm:pb-8 space-y-4 sm:space-y-8">
      {/* Breadcrumb */}
      <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
        <Link to="/" className="hover:text-primary-600">Home</Link>
        <span>/</span>
        <Link to="/products" className="hover:text-primary-600">Products</Link>
        <span>/</span>
        <Link to={`/products?cat=${category?.slug ?? product.categoryId}`} className="hover:text-primary-600">{category?.name ?? product.categoryId.replace(/-/g, ' ')}</Link>
        <span>/</span>
        <span className="text-gray-800 font-semibold truncate max-w-[260px]">{product.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-12">
        {/* Left Gallery */}
        <div className="space-y-4">
          {/* Phone: full-width swipeable photos */}
          <div className="sm:hidden -mx-4 relative">
            <div
              ref={slider}
              onScroll={(e) => {
                const el = e.currentTarget;
                setSlide(Math.round(el.scrollLeft / el.clientWidth));
              }}
              className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-gray-100"
            >
              {product.images?.length ? product.images.map((img, idx) => (
                <div key={idx} className="w-full flex-shrink-0 snap-center aspect-square">
                  <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" loading={idx === 0 ? 'eager' : 'lazy'} />
                </div>
              )) : (
                <div className="w-full flex-shrink-0 aspect-square flex flex-col items-center justify-center text-slate-300 gap-2"><Package className="w-14 h-14" /><span className="text-sm font-medium">No photo available</span></div>
              )}
            </div>
            {(product.images?.length ?? 0) > 1 && (
              <>
                <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
                  {product.images.map((_, i) => (
                    <span key={i} className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-5 bg-primary-600' : 'w-1.5 bg-white/80 shadow'}`} />
                  ))}
                </div>
                <span className="absolute top-3 right-3 text-[11px] font-bold bg-black/55 text-white rounded-full px-2.5 py-1">
                  {slide + 1}/{product.images.length}
                </span>
              </>
            )}
          </div>

          {/* Tablet and desktop */}
          <div className="hidden sm:block space-y-4">
            <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
              {selectedImage ? <img src={selectedImage} alt={product.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-2"><Package className="w-16 h-16" /><span className="text-sm font-medium">No photo available</span></div>}
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {product.images?.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(img)}
                  className={`w-20 h-20 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${
                    selectedImage === img ? 'border-primary-600 shadow-md scale-105' : 'border-gray-200 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Product Overview */}
        <div className="space-y-5 sm:space-y-6">
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-primary-600 uppercase tracking-widest">
                {category?.name ?? product.categoryId.replace(/-/g, ' ')}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => toggle(product.id)} aria-pressed={has(product.id)} aria-label="Save to wishlist" className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 active:scale-90 transition">
                  <Heart className={`w-5 h-5 ${has(product.id) ? 'fill-rose-500 text-rose-500' : 'text-slate-500'}`} />
                </button>
                <button onClick={share} aria-label="Share" className="relative w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 active:scale-90 transition">
                  <Share2 className="w-[18px] h-[18px] text-slate-500" />
                  {shared && <span className="absolute -bottom-7 right-0 text-[11px] font-bold bg-slate-900 text-white px-2 py-1 rounded-lg whitespace-nowrap">Link copied</span>}
                </button>
              </div>
            </div>
            <h1 className="text-xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-1 leading-snug break-words">
              {product.name}
            </h1>

            {/* Rating */}
            {(product.metadata?.totalRatings ?? 0) > 0 && (
              <div className="flex items-center gap-2 mt-3">
                <div className="flex items-center text-amber-500">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i < Math.floor(product.metadata?.averageRating ?? 0) ? 'fill-current' : 'text-gray-300'
                      }`}
                    />
                  ))}
                  <span className="font-bold text-gray-800 text-sm ml-2">
                    {product.metadata?.averageRating}
                  </span>
                </div>
                <a href="#reviews" className="text-xs text-primary-600 font-semibold hover:underline">({product.metadata?.totalRatings} {product.metadata?.totalRatings === 1 ? 'rating' : 'ratings'})</a>
              </div>
            )}
          </div>

          {/* Pricing */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-3xl font-black text-gray-900">
                ₹{(product.basePrice / 100).toLocaleString('en-IN')}
              </span>
              {product.salePrice && (
                <>
                  <span className="text-sm text-gray-400 line-through">
                    ₹{(product.salePrice / 100).toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                    Save {discountPercent}%
                  </span>
                </>
              )}
            </div>
            <p className="text-[11px] text-gray-500">Inclusive of all taxes.{settings.freeDeliveryThreshold > 0 ? ` Free delivery on orders over ${formatMoney(settings.freeDeliveryThreshold).replace(/\.00$/, '')}.` : ''}</p>
          </div>

          {/* Quantity & CTA */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-gray-700">Quantity:</span>
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  aria-label="Decrease quantity"
                  className="w-11 h-10 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 text-gray-600 hover:bg-gray-100 active:bg-gray-100 font-bold text-base sm:text-sm"
                >
                  −
                </button>
                <span className="w-10 sm:w-auto text-center sm:px-4 sm:py-1.5 font-bold text-sm text-gray-900">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(10, quantity + 1))}
                  aria-label="Increase quantity"
                  className="w-11 h-10 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 text-gray-600 hover:bg-gray-100 active:bg-gray-100 font-bold text-base sm:text-sm"
                >
                  +
                </button>
              </div>
              {vendor?.isOpen === false ? <Badge variant="warning">Store is not taking orders right now</Badge> : <Badge variant="success">Sold by {vendor?.storeName ?? 'a verified seller'}</Badge>}
            </div>

            {addedNotice && (
              <div role="status" className="fixed sm:static bottom-[84px] inset-x-3 sm:inset-auto z-40 p-3 bg-green-600 sm:bg-green-50 text-white sm:text-green-700 sm:border sm:border-green-200 rounded-xl sm:rounded-lg shadow-lg sm:shadow-none flex items-center gap-2 text-xs font-semibold animate-[slideUp_.2s_ease-out]">
                <CheckCircle className="w-4 h-4 sm:text-green-600 flex-shrink-0" />
                <span className="flex-1">Added to your cart</span>
                <Link to="/cart" className="underline sm:text-green-800 font-bold">View cart</Link>
              </div>
            )}

            <div className="hidden sm:flex flex-row gap-3 pt-2">
              <Button
                size="lg"
                onClick={handleAddToCart}
                className="flex-1 bg-primary-600 hover:bg-primary-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg"
              >
                <ShoppingCart className="w-5 h-5" />
                Add to Cart
              </Button>

              <Button
                size="lg"
                variant="secondary"
                onClick={handleBuyNow}
                className="flex-1 bg-slate-900 hover:bg-black text-white font-bold flex items-center justify-center gap-2"
              >
                <Zap className="w-5 h-5 text-amber-400" />
                Buy Now
              </Button>
            </div>
          </div>

          {/* Seller + delivery info (real values) */}
          {vendor && (
            <Link to={`/store/${vendor.id}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 hover:border-primary-300 hover:shadow-sm transition">
              <span className="w-12 h-12 rounded-xl bg-primary-50 text-primary-700 font-black text-lg flex items-center justify-center overflow-hidden shrink-0">
                {vendor.logoURL ? <img src={vendor.logoURL} alt="" className="w-full h-full object-cover" /> : (vendor.storeName?.[0]?.toUpperCase() ?? <StoreIcon className="w-5 h-5" />)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Sold by</span>
                <span className="flex items-center gap-1.5 font-bold text-slate-900 truncate">{vendor.storeName} <BadgeCheck className="w-4 h-4 text-primary-500 shrink-0" /></span>
              </span>
              <span className="text-xs font-bold text-primary-600 shrink-0">Visit store →</span>
            </Link>
          )}

          <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
            {[
              { icon: Truck, c: 'text-primary-600', t: 'Delivery', d: vendor?.prepTimeDays ? `Ships in ${vendor.prepTimeDays} day${vendor.prepTimeDays > 1 ? 's' : ''}` : 'Tracked delivery' },
              { icon: RotateCcw, c: 'text-amber-600', t: 'Returns', d: vendor?.returnWindowDays ? `${vendor.returnWindowDays}-day window` : 'Seller policy' },
              { icon: ShieldCheck, c: 'text-emerald-600', t: 'Verified', d: 'Reviewed seller' },
            ].map(({ icon: Icon, c, t, d }) => (
              <div key={t} className="rounded-xl bg-slate-50 py-3 px-1.5 space-y-1">
                <Icon className={`w-5 h-5 mx-auto ${c}`} />
                <p className="text-[11px] font-bold text-slate-900">{t}</p>
                <p className="text-[10px] text-slate-500 leading-tight">{d}</p>
              </div>
            ))}
          </div>

          {/* Description */}
          <div className="space-y-3">
            <h3 className="font-bold text-base text-gray-900">About this product</h3>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{product.description}</p>
            {(vendor?.returnPolicy || vendor?.shippingPolicy) && (
              <div className="rounded-xl bg-slate-50 p-4 space-y-2 text-xs text-slate-600">
                {vendor?.shippingPolicy && <p><b className="text-slate-800">Shipping:</b> {vendor.shippingPolicy}</p>}
                {vendor?.returnPolicy && <p><b className="text-slate-800">Returns:</b> {vendor.returnPolicy}</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pt-4 sm:pt-8 border-t border-slate-200"><ProductReviews product={product} /></div>

      {related.store.length > 0 && (
        <section className="pt-4">
          <SectionHead title={`More from ${vendor?.storeName ?? 'this store'}`} {...(vendor ? { to: `/store/${vendor.id}` } : {})} icon={<Package className="w-5 h-5" />} />
          <ProductRail products={related.store} />
        </section>
      )}
      {related.similar.length > 0 && (
        <section className="pt-4">
          <SectionHead title="You may also like" to={`/products?cat=${category?.slug ?? product.categoryId}`} />
          <ProductRail products={related.similar} />
        </section>
      )}

      {/* Phone: always-reachable buy bar */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,.06)] px-3 pt-2.5 pb-3 pb-safe flex items-center gap-3">
        <div className="min-w-0">
          <p className="text-[10px] text-gray-500 leading-none">Total</p>
          <p className="text-lg font-black text-gray-900 leading-tight">₹{((product.basePrice * quantity) / 100).toLocaleString('en-IN')}</p>
        </div>
        <button
          onClick={handleAddToCart}
          className="flex-1 h-12 rounded-xl border-2 border-primary-600 text-primary-600 font-bold text-sm flex items-center justify-center gap-1.5 active:bg-primary-50"
        >
          <ShoppingCart className="w-4 h-4" /> Add
        </button>
        <button
          onClick={handleBuyNow}
          className="flex-[1.3] h-12 rounded-xl bg-primary-600 text-white font-bold text-sm flex items-center justify-center gap-1.5 active:bg-primary-700 shadow-md"
        >
          <Zap className="w-4 h-4 text-amber-300" /> Buy now
        </button>
      </div>
    </div>
  );
};
