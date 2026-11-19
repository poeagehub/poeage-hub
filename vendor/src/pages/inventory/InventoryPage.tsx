import React, { useEffect, useMemo, useState } from 'react';
import { useVendorAuth } from '../../context/AuthContext';
import {
  subscribeToCollection,
  runTransaction,
  db,
  doc,
  collection,
  where,
  serverTimestamp,
  friendlyError,
} from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Inventory, InventoryLog, Product } from '@poeage/types';
import { Button, Card, Badge, Spinner } from '@poeage/ui';
import {
  Boxes,
  AlertTriangle,
  PackageX,
  PackageCheck,
  Search,
  SlidersHorizontal,
  X,
  Plus,
  Minus,
  Equal,
  History,
  AlertCircle,
} from 'lucide-react';

type Filter = 'all' | 'low' | 'out' | 'unset';
type AdjustType = 'add' | 'remove' | 'set';

const REASONS: Record<AdjustType, string[]> = {
  add: ['New stock received', 'Customer return restocked', 'Stock count correction', 'Other'],
  remove: ['Damaged / defective', 'Lost or missing', 'Sold offline', 'Stock count correction', 'Other'],
  set: ['Full stock count', 'Stock count correction', 'Other'],
};

interface Row {
  product: Product;
  inv: Inventory | null;
  onHand: number;
  reserved: number;
  available: number;
  reorder: number;
  state: 'ok' | 'low' | 'out' | 'unset';
}

const toTime = (v: unknown): number => {
  const t = v as { seconds?: number; toMillis?: () => number } | undefined;
  return t?.toMillis ? t.toMillis() : (t?.seconds ?? 0) * 1000;
};

