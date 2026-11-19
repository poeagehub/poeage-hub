import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDocuments, where, friendlyError } from '@poeage/firebase-client';
import { COLLECTION } from '@poeage/config';
import type { Product, Category } from '@poeage/types';
import { Button, Card, CardContent, Spinner } from '@poeage/ui';
import {
  Sparkles,
  ShoppingBag,
  ArrowRight,
  TrendingUp,
  Tag,
  Star,
} from 'lucide-react';

const CATEGORY_COLORS = [
  'bg-blue-50 text-blue-600',
  'bg-rose-50 text-rose-600',
  'bg-amber-50 text-amber-600',
  'bg-purple-50 text-purple-600',
];

export const HomePage: React.FC = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [cats, prods] = await Promise.all([
          getDocuments<Category>(COLLECTION.CATEGORIES, [where('isActive', '==', true)]),
          getDocuments<Product>(COLLECTION.PRODUCTS, [where('status', '==', 'published')]),
        ]);
        setCategories(cats.sort((x, y) => (x.order ?? 0) - (y.order ?? 0)).slice(0, 8));
        setProducts(prods);
      } catch (err) {
        console.error('Failed to load storefront:', err);
        setLoadError(friendlyError(err, 'Failed to load storefront data.'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const featured = (products.some((p) => p.isFeatured) ? products.filter((p) => p.isFeatured) : products).slice(0, 4);
  const countFor = (slug: string) => products.filter((p) => p.categoryId === slug).length;

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white py-10 sm:py-16 lg:py-24 overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-2xl space-y-6">
            <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 px-3.5 py-1.5 rounded-full text-xs font-semibold text-blue-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Multi-Vendor Mega Commerce Platform</span>
            </div>

            <h1 className="text-[2rem] sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
              Curated Brands. <br />
              <span className="text-blue-400">Rapid Delivery.</span>
            </h1>

            <p className="text-gray-300 text-base sm:text-lg leading-relaxed">
              Explore verified products from trusted local and national sellers with guaranteed authentic quality and lightning-fast fulfillment.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link to="/products">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2 shadow-lg">
                  <ShoppingBag className="w-5 h-5" />
                  Explore Catalog
                </Button>
              </Link>
              {!user && (
                <Link to="/register">
                  <Button variant="outline" size="lg" className="bg-white/10 hover:bg-white/20 text-white border-white/20">
                    Join POEAGE HUB
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Featured Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Shop by Category</h2>
            <p className="text-sm text-gray-500">Handpicked selections across popular departments</p>
          </div>
          <Link to="/categories" className="text-sm font-semibold text-blue-600 hover:text-blue-500 flex items-center gap-1">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="py-10 text-center"><Spinner size="lg" className="mx-auto text-blue-600" /></div>
        ) : loadError ? (
          <p className="text-xs text-red-600">{loadError}</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-gray-400">No categories have been added yet.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {categories.map((cat, i) => (
              <Link key={cat.id} to={`/products?cat=${cat.slug}`} className="group">
                <Card className="hover:shadow-md transition-shadow cursor-pointer border-gray-200">
                  <CardContent className="p-6 text-center space-y-3">
                    <div className={`w-14 h-14 ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]} rounded-2xl flex items-center justify-center mx-auto transition-transform group-hover:scale-110`}>
                      <Tag className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {cat.name}
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">{countFor(cat.slug)} items</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Trending Products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Trending Deals</h2>
              <p className="text-sm text-gray-500">Special offers direct from verified sellers</p>
            </div>
          </div>
          <Link to="/products" className="text-sm font-semibold text-blue-600 hover:text-blue-500 flex items-center gap-1">
            Explore All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? null : featured.length === 0 ? (
          <p className="text-sm text-gray-400">No products are published yet. Check back soon.</p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            {featured.map((prod) => (
              <Link key={prod.id} to={`/product/${prod.slug}`} className="group">
                <Card className="overflow-hidden hover:shadow-lg transition-shadow border-gray-200 flex flex-col h-full">
                  <div className="relative aspect-square bg-gray-100 overflow-hidden">
                    {prod.images?.[0] && (
                      <img
                        src={prod.images[0]}
                        alt={prod.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    )}
                    {prod.salePrice && prod.salePrice > prod.basePrice && (
                      <span className="absolute top-3 left-3 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                        {Math.round(((prod.salePrice - prod.basePrice) / prod.salePrice) * 100)}% OFF
                      </span>
                    )}
                  </div>

                  <CardContent className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-xs text-gray-400 font-medium mb-1 capitalize">{prod.categoryId.replace(/-/g, ' ')}</p>
                      <h4 className="font-semibold text-sm text-gray-900 line-clamp-2 group-hover:text-blue-600">
                        {prod.name}
                      </h4>

                      {(prod.metadata?.totalRatings ?? 0) > 0 && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <div className="flex items-center text-amber-500">
                            <Star className="w-3.5 h-3.5 fill-current" />
                            <span className="text-xs font-bold text-gray-700 ml-1">{prod.metadata?.averageRating}</span>
                          </div>
                          <span className="text-xs text-gray-400">({prod.metadata?.totalRatings})</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <div>
                        <span className="text-lg font-bold text-gray-900">₹{(prod.basePrice / 100).toLocaleString('en-IN')}</span>
                        {prod.salePrice && prod.salePrice > prod.basePrice && (
                          <span className="text-xs text-gray-400 line-through ml-2">₹{(prod.salePrice / 100).toLocaleString('en-IN')}</span>
                        )}
                      </div>
                      <Button size="sm" variant="outline">View</Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
