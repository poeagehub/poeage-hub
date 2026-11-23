import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DriverAuthProvider } from './context/AuthContext';
import { DriverGuard, RequireSignedIn } from './components/DriverGuard';
import { DriverLayout } from './components/layout/DriverLayout';
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
        <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans">
          <Routes>
            <Route path="/login" element={<DriverLoginPage />} />
            <Route path="/register" element={<DriverRegisterPage />} />
            <Route path="/onboarding" element={<RequireSignedIn><DriverOnboardingPage /></RequireSignedIn>} />
            <Route path="/status" element={<RequireSignedIn><DriverStatusPage /></RequireSignedIn>} />
            <Route
              path="/*"
              element={
                <DriverGuard>
                  <DriverLayout>
                    <Routes>
                      <Route path="/" element={<DashboardPage />} />
                      <Route path="/history" element={<DriverHistoryPage />} />
                      <Route path="/earnings" element={<DriverEarningsPage />} />
                      <Route path="/profile" element={<DriverProfilePage />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </DriverLayout>
                </DriverGuard>
              }
            />
          </Routes>
        </div>
      </BrowserRouter>
    </DriverAuthProvider>
  );
}
