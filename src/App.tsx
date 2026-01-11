import { useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
// import { TradesProvider } from './context/TradesContext';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { TradeList } from './pages/TradeList';
import { TradeForm } from './pages/TradeForm';
import { Analytics } from './pages/Analytics';
import { Calendar } from './pages/Calendar';
import { Reports } from './pages/Reports';
import { ColorModeProvider, useColorMode } from './context/ColorModeContext';
import { AccountProvider } from './context/AccountContext';
import { FxRateProvider } from './context/FxRateContext';
import { getTheme } from './theme';

import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AccountRouteGuard } from './components/auth/AccountRouteGuard';
import { WelcomePage } from './pages/WelcomePage';
import { ExpenseManagerPage } from './pages/ExpenseManagerPage';
import { AccountManagement } from './pages/AccountManagement';

function AppContent() {
  const { mode } = useColorMode();
  const theme = useMemo(() => getTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/welcome" element={<WelcomePage />} />

        <Route element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }>
          <Route path="/" element={<Dashboard />} />

          {/* Trading routes - blocked for PERSONAL account */}
          <Route path="/trades" element={
            <AccountRouteGuard allowedAccounts={['TFSA', 'FHSA', 'NON_REGISTERED']}>
              <TradeList />
            </AccountRouteGuard>
          } />
          <Route path="/add" element={
            <AccountRouteGuard allowedAccounts={['TFSA', 'FHSA', 'NON_REGISTERED']}>
              <TradeForm />
            </AccountRouteGuard>
          } />
          <Route path="/edit/:id" element={
            <AccountRouteGuard allowedAccounts={['TFSA', 'FHSA', 'NON_REGISTERED']}>
              <TradeForm />
            </AccountRouteGuard>
          } />
          <Route path="/analytics" element={
            <AccountRouteGuard allowedAccounts={['TFSA', 'FHSA', 'NON_REGISTERED']}>
              <Analytics />
            </AccountRouteGuard>
          } />
          <Route path="/reports" element={
            <AccountRouteGuard allowedAccounts={['TFSA', 'FHSA', 'NON_REGISTERED']}>
              <Reports />
            </AccountRouteGuard>
          } />

          {/* Expense route - only for PERSONAL account */}
          <Route path="/expenses" element={
            <AccountRouteGuard allowedAccounts={['PERSONAL']}>
              <ExpenseManagerPage />
            </AccountRouteGuard>
          } />

          {/* Calendar and Account Management - available for all accounts */}
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/account-management" element={<AccountManagement />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  );
}

function App() {
  // Cloud Sync Services are removed in favor of direct Firestore hooks.

  return (
    <AccountProvider>
      <ColorModeProvider>
        {/* <TradesProvider> Removed */}
        <FxRateProvider>
          <AppContent />
        </FxRateProvider>
        {/* </TradesProvider> */}
      </ColorModeProvider>
    </AccountProvider>
  );
}

export default App;
