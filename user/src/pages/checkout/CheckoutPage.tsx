import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { formatMoney } from '@poeage/utils';
import {
  callFunction,
  getDocuments,
  createDocument,
  db,
  serverTimestamp,
  collection,
  doc,
  writeBatch,
  where,
  getDocument,
  getPlatformSettings,
  friendlyError,
} from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Address, Vendor } from '@poeage/types';
import { Button, Input, Card, Badge, Spinner } from '@poeage/ui';
import {
  MapPin,
  CreditCard,
  Banknote,
  ShieldCheck,
  Plus,
  ArrowRight,
  AlertCircle,
  Building,
  Home,
} from 'lucide-react';

export const CheckoutPage: React.FC = () => {
  const { user, profile } = useAuth();
  const { items, subtotal, deliveryCharge, couponCode, couponDiscount, grandTotal, clearCart } = useCart();
  const navigate = useNavigate();

  // Saved addresses
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [showAddressForm, setShowAddressForm] = useState(false);

  // New Address Form State
  const [newRecipientName, setNewRecipientName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newLine1, setNewLine1] = useState('');
  const [newLandmark, setNewLandmark] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');
  const [newPincode, setNewPincode] = useState('');
  const [newLabel, setNewLabel] = useState<'home' | 'work' | 'other'>('home');
  const [savingAddress, setSavingAddress] = useState(false);

  // Payment Selection
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'razorpay_card'>('cod');
  const [orderNotes, setOrderNotes] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // The place-order button sits at the bottom on phones, so bring a failure message into view.
  useEffect(() => {
    if (orderError) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [orderError]);

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0 && !placingOrder) {
      navigate('/cart');
    }
  }, [items, navigate, placingOrder]);

  // Load user's saved addresses
  useEffect(() => {
    if (!user) return;

    const fetchAddresses = async () => {
      setLoadingAddresses(true);
      try {
        const userAddrs = await getDocuments<Address>(COLLECTION.ADDRESSES, [where('userId', '==', user.uid)]);
        setAddresses(userAddrs);

        if (userAddrs.length > 0) {
          const defaultAddr = userAddrs.find((a) => a.isDefault) || userAddrs[0];
          setSelectedAddressId(defaultAddr!.id);
        } else {
          setShowAddressForm(true);
          if (profile?.displayName) setNewRecipientName(profile.displayName);
          if (profile?.phone) setNewPhone(profile.phone);
        }
      } catch (err) {
        console.warn('Failed to load addresses:', err);
        setShowAddressForm(true);
      } finally {
        setLoadingAddresses(false);
      }
    };

    fetchAddresses();
  }, [user, profile]);

  const handleSaveNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!newRecipientName || !newPhone || !newLine1 || !newCity || !newState || !newPincode) {
      alert('Please fill all required address fields.');
      return;
    }

    setSavingAddress(true);
    try {
      const addressData = {
        userId: user.uid,
        recipientName: newRecipientName.trim(),
        phone: newPhone.trim(),
        line1: newLine1.trim(),
        ...(newLandmark.trim() ? { landmark: newLandmark.trim() } : {}),
        city: newCity.trim(),
        state: newState.trim(),
        pincode: newPincode.trim(),
        country: 'India',
        label: newLabel,
        isDefault: addresses.length === 0,
      };

      const newId = await createDocument(COLLECTION.ADDRESSES, addressData);
      const created = {
        id: newId,
        ...addressData,
        createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
        updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
      } as Address;
      setAddresses((prev) => [...prev, created]);
      setSelectedAddressId(newId);
      setShowAddressForm(false);
    } catch (err) {
      console.error('Failed to save address:', err);
      alert('Could not save address. Please try again.');
    } finally {
      setSavingAddress(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!user) {
      navigate('/login?redirect=/checkout');
      return;
    }

    const selectedAddr = addresses.find((a) => a.id === selectedAddressId);
    if (!selectedAddr) {
      setOrderError('Please select or add a delivery address to proceed.');
      return;
    }

    setPlacingOrder(true);
    setOrderError(null);

    const orderPayload = {
      items: items.map((it) => ({
        productId: it.productId,
        ...(it.variantId ? { variantId: it.variantId } : {}),
        quantity: it.quantity,
      })),
      shippingAddress: {
        recipientName: selectedAddr.recipientName,
        phone: selectedAddr.phone,
        line1: selectedAddr.line1,
        ...(selectedAddr.landmark ? { landmark: selectedAddr.landmark } : {}),
        city: selectedAddr.city,
        state: selectedAddr.state,
        pincode: selectedAddr.pincode,
        country: selectedAddr.country || 'India',
        label: selectedAddr.label || 'home',
      },
      paymentMethod,
      ...(couponCode ? { couponCode } : {}),
      ...(orderNotes.trim() ? { notes: orderNotes.trim() } : {}),
    };

    try {
      // 1. Try server-side Cloud Function first
      try {
        const res = await callFunction<{ success: boolean; orderId: string; orderNumber: string }>(
          'createOrder',
          orderPayload
        );
        if (res && res.orderId) {
          clearCart();
          navigate(`/order-success/${res.orderId}`, { state: { orderNumber: res.orderNumber } });
          return;
        }
      } catch (fnErr) {
        console.warn('Cloud Function createOrder unavailable or failed, applying client transaction fallback:', fnErr);
      }

      // 2. Cloud Functions are not available on this project plan, so the order is written directly.
      //    Firestore security rules re-verify the totals, the delivery fee (admin settings) and each
      //    vendor's commission before accepting anything.
      const liveSettings = await getPlatformSettings();
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const orderNumber = `PHB-${datePart}-${randomSuffix}`;

      const masterOrderRef = doc(collection(db, COLLECTION.ORDERS));
      const orderId = masterOrderRef.id;

      const batch = writeBatch(db);

      // Group items by vendor
      const itemsByVendor = new Map<string, typeof items>();
      for (const item of items) {
        const list = itemsByVendor.get(item.vendorId) || [];
        list.push(item);
        itemsByVendor.set(item.vendorId, list);
      }

      const vendorOrderIds: string[] = [];

      for (const [vendorId, vendorItems] of itemsByVendor.entries()) {
        const vendorDoc = await getDocument<Vendor>(COLLECTION.VENDORS, vendorId);
        if (!vendorDoc || vendorDoc.status !== 'approved') {
          throw new Error('Some items in your cart are from a store that is not accepting orders right now. Please remove them and try again.');
        }
        if (vendorDoc.isOpen === false) {
          throw new Error(`${vendorDoc.storeName} has paused new orders for now. Please remove their items or try again later.`);
        }

        // Make sure the seller still has enough stock for what is in the cart.
        const wanted = new Map<string, { qty: number; name: string }>();
        for (const it of vendorItems) {
          const w = wanted.get(it.productId) ?? { qty: 0, name: it.name };
          w.qty += it.quantity;
          wanted.set(it.productId, w);
        }
        for (const [pid, w] of wanted) {
          const inv = await getDocument<{ quantity: number; reservedQuantity?: number }>(COLLECTION.INVENTORY, pid).catch(() => null);
          if (inv && inv.quantity - (inv.reservedQuantity ?? 0) < w.qty) {
            const left = Math.max(0, inv.quantity - (inv.reservedQuantity ?? 0));
            throw new Error(
              left === 0
                ? `"${w.name}" is out of stock. Please remove it from your cart.`
                : `Only ${left} of "${w.name}" left in stock. Please reduce the quantity.`,
            );
          }
        }

        const vOrderRef = doc(collection(db, COLLECTION.VENDOR_ORDERS));
        const vOrderId = vOrderRef.id;
        vendorOrderIds.push(vOrderId);

        const vSubtotal = vendorItems.reduce((acc, it) => acc + it.totalPrice, 0);
        const vCommission = Math.round(vSubtotal * vendorDoc.commissionRate);
        const vEarning = vSubtotal - vCommission;

        const deliveryRef = doc(collection(db, COLLECTION.DELIVERIES));
        const deliveryId = deliveryRef.id;
        const verificationOtp = String(Math.floor(1000 + Math.random() * 9000));

        // Handover PIN lives in its own document so drivers can never read it before delivery.
        batch.set(doc(db, 'deliveryOtps', deliveryId), {
          deliveryId,
          orderId,
          customerId: user.uid,
          otp: verificationOtp,
          createdAt: serverTimestamp(),
        });

        // Delivery doc
        batch.set(deliveryRef, {
          id: deliveryId,
          orderId,
          vendorOrderId: vOrderId,
          customerId: user.uid,
          vendorId,
          status: 'pending_assignment',
          pickupAddress: {
            line1: vendorDoc.address?.line1 ?? '',
            city: vendorDoc.address?.city ?? '',
            state: vendorDoc.address?.state ?? '',
            pincode: vendorDoc.address?.pincode ?? (vendorDoc.address as { postalCode?: string } | undefined)?.postalCode ?? '',
            label: vendorDoc.storeName,
          },
          deliveryAddress: orderPayload.shippingAddress,
          driverEarning: liveSettings.driverEarningPerDelivery,
          statusHistory: [
            {
              status: 'pending_assignment',
              timestamp: new Date().toISOString(),
              note: 'Order confirmed, pending driver dispatch',
            },
          ],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Vendor order doc
        batch.set(vOrderRef, {
          id: vOrderId,
          orderId,
          customerId: user.uid,
          vendorId,
          storeName: vendorDoc.storeName,
          items: vendorItems,
          status: 'pending',
          subtotal: vSubtotal,
          commissionAmount: vCommission,
          vendorEarning: vEarning,
          deliveryId,
          statusHistory: [
            {
              status: 'pending',
              timestamp: new Date().toISOString(),
              note: 'Vendor sub-order initialized',
            },
          ],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // Master order doc. Product prices are GST-inclusive, so GST is the tax portion already inside the subtotal.
      const includedGst = Math.round(subtotal - subtotal / (1 + liveSettings.defaultGstRate));
      batch.set(masterOrderRef, {
        id: orderId,
        customerId: user.uid,
        orderNumber,
        status: 'confirmed',
        items,
        pricing: {
          subtotal,
          couponDiscount,
          deliveryCharge,
          gstTotal: includedGst,
          grandTotal,
        },
        shippingAddress: orderPayload.shippingAddress,
        paymentMethod: 'cod',
        couponCode: couponCode || null,
        vendorOrderIds,
        notes: orderNotes,
        statusHistory: [
          {
            status: 'confirmed',
            timestamp: new Date().toISOString(),
            note: 'Order confirmed via Cash on Delivery',
            actorId: user.uid,
          },
        ],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // If the connection drops mid-write Firestore queues the write and never rejects, so stop waiting
      // after a while instead of spinning forever.
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<'timeout'>((resolve) => {
        timer = setTimeout(() => resolve('timeout'), 20000);
      });
      const outcome = await Promise.race([batch.commit().then(() => 'ok' as const), timeout]);
      if (timer) clearTimeout(timer);

      if (outcome === 'timeout') {
        setOrderError(
          'Your internet connection dropped while placing the order. It may still go through once you are back online — please check "My Orders" before trying again, so you do not order twice.',
        );
        return;
      }

      clearCart();
      navigate(`/order-success/${orderId}`, { state: { orderNumber } });
    } catch (err: unknown) {
      console.error('Order creation error:', err);
      setOrderError(friendlyError(err, 'Failed to complete order. Please try again.'));
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 pb-32 lg:pb-8">
      {/* Breadcrumb / Title */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
          <Link to="/cart" className="hover:text-blue-600">Cart</Link>
          <span>/</span>
          <span className="text-gray-900 font-semibold">Secure Checkout</span>
        </div>
        <h1 className="text-xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Checkout</h1>
      </div>

      {orderError && (
        <div role="alert" className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span className="min-w-0 break-words">{orderError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 items-start">
        {/* Left Column: Checkout Steps */}
        <div className="lg:col-span-8 space-y-4 sm:space-y-6">
          {/* STEP 1: Delivery Address */}
          <Card className="p-4 sm:p-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                  1
                </div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900">Delivery Address</h2>
              </div>
              {!showAddressForm && (
                <button
                  type="button"
                  onClick={() => setShowAddressForm(true)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add New
                </button>
              )}
            </div>

            {loadingAddresses ? (
              <div className="py-8 flex justify-center">
                <Spinner size="md" />
              </div>
            ) : showAddressForm ? (
              /* Add New Address Form */
              <form onSubmit={handleSaveNewAddress} className="mt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Recipient Full Name"
                    autoComplete="name"
                    placeholder="e.g. Rahul Sharma"
                    value={newRecipientName}
                    onChange={(e) => setNewRecipientName(e.target.value)}
                    required
                  />
                  <Input
                    label="Contact Phone Number"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={13}
                    placeholder="10-digit mobile number"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    required
                  />
                </div>

                <Input
                  label="Street Address / House No. / Area"
                  autoComplete="address-line1"
                  placeholder="Flat 302, Green Valley Apartments, 5th Cross"
                  value={newLine1}
                  onChange={(e) => setNewLine1(e.target.value)}
                  required
                />

                <Input
                  label="Landmark (Optional)"
                  placeholder="Near Metro Station or City Hospital"
                  value={newLandmark}
                  onChange={(e) => setNewLandmark(e.target.value)}
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input
                    label="City"
                    autoComplete="address-level2"
                    placeholder="Mumbai / Bengaluru"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    required
                  />
                  <Input
                    label="State"
                    autoComplete="address-level1"
                    placeholder="Maharashtra / Karnataka"
                    value={newState}
                    onChange={(e) => setNewState(e.target.value)}
                    required
                  />
                  <Input
                    label="PIN Code"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    maxLength={6}
                    placeholder="e.g. 560001"
                    value={newPincode}
                    onChange={(e) => setNewPincode(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>

                {/* Address Tag */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Address Type</label>
                  <div className="flex gap-3">
                    {(['home', 'work', 'other'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setNewLabel(t)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold capitalize flex items-center gap-1.5 ${
                          newLabel === t
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {t === 'home' && <Home className="w-3.5 h-3.5" />}
                        {t === 'work' && <Building className="w-3.5 h-3.5" />}
                        {t === 'other' && <MapPin className="w-3.5 h-3.5" />}
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={savingAddress}
                    className="bg-blue-600 text-white font-semibold"
                  >
                    {savingAddress ? 'Saving Address...' : 'Save and Use This Address'}
                  </Button>
                  {addresses.length > 0 && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowAddressForm(false)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            ) : (
              /* Saved Address Cards */
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {addresses.map((addr) => {
                  const isSelected = selectedAddressId === addr.id;
                  return (
                    <div
                      key={addr.id}
                      onClick={() => setSelectedAddressId(addr.id)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-gray-900 text-sm">{addr.recipientName}</span>
                        <Badge
                          variant={addr.label === 'home' ? 'default' : 'outline'}
                          className="capitalize text-[10px]"
                        >
                          {addr.label || 'Home'}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {addr.line1}
                        {addr.landmark && `, ${addr.landmark}`}
                        <br />
                        {addr.city}, {addr.state} - {addr.pincode}
                      </p>
                      <p className="text-xs text-gray-500 mt-2 font-medium">📞 {addr.phone}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* STEP 2: Payment Method */}
          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100 mb-4">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                2
              </div>
              <h2 className="text-lg font-bold text-gray-900">Payment Option</h2>
            </div>

            <div className="space-y-3">
              {/* Cash on Delivery */}
              <label
                onClick={() => setPaymentMethod('cod')}
                className={`p-4 rounded-xl border-2 flex items-start gap-4 cursor-pointer transition-all ${
                  paymentMethod === 'cod'
                    ? 'border-blue-600 bg-blue-50/50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === 'cod'}
                  onChange={() => setPaymentMethod('cod')}
                  className="mt-1 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-5 h-5 text-green-600" />
                    <span className="font-bold text-gray-900 text-sm">Cash on Delivery (COD)</span>
                    <Badge variant="success" className="text-[10px]">Zero Extra Fee</Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Pay with Cash, Google Pay, PhonePe, or UPI upon doorstep parcel arrival.
                  </p>
                </div>
              </label>

              {/* Online Payment */}
              <label
                aria-disabled="true"
                className="p-4 rounded-xl border-2 border-gray-200 bg-gray-50 flex items-start gap-4 cursor-not-allowed opacity-70"
              >
                <input type="radio" name="paymentMethod" disabled className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    <span className="font-bold text-gray-900 text-sm">
                      Online Payment (UPI, Credit/Debit Card, NetBanking)
                    </span>
                    <Badge variant="default" className="text-[10px]">Coming soon</Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Online payments are not enabled yet. Please choose Cash on Delivery.
                  </p>
                </div>
              </label>
            </div>

            {/* Delivery Instructions */}
            <div className="mt-5 pt-4 border-t border-gray-100">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Delivery Instructions or Notes (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Leave with security guard, call before arriving..."
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white text-gray-900 placeholder-gray-400 border border-gray-300 hover:border-gray-400 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none transition-colors"
              />
              <p className="mt-1 text-[11px] text-gray-400">Shared with the delivery partner. Do not include payment or personal ID details.</p>
            </div>
          </Card>
        </div>

        {/* Right Column: Order Confirmation Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="p-4 sm:p-6">
            <h3 className="font-bold text-gray-900 text-base pb-3 border-b border-gray-100 mb-4">
              Items in Order ({items.length})
            </h3>

            {/* Mini Items List */}
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1 divide-y divide-gray-50">
              {items.map((item) => (
                <div key={`${item.productId}-${item.variantId || 'base'}`} className="pt-2 flex items-center gap-3">
                  {item.imageURL ? (
                    <img
                      src={item.imageURL}
                      alt={item.name}
                      loading="lazy"
                      className="w-12 h-12 object-cover rounded-lg border border-gray-100 flex-shrink-0 bg-gray-50"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg border border-gray-100 bg-gray-50 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 line-clamp-2 leading-snug">{item.name}</p>
                    <p className="text-[11px] text-gray-500">Qty: {item.quantity}</p>
                  </div>
                  <span className="text-xs font-bold text-gray-900">{formatMoney(item.totalPrice)}</span>
                </div>
              ))}
            </div>

            {/* Price Summary */}
            <div className="mt-4 pt-4 border-t border-gray-200 space-y-2.5 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="font-semibold text-gray-900">{formatMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Shipping Charge</span>
                {deliveryCharge === 0 ? (
                  <span className="font-semibold text-green-600">FREE</span>
                ) : (
                  <span className="font-semibold text-gray-900">{formatMoney(deliveryCharge)}</span>
                )}
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-green-600 font-semibold">
                  <span>Coupon Discount ({couponCode})</span>
                  <span>-{formatMoney(couponDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-500 text-[10px]">
                <span>Taxes</span>
                <span>Included in price</span>
              </div>
              <div className="pt-3 border-t border-gray-200 flex justify-between items-baseline">
                <span className="text-sm font-bold text-gray-900">Total Payable</span>
                <span className="text-xl font-black text-blue-600">{formatMoney(grandTotal)}</span>
              </div>
            </div>

            {/* Place Order CTA */}
            <div className="mt-6 hidden lg:block">
              <Button
                onClick={handlePlaceOrder}
                disabled={placingOrder || (!selectedAddressId && !showAddressForm)}
                size="lg"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 py-3.5"
              >
                {placingOrder ? (
                  <>
                    <Spinner size="sm" />
                    Placing Order...
                  </>
                ) : (
                  <>
                    Place Order ({formatMoney(grandTotal)})
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-center gap-2 text-[11px] text-gray-500">
              <ShieldCheck className="w-4 h-4 text-green-600" />
              <span>Safe & Authoritative Multi-Vendor Checkout</span>
            </div>
          </Card>
        </div>
      </div>

      {/* Phone: place-order bar pinned to the bottom */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,.08)] px-3 pt-2.5 pb-3 pb-safe flex items-center gap-3">
        <div className="min-w-0">
          <p className="text-[10px] text-gray-500 leading-none">Total payable</p>
          <p className="text-lg font-black text-blue-600 leading-tight">{formatMoney(grandTotal)}</p>
        </div>
        <button
          onClick={handlePlaceOrder}
          disabled={placingOrder || (!selectedAddressId && !showAddressForm)}
          className="flex-1 h-12 rounded-xl bg-blue-600 active:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md"
        >
          {placingOrder ? (
            <>
              <Spinner size="sm" />
              Placing order...
            </>
          ) : (
            <>
              Place order
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
