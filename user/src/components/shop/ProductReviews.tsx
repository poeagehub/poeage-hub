import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, BadgeCheck, MessageSquarePlus, CheckCircle2, Clock } from 'lucide-react';
import { getDocuments, getDocument, setDocument, where, friendlyError } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Product, Review, VendorOrder } from '@poeage/types';
import { useAuth } from '../../context/AuthContext';

const when = (t: any) => (t?.toDate ? t.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

const Stars: React.FC<{ value: number; size?: string }> = ({ value, size = 'w-4 h-4' }) => (
  <span className="inline-flex">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`${size} ${i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />)}</span>
);

export const ProductReviews: React.FC<{ product: Product }> = ({ product }) => {
  const { user, profile } = useAuth();
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [eligibleOrder, setEligibleOrder] = useState<VendorOrder | null>(null);
  const [mine, setMine] = useState<Review | null>(null);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getDocuments<Review>(COLLECTION.REVIEWS, [where('productId', '==', product.id), where('status', '==', 'approved')])
      .then((r) => setReviews(r.sort((a, b) => ((b.createdAt as any)?.toMillis?.() ?? 0) - ((a.createdAt as any)?.toMillis?.() ?? 0))))
      .catch(() => setReviews([]));
  }, [product.id]);

  // Can this customer review? They need a delivered order containing this product.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [own, orders] = await Promise.all([
        getDocument<Review>(COLLECTION.REVIEWS, `${user.uid}_${product.id}`).catch(() => null),
        getDocuments<VendorOrder>(COLLECTION.VENDOR_ORDERS, [where('customerId', '==', user.uid)]).catch(() => [] as VendorOrder[]),
      ]);
      setMine(own);
      if (own) {
        setRating(own.rating);
        setTitle(own.title ?? '');
        setBody(own.body ?? '');
      }
      setEligibleOrder(orders.find((o) => o.status === 'delivered' && o.vendorId === product.vendorId && o.items.some((i) => i.productId === product.id)) ?? null);
    })();
  }, [user, product.id, product.vendorId]);

  const stats = useMemo(() => {
    const list = reviews ?? [];
    const total = list.length;
    const avg = total ? list.reduce((s, r) => s + r.rating, 0) / total : 0;
    const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: list.filter((r) => r.rating === n).length }));
    return { total, avg, dist };
  }, [reviews]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !eligibleOrder) return;
    if (rating < 1) return setError('Please choose a star rating.');
    setSaving(true);
    setError(null);
    try {
      const data = { productId: product.id, vendorId: product.vendorId, orderId: eligibleOrder.id, customerId: user.uid, customerName: profile?.displayName || 'Customer', rating, title: title.trim(), body: body.trim(), isVerifiedPurchase: true, status: 'pending', helpfulCount: 0 };
      await setDocument(COLLECTION.REVIEWS, `${user.uid}_${product.id}`, data, false);
      setMine({ ...(data as any), id: `${user.uid}_${product.id}` });
      setOpen(false);
    } catch (err) {
      setError(friendlyError(err, 'Could not submit your review.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="reviews" className="scroll-mt-28">
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">Ratings &amp; reviews</h2>
          <p className="text-sm text-slate-500 mt-0.5">From customers who received this product</p>
        </div>
        {user && eligibleOrder && !open && (
          <button onClick={() => setOpen(true)} className="shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-300 text-sm font-bold text-slate-800 hover:border-slate-900">
            <MessageSquarePlus className="w-4 h-4" /> {mine ? 'Edit your review' : 'Write a review'}
          </button>
        )}
      </div>

      {mine && !open && (
        <div className={`mb-5 flex items-start gap-3 rounded-2xl border p-4 text-sm ${mine.status === 'approved' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : mine.status === 'rejected' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          {mine.status === 'approved' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <Clock className="w-5 h-5 shrink-0" />}
          <span>{mine.status === 'approved' ? 'Your review is live. Thank you!' : mine.status === 'rejected' ? 'Your review was not approved.' : 'Thanks! Your review is waiting for approval and will appear here once approved.'}</span>
        </div>
      )}

      {open && (
        <form onSubmit={submit} className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <p className="text-sm font-bold text-slate-900 mb-2">Your rating</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <button type="button" key={i} onClick={() => setRating(i)} aria-label={`${i} star${i > 1 ? 's' : ''}`} className="p-1 -m-0.5 transition active:scale-90">
                  <Star className={`w-8 h-8 ${i <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-300'}`} />
                </button>
              ))}
            </div>
          </div>
          <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Headline (optional)" className="w-full h-11 px-3.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500" />
          <textarea value={body} maxLength={1000} rows={4} onChange={(e) => setBody(e.target.value)} placeholder="What did you like or dislike? How was the quality?" className="w-full px-3.5 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setOpen(false)} className="h-11 px-5 rounded-xl border border-slate-300 font-bold">Cancel</button>
            <button disabled={saving} className="h-11 px-6 rounded-xl bg-primary-600 text-white font-bold hover:bg-primary-700 disabled:opacity-60">{saving ? 'Submitting…' : 'Submit review'}</button>
          </div>
        </form>
      )}

      {reviews === null ? (
        <div className="h-32 rounded-2xl bg-slate-100 animate-pulse" />
      ) : stats.total === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-10 px-6 text-center">
          <Star className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="mt-2 font-bold text-slate-800">No reviews yet</p>
          <p className="text-sm text-slate-500 mt-0.5">{user ? 'Reviews can be written after your order is delivered.' : <><Link to="/login" className="text-primary-600 font-semibold">Sign in</Link> to review products you have bought.</>}</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-[260px_1fr] gap-6">
          <div className="rounded-2xl bg-white border border-slate-200 p-5 self-start">
            <div className="flex items-end gap-2"><span className="text-5xl font-black text-slate-900 leading-none">{stats.avg.toFixed(1)}</span><span className="text-slate-400 pb-1">/ 5</span></div>
            <div className="mt-2"><Stars value={stats.avg} size="w-5 h-5" /></div>
            <p className="text-xs text-slate-500 mt-1">{stats.total} review{stats.total > 1 ? 's' : ''}</p>
            <div className="mt-4 space-y-1.5">
              {stats.dist.map((d) => (
                <div key={d.n} className="flex items-center gap-2 text-xs">
                  <span className="w-3 font-semibold text-slate-600">{d.n}</span>
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-amber-400 rounded-full" style={{ width: `${(d.c / stats.total) * 100}%` }} /></div>
                  <span className="w-5 text-right text-slate-400">{d.c}</span>
                </div>
              ))}
            </div>
          </div>
          <ul className="space-y-4">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-2xl bg-white border border-slate-200 p-5">
                <div className="flex items-center justify-between gap-3">
                  <Stars value={r.rating} />
                  <span className="text-xs text-slate-400">{when(r.createdAt)}</span>
                </div>
                {r.title && <p className="mt-2 font-bold text-slate-900">{r.title}</p>}
                {r.body && <p className="mt-1 text-sm text-slate-600 leading-relaxed whitespace-pre-line">{r.body}</p>}
                <p className="mt-3 text-xs text-slate-500 flex items-center gap-1.5">
                  <span className="font-semibold text-slate-700">{(r as any).customerName || 'Customer'}</span>
                  {r.isVerifiedPurchase && <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold"><BadgeCheck className="w-3.5 h-3.5" /> Verified purchase</span>}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
