# Andy Flux - Premium Trading Journal

A professional, high-performance trading journal designed for detailed analytics, strategy tracking, and market insights. Built with a "Premium Fintech" aesthetic.

## Features

-   **Dashboard**: Real-time equity curve, win/loss analytics, and daily performance summary.
-   **Trade Logging**: Advanced logging with custom strategies, fees, and auto-filled market data.
-   **Activity Report**: Detailed breakdown of trade history with filtering and "Last Price" / "Unrealized PnL" tracking.
-   **Goals**: Set and track monthly PnL targets with visual progress indicators.
-   **Market Connectivity**: Real-time market data integration for US stocks.
-   **Security**: Encrypted, local-first architecture with cloud sync.

## Tech Stack

-   **Frontend**: React, TypeScript, Vite
-   **UI System**: Material UI (Custom "Obsidian" Premium Theme) + Lucide Icons + Tailwind Utility
-   **State/Data**: Dexie.js (IndexedDB) for offline-first data, Firebase for sync.
-   **Charts**: Chart.js / React-Chartjs-2

## Getting Started

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Start Development Server**:
    ```bash
    npm run dev
    ```

3.  **Build for Production**:
    ```bash
    npm run build
    ```

## Project Structure

-   `src/pages`: Main application views (Dashboard, TradeList, ActivityReport).
-   `src/components`: Reusable UI widgets and charts.
-   `src/services`: Business logic for Market Data, Sync, and Documents.
-   `src/db`: Database schema and Dexie instance.
-   `src/theme.ts`: Custom premium theme definition.

---
© 2025 Andy Flux. All rights reserved.
