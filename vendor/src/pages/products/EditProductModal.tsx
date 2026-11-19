import React, { useMemo, useState } from 'react';
import { updateDocument, deleteField, friendlyError } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Product } from '@poeage/types';
import { formatMoney } from '@poeage/utils';
import { Button, Spinner } from '@poeage/ui';
import { X, AlertCircle, Info } from 'lucide-react';

/** Digits and one decimal point (max 2 decimals), no leading zeros. */
function money(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const [int = '', ...rest] = cleaned.split('.');
  const intPart = int.replace(/^0+(?=\d)/, '');
  return rest.length ? `${intPart}.${rest.join('').slice(0, 2)}` : intPart;
}
const toPaise = (v: string) => Math.round((parseFloat(v) || 0) * 100);
const toRupees = (paise: number | undefined) => (paise && paise > 0 ? String(paise / 100) : '');

const inputCls = (err?: string) =>
  `w-full px-3 py-2 text-sm rounded-lg border bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
    err ? 'border-red-400' : 'border-gray-300'
  }`;

export const EditProductModal: React.FC<{ product: Product; onClose: () => void }> = ({ product, onClose }) => {
  const [name, setName] = useState(product.name);
  const [shortDescription, setShortDescription] = useState(product.shortDescription ?? '');
  const [description, setDescription] = useState(product.description ?? '');
  const [cost, setCost] = useState(toRupees(product.costPrice));
  const [mrp, setMrp] = useState(toRupees(product.mrp ?? product.salePrice));
  const [selling, setSelling] = useState(toRupees(product.sellingPrice ?? product.basePrice));
  const [offer, setOffer] = useState(toRupees(product.offerPrice));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const p = useMemo(() => {
    const sellP = toPaise(selling);
    const offerP = toPaise(offer);
    const mrpP = toPaise(mrp);
    const costP = toPaise(cost);
    const pays = offerP > 0 ? offerP : sellP;
    const commission = Math.round(pays * product.commissionRate);
    return { sellP, offerP, mrpP, costP, pays, commission, payout: pays - commission, profit: pays - commission - costP };
  }, [cost, mrp, selling, offer, product.commissionRate]);

  const errors = {
    name: name.trim().length < 3 ? 'Product name must be at least 3 characters.' : undefined,
    selling: p.sellP <= 0 ? 'Enter a selling price.' : undefined,
    mrp: p.mrpP > 0 && p.mrpP < p.sellP ? 'MRP cannot be lower than the selling price.' : undefined,
    offer: p.offerP > 0 && p.offerP >= p.sellP ? 'Offer price must be lower than the selling price.' : undefined,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const save = async () => {
    setError(null);
    if (hasErrors) return setError('Please fix the highlighted fields.');
    setSaving(true);
    try {
      const reference = p.mrpP > 0 ? p.mrpP : p.sellP;
      await updateDocument(COLLECTION.PRODUCTS, product.id, {
        name: name.trim(),
        shortDescription: shortDescription.trim(),
        description: description.trim(),
        basePrice: p.pays,
        sellingPrice: p.sellP,
        mrp: reference,
        // Shown struck-through on the shop only when higher than what the customer pays.
        salePrice: reference > p.pays ? reference : deleteField(),
        offerPrice: p.offerP > 0 ? p.offerP : deleteField(),
        costPrice: p.costP > 0 ? p.costP : deleteField(),
      });
      onClose();
    } catch (err: any) {
      setError(
        err?.code === 'permission-denied'
          ? 'This product cannot be edited right now. Make sure your store is approved.'
          : friendlyError(err, 'Could not save your changes. Please try again.'),
      );
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, err: string | undefined, node: React.ReactNode, hint?: string) => (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
      {node}
      {err ? <p className="mt-1 text-[11px] text-red-600 font-medium">{err}</p> : hint ? <p className="mt-1 text-[11px] text-gray-400">{hint}</p> : null}
    </div>
  );

  const priceInput = (value: string, set: (v: string) => void, err?: string) => (
    <div className="relative">
      <span className="absolute left-3 top-2 text-sm text-gray-400">₹</span>
      <input inputMode="decimal" value={value} onChange={(e) => set(money(e.target.value))} className={`${inputCls(err)} pl-7`} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] text-gray-400 font-semibold uppercase">Edit product</p>
            <h2 className="text-base font-bold text-gray-900">{product.name}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {field('Product title', errors.name, <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} className={inputCls(errors.name)} />)}
        {field('Short description', undefined, <input value={shortDescription} maxLength={160} onChange={(e) => setShortDescription(e.target.value)} className={inputCls()} />)}
        {field('Full description', undefined, <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls()} />)}

        <div className="grid grid-cols-2 gap-4">
          {field('Production cost', undefined, priceInput(cost, setCost), 'Private. Never shown to customers.')}
          {field('MRP', errors.mrp, priceInput(mrp, setMrp, errors.mrp))}
          {field('Selling price', errors.selling, priceInput(selling, setSelling, errors.selling))}
          {field('Offer price (optional)', errors.offer, priceInput(offer, setOffer, errors.offer))}
        </div>

        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-xs space-y-1.5">
          <div className="flex justify-between"><span className="text-gray-600">Customer pays</span><b>{formatMoney(p.pays)}</b></div>
          <div className="flex justify-between"><span className="text-gray-600">Platform commission ({(product.commissionRate * 100).toFixed(0)}%)</span><b className="text-red-600">-{formatMoney(p.commission)}</b></div>
          <div className="flex justify-between"><span className="text-gray-600">You receive</span><b>{formatMoney(p.payout)}</b></div>
          {p.costP > 0 && (
            <div className="flex justify-between border-t border-emerald-100 pt-1.5">
              <span className="text-gray-600">Profit after cost</span>
              <b className={p.profit < 0 ? 'text-red-600' : 'text-emerald-700'}>{formatMoney(p.profit)}</b>
            </div>
          )}
        </div>

        <p className="text-[11px] text-gray-400 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          Price changes apply to the shop immediately. Change stock from the Inventory page.
        </p>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold min-w-[110px]">
            {saving ? <Spinner size="sm" /> : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  );
};
