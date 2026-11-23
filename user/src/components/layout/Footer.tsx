import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, Clock, Truck, ShieldCheck, RotateCcw, Banknote } from 'lucide-react';
import { getDocuments, where } from '@poeage/firebase-client';
import { COLLECTION, APP_CONFIG } from '@poeage/config';
import type { Category } from '@poeage/types';
import { useSettings } from '../../context/SettingsContext';

export const Footer: React.FC = () => {
  const { settings } = useSettings();
  const [cats, setCats] = useState<Category[]>([]);

  useEffect(() => {
    getDocuments<Category>(COLLECTION.CATEGORIES, [where('isActive', '==', true)])
      .then((c) => setCats(c.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).slice(0, 6)))
      .catch(() => {});
  }, []);

  const col = 'text-sm text-slate-400 hover:text-white transition-colors';
  return (
    <footer className="bg-slate-950 text-slate-300 mt-16 md:mt-24 pb-20 md:pb-0">
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Truck, t: 'Fast delivery', d: 'Tracked end to end' },
            { icon: Banknote, t: 'Cash on delivery', d: 'Pay when you receive' },
            { icon: ShieldCheck, t: 'Verified sellers', d: 'Reviewed before going live' },
            { icon: RotateCcw, t: 'Easy returns', d: 'Seller-backed policy' },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-white/5 text-primary-300 flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></span>
              <span><span className="block text-sm font-bold text-white leading-tight">{t}</span><span className="block text-xs text-slate-500">{d}</span></span>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-9">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-black">P</div>
            <span className="font-extrabold text-white text-lg tracking-tight">{settings.platformName}</span>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed max-w-xs">A marketplace where independent sellers and delivery partners bring great products to your door.</p>
          <ul className="mt-5 space-y-2 text-sm text-slate-400">
            {settings.supportEmail && <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-500" /> {settings.supportEmail}</li>}
            {settings.supportPhone && <li className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-500" /> {settings.supportPhone}</li>}
            {settings.supportHours && <li className="flex items-center gap-2"><Clock className="w-4 h-4 text-slate-500" /> {settings.supportHours}</li>}
          </ul>
        </div>

        <div className="hidden md:block">
          <h4 className="font-bold text-white text-sm mb-4">Shop</h4>
          <ul className="space-y-2.5">
            <li><Link to="/products" className={col}>All products</Link></li>
            {cats.map((c) => <li key={c.id}><Link to={`/products?cat=${c.slug}`} className={col}>{c.name}</Link></li>)}
            <li><Link to="/stores" className={col}>Stores</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-white text-sm mb-4">Help</h4>
          <ul className="space-y-2.5">
            <li><Link to="/account/orders" className={col}>Track orders</Link></li>
            <li><Link to="/wishlist" className={col}>Wishlist</Link></li>
            <li><Link to="/support" className={col}>Help &amp; contact</Link></li>
            <li><Link to="/shipping-policy" className={col}>Shipping policy</Link></li>
            <li><Link to="/returns" className={col}>Returns &amp; refunds</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-white text-sm mb-4">Partner with us</h4>
          <ul className="space-y-2.5">
            <li><a href={APP_CONFIG.urls.vendor} target="_blank" rel="noreferrer" className={col}>Sell on {settings.platformName}</a></li>
            <li><a href={APP_CONFIG.urls.driver} target="_blank" rel="noreferrer" className={col}>Deliver with us</a></li>
            <li><Link to="/about" className={col}>About us</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} {settings.platformName}. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <Link to="/terms" className="hover:text-slate-300">Terms</Link>
            <Link to="/privacy" className="hover:text-slate-300">Privacy</Link>
            <Link to="/about" className="hover:text-slate-300">About</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
