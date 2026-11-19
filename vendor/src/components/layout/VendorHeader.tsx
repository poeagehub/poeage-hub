import React, { useState } from 'react';
import { updateDocument, friendlyError } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import { useVendorAuth } from '../../context/AuthContext';
import { LogOut, Power } from 'lucide-react';
import { Badge } from '@poeage/ui';

export const VendorHeader: React.FC = () => {
  const { vendor, signOutVendor } = useVendorAuth();
  const isOpen = vendor?.isOpen !== false;
  const [busy, setBusy] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  // Saved to your store record: while paused, customers cannot place new orders.
  const toggleStoreStatus = async () => {
    if (!vendor || busy) return;
    setBusy(true);
    setToggleError(null);
    try {
      await updateDocument(COLLECTION.VENDORS, vendor.id, { isOpen: !isOpen });
    } catch (err) {
      setToggleError(friendlyError(err, 'Could not change store status.'));
      setTimeout(() => setToggleError(null), 5000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between shadow-sm sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-gray-900">{vendor?.storeName || 'Seller Hub'}</h1>
        {vendor?.status === 'approved' ? <Badge variant="success">Merchant Verified</Badge> : <Badge variant="warning">Pending Review</Badge>}
      </div>

      <div className="flex items-center gap-4">
        {/* Store Open/Close Toggle */}
        {toggleError && <span className="text-xs text-red-600">{toggleError}</span>}
        <button
          onClick={toggleStoreStatus}
          disabled={busy}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            isOpen
              ? 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100'
              : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
          }`}
        >
          <Power className={`w-3.5 h-3.5 ${isOpen ? 'text-green-600' : 'text-gray-400'}`} />
          <span>{isOpen ? 'Store Open' : 'Store Paused'}</span>
        </button>

        {/* User profile & logout */}
        <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
            {vendor?.storeName?.[0]?.toUpperCase() || 'V'}
          </div>
          <button
            onClick={signOutVendor}
            title="Sign out of Vendor Portal"
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
