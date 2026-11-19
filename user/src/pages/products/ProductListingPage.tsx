import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { getDocuments, where, friendlyError } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Product, Category } from '@poeage/types';
import { Button, Card, CardContent, Badge, Spinner } from '@poeage/ui';
import { Filter, Star, ShoppingBag, ArrowUpDown, Search } from 'lucide-react';

export const ProductListingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';
  const categoryParam = searchParams.get('cat') || 'all';

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>(categoryParam);
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'rating'>('featured');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPublishedCatalog = async () => {
      setLoading(true);
      try {
        const [prods, cats] = await Promise.all([
          getDocuments<Product>(COLLECTION.PRODUCTS, [where('status', '==', 'published')]),
          getDocuments<Category>(COLLECTION.CATEGORIES, [where('isActive', '==', true)]),
        ]);
        setProducts(prods);
        setCategories(cats.sort((x, y) => (x.order ?? 0) - (y.order ?? 0)));
      } catch (err) {
        console.error('Failed to load catalog:', err);
        setLoadError(friendlyError(err, 'Failed to load catalog.'));
      } finally {
        setLoading(false);
      }
    };

    fetchPublishedCatalog();
  }, []);

  useEffect(() => {
    if (categoryParam) {
      setSelectedCategory(categoryParam);
    }
  }, [categoryParam]);

  const filtered = products
    .filter((p) => {
      if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) return false;
      if (queryParam) {
        const q = queryParam.toLowerCase();
        const matchesTitle = p.name.toLowerCase().includes(q);
        const matchesTag = p.tags?.some((t) => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesTag) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'price_asc') return a.basePrice - b.basePrice;
      if (sortBy === 'price_desc') return b.basePrice - a.basePrice;
      if (sortBy === 'rating') return (b.metadata?.averageRating ?? 0) - (a.metadata?.averageRating ?? 0);
      return 0; // featured default
    });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
      {/* Top Banner & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-gray-200 pb-3 sm:pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight break-words">
            {queryParam ? `Search Results for "${queryParam}"` : 'Browse Catalog'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">{filtered.length} {filtered.length === 1 ? 'product' : 'products'}</p>
        </div>

        {/* Sorting Dropdown */}
        <div className="flex items-center gap-2 justify-between sm:justify-start">
          <label className="text-xs text-gray-500 flex items-center gap-1 font-medium whitespace-nowrap">
            <ArrowUpDown className="w-3.5 h-3.5" /> Sort By:
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="flex-1 sm:flex-none text-xs font-semibold bg-white border border-gray-300 rounded-lg px-2.5 py-2.5 sm:py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="featured">Featured Deals</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="rating">Highest Rated</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-8">
        {/* Phone: swipeable category chips */}
        <div className="md:hidden -mx-4 px-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-2 w-max pb-1">
            {[{ id: 'all', name: 'All' }, ...categories.map((c) => ({ id: c.slug, name: c.name }))].map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-4 h-9 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors ${
                  selectedCategory === c.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200 active:bg-gray-50'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Left Filter Sidebar */}
        <aside className="hidden md:block space-y-6">
          <Card>
            <CardContent className="p-5 space-y-4">
              <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-600" /> Filter Departments
              </h3>

              <div className="space-y-1">
                {[{ id: 'all', name: 'All Departments' }, ...categories.map((c) => ({ id: c.slug, name: c.name }))].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      selectedCategory === c.id
                        ? 'bg-blue-50 text-blue-700 font-bold'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Product Grid */}
        <main className="md:col-span-3">
          {loading ? (
            <div className="py-20 text-center">
              <Spinner size="lg" className="mx-auto text-blue-600" />
              <p className="text-xs text-gray-400 mt-2">Loading marketplace catalog...</p>
            </div>
          ) : loadError ? (
            <Card className="text-center py-16">
              <h4 className="font-bold text-red-600">Could not load the catalog</h4>
              <p className="text-xs text-gray-500 mt-1">{loadError}</p>
            </Card>
          ) : filtered.length === 0 ? (
            <Card className="text-center py-16">
              <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h4 className="font-bold text-gray-700">No products found</h4>
              <p className="text-xs text-gray-400 mt-1">Try relaxing filters or search terms.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {filtered.map((prod) => (
                <Link key={prod.id} to={`/product/${prod.slug}`} className="group">
                  <Card className="overflow-hidden hover:shadow-lg transition-all border-gray-200 h-full flex flex-col justify-between">
                    <div>
                      <div className="relative aspect-square bg-gray-100 overflow-hidden">
                        {prod.images?.[0] && (
                          <img
                            src={prod.images[0]}
                            alt={prod.name}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        )}
                        {prod.salePrice && prod.salePrice > prod.basePrice && (
                          <span className="absolute top-2 left-2 sm:top-2.5 sm:left-2.5 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                            {Math.round(((prod.salePrice - prod.basePrice) / prod.salePrice) * 100)}% OFF
                          </span>
                        )}
                      </div>

                      <div className="p-3 sm:p-4 space-y-1.5 sm:space-y-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate block">
                          {prod.categoryId.replace('-', ' ')}
                        </span>
                        <h4 className="font-bold text-[13px] sm:text-sm text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">
                          {prod.name}
                        </h4>
                        {(prod.metadata?.totalRatings ?? 0) > 0 && (
                          <div className="flex items-center gap-1 text-xs">
                            <div className="flex items-center text-amber-500">
                              <Star className="w-3.5 h-3.5 fill-current" />
                              <span className="font-bold text-gray-700 ml-1">{prod.metadata?.averageRating}</span>
                            </div>
                            <span className="text-gray-400">({prod.metadata?.totalRatings})</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="px-3 pb-3 sm:p-4 sm:pt-0 pt-2.5 border-t border-gray-100 flex items-center justify-between mt-1 sm:mt-2 gap-2">
                      <div className="min-w-0">
                        <span className="text-[15px] sm:text-base font-extrabold text-gray-900">
                          ₹{(prod.basePrice / 100).toLocaleString('en-IN')}
                        </span>
                        {prod.salePrice && prod.salePrice > prod.basePrice && (
                          <span className="text-[11px] sm:text-xs text-gray-400 line-through ml-1 sm:ml-1.5">
                            ₹{(prod.salePrice / 100).toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>

                      <Button size="sm" variant="outline" className="text-xs hidden sm:inline-flex">
                        View Item
                      </Button>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
