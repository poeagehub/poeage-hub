import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider } from './context/AuthContext';
import { AdminGuard } from './components/AdminGuard';
import { AdminLayout } from './components/layout/AdminLayout';
import { AdminLoginPage } from './pages/auth/AdminLoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProductModerationPage } from './pages/products/ProductModerationPage';
import { AdminOrdersPage } from './pages/orders/AdminOrdersPage';
import { AdminDriversPage } from './pages/drivers/AdminDriversPage';
import { AdminVendorsPage } from './pages/vendors/AdminVendorsPage';
import { AdminCustomersPage } from './pages/customers/AdminCustomersPage';
import { AdminPayoutsPage } from './pages/payouts/AdminPayoutsPage';
import { PlatformSettingsPage } from './pages/settings/PlatformSettingsPage';
import { AdminCategoriesPage } from './pages/categories/AdminCategoriesPage';
import { AdminCouponsPage } from './pages/coupons/AdminCouponsPage';
import { AdminReviewsPage } from './pages/reviews/AdminReviewsPage';

export default function App() {
  return (
    <AdminAuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AdminLoginPage />} />
          <Route
            path="/*"
            element={
              <AdminGuard>
                <AdminLayout>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/products" element={<ProductModerationPage />} />
                    <Route path="/orders" element={<AdminOrdersPage />} />
                    <Route path="/vendors" element={<AdminVendorsPage />} />
                    <Route path="/drivers" element={<AdminDriversPage />} />
                    <Route path="/customers" element={<AdminCustomersPage />} />
                    <Route path="/categories" element={<AdminCategoriesPage />} />
                    <Route path="/coupons" element={<AdminCouponsPage />} />
                    <Route path="/reviews" element={<AdminReviewsPage />} />
                    <Route path="/payouts" element={<AdminPayoutsPage />} />
                    <Route path="/settlements" element={<Navigate to="/payouts" replace />} />
                    <Route path="/settings" element={<PlatformSettingsPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </AdminLayout>
              </AdminGuard>
            }
          />
        </Routes>
      </BrowserRouter>
    </AdminAuthProvider>
  );
}
