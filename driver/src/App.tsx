import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DriverAuthProvider } from './context/AuthContext';
import { DriverGuard } from './components/DriverGuard';
import { DriverHeader } from './components/layout/DriverHeader';
import { DriverBottomNav } from './components/layout/DriverBottomNav';
import { DriverLoginPage } from './pages/auth/DriverLoginPage';
import { DriverRegisterPage } from './pages/auth/DriverRegisterPage';
import { DriverOnboardingPage } from './pages/onboarding/DriverOnboardingPage';
import { DriverStatusPage } from './pages/onboarding/DriverStatusPage';
import { DashboardPage } from './pages/DashboardPage';
import { DriverHistoryPage } from './pages/history/DriverHistoryPage';
import { DriverEarningsPage } from './pages/earnings/DriverEarningsPage';
import { DriverProfilePage } from './pages/profile/DriverProfilePage';

export default function App() {
  return (
    <DriverAuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
          <Routes>
            <Route path="/login" element={<DriverLoginPage />} />
            <Route path="/register" element={<DriverRegisterPage />} />
            <Route path="/onboarding" element={<DriverOnboardingPage />} />
            <Route path="/status" element={<DriverStatusPage />} />
            <Route
              path="/*"
              element={
                <DriverGuard>
                  <div className="flex flex-col min-h-screen">
                    <DriverHeader />
                    <main className="flex-1 pb-[env(safe-area-inset-bottom,0px)]">
                      <Routes>
                        <Route path="/" element={<DashboardPage />} />
                        <Route path="/history" element={<DriverHistoryPage />} />
                        <Route path="/earnings" element={<DriverEarningsPage />} />
                        <Route path="/profile" element={<DriverProfilePage />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </main>
                    <DriverBottomNav />
                  </div>
                </DriverGuard>
              }
            />
          </Routes>
        </div>
      </BrowserRouter>
    </DriverAuthProvider>
  );
}
