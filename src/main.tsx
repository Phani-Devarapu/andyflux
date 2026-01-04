import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext'
import { syncService } from './services/SyncService'
import { expenseSyncService } from './services/ExpenseSyncService'

import { GlobalErrorBoundary } from './components/GlobalErrorBoundary'

import { MarketDataProvider } from './context/MarketDataContext'

// Initialize Cloud Sync
syncService.init();
expenseSyncService.init();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <MarketDataProvider>
            <App />
          </MarketDataProvider>
        </AuthProvider>
      </BrowserRouter>
    </GlobalErrorBoundary>
  </StrictMode>,
)
