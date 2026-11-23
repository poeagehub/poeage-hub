import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Star, Plus, Check, ImageOff } from 'lucide-react';
import type { Product } from '@poeage/types';
import { formatMoney } from '@poeage/utils';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';

/** Real discount %, but token discounts under 5% are not advertised as an offer. */
export const discountPct = (p: Pick<Product, 'basePrice' | 'salePrice'>) => {
  const pct = p.salePrice && p.salePrice > p.basePrice ? Math.round(((p.salePrice - p.basePrice) / p.salePrice) * 100) : 0;
  return pct >= 5 ? pct : 0;
};

export const ProductCard: React.FC<{ product: Product; storeName?: string | undefined }> = ({ product: p, storeName }) => {
  const { addToCart } = useCart();
  const { has, toggle } = useWishlist();
  const [added, setAdded] = useState(false);
  const off = discountPct(p);
  const saved = has(p.id);
  const rating = p.metadata?.averageRating ?? 0;
  const ratings = p.metadata?.totalRatings ?? 0;

  const quickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(p, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  return (
    <Link
      to={`/product/${p.slug}`}
      className="group relative flex flex-col rounded-2xl bg-white border border-slate-200/80 overflow-hidden transition-all hover:shadow-[0_8px_30px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 hover:border-slate-300"
    >
      <div className="relative aspect-[4/5] sm:aspect-square bg-slate-100 overflow-hidden">
        {p.images?.[0] ? (
          <img
            src={p.images[0]}
            alt={p.name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <ImageOff className="w-8 h-8" />
          </div>
        )}
        {off > 0 && (
          <span className="absolute top-2.5 left-2.5 bg-rose-600 text-white text-[10px] sm:text-[11px] font-extrabold px-2 py-1 rounded-lg shadow-sm">
            {off}% OFF
          </span>
        )}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle(p.id);
          }}
          aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'}
          aria-pressed={saved}
          className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/90 backdrop-blur shadow-sm flex items-center justify-center transition active:scale-90 hover:bg-white"
        >
          <Heart className={`w-[18px] h-[18px] transition ${saved ? 'fill-rose-500 text-rose-500' : 'text-slate-500'}`} />
        </button>
      </div>

      <div className="flex-1 flex flex-col p-3 sm:p-4">
        {storeName && <p className="text-[11px] font-semibold text-primary-600 truncate">{storeName}</p>}
        <h3 className="mt-0.5 text-[13px] sm:text-sm font-semibold text-slate-900 leading-snug line-clamp-2 min-h-[2.5rem]">{p.name}</h3>

        {ratings > 0 && (
          <div className="mt-1.5 inline-flex items-center gap-1 self-start rounded-md bg-emerald-600 text-white px-1.5 py-0.5 text-[11px] font-bold">
            {rating.toFixed(1)} <Star className="w-3 h-3 fill-current" />
            <span className="font-medium opacity-80">({ratings})</span>
          </div>
        )}

        <div className="mt-auto pt-3 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="text-base sm:text-lg font-extrabold text-slate-900 leading-none">{formatMoney(p.basePrice)}</div>
            {off > 0 && p.salePrice && <div className="text-[11px] text-slate-400 line-through mt-1">{formatMoney(p.salePrice)}</div>}
          </div>
          <button
            onClick={quickAdd}
            aria-label={`Add ${p.name} to cart`}
            className={`shrink-0 h-9 min-w-9 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition active:scale-95 ${
              added ? 'bg-emerald-600 text-white' : 'bg-primary-50 text-primary-700 hover:bg-primary-600 hover:text-white'
            }`}
          >
            {added ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span className="hidden sm:inline">{added ? 'Added' : 'Add'}</span>
          </button>
        </div>
      </div>
    </Link>
  );
};

export const ProductCardSkeleton: React.FC = () => (
  <div className="rounded-2xl bg-white border border-slate-200/80 overflow-hidden animate-pulse">
    <div className="aspect-[4/5] sm:aspect-square bg-slate-100" />
    <div className="p-3 sm:p-4 space-y-2.5">
      <div className="h-3 w-1/3 bg-slate-100 rounded" />
      <div className="h-4 w-4/5 bg-slate-100 rounded" />
      <div className="h-5 w-1/2 bg-slate-100 rounded mt-4" />
    </div>
  </div>
);