export const InventoryPage: React.FC = () => {
  const { vendor, user } = useVendorAuth();
  const vendorId = vendor?.id || user?.uid;

  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [ready, setReady] = useState({ products: false, inventory: false });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Row | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!vendorId) return;
    const scope = [where('vendorId', '==', vendorId)];
    const onError = (err: Error) => setLoadError(friendlyError(err, 'Could not load your inventory.'));
    const u1 = subscribeToCollection<Product>(
      COLLECTION.PRODUCTS,
      scope,
      (l) => {
        setProducts(l);
        setReady((r) => ({ ...r, products: true }));
      },
      onError,
    );
    const u2 = subscribeToCollection<Inventory>(
      COLLECTION.INVENTORY,
      scope,
      (l) => {
        setInventory(l);
        setReady((r) => ({ ...r, inventory: true }));
      },
      onError,
    );
    const u3 = subscribeToCollection<InventoryLog>(COLLECTION.INVENTORY_LOGS, scope, setLogs, () => {});
    return () => {
      u1();
      u2();
      u3();
    };
  }, [vendorId]);

  const rows: Row[] = useMemo(() => {
    const byProduct = new Map(inventory.map((i) => [i.productId, i]));
    return products
      .filter((p) => p.status !== 'archived')
      .map((product) => {
        const inv = byProduct.get(product.id) ?? null;
        const onHand = inv?.quantity ?? 0;
        const reserved = inv?.reservedQuantity ?? 0;
        const available = Math.max(0, onHand - reserved);
        const reorder = inv?.reorderLevel ?? 5;
        const state: Row['state'] = !inv ? 'unset' : available <= 0 ? 'out' : available <= reorder ? 'low' : 'ok';
        return { product, inv, onHand, reserved, available, reorder, state };
      })
      .sort((a, b) => a.product.name.localeCompare(b.product.name));
  }, [products, inventory]);

  const stats = useMemo(
    () => ({
      skus: rows.length,
      units: rows.reduce((s, r) => s + r.available, 0),
      low: rows.filter((r) => r.state === 'low').length,
      out: rows.filter((r) => r.state === 'out').length,
    }),
    [rows],
  );

  const visible = rows.filter((r) => {
    if (filter !== 'all' && r.state !== filter) return false;
    const q = search.trim().toLowerCase();
    return !q || r.product.name.toLowerCase().includes(q);
  });

  const recentLogs = useMemo(() => [...logs].sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt)).slice(0, 25), [logs]);
  const loading = !ready.products || !ready.inventory;

  const stateBadge = (r: Row) => {
    switch (r.state) {
      case 'out':
        return <Badge variant="danger">Out of stock</Badge>;
      case 'low':
        return <Badge variant="warning">Low stock</Badge>;
      case 'unset':
        return <Badge variant="default">Not tracked</Badge>;
      default:
        return <Badge variant="success">In stock</Badge>;
    }
  };

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Inventory & Stock</h1>
          <p className="text-xs text-gray-500 mt-1">
            Live stock for every product. Stock is deducted automatically when you accept an order.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowHistory((v) => !v)}
          className="flex items-center gap-2 self-start"
        >
          <History className="w-3.5 h-3.5" />
          {showHistory ? 'Hide' : 'Show'} stock history
        </Button>
      </div>

      {loadError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Products', value: stats.skus, icon: Boxes, tone: 'bg-blue-50 text-blue-600' },
          { label: 'Units available', value: stats.units, icon: PackageCheck, tone: 'bg-emerald-50 text-emerald-600' },
          { label: 'Low stock', value: stats.low, icon: AlertTriangle, tone: 'bg-amber-50 text-amber-600' },
          { label: 'Out of stock', value: stats.out, icon: PackageX, tone: 'bg-red-50 text-red-600' },
        ].map((t) => (
          <Card key={t.label} className="p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.tone}`}>
              <t.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 font-medium">{t.label}</p>
              <p className="text-xl font-black text-gray-900">{t.value}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-3">
        <div className="flex items-center gap-1 overflow-x-auto text-xs">
          {(
            [
              ['all', 'All', rows.length],
              ['low', 'Low stock', stats.low],
              ['out', 'Out of stock', stats.out],
              ['unset', 'Not tracked', rows.filter((r) => r.state === 'unset').length],
            ] as Array<[Filter, string, number]>
          ).map(([id, label, count]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                filter === id ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`text-[10px] px-1.5 rounded-full ${filter === id ? 'bg-white/30' : 'bg-gray-200 text-gray-700'}`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <Spinner size="lg" />
        </div>
      ) : visible.length === 0 ? (
        <Card className="p-12 text-center max-w-md mx-auto">
          <Boxes className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900 mb-1">
            {rows.length === 0 ? 'No products yet' : 'Nothing matches this view'}
          </h3>
          <p className="text-xs text-gray-500">
            {rows.length === 0 ? 'Add a product and its stock will appear here.' : 'Try another filter or search.'}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 text-gray-500 uppercase font-bold border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Available</th>
                  <th className="py-3 px-4 text-right">On hand</th>
                  <th className="py-3 px-4 text-right">Reserved</th>
                  <th className="py-3 px-4 text-right">Reorder at</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((r) => (
                  <tr key={r.product.id} className="hover:bg-gray-50/60">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {r.product.images?.[0] ? (
                          <img src={r.product.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-100" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100" />
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 truncate max-w-[240px]">{r.product.name}</p>
                          <p className="text-[11px] text-gray-400 capitalize">{r.product.status.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">{stateBadge(r)}</td>
                    <td className="py-3 px-4 text-right font-black text-gray-900">{r.inv ? r.available : '—'}</td>
                    <td className="py-3 px-4 text-right text-gray-700">{r.inv ? r.onHand : '—'}</td>
                    <td className="py-3 px-4 text-right text-gray-700">{r.inv ? r.reserved : '—'}</td>
                    <td className="py-3 px-4 text-right text-gray-700">{r.inv ? r.reorder : '—'}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setEditing(r)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 inline-flex items-center gap-1"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        {r.inv ? 'Adjust' : 'Set up'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showHistory && (
        <Card className="p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-600" /> Recent stock changes
          </h3>
          {recentLogs.length === 0 ? (
            <p className="text-xs text-gray-500">No stock changes recorded yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentLogs.map((l) => (
                <div key={l.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate">{l.productName}</p>
                    <p className="text-gray-500">
                      {l.reason}
                      {l.note ? ` · ${l.note}` : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-black ${l.change > 0 ? 'text-emerald-600' : l.change < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                      {l.change > 0 ? `+${l.change}` : l.change}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {l.before} → {l.after}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {editing && vendorId && (
        <AdjustModal row={editing} vendorId={vendorId} actorId={user?.uid ?? ''} onClose={() => setEditing(null)} />
      )}
    </div>
  );
};

const AdjustModal: React.FC<{ row: Row; vendorId: string; actorId: string; onClose: () => void }> = ({
  row,
  vendorId,
  actorId,
  onClose,
}) => {
  const isNew = !row.inv;
  const [type, setType] = useState<AdjustType>(isNew ? 'set' : 'add');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState(REASONS[isNew ? 'set' : 'add'][0]!);
  const [note, setNote] = useState('');
  const [reorder, setReorder] = useState(String(row.reorder));
  const [location, setLocation] = useState(row.inv?.warehouseLocation ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = qty === '' ? NaN : Math.floor(Number(qty));
  const projected = Number.isNaN(amount)
    ? row.onHand
    : type === 'add'
    ? row.onHand + amount
    : type === 'remove'
    ? row.onHand - amount
    : amount;

  const changeType = (t: AdjustType) => {
    setType(t);
    setReason(REASONS[t][0]!);
  };

  const save = async () => {
    setError(null);
    const reorderN = Math.floor(Number(reorder));
    if (Number.isNaN(reorderN) || reorderN < 0) return setError('Reorder level must be 0 or more.');
    const qtyEntered = qty !== '';
    if (qtyEntered && (Number.isNaN(amount) || amount < 0)) return setError('Enter a valid quantity (0 or more).');
    if (isNew && !qtyEntered) return setError('Enter the quantity you currently have.');
    if (qtyEntered && projected < 0) return setError(`You only have ${row.onHand} on hand, so you cannot remove ${amount}.`);
    if (qtyEntered && projected < row.reserved) return setError(`${row.reserved} units are reserved for open orders. Stock cannot go below that.`);

    setSaving(true);
    try {
      const invRef = doc(db, COLLECTION.INVENTORY, row.product.id);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(invRef);
        const current = snap.exists() ? Number((snap.data() as Inventory).quantity) || 0 : 0;
        const next = !qtyEntered ? current : type === 'add' ? current + amount : type === 'remove' ? current - amount : amount;
        if (next < 0) throw new Error('Stock cannot go below zero.');

        if (snap.exists()) {
          tx.update(invRef, {
            quantity: next,
            reorderLevel: reorderN,
            warehouseLocation: location.trim(),
            updatedAt: serverTimestamp(),
          });
        } else {
          tx.set(invRef, {
            id: row.product.id,
            productId: row.product.id,
            vendorId,
            quantity: next,
            reservedQuantity: 0,
            reorderLevel: reorderN,
            warehouseLocation: location.trim(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        if (qtyEntered && (next !== current || !snap.exists())) {
          tx.set(doc(collection(db, COLLECTION.INVENTORY_LOGS)), {
            vendorId,
            productId: row.product.id,
            productName: row.product.name,
            type: snap.exists() ? type : 'setup',
            change: next - current,
            before: current,
            after: next,
            reason,
            ...(note.trim() ? { note: note.trim() } : {}),
            actorId,
            createdAt: serverTimestamp(),
          });
        }
      });
      onClose();
    } catch (err: any) {
      setError(
        err?.code === 'permission-denied'
          ? 'You are not allowed to change this stock record. Make sure your store is approved.'
          : friendlyError(err, 'Could not save stock. Please try again.'),
      );
    } finally {
      setSaving(false);
    }
  };

  const tabs: Array<[AdjustType, string, React.ReactNode]> = [
    ['add', 'Add stock', <Plus key="a" className="w-3.5 h-3.5" />],
    ['remove', 'Remove', <Minus key="r" className="w-3.5 h-3.5" />],
    ['set', 'Set exact', <Equal key="s" className="w-3.5 h-3.5" />],
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[92vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-gray-400 font-semibold uppercase">{isNew ? 'Set up stock' : 'Adjust stock'}</p>
            <h2 className="text-base font-bold text-gray-900 truncate">{row.product.name}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ['On hand', row.inv ? row.onHand : '—'],
            ['Reserved', row.inv ? row.reserved : '—'],
            ['After change', row.inv || qty !== '' ? projected : '—'],
          ].map(([k, v]) => (
            <div key={String(k)} className="p-2.5 bg-gray-50 rounded-xl">
              <p className="text-[10px] text-gray-400">{k}</p>
              <p className="text-lg font-black text-gray-900">{v}</p>
            </div>
          ))}
        </div>

        {!isNew && (
          <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-xl">
            {tabs.map(([id, label, icon]) => (
              <button
                key={id}
                onClick={() => changeType(id)}
                className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
                  type === id ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              {isNew ? 'Units you have now' : type === 'set' ? 'New total quantity' : 'Quantity'}
            </label>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="0"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
          {qty !== '' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {REASONS[isNew ? 'set' : type].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <input
                type="text"
                value={note}
                maxLength={120}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                className="mt-2 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Low-stock alert at</label>
              <input
                type="number"
                min={0}
                value={reorder}
                onChange={(e) => setReorder(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Shelf / bin</label>
              <input
                type="text"
                value={location}
                maxLength={40}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. A-12"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
            {saving ? <Spinner size="sm" /> : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
};
