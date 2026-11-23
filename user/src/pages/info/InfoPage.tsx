import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, Mail, Phone, Clock, Truck, RotateCcw, LifeBuoy, FileText, ShieldCheck, Info } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { formatMoney } from '@poeage/utils';

const NAV = [
  { to: '/support', label: 'Help & contact', icon: LifeBuoy },
  { to: '/shipping-policy', label: 'Shipping policy', icon: Truck },
  { to: '/returns', label: 'Returns & refunds', icon: RotateCcw },
  { to: '/about', label: 'About us', icon: Info },
  { to: '/terms', label: 'Terms of use', icon: FileText },
  { to: '/privacy', label: 'Privacy policy', icon: ShieldCheck },
];

const Faq: React.FC<{ q: string; a: React.ReactNode }> = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200 last:border-0">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-4 py-4 text-left">
        <span className="font-semibold text-slate-900">{q}</span>
        <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="pb-4 text-sm text-slate-600 leading-relaxed">{a}</div>}
    </div>
  );
};

export const InfoPage: React.FC = () => {
  const { pathname } = useLocation();
  const { settings: s } = useSettings();
  const free = s.freeDeliveryThreshold > 0 ? formatMoney(s.freeDeliveryThreshold).replace(/\.00$/, '') : null;
  const fee = formatMoney(s.deliveryChargeFlat).replace(/\.00$/, '');

  let title = 'Help & contact';
  let body: React.ReactNode;

  if (pathname === '/shipping-policy') {
    title = 'Shipping policy';
    body = (
      <div className="space-y-4 text-slate-600 leading-relaxed">
        <p>Orders are packed by the seller and picked up by a {s.platformName} delivery partner. You can follow every step from the order page.</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Delivery charge: <b>{fee}</b> per order{free ? <>, <b>free</b> on orders of {free} or more</> : null}.</li>
          <li>Each seller sets a preparation time, so items from different stores may be dispatched on different days.</li>
          <li>You receive a 4-digit delivery PIN on the order page. Share it with the delivery partner only when you receive your parcel.</li>
          <li>Payment is currently <b>Cash on Delivery</b>. Please keep the exact amount ready.</li>
        </ul>
      </div>
    );
  } else if (pathname === '/returns') {
    title = 'Returns & refunds';
    body = (
      <div className="space-y-4 text-slate-600 leading-relaxed">
        <p>Return rules are set by each seller and are shown on the product page. In general:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Report damaged, defective or wrong items within the seller's return window.</li>
          <li>Keep the product unused with its original packaging and tags.</li>
          <li>Approved returns are refunded to your original payment method, or as agreed for Cash on Delivery orders.</li>
        </ul>
        <p>To start a return, contact support with your order number.</p>
      </div>
    );
  } else if (pathname === '/about') {
    title = `About ${s.platformName}`;
    body = (
      <div className="space-y-4 text-slate-600 leading-relaxed">
        <p>{s.platformName} is a multi-vendor marketplace that connects independent sellers with customers in their city. Sellers manage their own catalog and stock, and our delivery partners bring orders to your door.</p>
        <p>We review every seller before they go live, show prices transparently, and let you track each order from the store to your doorstep.</p>
      </div>
    );
  } else if (pathname === '/terms') {
    title = 'Terms of use';
    body = (
      <div className="space-y-4 text-slate-600 leading-relaxed">
        <p>By using {s.platformName} you agree to provide accurate information, keep your account secure, and use the service lawfully.</p>
        <p>Products are sold by independent sellers. Prices, availability and descriptions are provided by them and may change. An order is confirmed once the seller accepts it.</p>
        <p>We may suspend accounts that misuse the platform. These terms may be updated from time to time.</p>
      </div>
    );
  } else if (pathname === '/privacy') {
    title = 'Privacy policy';
    body = (
      <div className="space-y-4 text-slate-600 leading-relaxed">
        <p>We collect the details you give us (name, phone, delivery address) and your order history to run your orders and support you.</p>
        <p>Your address and phone number are shared only with the seller and delivery partner handling your order. We do not sell your personal data.</p>
        <p>You can ask us to correct or delete your account data at any time by contacting support.</p>
      </div>
    );
  } else {
    body = (
      <div className="space-y-8">
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { icon: Mail, t: 'Email', v: s.supportEmail, href: s.supportEmail ? `mailto:${s.supportEmail}` : undefined },
            { icon: Phone, t: 'Phone', v: s.supportPhone || 'Not available', href: s.supportPhone ? `tel:${s.supportPhone}` : undefined },
            { icon: Clock, t: 'Hours', v: s.supportHours },
          ].map(({ icon: Icon, t, v, href }) => {
            const C: any = href ? 'a' : 'div';
            return (
              <C key={t} {...(href ? { href } : {})} className="rounded-2xl border border-slate-200 bg-white p-4 flex items-start gap-3 hover:border-primary-300 transition">
                <span className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></span>
                <span className="min-w-0"><span className="block text-xs font-bold uppercase tracking-wider text-slate-400">{t}</span><span className="block text-sm font-semibold text-slate-900 break-words">{v}</span></span>
              </C>
            );
          })}
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 mb-2">Frequently asked questions</h2>
          <div className="rounded-2xl border border-slate-200 bg-white px-5">
            <Faq q="Where is my order?" a={<>Open <Link to="/account/orders" className="text-primary-600 font-semibold">My orders</Link> and select the order. It shows each stage live, from the seller accepting it to delivery.</>} />
            <Faq q="What is the delivery PIN?" a="A 4-digit code shown on your order page. Give it to the delivery partner only when you have received the parcel — it confirms the delivery." />
            <Faq q="How do I pay?" a="Cash on Delivery is available now. Keep the exact amount ready when your order arrives." />
            <Faq q="Can I use a coupon?" a="Yes. Enter the code in your cart. Each code can be used once per customer and may have a minimum order value." />
            <Faq q="How do returns work?" a={<>Each seller sets a return window shown on the product page. See <Link to="/returns" className="text-primary-600 font-semibold">Returns &amp; refunds</Link>.</>} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="grid md:grid-cols-[220px_1fr] gap-8">
        <aside className="md:sticky md:top-24 self-start">
          <nav className="flex md:flex-col gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`shrink-0 inline-flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                  pathname === to ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 md:border-transparent md:bg-transparent text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" /> {label}
              </Link>
            ))}
          </nav>
        </aside>
        <article>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mb-5">{title}</h1>
          {body}
        </article>
      </div>
    </div>
  );
};
