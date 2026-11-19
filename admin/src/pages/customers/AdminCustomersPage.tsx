import React, { useState, useEffect, useMemo } from 'react';
import type { UserProfile, AccountStatus, UserRole } from '@poeage/types';
import { formatMoney, formatDate, formatRelativeTime } from '@poeage/utils';
import { Button, Card, Badge, Spinner } from '@poeage/ui';
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  Eye,
  X,
  UserPlus,
  Download,
  ShieldCheck,
  ShieldAlert,
  ShoppingBag,
  TrendingUp,
  CreditCard,
  Phone,
  Mail,
  Copy,
  ChevronDown,
  ArrowUpDown,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Database,
} from 'lucide-react';
import {
  subscribeToCustomers,
  getCustomersList,
  updateCustomerStatus,
  createCustomer,
  exportCustomersToCSV,
  safeFormatDate,
} from '../../lib/customers';
import { CustomerDetailsModal } from './CustomerDetailsModal';
import { AddCustomerModal } from './AddCustomerModal';
import { CustomerStatusModal } from './CustomerStatusModal';
import { useAdminAuth } from '../../context/AuthContext';

export const AdminCustomersPage: React.FC = () => {
  const { user: adminUser } = useAdminAuth();

  const [customers, setCustomers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveSyncActive, setLiveSyncActive] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [spendingFilter, setSpendingFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');

  // Modals & Drawers
  const [selectedCustomer, setSelectedCustomer] = useState<UserProfile | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [statusTargetCustomer, setStatusTargetCustomer] = useState<UserProfile | null>(null);
  const [isStatusSubmitting, setIsStatusSubmitting] = useState(false);
  const [isAddSubmitting, setIsAddSubmitting] = useState(false);

  // Notifications & UI feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Real-time Firestore sync
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToCustomers(
      (list) => {
        setCustomers(list);
        setLoading(false);
        setLiveSyncActive(true);
        setLastRefreshedAt(new Date());
      },
      (err) => {
        console.warn('[AdminCustomersPage] Live sync warning:', err);
        // Fallback to one-time query
        getCustomersList()
          .then((list) => {
            setCustomers(list);
            setLiveSyncActive(false);
          })
          .catch((fetchErr) => {
            console.error('[AdminCustomersPage] Error fetching customers:', fetchErr);
            showToast('Could not load customers from Firestore.', 'error');
          })
          .finally(() => setLoading(false));
      }
    );

    return () => unsubscribe();
  }, []);

  const handleManualRefresh = async () => {
    setLoading(true);
    try {
      const list = await getCustomersList();
      setCustomers(list);
      setLastRefreshedAt(new Date());
      showToast('Customer directory refreshed.');
    } catch (err: any) {
      showToast('Refresh failed: ' + (err?.message || 'Check database connection'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Handle status toggle (Suspend / Reactivate)
  const handleConfirmStatusChange = async (targetStatus: AccountStatus, reason?: string) => {
    if (!statusTargetCustomer) return;
    setIsStatusSubmitting(true);
    try {
      await updateCustomerStatus(statusTargetCustomer.uid, targetStatus, reason, {
        uid: adminUser?.uid || 'admin',
        email: adminUser?.email || 'admin@poeagehub.com',
      });

      // Update local state
      setCustomers((prev) =>
        prev.map((c) => (c.uid === statusTargetCustomer.uid ? { ...c, status: targetStatus } : c))
      );

      if (selectedCustomer?.uid === statusTargetCustomer.uid) {
        setSelectedCustomer((prev) => (prev ? { ...prev, status: targetStatus } : null));
      }

      showToast(
        `Account for ${statusTargetCustomer.displayName} has been marked ${targetStatus}.`,
        'success'
      );
      setStatusTargetCustomer(null);
    } catch (err: any) {
      showToast(err?.message || 'Failed to update account status.', 'error');
    } finally {
      setIsStatusSubmitting(false);
    }
  };

  // Handle new customer creation
  const handleCreateCustomer = async (data: {
    displayName: string;
    email: string;
    phone?: string;
    status: AccountStatus;
    address?: {
      label: 'home' | 'work' | 'other';
      line1: string;
      city: string;
      state: string;
      pincode: string;
    };
  }) => {
    setIsAddSubmitting(true);
    try {
      await createCustomer(data, {
        uid: adminUser?.uid || 'admin',
        email: adminUser?.email || 'admin@poeagehub.com',
      });
      showToast(`Customer account for ${data.displayName} created successfully!`, 'success');
      handleManualRefresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to create customer.', 'error');
      throw err;
    } finally {
      setIsAddSubmitting(false);
    }
  };

  // Quick Seed Demo Customers if database is empty
  const handleSeedDemoCustomers = async () => {
    setLoading(true);
    try {
      const demoUsers = [
        {
          displayName: 'Aarav Sharma',
          email: 'aarav.sharma@example.com',
          phone: '+91 98450 12345',
          status: 'active' as AccountStatus,
          address: {
            label: 'home' as const,
            line1: '12B, Palm Meadows, Whitefield',
            city: 'Bengaluru',
            state: 'Karnataka',
            pincode: '560066',
          },
        },
        {
          displayName: 'Riya Patel',
          email: 'riya.patel@example.com',
          phone: '+91 97123 45678',
          status: 'active' as AccountStatus,
          address: {
            label: 'work' as const,
            line1: 'Tower 4, Cyber City, DLF Phase 2',
            city: 'Gurugram',
            state: 'Haryana',
            pincode: '122002',
          },
        },
        {
          displayName: 'Kavita Reddy',
          email: 'kavita.reddy@example.com',
          phone: '+91 99887 65432',
          status: 'suspended' as AccountStatus,
          address: {
            label: 'home' as const,
            line1: 'Plot 45, Jubilee Hills, Road No. 36',
            city: 'Hyderabad',
            state: 'Telangana',
            pincode: '500033',
          },
        },
      ];

      for (const u of demoUsers) {
        await createCustomer(u, {
          uid: adminUser?.uid || 'admin',
          email: adminUser?.email || 'admin@poeagehub.com',
        });
      }

      showToast('Seeded 3 live customer profiles into Firestore!', 'success');
      await handleManualRefresh();
    } catch (err: any) {
      showToast('Seed failed: ' + err?.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filtered & Sorted Customers
  const filteredCustomers = useMemo(() => {
    return customers
      .filter((c) => {
        // Status filter
        if (statusFilter !== 'all' && c.status !== statusFilter) return false;

        // Role filter
        if (roleFilter !== 'all') {
          const hasRole = c.roles?.includes(roleFilter as UserRole);
          if (!hasRole) return false;
        }

        // Spending filter
        if (spendingFilter === 'high_value' && (c.metadata?.totalSpent || 0) < 1000000) return false; // ₹10,000
        if (spendingFilter === 'buyers' && (c.metadata?.totalOrders || 0) === 0) return false;
        if (spendingFilter === 'zero_orders' && (c.metadata?.totalOrders || 0) > 0) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = c.displayName?.toLowerCase().includes(q);
          const matchEmail = c.email?.toLowerCase().includes(q);
          const matchPhone = c.phone?.toLowerCase().includes(q);
          const matchUid = c.uid?.toLowerCase().includes(q);
          if (!matchName && !matchEmail && !matchPhone && !matchUid) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          const tA = (a.createdAt as any)?.seconds || 0;
          const tB = (b.createdAt as any)?.seconds || 0;
          return tB - tA;
        }
        if (sortBy === 'oldest') {
          const tA = (a.createdAt as any)?.seconds || 0;
          const tB = (b.createdAt as any)?.seconds || 0;
          return tA - tB;
        }
        if (sortBy === 'highest_spend') {
          return (b.metadata?.totalSpent || 0) - (a.metadata?.totalSpent || 0);
        }
        if (sortBy === 'most_orders') {
          return (b.metadata?.totalOrders || 0) - (a.metadata?.totalOrders || 0);
        }
        if (sortBy === 'name_asc') {
          return (a.displayName || '').localeCompare(b.displayName || '');
        }
        return 0;
      });
  }, [customers, statusFilter, roleFilter, spendingFilter, searchQuery, sortBy]);

  // Aggregate Metrics for Top Banner
  const metrics = useMemo(() => {
    const total = customers.length;
    const active = customers.filter((c) => c.status === 'active').length;
    const suspended = customers.filter((c) => c.status === 'suspended').length;
    const totalSpentPaise = customers.reduce((sum, c) => sum + (c.metadata?.totalSpent || 0), 0);
    const totalOrdersCount = customers.reduce((sum, c) => sum + (c.metadata?.totalOrders || 0), 0);
    const avgSpent = total > 0 ? Math.round(totalSpentPaise / total) : 0;

    return {
      total,
      active,
      suspended,
      totalSpentPaise,
      totalOrdersCount,
      avgSpent,
    };
  }, [customers]);

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Toast Feedback */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 text-xs font-semibold border animate-in slide-in-from-bottom duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-700'
              : toast.type === 'error'
              ? 'bg-rose-900 text-white border-rose-700'
              : 'bg-slate-900 text-white border-slate-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Customer Directory</h1>
            {liveSyncActive ? (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs"
                title="Real-time WebSocket listener active with Firebase Firestore"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                <Database className="w-3 h-3" />
                Connected
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Inspect customer profiles, purchase history, delivery addresses, and compliance audit records.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            className="flex items-center gap-1.5 text-xs text-gray-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCustomersToCSV(filteredCustomers)}
            disabled={filteredCustomers.length === 0}
            className="flex items-center gap-1.5 text-xs text-gray-700"
          >
            <Download className="w-3.5 h-3.5 text-gray-600" />
            Export CSV
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-bold shadow-sm"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* KPI / Telemetry Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Customers</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-gray-900">{metrics.total}</p>
          <span className="text-[10px] text-gray-400 mt-1 block">Registered in platform</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Accounts</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-600">{metrics.active}</p>
          <span className="text-[10px] text-emerald-700/80 mt-1 block font-semibold">
            {metrics.total > 0 ? `${Math.round((metrics.active / metrics.total) * 100)}% active rate` : '0%'}
          </span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Suspended</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-600">{metrics.suspended}</p>
          <span className="text-[10px] text-gray-400 mt-1 block">Security / policy hold</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Spend (GMV)</span>
            <CreditCard className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-gray-900">{formatMoney(metrics.totalSpentPaise)}</p>
          <span className="text-[10px] text-gray-400 mt-1 block">{metrics.totalOrdersCount} lifetime orders</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-xs col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Avg Spend / User</span>
            <TrendingUp className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-gray-900">{formatMoney(metrics.avgSpent)}</p>
          <span className="text-[10px] text-gray-400 mt-1 block">Customer lifetime value</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, phone number, or UID..."
              className="w-full text-xs pl-10 pr-9 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 p-0.5 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Dropdown Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium text-gray-700"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="suspended">Suspended Only</option>
              <option value="pending_verification">Pending Verification</option>
            </select>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="text-xs px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium text-gray-700"
            >
              <option value="all">All Roles</option>
              <option value="customer">Customer</option>
              <option value="vendor">Vendor</option>
              <option value="driver">Driver</option>
              <option value="admin">Admin</option>
            </select>

            {/* Spending Filter */}
            <select
              value={spendingFilter}
              onChange={(e) => setSpendingFilter(e.target.value)}
              className="text-xs px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium text-gray-700"
            >
              <option value="all">All Spending Tiers</option>
              <option value="high_value">VIP Spenders (≥ ₹10K)</option>
              <option value="buyers">Active Buyers (≥ 1 order)</option>
              <option value="zero_orders">Zero Orders</option>
            </select>

            {/* Sort Filter */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium text-gray-700"
            >
              <option value="newest">Newest Joined</option>
              <option value="oldest">Oldest Joined</option>
              <option value="highest_spend">Highest Lifetime Spend</option>
              <option value="most_orders">Most Orders Placed</option>
              <option value="name_asc">Name (A–Z)</option>
            </select>
          </div>
        </div>

        {/* Showing Count & Active filter chips */}
        <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-100 flex-wrap gap-2">
          <div>
            Showing <span className="font-bold text-gray-800">{filteredCustomers.length}</span> of{' '}
            <span className="font-bold text-gray-800">{customers.length}</span> registered profiles
          </div>

          {(statusFilter !== 'all' || roleFilter !== 'all' || spendingFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setRoleFilter('all');
                setSpendingFilter('all');
                setSearchQuery('');
              }}
              className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Customers Table or Empty State */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <Spinner size="lg" />
          <p className="text-xs font-semibold text-gray-500">Connecting to Firebase & syncing profiles...</p>
        </div>
      ) : customers.length === 0 ? (
        /* Empty Database State with Seed Button */
        <Card className="p-12 text-center max-w-lg mx-auto shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">No Customers Registered Yet</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mb-6 leading-relaxed">
            The live Firestore <code className="bg-gray-100 px-1 py-0.5 rounded text-blue-700 font-mono">users</code>{' '}
            collection has no records yet. When users sign up on the consumer store, they will automatically appear here.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Register Customer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeedDemoCustomers}
              className="flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Seed Demo Profiles
            </Button>
          </div>
        </Card>
      ) : filteredCustomers.length === 0 ? (
        /* No Match for Search */
        <Card className="p-12 text-center max-w-md mx-auto shadow-sm">
          <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900 mb-1">No Matching Customers</h3>
          <p className="text-xs text-gray-500 mb-4">
            No customer accounts match your current search and filter combination.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setRoleFilter('all');
              setSpendingFilter('all');
            }}
          >
            Clear Search & Filters
          </Button>
        </Card>
      ) : (
        /* Rich Data Table */
        <Card className="overflow-hidden border border-gray-200 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 text-gray-500 uppercase font-bold border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Contact Info</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Roles</th>
                  <th className="py-3 px-4 text-center">Orders</th>
                  <th className="py-3 px-4">Lifetime Spend</th>
                  <th className="py-3 px-4">Joined Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCustomers.map((cust) => {
                  const isCurrentActive = cust.status === 'active';
                  const initials =
                    cust.displayName?.[0]?.toUpperCase() || cust.email?.[0]?.toUpperCase() || 'C';

                  return (
                    <tr key={cust.uid} className="hover:bg-blue-50/30 transition-colors group">
                      {/* Customer Profile Column */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-700 text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0">
                            {initials}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                              {cust.displayName || 'Customer'}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[11px] text-gray-500 truncate max-w-[160px]">
                                {cust.email}
                              </span>
                              <button
                                onClick={() => copyToClipboard(cust.uid, cust.uid)}
                                title="Click to copy UID"
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              {copiedId === cust.uid && (
                                <span className="text-[9px] text-green-600 font-bold">Copied</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="py-3.5 px-4 text-gray-600">
                        {cust.phone ? (
                          <span className="flex items-center gap-1 font-mono text-[11px]">
                            <Phone className="w-3 h-3 text-gray-400" />
                            {cust.phone}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[11px]">No phone linked</span>
                        )}
                      </td>

                      {/* Status Column */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize border ${
                            cust.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : cust.status === 'suspended'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              cust.status === 'active'
                                ? 'bg-emerald-500'
                                : cust.status === 'suspended'
                                ? 'bg-rose-500'
                                : 'bg-amber-500'
                            }`}
                          />
                          {cust.status}
                        </span>
                      </td>

                      {/* Roles */}
                      <td className="py-3.5 px-4">
                        <div className="flex gap-1 flex-wrap">
                          {(cust.roles || ['customer']).map((r) => (
                            <span
                              key={r}
                              className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[10px] font-semibold border border-gray-200 capitalize"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Orders Count */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            (cust.metadata?.totalOrders || 0) > 0
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {cust.metadata?.totalOrders || 0}
                        </span>
                      </td>

                      {/* Lifetime Spend */}
                      <td className="py-3.5 px-4 font-bold text-gray-900">
                        {formatMoney(cust.metadata?.totalSpent || 0)}
                      </td>

                      {/* Joined Date */}
                      <td className="py-3.5 px-4 text-gray-500 text-[11px]">
                        {safeFormatDate(cust.createdAt)}
                      </td>

                      {/* Quick Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedCustomer(cust)}
                            title="View Full Profile Dossier"
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setStatusTargetCustomer(cust)}
                            title={isCurrentActive ? 'Suspend Customer Account' : 'Reactivate Account'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isCurrentActive
                                ? 'text-gray-400 hover:text-rose-600 hover:bg-rose-50'
                                : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                            }`}
                          >
                            {isCurrentActive ? (
                              <ShieldAlert className="w-4 h-4" />
                            ) : (
                              <ShieldCheck className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Customer Details Dossier Modal */}
      <CustomerDetailsModal
        isOpen={Boolean(selectedCustomer)}
        customer={selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        onCustomerUpdated={(updated) => {
          setSelectedCustomer(updated);
          setCustomers((prev) => prev.map((c) => (c.uid === updated.uid ? updated : c)));
        }}
        onRequestStatusToggle={(cust) => {
          setStatusTargetCustomer(cust);
        }}
      />

      {/* Add Customer Modal */}
      <AddCustomerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreateCustomer}
        isSubmitting={isAddSubmitting}
      />

      {/* Suspend / Reactivate Confirmation Modal */}
      <CustomerStatusModal
        isOpen={Boolean(statusTargetCustomer)}
        customer={statusTargetCustomer}
        onClose={() => setStatusTargetCustomer(null)}
        onConfirm={handleConfirmStatusChange}
        isSubmitting={isStatusSubmitting}
      />
    </div>
  );
};
