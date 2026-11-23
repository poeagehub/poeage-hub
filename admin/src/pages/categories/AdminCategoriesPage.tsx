import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  subscribeToCollection,
  createDocument,
  updateDocument,
  deleteDocument,
  friendlyError,
} from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Category, Product } from '@poeage/types';
import { slugify } from '@poeage/utils';
import { Button, PageHeader, Section, EmptyState, Modal, SearchField, StatusPill, Skeleton } from '@poeage/ui';
import { Tags, Plus, Pencil, Trash2, ImagePlus, AlertCircle } from 'lucide-react';
import { compressImageToDataUrl } from '../../lib/imageCompress';
import { Switch } from '../../components/ui/Switch';

interface FormState {
  id?: string;
  name: string;
  description: string;
  imageURL: string;
  order: string;
  isActive: boolean;
}
const EMPTY: FormState = { name: '', description: '', imageURL: '', order: '0', isActive: true };

export const AdminCategoriesPage: React.FC = () => {
  const [cats, setCats] = useState<Category[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onErr = (e: Error) => setError(friendlyError(e, 'Could not load categories.'));
    const a = subscribeToCollection<Category>(COLLECTION.CATEGORIES, [], setCats, onErr);
    const b = subscribeToCollection<Product>(COLLECTION.PRODUCTS, [], setProducts, () => {});
    return () => {
      a();
      b();
    };
  }, []);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    products.forEach((p) => m.set(p.categoryId, (m.get(p.categoryId) ?? 0) + 1));
    return m;
  }, [products]);

  const list = useMemo(
    () =>
      [...(cats ?? [])]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))
        .filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase())),
    [cats, q],
  );

  const pickImage = async (file?: File) => {
    if (!file) return;
    try {
      const url = await compressImageToDataUrl(file, { maxDimension: 600, maxBytes: 60_000 });
      setForm((f) => (f ? { ...f, imageURL: url } : f));
    } catch (e) {
      setError(friendlyError(e, 'Could not use that image.'));
    }
  };

  const save = async () => {
    if (!form) return;
    const name = form.name.trim();
    if (name.length < 2) return setError('Give the category a name (at least 2 characters).');
    const slug = slugify(name);
    if ((cats ?? []).some((c) => c.slug === slug && c.id !== form.id)) return setError('A category with this name already exists.');
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name,
        slug,
        description: form.description.trim(),
        imageURL: form.imageURL,
        order: Number(form.order) || 0,
        isActive: form.isActive,
      };
      if (form.id) await updateDocument(COLLECTION.CATEGORIES, form.id, payload);
      else await createDocument(COLLECTION.CATEGORIES, { ...payload, productCount: 0 });
      setForm(null);
    } catch (e) {
      setError(friendlyError(e, 'Could not save the category.'));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c: Category) => {
    try {
      await updateDocument(COLLECTION.CATEGORIES, c.id, { isActive: !c.isActive });
    } catch (e) {
      setError(friendlyError(e, 'Could not update the category.'));
    }
  };

  const remove = async () => {
    if (!confirmDelete) return;
    try {
      await deleteDocument(COLLECTION.CATEGORIES, confirmDelete.id);
      setConfirmDelete(null);
    } catch (e) {
      setError(friendlyError(e, 'Could not delete the category.'));
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <PageHeader
        title="Categories"
        description="Organise the catalog. Active categories appear on the storefront home page and in filters."
        actions={
          <Button onClick={() => { setError(null); setForm({ ...EMPTY, order: String((cats?.length ?? 0) + 1) }); }}>
            <Plus className="w-4 h-4 mr-1.5" /> New category
          </Button>
        }
      />

      {error && !form && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm p-3.5">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <SearchField value={q} onChange={setQ} placeholder="Search categories…" className="max-w-sm" />

      {cats === null ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : list.length === 0 ? (
        <Section><EmptyState icon={Tags} title="No categories found" description="Create your first category to organise products." /></Section>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map((c) => (
            <div key={c.id} className="rounded-2xl bg-white border border-slate-200/80 p-4 flex gap-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] card-modern-hover">
              <div className="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center text-slate-300">
                {c.imageURL ? <img src={c.imageURL} alt="" className="w-full h-full object-cover" /> : <Tags className="w-7 h-7" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-slate-900 truncate">{c.name}</h3>
                  <StatusPill tone={c.isActive ? 'green' : 'slate'}>{c.isActive ? 'Active' : 'Hidden'}</StatusPill>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">/{c.slug} · order {c.order ?? 0}</p>
                <p className="text-xs text-slate-500">{counts.get(c.id) ?? 0} product{(counts.get(c.id) ?? 0) === 1 ? '' : 's'}</p>
                <div className="mt-3 flex items-center gap-2">
                  <button onClick={() => { setError(null); setForm({ id: c.id, name: c.name, description: c.description ?? '', imageURL: c.imageURL ?? '', order: String(c.order ?? 0), isActive: c.isActive }); }} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 transition-all">
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200/80 bg-slate-50/70" title={c.isActive ? 'Hide from shop' : 'Publish to shop'}>
                    <Switch
                      size="sm"
                      tone="emerald"
                      checked={c.isActive}
                      onChange={() => toggle(c)}
                    />
                    <span className="text-[11px] font-semibold text-slate-600 select-none">
                      {c.isActive ? 'Active' : 'Hidden'}
                    </span>
                  </div>
                  <button onClick={() => setConfirmDelete(c)} aria-label="Delete" className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Edit category' : 'New category'}
        footer={
          <>
            <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
            <Button onClick={save} isLoading={saving}>{form?.id ? 'Save changes' : 'Create category'}</Button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => fileRef.current?.click()} className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-primary-400 overflow-hidden flex flex-col items-center justify-center text-slate-400 text-[11px] font-semibold gap-1">
                {form.imageURL ? <img src={form.imageURL} alt="" className="w-full h-full object-cover" /> : <><ImagePlus className="w-6 h-6" /> Add image</>}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
              <p className="text-xs text-slate-500 flex-1">Square images look best. The image is shown on the storefront category tiles.</p>
            </div>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Name</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5 w-full h-11 px-3.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500" placeholder="e.g. Comics & Books" />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Description <span className="font-normal text-slate-400">(optional)</span></span>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500" />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Display order</span>
                <input type="number" inputMode="numeric" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} className="mt-1.5 w-full h-11 px-3.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/30" />
              </label>
              <div className="flex flex-col justify-end">
                <span className="text-sm font-semibold text-slate-700 mb-1.5">Visibility</span>
                <div className="h-11 px-3.5 rounded-xl border border-slate-300 bg-slate-50/70 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">{form.isActive ? 'Active on store' : 'Hidden'}</span>
                  <Switch
                    size="sm"
                    tone="emerald"
                    checked={form.isActive}
                    onChange={(checked) => setForm({ ...form, isActive: checked })}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        size="sm"
        title="Delete category?"
        description={confirmDelete ? `“${confirmDelete.name}” will be removed. Products in it keep their data but lose the category.` : ''}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Keep it</Button>
            <Button variant="danger" onClick={remove}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">{confirmDelete && (counts.get(confirmDelete.id) ?? 0) > 0 ? `${counts.get(confirmDelete.id)} product(s) use this category. Consider hiding it instead.` : 'No products use this category.'}</p>
      </Modal>
    </div>
  );
};
