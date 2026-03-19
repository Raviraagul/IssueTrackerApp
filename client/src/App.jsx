import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';

// ── Pages (we'll create these next) ──────────────────────────────────────────
import DashboardPage from './pages/DashboardPage';
import TicketsPage from './pages/TicketsPage';
import ImportPage from './pages/ImportPage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';

import DailyMovementPage from './pages/DailyMovementPage';
import TicketDetailPage from './pages/TicketDetailPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>

          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Layout><DashboardPage /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/tickets/:id" element={
            <ProtectedRoute>
              <Layout><TicketDetailPage /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/tickets" element={
            <ProtectedRoute>
              <Layout><TicketsPage /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/import" element={
            <ProtectedRoute adminOnly>
              <Layout><ImportPage /></Layout>
            </ProtectedRoute>
          } />

          {/* <Route path="/reports" element={
            <ProtectedRoute>
              <Layout><ReportsPage /></Layout>
            </ProtectedRoute>
          } /> */}

          <Route path="/reports" element={<Navigate to="/reports/standard" replace />} />

          <Route path="/reports/standard" element={
            <ProtectedRoute>
              <Layout><ReportsPage /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/reports/daily" element={
            <ProtectedRoute>
              <Layout><DailyMovementPage /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/users" element={
            <ProtectedRoute adminOnly>
              <Layout><UsersPage /></Layout>
            </ProtectedRoute>
          } />

          {/* Redirect root to dashboard */}
          {/* <Route path="/" element={<Navigate to="/dashboard" replace />} /> */}
          {/* <Route path="*" element={<Navigate to="/dashboard" replace />} /> */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />

        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}