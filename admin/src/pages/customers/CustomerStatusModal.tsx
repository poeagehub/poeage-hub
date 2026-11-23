import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type { UserProfile, AccountStatus } from '@poeage/types';
import { Button } from '@poeage/ui';
import { AlertTriangle, ShieldCheck, ShieldAlert, X } from 'lucide-react';

interface CustomerStatusModalProps {
  isOpen: boolean;
  customer: UserProfile | null;
  onClose: () => void;
  onConfirm: (targetStatus: AccountStatus, reason?: string) => Promise<void>;
  isSubmitting: boolean;
}

export const CustomerStatusModal: React.FC<CustomerStatusModalProps> = ({
  isOpen,
  customer,
  onClose,
  onConfirm,
  isSubmitting,
}) => {
  if (!isOpen || !customer || typeof document === 'undefined') return null;

  const isCurrentlyActive = customer.status === 'active';
  const targetStatus: AccountStatus = isCurrentlyActive ? 'suspended' : 'active';
  const [reason, setReason] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm(targetStatus, reason.trim() || undefined);
    setReason('');
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="flex min-h-full items-center justify-center p-4 text-center">
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className="relative bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden text-left my-auto animate-in fade-in zoom-in-95 duration-150"
        >
        {/* Header */}
        <div
          className={`p-5 flex items-center justify-between border-b ${
            isCurrentlyActive ? 'bg-amber-50/70 border-amber-100' : 'bg-emerald-50/70 border-emerald-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isCurrentlyActive ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {isCurrentlyActive ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {isCurrentlyActive ? 'Suspend Customer Account' : 'Reactivate Customer Account'}
              </h3>
              <p className="text-xs text-gray-500">Security & compliance enforcement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Customer Name:</span>
              <span className="font-semibold text-gray-900">{customer.displayName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Email:</span>
              <span className="font-semibold text-gray-900">{customer.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Current Status:</span>
              <span
                className={`font-bold capitalize ${
                  customer.status === 'active'
                    ? 'text-emerald-600'
                    : customer.status === 'suspended'
                    ? 'text-rose-600'
                    : 'text-amber-600'
                }`}
              >
                {customer.status}
              </span>
            </div>
          </div>

          {isCurrentlyActive ? (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <p>
                Suspending this account will immediately revoke checkout rights and invalidate active sessions. The customer
                cannot place orders until reactivated.
              </p>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <p>
                Reactivating this account will restore full ordering privileges and allow the customer to sign in to POEAGE HUB.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Reason / Compliance Note <span className="text-gray-400 font-normal">(Optional, saved to audit log)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                isCurrentlyActive
                  ? 'e.g. Chargeback dispute, suspicious fraud score, policy violation...'
                  : 'e.g. Identity verified by support team, dispute resolved...'
              }
              rows={3}
              className="w-full text-xs p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={isCurrentlyActive ? 'danger' : 'primary'}
              size="sm"
              isLoading={isSubmitting}
            >
              {isCurrentlyActive ? 'Confirm Suspension' : 'Confirm Reactivation'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  </div>,
  document.body,
);
};
