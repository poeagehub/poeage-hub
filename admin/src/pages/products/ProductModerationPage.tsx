import React, { useState, useEffect } from 'react';
import { getDocuments, updateDocument, friendlyError } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Product, ProductStatus } from '@poeage/types';
import { Button, Card, CardContent, Badge, Spinner } from '@poeage/ui';
import { Check, X, Shield, Search, Package, AlertCircle } from 'lucide-react';

export const ProductModerationPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'published' | 'rejected'>('all');
  const [search, setSearch] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchCatalog = async () => {
      setLoading(true);
      try {
        const prods = await getDocuments<Product>(COLLECTION.PRODUCTS);
        setProducts(prods);
      } catch (err) {
        console.error('Failed to load products:', err);
        setLoadError(friendlyError(err, 'Failed to load products.'));
      } finally {
        setLoading(false);
      }
    };

    fetchCatalog();
  }, []);

  const handleUpdateStatus = async (productId: string, nextStatus: ProductStatus) => {
    try {
      await updateDocument(COLLECTION.PRODUCTS, productId, {
        status: nextStatus,
      });

      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, status: nextStatus } : p))
      );

      setActionSuccess(`Product ${nextStatus === 'published' ? 'approved & published to marketplace!' : 'rejected.'}`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to moderate product:', err);
      setLoadError(friendlyError(err, 'Failed to update product status.'));
    }
  };

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.vendorId.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'pending') return p.status === 'pending_review';
    if (activeTab === 'published') return p.status === 'published';
    if (activeTab === 'rejected') return p.status === 'rejected';
    return true;
  });

  return (
    <div className="p-8 space-y-6 bg-gray-50 min-h-[calc(100vh-4rem)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Product Catalog Moderation</h2>
          <p className="text-sm text-gray-500">Review vendor SKU submissions, verify compliance, and grant live publishing.</p>
        </div>

        <Badge variant="info">
          {products.filter((p) => p.status === 'pending_review').length} Pending Approvals
        </Badge>
      </div>

      {loadError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span>{loadError}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-xs text-green-700">
          <Check className="w-4 h-4 text-green-500" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex gap-1.5 p-1 bg-gray-100 rounded-lg text-xs font-semibold">
            {(['all', 'pending', 'published', 'rejected'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-md capitalize transition-colors ${
                  activeTab === tab
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {tab === 'pending' ? 'Pending Review' : tab}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search product or vendor ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
            />
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
          </div>
        </CardContent>
      </Card>

      {/* Moderation Table */}
      {loading ? (
        <div className="py-20 text-center">
          <Spinner size="lg" className="mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-16">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h4 className="font-bold text-gray-700">No products matching current filter</h4>
          <p className="text-xs text-gray-400 mt-1">All queues up to date.</p>
        </Card>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Product Details</th>
                  <th className="py-3.5 px-4">Vendor</th>
                  <th className="py-3.5 px-4">Price / MRP</th>
                  <th className="py-3.5 px-4">Commission</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        {p.images?.[0] ? (
                          <img
                            src={p.images[0]}
                            alt={p.name}
                            className="w-12 h-12 rounded-lg object-cover bg-gray-100 border border-gray-200 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex-shrink-0 flex items-center justify-center text-gray-400">
                            <Package className="w-5 h-5" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-gray-900 line-clamp-1">{p.name}</p>
                          <span className="text-xs text-gray-400 capitalize">{p.categoryId}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-xs font-mono text-gray-600">
                      {p.vendorId}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-bold text-gray-900">₹{(p.basePrice / 100).toLocaleString('en-IN')}</span>
                      {p.salePrice && (
                        <span className="text-xs text-gray-400 line-through ml-1.5">
                          ₹{(p.salePrice / 100).toLocaleString('en-IN')}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-xs font-semibold text-blue-600">
                      {Math.round((p.commissionRate ?? 0.1) * 100)}%
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge
                        variant={
                          p.status === 'published'
                            ? 'success'
                            : p.status === 'pending_review'
                            ? 'warning'
                            : 'danger'
                        }
                      >
                        {p.status.replace('_', ' ')}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-2">
                      {p.status !== 'published' && (
                        <Button
                          size="sm"
                          onClick={() => handleUpdateStatus(p.id, 'published')}
                          className="bg-green-600 hover:bg-green-500 text-white text-xs px-2.5 py-1"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" /> Approve
                        </Button>
                      )}

                      {p.status !== 'rejected' && (
                        <Button
                          size="sm"
                          onClick={() => handleUpdateStatus(p.id, 'rejected')}
                          className="bg-red-600 hover:bg-red-500 text-white text-xs px-2.5 py-1"
                        >
                          <X className="w-3.5 h-3.5 mr-1" /> Reject
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
