import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { VendorAuthProvider } from './context/AuthContext';
import { VendorGuard } from './components/VendorGuard';
import { VendorSidebar } from './components/layout/VendorSidebar';
import { VendorHeader } from './components/layout/VendorHeader';
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
                <div className="flex min-h-screen bg-gray-50">
                  <VendorSidebar />
                  <div className="flex-1 flex flex-col min-w-0">
                    <VendorHeader />
                    <main className="flex-1">
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
                    </main>
                  </div>
                </div>
              </VendorGuard>
            }
          />
        </Routes>
      </BrowserRouter>
    </VendorAuthProvider>
  );
}
