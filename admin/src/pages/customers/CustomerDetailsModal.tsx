import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { UserProfile, Order, Address, AuditLog, AccountStatus } from '@poeage/types';
import { formatMoney, formatDate, formatDateTime, formatRelativeTime } from '@poeage/utils';
import { Button, Badge, Spinner } from '@poeage/ui';
import {
  X,
  User,
  ShoppingBag,
  MapPin,
  Shield,
  Phone,
  Mail,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Copy,
  ExternalLink,
  Save,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  CreditCard,
  Plus,
} from 'lucide-react';
import {
  getCustomerOrders,
  getCustomerAddresses,
  getCustomerAuditLogs,
  updateCustomerProfile,
  addCustomerAdminNote,
  safeFormatDate,
  safeFormatDateTime,
} from '../../lib/customers';
import { useAdminAuth } from '../../context/AuthContext';

interface CustomerDetailsModalProps {
  isOpen: boolean;
  customer: UserProfile | null;
  onClose: () => void;
  onCustomerUpdated: (updated: UserProfile) => void;
  onRequestStatusToggle: (customer: UserProfile) => void;
}

export const CustomerDetailsModal: React.FC<CustomerDetailsModalProps> = ({
  isOpen,
  customer,
  onClose,
  onCustomerUpdated,
  onRequestStatusToggle,
}) => {
  if (!isOpen || !customer || typeof document === 'undefined') return null;

  const { user: adminUser } = useAdminAuth();

  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'addresses' | 'audit'>('overview');
  const [copiedUid, setCopiedUid] = useState(false);

  // Edit profile state
  const [displayName, setDisplayName] = useState(customer.displayName || '');
  const [phone, setPhone] = useState(customer.phone || '');
  const [status, setStatus] = useState<AccountStatus>(customer.status);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);

  // Async tab data
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // New admin note
  const [newNote, setNewNote] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Sync state if customer changes
  useEffect(() => {
    setDisplayName(customer.displayName || '');
    setPhone(customer.phone || '');
    setStatus(customer.status);
    setProfileSuccessMsg(null);
  }, [customer]);

  // Lazy-load tab data
  useEffect(() => {
    if (activeTab === 'orders') {
      setOrdersLoading(true);
      getCustomerOrders(customer.uid)
        .then(setOrders)
        .finally(() => setOrdersLoading(false));
    } else if (activeTab === 'addresses') {
      setAddressesLoading(true);
      getCustomerAddresses(customer.uid)
        .then(setAddresses)
        .finally(() => setAddressesLoading(false));
    } else if (activeTab === 'audit') {
      setAuditLoading(true);
      getCustomerAuditLogs(customer.uid)
        .then(setAuditLogs)
        .finally(() => setAuditLoading(false));
    }
  }, [activeTab, customer.uid]);

  const copyUidToClipboard = () => {
    navigator.clipboard.writeText(customer.uid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileSuccessMsg(null);
    try {
      await updateCustomerProfile(
        customer.uid,
        {
          displayName,
          phone,
          status,
        },
        { uid: adminUser?.uid || 'admin', email: adminUser?.email || 'admin123@gmail.com' }
      );

      const updatedCustomer: UserProfile = {
        ...customer,
        displayName,
        phone,
        status,
      };
      onCustomerUpdated(updatedCustomer);
      setProfileSuccessMsg('Customer profile updated successfully!');
      setTimeout(() => setProfileSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err?.message || 'Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAddAdminNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setIsSubmittingNote(true);
    try {
      await addCustomerAdminNote(customer.uid, newNote.trim(), {
        uid: adminUser?.uid || 'admin',
        email: adminUser?.email || 'admin123@gmail.com',
      });
      setNewNote('');
      // Reload audit logs
      const updated = await getCustomerAuditLogs(customer.uid);
      setAuditLogs(updated);
    } catch (err: any) {
      alert(err?.message || 'Failed to record audit note.');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Financial aggregates
  const totalOrdersCount = customer.metadata?.totalOrders || orders.length;
  const totalSpentPaise = customer.metadata?.totalSpent || 0;
  const avgOrderValue = totalOrdersCount > 0 ? Math.round(totalSpentPaise / totalOrdersCount) : 0;

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="flex min-h-full items-center justify-center p-3 sm:p-6 text-center">
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className="relative bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[calc(100vh-3.5rem)] my-auto text-left animate-in fade-in zoom-in-95 duration-150"
        >
        {/* Modal Top Header */}
        <div className="p-6 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-500 text-white font-black text-xl flex items-center justify-center shadow-lg border border-white/20 shrink-0">
              {customer.displayName?.[0]?.toUpperCase() || customer.email?.[0]?.toUpperCase() || 'C'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black tracking-tight text-white">{customer.displayName}</h2>
                <Badge
                  variant={customer.status === 'active' ? 'success' : customer.status === 'suspended' ? 'danger' : 'warning'}
                  className="capitalize font-bold text-[10px]"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full mr-1 ${
                      customer.status === 'active'
                        ? 'bg-green-500'
                        : customer.status === 'suspended'
                        ? 'bg-red-500'
                        : 'bg-amber-500'
                    }`}
                  />
                  {customer.status}
                </Badge>
                {(customer.roles || []).map((r) => (
                  <span
                    key={r}
                    className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-semibold border border-slate-700 capitalize"
                  >
                    {r}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-300 mt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-primary-400" />
                  {customer.email}
                </span>
                {customer.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    {customer.phone}
                  </span>
                )}
                <button
                  onClick={copyUidToClipboard}
                  title="Click to copy UID"
                  className="flex items-center gap-1 font-mono text-[11px] text-slate-400 hover:text-white bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700 transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  <span>{customer.uid.slice(0, 14)}…</span>
                  {copiedUid && <span className="text-green-400 font-bold ml-1">Copied!</span>}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <Button
              variant={customer.status === 'active' ? 'danger' : 'primary'}
              size="sm"
              onClick={() => onRequestStatusToggle(customer)}
              className="flex items-center gap-1.5 text-xs font-bold"
            >
              {customer.status === 'active' ? (
                <>
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Suspend Account
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Reactivate
                </>
              )}
            </Button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 4 Stat Overview Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 border-b border-gray-200">
          <div className="p-3 bg-white rounded-xl border border-gray-200/80 shadow-xs">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Lifetime Spend</p>
            <p className="text-lg font-black text-gray-900 mt-0.5">{formatMoney(totalSpentPaise)}</p>
          </div>
          <div className="p-3 bg-white rounded-xl border border-gray-200/80 shadow-xs">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total Orders</p>
            <p className="text-lg font-black text-primary-600 mt-0.5">{totalOrdersCount}</p>
          </div>
          <div className="p-3 bg-white rounded-xl border border-gray-200/80 shadow-xs">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Avg Order Value</p>
            <p className="text-lg font-black text-gray-900 mt-0.5">{formatMoney(avgOrderValue)}</p>
          </div>
          <div className="p-3 bg-white rounded-xl border border-gray-200/80 shadow-xs">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Member Since</p>
            <p className="text-xs font-bold text-gray-900 mt-1.5">{safeFormatDate(customer.createdAt)}</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 px-6 bg-white gap-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Profile & Account</span>
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`py-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'orders'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Order History</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-gray-100 text-[10px] text-gray-600">
              {totalOrdersCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('addresses')}
            className={`py-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'addresses'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Saved Addresses</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`py-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'audit'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Audit Trail & Notes</span>
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="p-6 overflow-y-auto flex-1 bg-white">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-2xl">
              {profileSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{profileSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="border border-gray-200 rounded-xl p-5 space-y-4 shadow-xs">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-primary-600" />
                    Edit Customer Information
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Display Name</label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Email (Auth Identity)</label>
                      <input
                        type="email"
                        disabled
                        value={customer.email}
                        className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Account Status</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as AccountStatus)}
                        className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                      >
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                        <option value="pending_verification">Pending Verification</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button type="submit" size="sm" variant="primary" isLoading={isSavingProfile}>
                      <Save className="w-3.5 h-3.5 mr-1" />
                      Save Profile Changes
                    </Button>
                  </div>
                </div>
              </form>

              {/* Technical / Meta Box */}
              <div className="border border-gray-200 rounded-xl p-5 space-y-3 bg-gray-50 text-xs">
                <h4 className="font-bold text-gray-900">System Records & Security Meta</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-gray-600">
                  <div>
                    <span className="text-gray-400 block text-[11px]">Unique User ID:</span>
                    <span className="font-mono text-gray-800 break-all">{customer.uid}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[11px]">Primary Role:</span>
                    <span className="capitalize font-semibold text-gray-800">{customer.roles?.join(', ')}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[11px]">Created At:</span>
                    <span>{safeFormatDateTime(customer.createdAt)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[11px]">Last Profile Update:</span>
                    <span>{safeFormatDateTime(customer.updatedAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ORDERS */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">Customer Purchase Records</h3>
                <span className="text-xs text-gray-500">Live query from /orders</span>
              </div>

              {ordersLoading ? (
                <div className="py-16 flex justify-center">
                  <Spinner size="lg" />
                </div>
              ) : orders.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-gray-300 rounded-xl bg-gray-50/50">
                  <ShoppingBag className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-gray-800">No Orders Placed Yet</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Orders placed on the consumer store will appear here in real-time.
                  </p>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 text-gray-500 uppercase font-bold border-b border-gray-200">
                      <tr>
                        <th className="py-3 px-4">Order #</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Items</th>
                        <th className="py-3 px-4">Payment</th>
                        <th className="py-3 px-4 text-right">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {orders.map((o) => (
                        <tr key={o.id} className="hover:bg-gray-50/60">
                          <td className="py-3 px-4 font-bold text-gray-900 font-mono">
                            {o.orderNumber || o.id.slice(0, 10)}
                          </td>
                          <td className="py-3 px-4 text-gray-500">{safeFormatDate(o.createdAt)}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                                o.status === 'delivered'
                                  ? 'bg-green-100 text-green-700'
                                  : o.status === 'cancelled'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-primary-100 text-primary-700'
                              }`}
                            >
                              {o.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {o.items?.length || 1} item{((o.items?.length || 1) > 1 ? 's' : '')}
                          </td>
                          <td className="py-3 px-4 font-semibold uppercase text-gray-500">
                            {o.paymentMethod || 'COD'}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-gray-900">
                            {formatMoney(o.pricing?.grandTotal || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ADDRESSES */}
          {activeTab === 'addresses' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">Saved Shipping Addresses</h3>
                <span className="text-xs text-gray-500">Managed by customer in storefront</span>
              </div>

              {addressesLoading ? (
                <div className="py-16 flex justify-center">
                  <Spinner size="lg" />
                </div>
              ) : addresses.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-gray-300 rounded-xl bg-gray-50/50">
                  <MapPin className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-gray-800">No Saved Delivery Addresses</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Customer hasn't registered an address yet.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {addresses.map((addr) => (
                    <div
                      key={addr.id}
                      className={`p-4 rounded-xl border relative space-y-2 ${
                        addr.isDefault || addr.id === customer.defaultAddressId
                          ? 'border-primary-400 bg-primary-50/30'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-primary-600" />
                          {addr.label || 'Home'}
                        </span>
                        {(addr.isDefault || addr.id === customer.defaultAddressId) && (
                          <span className="px-2 py-0.5 bg-primary-600 text-white text-[10px] font-bold rounded-full">
                            Default Address
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-bold text-gray-900">{addr.recipientName || customer.displayName}</p>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {addr.line1}
                        {addr.line2 && `, ${addr.line2}`}
                        <br />
                        {addr.city}, {addr.state} - <span className="font-semibold">{addr.pincode}</span>
                      </p>
                      {addr.phone && (
                        <p className="text-[11px] text-gray-500 flex items-center gap-1 pt-1 border-t border-gray-100">
                          <Phone className="w-3 h-3" />
                          {addr.phone}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="space-y-6">
              {/* Note input box */}
              <form onSubmit={handleAddAdminNote} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-primary-600" />
                  Append Internal Compliance Note / Flag
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="e.g. Identity verified via phone, customer reported delayed shipment..."
                    className="flex-1 text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                  />
                  <Button type="submit" size="sm" variant="primary" isLoading={isSubmittingNote} disabled={!newNote.trim()}>
                    Log Note
                  </Button>
                </div>
              </form>

              {/* Audit history list */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Historical Audit Logs</h4>

                {auditLoading ? (
                  <div className="py-12 flex justify-center">
                    <Spinner size="md" />
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-gray-200 rounded-xl text-xs text-gray-500">
                    No recorded administrative audit events for this customer yet.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-900 capitalize">
                            {log.action?.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[11px] text-gray-400">
                            {safeFormatDateTime(log.createdAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-600">
                          By <span className="font-semibold text-gray-800">{log.actorEmail || log.actorId}</span> ({log.actorRole || 'admin'})
                        </p>
                        {log.after && (
                          <pre className="text-[10px] bg-white p-2 rounded border border-gray-200 text-gray-700 overflow-x-auto">
                            {JSON.stringify(log.after, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>,
  document.body,
);
};
