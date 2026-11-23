import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ArrowRight } from 'lucide-react';
import { getDocument } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Product } from '@poeage/types';
import { useWishlist } from '../../context/WishlistContext';
import { ProductCard, ProductCardSkeleton } from '../../components/shop/ProductCard';

export const WishlistPage: React.FC = () => {
  const { ids } = useWishlist();
  const [products, setProducts] = useState<Product[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await Promise.all(ids.map((id) => getDocument<Product>(COLLECTION.PRODUCTS, id).catch(() => null)));
      if (alive) setProducts(list.filter((p): p is Product => !!p && p.status === 'published'));
    })();
    return () => {
      alive = false;
    };
    // Re-fetch only when the set of ids changes
  }, [ids.join(',')]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Wishlist</h1>
          <p className="text-sm text-slate-500 mt-1">{ids.length} saved item{ids.length === 1 ? '' : 's'}</p>
        </div>
      </div>

      {ids.length === 0 ? (
        <div className="rounded-3xl bg-white border border-slate-200 py-16 px-6 text-center">
          <span className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto"><Heart className="w-8 h-8" /></span>
          <h2 className="mt-4 text-lg font-bold text-slate-900">Nothing saved yet</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Tap the heart on any product to keep it here for later.</p>
          <Link to="/products" className="mt-6 inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-primary-600 text-white font-bold hover:bg-primary-700">
            Browse products <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5">
          {products === null
            ? ids.slice(0, 5).map((_, i) => <ProductCardSkeleton key={i} />)
            : products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
};
