import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Store as StoreIcon, MapPin, Clock, Package, BadgeCheck, ArrowLeft } from 'lucide-react';
import { getDocument, getDocuments, where } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Product, Vendor } from '@poeage/types';
import { ProductCard, ProductCardSkeleton } from '../../components/shop/ProductCard';

export const StoresPage: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    (async () => {
      const [v, p] = await Promise.all([
        getDocuments<Vendor>(COLLECTION.VENDORS, [where('status', '==', 'approved')]).catch(() => []),
        getDocuments<Product>(COLLECTION.PRODUCTS, [where('status', '==', 'published')]).catch(() => []),
      ]);
      setVendors(v);
      setProducts(p);
    })();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Stores</h1>
      <p className="text-sm text-slate-500 mt-1 mb-6">Shop directly from verified sellers.</p>
      {vendors === null ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <div key={i} className="h-40 rounded-2xl bg-slate-200/70 animate-pulse" />)}</div>
      ) : vendors.length === 0 ? (
        <p className="text-slate-500 py-16 text-center">No stores are open yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendors.map((v) => (
            <Link key={v.id} to={`/store/${v.id}`} className="group rounded-2xl bg-white border border-slate-200/80 overflow-hidden hover:shadow-lg hover:border-slate-300 transition">
              <div className="h-24 bg-gradient-to-br from-primary-100 via-primary-50 to-slate-100 relative">
                {v.bannerURL && <img src={v.bannerURL} alt="" className="absolute inset-0 w-full h-full object-cover" />}
              </div>
              <div className="px-5 pb-5 -mt-8 relative">
                <div className="w-16 h-16 rounded-2xl bg-white border-4 border-white shadow text-primary-700 font-black text-2xl flex items-center justify-center overflow-hidden">
                  {v.logoURL ? <img src={v.logoURL} alt="" className="w-full h-full object-cover" /> : v.storeName?.[0]?.toUpperCase()}
                </div>
                <h2 className="mt-3 font-extrabold text-slate-900 group-hover:text-primary-700 flex items-center gap-1.5">{v.storeName} <BadgeCheck className="w-4 h-4 text-primary-500" /></h2>
                <p className="text-sm text-slate-500 line-clamp-2 mt-0.5 min-h-[2.5rem]">{v.description || 'Quality products delivered to your door.'}</p>
                <p className="mt-3 text-xs font-semibold text-slate-500 inline-flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> {products.filter((p) => p.vendorId === v.id).length} {products.filter((p) => p.vendorId === v.id).length === 1 ? 'product' : 'products'}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export const StorePage: React.FC = () => {
  const { id } = useParams();
  const [vendor, setVendor] = useState<Vendor | null | undefined>(undefined);
  const [products, setProducts] = useState<Product[] | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [v, p] = await Promise.all([
        getDocument<Vendor>(COLLECTION.VENDORS, id).catch(() => null),
        getDocuments<Product>(COLLECTION.PRODUCTS, [where('vendorId', '==', id), where('status', '==', 'published')]).catch(() => []),
      ]);
      setVendor(v && v.status === 'approved' ? v : null);
      setProducts(p);
    })();
  }, [id]);

  const open = vendor?.isOpen !== false;
  const addr = useMemo(() => [vendor?.address?.city, vendor?.address?.state].filter(Boolean).join(', '), [vendor]);

  if (vendor === null)
    return (
      <div className="max-w-xl mx-auto text-center py-24 px-4">
        <StoreIcon className="w-12 h-12 text-slate-300 mx-auto" />
        <h1 className="mt-4 text-xl font-extrabold">Store not found</h1>
        <Link to="/stores" className="mt-4 inline-flex items-center gap-1.5 text-primary-600 font-bold"><ArrowLeft className="w-4 h-4" /> All stores</Link>
      </div>
    );

  return (
    <div className="pb-12">
      <div className="h-36 sm:h-52 bg-gradient-to-br from-primary-200 via-primary-100 to-slate-100 relative">
        {vendor?.bannerURL && <img src={vendor.bannerURL} alt="" className="absolute inset-0 w-full h-full object-cover" />}
      </div>
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="-mt-10 sm:-mt-12 flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-white border-4 border-white shadow-lg text-primary-700 font-black text-3xl flex items-center justify-center overflow-hidden shrink-0">
            {vendor?.logoURL ? <img src={vendor.logoURL} alt="" className="w-full h-full object-cover" /> : vendor?.storeName?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 pb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">{vendor?.storeName ?? '…'} {vendor && <BadgeCheck className="w-5 h-5 text-primary-500" />}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              {addr && <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" />{addr}</span>}
              <span className={`inline-flex items-center gap-1.5 font-semibold ${open ? 'text-emerald-600' : 'text-amber-600'}`}><Clock className="w-4 h-4" />{open ? 'Open for orders' : 'Not taking orders right now'}</span>
              <span className="inline-flex items-center gap-1.5"><Package className="w-4 h-4" />{products?.length ?? 0} products</span>
            </div>
          </div>
        </div>
        {vendor?.description && <p className="mt-4 text-slate-600 max-w-3xl">{vendor.description}</p>}

        <h2 className="mt-10 mb-4 text-xl font-extrabold text-slate-900">Products</h2>
        {products === null ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5">{[0, 1, 2, 3].map((i) => <ProductCardSkeleton key={i} />)}</div>
        ) : products.length === 0 ? (
          <p className="text-slate-500 py-12 text-center">This store hasn't published any products yet.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </div>
  );
};
