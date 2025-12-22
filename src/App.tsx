import { useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { TradeList } from './pages/TradeList';
import { TradeForm } from './pages/TradeForm';
import { Analytics } from './pages/Analytics';
import { Calendar } from './pages/Calendar';
import { TickerAnalytics } from './pages/TickerAnalytics';
import { StrategyAnalytics } from './pages/StrategyAnalytics';
import { ActivityReport } from './pages/ActivityReport';
import { ColorModeProvider, useColorMode } from './context/ColorModeContext';
import { AccountProvider } from './context/AccountContext';
import { getTheme } from './theme';

import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { WelcomePage } from './pages/WelcomePage';

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
          <Route path="/ticker-analytics" element={<TickerAnalytics />} />
          <Route path="/strategy-analytics" element={<StrategyAnalytics />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/activity-reports" element={<ActivityReport />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  );
}

function App() {
  return (
    <AccountProvider>
      <ColorModeProvider>
        <AppContent />
      </ColorModeProvider>
    </AccountProvider>
  );
}

export default App;
