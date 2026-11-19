import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider } from './context/AuthContext';
import { AdminGuard } from './components/AdminGuard';
import { AdminSidebar } from './components/layout/AdminSidebar';
import { AdminHeader } from './components/layout/AdminHeader';
import { AdminLoginPage } from './pages/auth/AdminLoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProductModerationPage } from './pages/products/ProductModerationPage';
import { AdminOrdersPage } from './pages/orders/AdminOrdersPage';
import { AdminDriversPage } from './pages/drivers/AdminDriversPage';
import { AdminVendorsPage } from './pages/vendors/AdminVendorsPage';
import { AdminCustomersPage } from './pages/customers/AdminCustomersPage';
import { AdminSettlementsPage } from './pages/settlements/AdminSettlementsPage';
import { PlatformSettingsPage } from './pages/settings/PlatformSettingsPage';

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
                <div className="flex min-h-screen bg-gray-50">
                  <AdminSidebar />
                  <div className="flex-1 flex flex-col min-w-0">
                    <AdminHeader />
                    <main className="flex-1">
                      <Routes>
                        <Route path="/" element={<DashboardPage />} />
                        <Route path="/products" element={<ProductModerationPage />} />
                        <Route path="/orders" element={<AdminOrdersPage />} />
                        <Route path="/vendors" element={<AdminVendorsPage />} />
                        <Route path="/drivers" element={<AdminDriversPage />} />
                        <Route path="/customers" element={<AdminCustomersPage />} />
                        <Route path="/settlements" element={<AdminSettlementsPage />} />
                        <Route path="/settings" element={<PlatformSettingsPage />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </main>
                  </div>
                </div>
              </AdminGuard>
            }
          />
        </Routes>
      </BrowserRouter>
    </AdminAuthProvider>
  );
}
