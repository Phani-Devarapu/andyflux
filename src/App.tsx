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
import { WelcomePage } from './pages/WelcomePage';
import { ExpenseManagerPage } from './pages/ExpenseManagerPage';

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
          <Route path="/trades" element={<TradeList />} />
          <Route path="/add" element={<TradeForm />} />
          <Route path="/edit/:id" element={<TradeForm />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/expenses" element={<ExpenseManagerPage />} />
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
