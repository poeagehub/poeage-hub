import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useVendorAuth } from '../../context/AuthContext';
import {
  setDocument,
  getDocuments,
  where,
  friendlyError,
  uploadVendorProductImage,
  isStorageAvailable,
} from '@poeage/firebase-client';
import { compressImageToDataUrl } from '../../lib/imageCompress';
import { COLLECTION } from '@poeage/config';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@poeage/ui';
import { ArrowLeft, AlertCircle, Trash2, UploadCloud, Link2, Star, Loader2, Info } from 'lucide-react';
import type { Category } from '@poeage/types';

// ---------- helpers ----------

/** Keep only digits and one decimal point (max 2 decimals) and drop leading zeros ("060" -> "60"). */
function sanitizeMoney(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const [intPart = '', ...rest] = cleaned.split('.');
  const int = intPart.replace(/^0+(?=\d)/, '');
  if (rest.length === 0) return int;
  return `${int === '' ? '0' : int}.${rest.join('').slice(0, 2)}`;
}

function sanitizeInt(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
}

const toPaise = (v: string): number => Math.round((parseFloat(v) || 0) * 100);
const inr = (paise: number): string =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MAX_IMAGES = 8;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
// When Firebase Storage is not enabled, photos are compressed and kept inside the product record.
const MAX_EMBEDDED_IMAGES = 4;
const MAX_EMBEDDED_TOTAL_CHARS = 600_000;

interface MoneyInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  helper?: string | undefined;
  error?: string | undefined;
  placeholder?: string;
}

const MoneyInput: React.FC<MoneyInputProps> = ({ label, value, onChange, required, helper, error, placeholder }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        placeholder={placeholder ?? '0'}
        onChange={(e) => onChange(sanitizeMoney(e.target.value))}
        className={`w-full pl-7 pr-3.5 py-2 text-sm rounded-lg border bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
          error ? 'border-red-400' : 'border-gray-300'
        }`}
      />
    </div>
    {error ? (
      <p className="mt-1 text-xs text-red-600">{error}</p>
    ) : helper ? (
      <p className="mt-1 text-[11px] text-gray-400">{helper}</p>
    ) : null}
  </div>
);

interface GalleryImage {
  key: string;
  url: string;
  source: 'upload' | 'link' | 'embedded';
  progress?: number | undefined; // 0-100 while uploading
  error?: string | undefined;
}

// ---------- page ----------

