import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useVendorAuth } from '../../context/AuthContext';
import { subscribeToCollection, where, friendlyError } from '@poeage/firebase-client';
import { EditProductModal } from './EditProductModal';
import { COLLECTION } from '@poeage/config';
import type { Product } from '@poeage/types';
import { Button, Card, CardContent, Badge, Spinner } from '@poeage/ui';
import { Package, Plus, Search, Edit, Trash2, Eye } from 'lucide-react';

export const ProductListPage: React.FC = () => {
  const { vendor } = useVendorAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState<Product | null>(null);

  // Live list: edits, moderation decisions and new products appear without a refresh.
  useEffect(() => {
    if (!vendor) {
      setLoading(false);
      return;
    }
    setLoading(true);
    return subscribeToCollection<Product>(
      COLLECTION.PRODUCTS,
      [where('vendorId', '==', vendor.id)],
      (list) => {
        setProducts(list);
        setLoadError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load vendor products:', err);
        setLoadError(friendlyError(err, 'Failed to load products.'));
        setLoading(false);
      },
    );
  }, [vendor?.id]);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-8 space-y-6 bg-gray-50 min-h-[calc(100vh-4rem)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Product Catalog</h2>
          <p className="text-sm text-gray-500">Manage your SKU listings, pricing, and stock status.</p>
        </div>

        <Link to="/products/new">
          <Button className="bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-600 text-white font-bold flex items-center gap-2 shadow-md shadow-teal-900/10 active:scale-95 transition-all">
            <Plus className="w-4 h-4" />
            Add New Product
          </Button>
        </Link>
      </div>

      {loadError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{loadError}</div>
      )}

      {/* Search and filters */}
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by product title or tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          </div>
          <span className="text-xs text-gray-500 font-medium">
            Showing {filteredProducts.length} items
          </span>
        </CardContent>
      </Card>

      {/* Product Table */}
      {loading ? (
        <div className="py-20 text-center">
          <Spinner size="lg" className="text-teal-500 mx-auto" />
          <p className="text-xs text-gray-400 mt-2">Loading products...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <Card className="text-center py-16">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h4 className="font-bold text-gray-700">No products found</h4>
          <p className="text-xs text-gray-400 mt-1 mb-4">Start selling by adding your first product listing.</p>
          <Link to="/products/new">
            <Button size="sm" className="bg-teal-600 hover:bg-teal-500 text-white font-bold shadow-sm transition-all">
              Create Product Listing
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Product Details</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Selling Price</th>
                  <th className="py-3.5 px-4">Total Sold</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((p) => (
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
                          <p className="text-xs text-gray-400 font-mono">ID: {p.id.slice(0, 12)}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-gray-600 capitalize">
                      {p.categoryId.replace('-', ' ')}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-bold text-gray-900">₹{(p.basePrice / 100).toLocaleString('en-IN')}</span>
                      {p.salePrice && (
                        <span className="text-xs text-gray-400 line-through ml-1.5">
                          ₹{(p.salePrice / 100).toLocaleString('en-IN')}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-gray-700">
                      {p.metadata?.totalSold ?? 0} units
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge
                        variant={
                          p.status === 'published'
                            ? 'success'
                            : p.status === 'pending_review'
                            ? 'warning'
                            : p.status === 'draft'
                            ? 'default'
                            : 'danger'
                        }
                      >
                        {p.status.replace('_', ' ')}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        title="Edit Product"
                        onClick={() => setEditing(p)}
                        className="p-1.5 text-gray-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && <EditProductModal product={editing} onClose={() => setEditing(null)} />}
    </div>
  );
};
