import React, { useState, useEffect, useMemo } from 'react';
import { getDocuments, updateDocument, callFunction } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Vendor } from '@poeage/types';
import { formatMoney } from '@poeage/utils';
import { Button, Card, Badge, Spinner } from '@poeage/ui';
import {
  Store,
  CheckCircle,
  XCircle,
  RefreshCw,
  Search,
  Building,
  DollarSign,
  Percent,
  Clock,
  ShieldCheck,
  TrendingUp,
  X,
} from 'lucide-react';

export const AdminVendorsPage: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, { products: number; sales: number }>>({});
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_review' | 'approved' | 'rejected'>('all');

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const [list, products, vorders] = await Promise.all([
        getDocuments<Vendor>(COLLECTION.VENDORS),
        getDocuments<{ vendorId: string; status: string }>(COLLECTION.PRODUCTS).catch(() => []),
        getDocuments<{ vendorId: string; subtotal: number; status: string }>(COLLECTION.VENDOR_ORDERS).catch(() => []),
      ]);
      const st: Record<string, { products: number; sales: number }> = {};
      products.forEach((p) => { (st[p.vendorId] ??= { products: 0, sales: 0 }).products++; });
      vorders.filter((o) => o.status !== 'cancelled').forEach((o) => { (st[o.vendorId] ??= { products: 0, sales: 0 }).sales += o.subtotal || 0; });
      setStats(st);
      setVendors(list);
    } catch (err) {
      console.warn('Failed to fetch vendors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const handleApproveVendor = async (vendorId: string, approved: boolean) => {
    setActionLoadingId(vendorId);
    try {
      try {
        await callFunction('approveVendor', {
          vendorId,
          approved,
          commissionRate: 0.12,
        });
      } catch (fnErr) {
        console.warn('Cloud Function unavailable, using fallback:', fnErr);
        await updateDocument(COLLECTION.VENDORS, vendorId, {
          status: approved ? 'approved' : 'rejected',
          updatedAt: new Date(),
        });
      }

      setVendors((prev) =>
        prev.map((v) => (v.id === vendorId ? { ...v, status: approved ? 'approved' : 'rejected' } : v))
      );
    } catch (err) {
      console.error('Vendor approval error:', err);
      alert('Could not update vendor status. Please try again.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = v.storeName?.toLowerCase().includes(q);
        const matchEmail = v.email?.toLowerCase().includes(q);
        const matchPhone = v.phone?.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchPhone) return false;
      }
      return true;
    });
  }, [vendors, statusFilter, searchQuery]);

  // Aggregate metrics
  const totalVendors = vendors.length;
  const approvedCount = vendors.filter((v) => v.status === 'approved').length;
  const pendingCount = vendors.filter((v) => v.status === 'pending_review').length;
  const totalGMV = Object.values(stats).reduce((sum, s) => sum + s.sales, 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Merchant & Seller Directory</h1>
          <p className="text-xs text-gray-500 mt-1">
            Review merchant store KYC onboarding, adjust commission structures, and audit seller performance.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={fetchVendors}
          className="flex items-center gap-1.5 self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Modern KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Merchants</span>
            <Store className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-gray-900">{totalVendors}</p>
          <span className="text-[10px] text-gray-400 mt-0.5 block">Registered store profiles</span>
        </Card>

        <Card className="p-4 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Stores</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-600">{approvedCount}</p>
          <span className="text-[10px] text-emerald-700/80 mt-0.5 block font-semibold">
            {totalVendors > 0 ? `${Math.round((approvedCount / totalVendors) * 100)}% active rate` : '0%'}
          </span>
        </Card>

        <Card className="p-4 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">KYC Pending</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-600">{pendingCount}</p>
          <span className="text-[10px] text-amber-700/80 mt-0.5 block font-semibold">
            {pendingCount > 0 ? 'Requires admin review' : 'All reviews clear'}
          </span>
        </Card>

        <Card className="p-4 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Merchant Sales</span>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-gray-900">{formatMoney(totalGMV)}</p>
          <span className="text-[10px] text-gray-400 mt-0.5 block">Cumulative delivered GMV</span>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by store name, email, or phone..."
              className="w-full text-xs pl-10 pr-9 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
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

          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            {(
              [
                ['all', 'All Sellers'],
                ['pending_review', 'Pending Review'],
                ['approved', 'Approved'],
                ['rejected', 'Rejected'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setStatusFilter(id)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                  statusFilter === id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <Spinner size="lg" />
        </div>
      ) : filteredVendors.length === 0 ? (
        <Card className="p-12 text-center max-w-md mx-auto rounded-2xl">
          <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900 mb-1">No Vendors Found</h3>
          <p className="text-xs text-gray-500">
            {searchQuery || statusFilter !== 'all'
              ? 'No stores match your search criteria.'
              : 'Registered merchant stores will appear here for administrative verification and catalog rights.'}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-gray-500 uppercase font-bold border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Store Name</th>
                  <th className="py-3 px-4">Contact Info</th>
                  <th className="py-3 px-4">Commission</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Products</th>
                  <th className="py-3 px-4">Total Sales</th>
                  <th className="py-3 px-4 text-right">KYC Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredVendors.map((vendor) => {
                  const isActing = actionLoadingId === vendor.id;

                  return (
                    <tr key={vendor.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-gray-900">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-slate-800 to-slate-700 text-white font-black flex items-center justify-center text-xs shadow-xs">
                            {vendor.storeName?.[0]?.toUpperCase() || 'S'}
                          </div>
                          <span>{vendor.storeName}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-600">
                        <p className="font-medium text-gray-900">{vendor.email}</p>
                        <p className="text-[11px] text-gray-400 font-mono mt-0.5">{vendor.phone}</p>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-blue-600">
                        {(vendor.commissionRate * 100).toFixed(0)}%
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={
                            vendor.status === 'approved'
                              ? 'success'
                              : vendor.status === 'pending_review'
                              ? 'warning'
                              : 'danger'
                          }
                          className="capitalize font-semibold"
                        >
                          {vendor.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-gray-900">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                          {stats[vendor.id]?.products ?? 0}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-black text-gray-900">
                        {formatMoney(stats[vendor.id]?.sales ?? 0)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {vendor.status === 'pending_review' && (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              disabled={isActing}
                              onClick={() => handleApproveVendor(vendor.id, true)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-sm"
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={isActing}
                              onClick={() => handleApproveVendor(vendor.id, false)}
                              className="text-red-600 hover:bg-red-50 text-xs rounded-lg"
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                        {vendor.status === 'approved' && (
                          <span className="text-[11px] text-emerald-600 font-semibold flex items-center justify-end gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Active Store
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