export const CreateProductPage: React.FC = () => {
  const { vendor } = useVendorAuth();
  const navigate = useNavigate();
  const productIdRef = useRef(`prod-${Date.now()}`);

  const [name, setName] = useState('');
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  // pricing (all in rupees, held as text so the field can be freely edited)
  const [productionCost, setProductionCost] = useState('');
  const [mrp, setMrp] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [offerPrice, setOfferPrice] = useState('');

  const [stockQuantity, setStockQuantity] = useState('');
  const [reorderLevel, setReorderLevel] = useState('5');

  const [images, setImages] = useState<GalleryImage[]>([]);
  const [linkInput, setLinkInput] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [storageMode, setStorageMode] = useState<'checking' | 'cloud' | 'embedded'>('checking');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    getDocuments<Category>(COLLECTION.CATEGORIES, [where('isActive', '==', true)])
      .then((cats) => {
        const list = cats.sort((x, y) => (x.order ?? 0) - (y.order ?? 0)).map((c) => ({ id: c.slug, name: c.name }));
        setCategories(list);
        setCategoryId((prev) => prev || list[0]?.id || '');
      })
      .catch((err) => console.error('Failed to load categories:', err));
  }, []);

  // ----- pricing maths -----
  const commissionRate = vendor?.commissionRate ?? 0.1;
  const pricing = useMemo(() => {
    const cost = toPaise(productionCost);
    const mrpP = toPaise(mrp);
    const sellP = toPaise(sellingPrice);
    const offerP = offerPrice ? toPaise(offerPrice) : 0;
    const customerPays = offerP > 0 ? offerP : sellP;
    const commission = Math.round(customerPays * commissionRate);
    const payout = customerPays - commission;
    const profit = payout - cost;
    const reference = mrpP > 0 ? mrpP : sellP;
    const discountPct = reference > 0 && customerPays > 0 ? Math.round(((reference - customerPays) / reference) * 100) : 0;
    const marginPct = customerPays > 0 ? Math.round((profit / customerPays) * 100) : 0;
    return { cost, mrpP, sellP, offerP, customerPays, commission, payout, profit, discountPct, marginPct };
  }, [productionCost, mrp, sellingPrice, offerPrice, commissionRate]);

  const priceErrors = {
    mrp: pricing.mrpP > 0 && pricing.sellP > 0 && pricing.mrpP < pricing.sellP ? 'MRP cannot be lower than the selling price.' : undefined,
    offer: pricing.offerP > 0 && pricing.sellP > 0 && pricing.offerP >= pricing.sellP ? 'Offer price must be lower than the selling price.' : undefined,
  };

  // ----- gallery -----
  const patchImage = (key: string, patch: Partial<GalleryImage>) =>
    setImages((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const handleFiles = async (fileList: FileList | File[]) => {
    if (!vendor) return;
    const files = Array.from(fileList);
    setErrorMsg(null);

    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      setErrorMsg(`You can add up to ${MAX_IMAGES} images.`);
      return;
    }

    const cloud = storageMode === 'cloud' || (storageMode === 'checking' && (await isStorageAvailable()));
    if (storageMode === 'checking') setStorageMode(cloud ? 'cloud' : 'embedded');

    let embeddedCount = images.filter((i) => i.source === 'embedded').length;

    for (const file of files.slice(0, room)) {
      if (!file.type.startsWith('image/')) {
        setErrorMsg(`"${file.name}" is not an image file.`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setErrorMsg(`"${file.name}" is larger than 5 MB.`);
        continue;
      }
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      if (!cloud) {
        // Storage not enabled: compress and keep the photo inside the product record.
        if (embeddedCount >= MAX_EMBEDDED_IMAGES) {
          setErrorMsg(`Without cloud storage you can add up to ${MAX_EMBEDDED_IMAGES} uploaded photos. Use image links for more.`);
          break;
        }
        try {
          const dataUrl = await compressImageToDataUrl(file);
          embeddedCount += 1;
          setImages((prev) => [...prev, { key, url: dataUrl, source: 'embedded' }]);
        } catch (err) {
          console.error('Image compression failed:', err);
          setErrorMsg(friendlyError(err, `Could not process "${file.name}".`));
        }
        continue;
      }

      const localPreview = URL.createObjectURL(file);
      setImages((prev) => [...prev, { key, url: localPreview, source: 'upload', progress: 0 }]);
      try {
        const url = await uploadVendorProductImage(vendor.id, productIdRef.current, file, images.length, (p) =>
          patchImage(key, { progress: p.percentage }),
        );
        patchImage(key, { url, progress: undefined, error: undefined });
      } catch (err) {
        console.error('Image upload failed:', err);
        const message = friendlyError(err, 'Upload failed.');
        patchImage(key, { progress: undefined, error: 'Upload failed' });
        setErrorMsg(message);
      } finally {
        URL.revokeObjectURL(localPreview);
      }
    }
  };

  const addLinkImage = () => {
    setLinkError(null);
    const value = linkInput.trim();
    if (!value) {
      setLinkError('Paste an image link first.');
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      setLinkError('That is not a valid link. It should start with https://');
      return;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      setLinkError('Only http(s) image links are supported.');
      return;
    }
    if (images.length >= MAX_IMAGES) {
      setLinkError(`You can add up to ${MAX_IMAGES} images.`);
      return;
    }
    if (images.some((i) => i.url === value)) {
      setLinkError('That image is already added.');
      return;
    }
    setImages((prev) => [...prev, { key: `link-${Date.now()}`, url: value, source: 'link' }]);
    setLinkInput('');
  };

  const removeImage = (key: string) => setImages((prev) => prev.filter((i) => i.key !== key));
  const makeCover = (key: string) =>
    setImages((prev) => {
      const target = prev.find((i) => i.key === key);
      return target ? [target, ...prev.filter((i) => i.key !== key)] : prev;
    });

  const uploading = images.some((i) => i.progress !== undefined);
  const readyImages = images.filter((i) => i.progress === undefined && !i.error);

  // ----- submit -----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendor) return;
    setErrorMsg(null);

    if (!categoryId) return setErrorMsg('Please choose a category.');
    if (pricing.sellP <= 0) return setErrorMsg('Enter the selling price.');
    if (priceErrors.mrp) return setErrorMsg(priceErrors.mrp);
    if (priceErrors.offer) return setErrorMsg(priceErrors.offer);
    if (uploading) return setErrorMsg('Please wait for image uploads to finish.');
    if (readyImages.length === 0) return setErrorMsg('Add at least one product image.');
    const embeddedChars = readyImages.filter((i) => i.source === 'embedded').reduce((n, i) => n + i.url.length, 0);
    if (embeddedChars > MAX_EMBEDDED_TOTAL_CHARS) return setErrorMsg('The uploaded photos are too large together. Remove one or use image links.');
    if (stockQuantity === '') return setErrorMsg('Enter the initial stock units (0 if none).');

    setLoading(true);
    try {
      const productId = productIdRef.current;
      const slug = `${name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')}-${productId.slice(-5)}`;

      const tags = tagsInput
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      // basePrice = what the customer pays now; salePrice = MRP shown struck-through.
      const productDoc: Record<string, unknown> = {
        id: productId,
        vendorId: vendor.id,
        categoryId,
        name: name.trim(),
        slug,
        description: description.trim(),
        shortDescription: shortDescription.trim(),
        images: readyImages.map((i) => i.url),
        status: 'pending_review',
        basePrice: pricing.customerPays,
        sellingPrice: pricing.sellP,
        mrp: pricing.mrpP > 0 ? pricing.mrpP : pricing.sellP,
        commissionRate,
        tags,
        isFeatured: false,
        gstRate: 0.18,
        metadata: { totalSold: 0, totalRevenue: 0, averageRating: 0, totalRatings: 0, viewCount: 0 },
      };
      const mrpValue = productDoc['mrp'] as number;
      if (mrpValue > pricing.customerPays) productDoc['salePrice'] = mrpValue;
      if (pricing.offerP > 0) productDoc['offerPrice'] = pricing.offerP;
      if (pricing.cost > 0) productDoc['costPrice'] = pricing.cost;

      await setDocument(COLLECTION.PRODUCTS, productId, productDoc);

      await setDocument(COLLECTION.INVENTORY, productId, {
        id: productId,
        productId,
        vendorId: vendor.id,
        quantity: parseInt(stockQuantity, 10) || 0,
        reservedQuantity: 0,
        reorderLevel: parseInt(reorderLevel, 10) || 5,
      });

      navigate('/products', { replace: true });
    } catch (err: unknown) {
      console.error('Failed to create product:', err);
      setErrorMsg(friendlyError(err, 'Failed to create product.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/products" className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Add New Product</h2>
          <p className="text-xs text-gray-500">Provide product details, pricing, stock and images. New products are reviewed by the admin before going live.</p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Product Identification</CardTitle>
            <CardDescription>Primary information shown to shoppers on POEAGE HUB.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Product Title"
              required
              placeholder="e.g. Ergonomic Bluetooth Wireless Mouse"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Tags (comma-separated)"
                placeholder="tech, wireless, ergonomic, office"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
              />
            </div>

            <Input
              label="Short Catchy Tagline"
              placeholder="Comfortable wireless navigation with 18-month battery"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Description <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe product highlights, dimensions, box contents, and features..."
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Pricing & Commercials */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pricing & Commission</CardTitle>
            <CardDescription>
              Amounts are in Indian Rupees. The platform commission is set by the admin and is deducted from every sale.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <MoneyInput
                label="Production Cost"
                value={productionCost}
                onChange={setProductionCost}
                helper="What it costs you to make/buy one unit. Private — never shown to customers."
              />
              <MoneyInput
                label="MRP (Maximum Retail Price)"
                value={mrp}
                onChange={setMrp}
                error={priceErrors.mrp}
                helper="Printed list price. Shown struck-through to customers."
              />
              <MoneyInput
                label="Selling Price"
                required
                value={sellingPrice}
                onChange={setSellingPrice}
                helper="Your regular price to customers (at or below MRP)."
              />
              <MoneyInput
                label="Offer Price (optional)"
                value={offerPrice}
                onChange={setOfferPrice}
                error={priceErrors.offer}
                helper="Promotional price. If set, customers pay this instead of the selling price."
              />
            </div>

            {/* Commission + live breakdown */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" /> Platform commission (set by admin)
                </span>
                <span className="font-bold text-emerald-800 bg-white border border-emerald-200 rounded-full px-2.5 py-0.5">
                  {Number((commissionRate * 100).toFixed(1))}%
                </span>
              </div>

              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-white rounded-lg border border-emerald-100 p-3">
                  <dt className="text-gray-500">Customer pays</dt>
                  <dd className="mt-0.5 text-sm font-bold text-gray-900">{inr(pricing.customerPays)}</dd>
                  {pricing.discountPct > 0 && (
                    <dd className="text-[11px] text-green-600 font-semibold">{pricing.discountPct}% off MRP</dd>
                  )}
                </div>
                <div className="bg-white rounded-lg border border-emerald-100 p-3">
                  <dt className="text-gray-500">Commission</dt>
                  <dd className="mt-0.5 text-sm font-bold text-amber-700">− {inr(pricing.commission)}</dd>
                </div>
                <div className="bg-white rounded-lg border border-emerald-100 p-3">
                  <dt className="text-gray-500">Your payout</dt>
                  <dd className="mt-0.5 text-sm font-bold text-gray-900">{inr(pricing.payout)}</dd>
                </div>
                <div className="bg-white rounded-lg border border-emerald-100 p-3">
                  <dt className="text-gray-500">Profit / unit</dt>
                  <dd className={`mt-0.5 text-sm font-bold ${pricing.profit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {pricing.profit < 0 ? '− ' : ''}
                    {inr(Math.abs(pricing.profit))}
                  </dd>
                  {pricing.customerPays > 0 && (
                    <dd className="text-[11px] text-gray-500">{pricing.marginPct}% margin</dd>
                  )}
                </div>
              </dl>

              {pricing.customerPays > 0 && pricing.cost > 0 && pricing.profit < 0 && (
                <p className="text-xs text-red-600 font-medium">
                  Warning: after commission you would lose money on every unit. Consider raising the price.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stock & Inventory */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inventory Allocation</CardTitle>
            <CardDescription>Track live warehouse availability and prevent overselling.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Initial Stock Units <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={stockQuantity}
                placeholder="0"
                onChange={(e) => setStockQuantity(sanitizeInt(e.target.value))}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Low-Stock Alert Threshold</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={reorderLevel}
                placeholder="5"
                onChange={(e) => setReorderLevel(sanitizeInt(e.target.value))}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Image Gallery */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Product Gallery</CardTitle>
            <CardDescription>
              Upload up to {MAX_IMAGES} images (JPG/PNG/WebP, max 5 MB each). The first image is the cover.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {storageMode === 'embedded' && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                Cloud image storage isn't enabled yet, so uploaded photos are compressed and saved with the product
                (up to {MAX_EMBEDDED_IMAGES}). You can also paste image links.
              </p>
            )}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
                dragOver ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 hover:border-emerald-400 hover:bg-gray-50'
              }`}
            >
              <UploadCloud className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-800">Click to choose images, or drag & drop here</p>
              <p className="text-xs text-gray-400 mt-1">Uploaded securely to your store's storage</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) void handleFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>

            <div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link2 className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="…or paste an image link (https://…)"
                    value={linkInput}
                    onChange={(e) => {
                      setLinkInput(e.target.value);
                      setLinkError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addLinkImage();
                      }
                    }}
                    className="w-full pl-9 pr-3.5 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <Button type="button" variant="outline" onClick={addLinkImage}>
                  Add Link
                </Button>
              </div>
              {linkError && <p className="mt-1 text-xs text-red-600">{linkError}</p>}
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                {images.map((img, idx) => (
                  <div
                    key={img.key}
                    className={`relative rounded-lg overflow-hidden border aspect-square bg-gray-50 group ${
                      img.error ? 'border-red-300' : 'border-gray-200'
                    }`}
                  >
                    <img
                      src={img.url}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={() => patchImage(img.key, { error: 'Image could not be loaded' })}
                    />

                    {idx === 0 && !img.error && (
                      <span className="absolute top-1.5 left-1.5 bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                        Cover
                      </span>
                    )}

                    {img.progress !== undefined && (
                      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white text-xs gap-1">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {img.progress}%
                      </div>
                    )}

                    {img.error && (
                      <div className="absolute inset-0 bg-white/90 p-2 text-[11px] text-red-600 flex items-center justify-center text-center">
                        {img.error}
                      </div>
                    )}

                    <div className="absolute top-1.5 right-1.5 flex gap-1">
                      {idx !== 0 && !img.error && img.progress === undefined && (
                        <button
                          type="button"
                          title="Make cover image"
                          onClick={() => makeCover(img.key)}
                          className="bg-white text-amber-500 p-1 rounded-full shadow opacity-90 hover:opacity-100"
                        >
                          <Star className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        title="Remove"
                        onClick={() => removeImage(img.key)}
                        className="bg-red-600 text-white p-1 rounded-full shadow opacity-90 hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-4">
          <Link to="/products">
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 shadow-md"
            isLoading={loading}
            disabled={uploading}
          >
            Submit for Admin Moderation
          </Button>
        </div>
      </form>
    </div>
  );
};
