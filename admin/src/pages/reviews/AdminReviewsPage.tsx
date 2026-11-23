import React, { useEffect, useMemo, useState } from 'react';
import { subscribeToCollection, updateDocument, deleteDocument, getDocuments, where, friendlyError } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Review, Product } from '@poeage/types';
import { PageHeader, Section, Pills, EmptyState, StatusPill, Skeleton, Button } from '@poeage/ui';
import { Star, Check, X, Trash2, BadgeCheck, MessageSquareText, AlertCircle } from 'lucide-react';

const ms = (t: any): number => (t?.toDate ? t.toDate().getTime() : 0);
const Stars: React.FC<{ v: number }> = ({ v }) => (
  <span className="inline-flex">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`w-4 h-4 ${i <= v ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />)}</span>
);

/** Keep the product's public rating in step with its approved reviews. */
async function refreshProductRating(productId: string) {
  const approved = await getDocuments<Review>(COLLECTION.REVIEWS, [where('productId', '==', productId), where('status', '==', 'approved')]);
  const n = approved.length;
  const avg = n ? Math.round((approved.reduce((s, r) => s + r.rating, 0) / n) * 10) / 10 : 0;
  await updateDocument(COLLECTION.PRODUCTS, productId, { 'metadata.averageRating': avg, 'metadata.totalRatings': n });
}

export const AdminReviewsPage: React.FC = () => {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [tab, setTab] = useState('pending');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const a = subscribeToCollection<Review>(COLLECTION.REVIEWS, [], setReviews, (e) => { setError(friendlyError(e, 'Could not load reviews.')); setReviews([]); });
    const b = subscribeToCollection<Product>(COLLECTION.PRODUCTS, [], setProducts, () => {});
    return () => { a(); b(); };
  }, []);

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 };
    (reviews ?? []).forEach((r) => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [reviews]);

  const list = useMemo(() => (reviews ?? []).filter((r) => r.status === tab).sort((a, b) => ms(b.createdAt) - ms(a.createdAt)), [reviews, tab]);
  const name = (id: string) => products.find((p) => p.id === id)?.name ?? 'Unknown product';

  const decide = async (r: Review, status: 'approved' | 'rejected') => {
    setBusy(r.id);
    setError(null);
    try {
      await updateDocument(COLLECTION.REVIEWS, r.id, { status });
      await refreshProductRating(r.productId);
    } catch (e) {
      setError(friendlyError(e, 'Could not update the review.'));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (r: Review) => {
    if (!window.confirm('Delete this review permanently?')) return;
    setBusy(r.id);
    try {
      await deleteDocument(COLLECTION.REVIEWS, r.id);
      await refreshProductRating(r.productId);
    } catch (e) {
      setError(friendlyError(e, 'Could not delete the review.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1100px] mx-auto space-y-6">
      <PageHeader title="Reviews" description="Approve customer reviews before they appear on product pages. Ratings update automatically." />
      {error && <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm p-3.5"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</div>}
      <Pills value={tab} onChange={setTab} options={[{ value: 'pending', label: 'Pending', count: counts.pending }, { value: 'approved', label: 'Approved', count: counts.approved }, { value: 'rejected', label: 'Rejected', count: counts.rejected }]} />

      {reviews === null ? (
        <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : list.length === 0 ? (
        <Section><EmptyState icon={MessageSquareText} title={`No ${tab} reviews`} description={tab === 'pending' ? 'New customer reviews will show up here for approval.' : undefined} /></Section>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => (
            <li key={r.id} className="rounded-2xl bg-white border border-slate-200/80 p-4 sm:p-5 card-modern-hover">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{name(r.productId)}</p>
                  <div className="mt-1 flex items-center gap-2"><Stars v={r.rating} /><span className="text-xs text-slate-400">{ms(r.createdAt) ? new Date(ms(r.createdAt)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span></div>
                </div>
                <StatusPill tone={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'amber'}>{r.status}</StatusPill>
              </div>
              {r.title && <p className="mt-3 font-semibold text-slate-900">{r.title}</p>}
              {r.body && <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">{r.body}</p>}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  {(r as any).customerName || 'Customer'}
                  {r.isVerifiedPurchase && <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold"><BadgeCheck className="w-3.5 h-3.5" /> Verified purchase</span>}
                </p>
                <div className="flex items-center gap-2">
                  {r.status !== 'approved' && <Button size="sm" disabled={busy === r.id} onClick={() => decide(r, 'approved')}><Check className="w-4 h-4 mr-1" /> Approve</Button>}
                  {r.status !== 'rejected' && <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => decide(r, 'rejected')}><X className="w-4 h-4 mr-1" /> Reject</Button>}
                  <button disabled={busy === r.id} onClick={() => remove(r)} aria-label="Delete review" className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
