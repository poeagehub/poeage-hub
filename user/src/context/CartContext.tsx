import { createStableContext } from '@poeage/ui';
import React, { useContext, useState, useEffect, useCallback } from 'react';
import type { CartItem, Product } from '@poeage/types';
import { useAuth } from './AuthContext';
import { getDocument, setDocument } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import { useSettings } from './SettingsContext';

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  deliveryCharge: number;
  couponCode: string | null;
  couponDiscount: number;
  grandTotal: number;
  addToCart: (product: Product, quantity?: number, variantId?: string) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  removeFromCart: (productId: string, variantId?: string) => void;
  clearCart: () => void;
  applyCoupon: (code: string) => Promise<{ success: boolean; message: string }>;
  removeCoupon: () => void;
}

const LOCAL_STORAGE_KEY = 'poeage_hub_cart';

const CartContext = createStableContext<CartContextType | undefined>('ShopCart', undefined);

/** Drop anything in a saved cart that is not a complete item, so an old or damaged entry can never crash the cart page. */
function cleanCartItems(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (i): i is CartItem =>
        !!i &&
        typeof i.productId === 'string' &&
        typeof i.vendorId === 'string' &&
        typeof i.name === 'string' &&
        Number.isFinite(i.quantity) &&
        i.quantity > 0 &&
        Number.isFinite(i.unitPrice) &&
        Number.isFinite(i.totalPrice),
    )
    .map((i) => ({ ...i, imageURL: typeof i.imageURL === 'string' ? i.imageURL : '' }));
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      return saved ? cleanCartItems(JSON.parse(saved)) : [];
    } catch {
      return [];
    }
  });

  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState<number>(0);

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.warn('Failed to save cart to localStorage', err);
    }
  }, [items]);

  // Load from Firestore when user logs in
  useEffect(() => {
    if (!user) return;

    const loadRemoteCart = async () => {
      try {
        const remote = await getDocument<{ items?: CartItem[]; couponCode?: string }>(
          COLLECTION.CARTS,
          user.uid
        );
        if (remote?.items && remote.items.length > 0) {
          // Merge remote items with local items (avoid duplicates)
          setItems((local) => {
            const merged = cleanCartItems(remote.items);
            for (const item of cleanCartItems(local)) {
              if (!merged.some((m) => m.productId === item.productId && m.variantId === item.variantId)) {
                merged.push(item);
              }
            }
            return merged;
          });
        }
      } catch (err) {
        console.warn('Could not sync remote cart:', err);
      }
    };

    loadRemoteCart();
  }, [user]);

  // Sync back to Firestore when items change and user is logged in
  useEffect(() => {
    if (!user) return;
    const saveRemoteCart = async () => {
      try {
        await setDocument(
          COLLECTION.CARTS,
          user.uid,
          {
            userId: user.uid,
            items,
            couponCode: couponCode || null,
            couponDiscount,
          },
          true
        );
      } catch (err) {
        console.warn('Failed to update remote cart:', err);
      }
    };

    const timeout = setTimeout(saveRemoteCart, 800);
    return () => clearTimeout(timeout);
  }, [items, user, couponCode, couponDiscount]);

  // Calculations
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const qualifiesForFreeDelivery =
    settings.freeDeliveryThreshold > 0 && subtotal >= settings.freeDeliveryThreshold;
  const deliveryCharge = items.length === 0 || qualifiesForFreeDelivery ? 0 : settings.deliveryChargeFlat;
  const grandTotal = Math.max(0, subtotal + deliveryCharge - couponDiscount);

  const addToCart = useCallback((product: Product, quantity = 1, variantId?: string) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex(
        (i) => i.productId === product.id && i.variantId === (variantId || undefined)
      );

      const unitPrice = product.basePrice;
      const imageURL = product.images?.[0] || '';

      if (existingIndex > -1) {
        const updated = [...prev];
        const existing = updated[existingIndex]!;
        const newQty = existing.quantity + quantity;
        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
          totalPrice: unitPrice * newQty,
        };
        return updated;
      }

      const newItem: CartItem = {
        productId: product.id,
        ...(variantId ? { variantId } : {}),
        vendorId: product.vendorId,
        name: product.name,
        imageURL,
        quantity,
        unitPrice,
        totalPrice: unitPrice * quantity,
      };

      return [...prev, newItem];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number, variantId?: string) => {
    if (quantity <= 0) {
      removeFromCart(productId, variantId);
      return;
    }

    setItems((prev) =>
      prev.map((item) => {
        if (item.productId === productId && item.variantId === (variantId || undefined)) {
          return {
            ...item,
            quantity,
            totalPrice: item.unitPrice * quantity,
          };
        }
        return item;
      })
    );
  }, []);

  const removeFromCart = useCallback((productId: string, variantId?: string) => {
    setItems((prev) =>
      prev.filter(
        (item) => !(item.productId === productId && item.variantId === (variantId || undefined))
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setCouponCode(null);
    setCouponDiscount(0);
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const applyCoupon = useCallback(async (code: string): Promise<{ success: boolean; message: string }> => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, message: 'Please enter a coupon code.' };
    }

    // Try fetching from Firestore collection
    try {
      const coupon = await getDocument<any>(COLLECTION.COUPONS, cleanCode);
      if (!coupon || !coupon.isActive) {
        return { success: false, message: 'Invalid or expired coupon code.' };
      }
      if (subtotal < (coupon.minOrderAmount || 0)) {
        return {
          success: false,
          message: `Minimum order amount for this coupon is ₹${((coupon.minOrderAmount || 0) / 100).toFixed(2)}.`,
        };
      }

      let discount = 0;
      if (coupon.discountType === 'percentage') {
        const calculated = Math.round((subtotal * coupon.discountValue) / 100);
        discount = coupon.maxDiscountAmount ? Math.min(calculated, coupon.maxDiscountAmount) : calculated;
      } else {
        discount = coupon.discountValue;
      }

      setCouponCode(cleanCode);
      setCouponDiscount(discount);
      return { success: true, message: `Coupon ${cleanCode} applied successfully!` };
    } catch {
      return { success: false, message: 'Could not validate coupon at this time.' };
    }
  }, [subtotal]);

  const removeCoupon = useCallback(() => {
    setCouponCode(null);
    setCouponDiscount(0);
  }, []);

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        subtotal,
        deliveryCharge,
        couponCode,
        couponDiscount,
        grandTotal,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        applyCoupon,
        removeCoupon,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
