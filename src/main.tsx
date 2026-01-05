import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext'
// Sync services removed


import { GlobalErrorBoundary } from './components/GlobalErrorBoundary'

import { MarketDataProvider } from './context/MarketDataContext'

// Initialize Cloud Sync
// Cloud Sync initialized via Hooks now


import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// ... imports

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <MarketDataProvider>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <App />
            </LocalizationProvider>
          </MarketDataProvider>
        </AuthProvider>
      </BrowserRouter>
    </GlobalErrorBoundary>
  </StrictMode>,
)
