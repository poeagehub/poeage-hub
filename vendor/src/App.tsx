import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { VendorAuthProvider } from './context/AuthContext';
import { VendorGuard } from './components/VendorGuard';
import { VendorLayout } from './components/layout/VendorLayout';
import { VendorLoginPage } from './pages/auth/VendorLoginPage';
import { VendorRegisterPage } from './pages/auth/VendorRegisterPage';
import { VendorOnboardingPage } from './pages/onboarding/VendorOnboardingPage';
import { VendorStatusPage } from './pages/onboarding/VendorStatusPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProductListPage } from './pages/products/ProductListPage';
import { CreateProductPage } from './pages/products/CreateProductPage';
import { VendorOrdersPage } from './pages/orders/VendorOrdersPage';
import { InventoryPage } from './pages/inventory/InventoryPage';
import { StoreSettingsPage } from './pages/settings/StoreSettingsPage';
import { VendorSettlementsPage } from './pages/settlements/VendorSettlementsPage';

export default function App() {
  return (
    <VendorAuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<VendorLoginPage />} />
          <Route path="/register" element={<VendorRegisterPage />} />
          <Route path="/onboarding" element={<VendorOnboardingPage />} />
          <Route path="/status" element={<VendorStatusPage />} />
          <Route
            path="/*"
            element={
              <VendorGuard>
                <VendorLayout>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/products" element={<ProductListPage />} />
                    <Route path="/products/new" element={<CreateProductPage />} />
                    <Route path="/orders" element={<VendorOrdersPage />} />
                    <Route path="/inventory" element={<InventoryPage />} />
                    <Route path="/settlements" element={<VendorSettlementsPage />} />
                    <Route path="/settings" element={<StoreSettingsPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </VendorLayout>
              </VendorGuard>
            }
          />
        </Routes>
      </BrowserRouter>
    </VendorAuthProvider>
  );
}
