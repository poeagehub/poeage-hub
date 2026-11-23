import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createStableContext } from '@poeage/ui';
import { setDocument, subscribeToDocument } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import { useAuth } from './AuthContext';

interface WishlistContextType {
  ids: string[];
  has: (productId: string) => boolean;
  toggle: (productId: string) => void;
  count: number;
}

const KEY = 'poeage_wishlist';
const WishlistContext = createStableContext<WishlistContextType>('ShopWishlist', {
  ids: [],
  has: () => false,
  toggle: () => {},
  count: 0,
});

const readLocal = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

/** Saved items. Guests keep them on the device; signed-in customers get them stored in their account. */
export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [ids, setIds] = useState<string[]>(readLocal);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  }, [ids]);

  // Merge the account list with anything saved as a guest, then keep them in sync.
  useEffect(() => {
    if (!user) return;
    let merged = false;
    const unsub = subscribeToDocument<{ productIds?: string[] }>(
      COLLECTION.WISHLISTS,
      user.uid,
      (doc) => {
        const remote = doc?.productIds ?? [];
        if (!merged) {
          merged = true;
          const union = Array.from(new Set([...remote, ...readLocal()]));
          setIds(union);
          if (union.length !== remote.length) {
            setDocument(COLLECTION.WISHLISTS, user.uid, { userId: user.uid, productIds: union }, true).catch(() => {});
          }
        } else {
          setIds(remote);
        }
      },
      () => {},
    );
    return () => unsub();
  }, [user]);

  const toggle = useCallback(
    (productId: string) => {
      setIds((prev) => {
        const next = prev.includes(productId) ? prev.filter((i) => i !== productId) : [productId, ...prev];
        if (user) setDocument(COLLECTION.WISHLISTS, user.uid, { userId: user.uid, productIds: next }, true).catch(() => {});
        return next;
      });
    },
    [user],
  );

  const value = useMemo(() => ({ ids, has: (id: string) => ids.includes(id), toggle, count: ids.length }), [ids, toggle]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};

export const useWishlist = () => useContext(WishlistContext);
