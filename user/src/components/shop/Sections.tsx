import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Product } from '@poeage/types';
import { ProductCard, ProductCardSkeleton } from './ProductCard';

export const SectionHead: React.FC<{
  title: string;
  subtitle?: string;
  to?: string;
  linkLabel?: string;
  icon?: React.ReactNode;
}> = ({ title, subtitle, to, linkLabel = 'See all', icon }) => (
  <div className="flex items-end justify-between gap-4 mb-4 sm:mb-6">
    <div className="flex items-center gap-3 min-w-0">
      {icon && <span className="hidden sm:flex w-10 h-10 rounded-xl bg-primary-50 text-primary-600 items-center justify-center shrink-0">{icon}</span>}
      <div className="min-w-0">
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">{title}</h2>
        {subtitle && <p className="text-[13px] sm:text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {to && (
      <Link to={to} className="shrink-0 inline-flex items-center gap-1 text-sm font-bold text-primary-600 hover:text-primary-700">
        {linkLabel} <ArrowRight className="w-4 h-4" />
      </Link>
    )}
  </div>
);

/** Horizontal snap-scrolling row of product cards (swipe on phones, arrow buttons on desktop). */
export const ProductRail: React.FC<{
  products: Product[];
  loading?: boolean;
  storeNames?: Record<string, string>;
}> = ({ products, loading, storeNames }) => {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: 'smooth' });
  const items = loading ? Array.from({ length: 5 }) : products;
  return (
    <div className="relative group/rail">
      <div ref={ref} className="flex gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 pb-2">
        {items.map((p, i) => (
          <div key={loading ? i : (p as Product).id} className="snap-start shrink-0 w-[44vw] max-w-[190px] sm:w-[220px] sm:max-w-none lg:w-[236px]">
            {loading ? <ProductCardSkeleton /> : <ProductCard product={p as Product} storeName={storeNames?.[(p as Product).vendorId]} />}
          </div>
        ))}
      </div>
      {!loading && products.length > 4 && (
        <>
          <button onClick={() => scroll(-1)} aria-label="Previous" className="hidden lg:flex absolute -left-4 top-1/3 w-10 h-10 rounded-full bg-white shadow-lg border border-slate-200 items-center justify-center opacity-0 group-hover/rail:opacity-100 transition hover:bg-slate-50">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => scroll(1)} aria-label="Next" className="hidden lg:flex absolute -right-4 top-1/3 w-10 h-10 rounded-full bg-white shadow-lg border border-slate-200 items-center justify-center opacity-0 group-hover/rail:opacity-100 transition hover:bg-slate-50">
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}
    </div>
  );
};
