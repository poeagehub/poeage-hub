import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { SettingsProvider } from './context/SettingsContext';
import { WishlistProvider } from './context/WishlistContext';
import { MaintenanceGate } from './components/MaintenanceGate';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { MobileTabBar } from './components/layout/MobileTabBar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ProfilePage } from './pages/account/ProfilePage';
import { ProductListingPage } from './pages/products/ProductListingPage';
import { ProductDetailPage } from './pages/products/ProductDetailPage';
import { CartPage } from './pages/cart/CartPage';
import { CheckoutPage } from './pages/checkout/CheckoutPage';
import { OrderSuccessPage } from './pages/orders/OrderSuccessPage';
import { OrderHistoryPage } from './pages/orders/OrderHistoryPage';
import { OrderTrackingPage } from './pages/orders/OrderTrackingPage';
import { WishlistPage } from './pages/account/WishlistPage';
import { StoresPage, StorePage } from './pages/stores/StoresPage';
import { InfoPage } from './pages/info/InfoPage';
import { Button } from '@poeage/ui';

const NotFoundPage: React.FC = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
    <h1 className="text-6xl font-extrabold text-primary-600 mb-2">404</h1>
    <h2 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h2>
    <p className="text-gray-500 max-w-md mb-6">The page you're looking for doesn't exist or has been moved.</p>
    <Link to="/">
      <Button>Return to Home</Button>
    </Link>
  </div>
);

export default function App() {
  return (
    <SettingsProvider>
    <MaintenanceGate>
    <AuthProvider>
      <CartProvider>
      <WishlistProvider>
        <BrowserRouter>
          <div className="min-h-screen flex flex-col bg-gray-50">
            <Header />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/products" element={<ProductListingPage />} />
                <Route path="/category/:slug" element={<ProductListingPage />} />
                <Route path="/search" element={<ProductListingPage />} />
                <Route path="/product/:slug" element={<ProductDetailPage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route
                  path="/checkout"
                  element={
                    <ProtectedRoute>
                      <CheckoutPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/order-success/:orderId"
                  element={
                    <ProtectedRoute>
                      <OrderSuccessPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route
                  path="/account/profile"
                  element={
                    <ProtectedRoute>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/account/orders"
                  element={
                    <ProtectedRoute>
                      <OrderHistoryPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/account/orders/:orderId"
                  element={
                    <ProtectedRoute>
                      <OrderTrackingPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/wishlist" element={<WishlistPage />} />
                <Route path="/stores" element={<StoresPage />} />
                <Route path="/store/:id" element={<StorePage />} />
                {['/support', '/shipping-policy', '/returns', '/about', '/terms', '/privacy'].map((p) => (
                  <Route key={p} path={p} element={<InfoPage />} />
                ))}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </main>
            <Footer />
            <MobileTabBar />
          </div>
        </BrowserRouter>
      </WishlistProvider>
      </CartProvider>
    </AuthProvider>
    </MaintenanceGate>
    </SettingsProvider>
  );
}
