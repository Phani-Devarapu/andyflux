
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useAuth } from './AuthContext';
import { MarketDataService } from '../services/MarketDataService';

interface MarketData {
    price: number;
    change?: number; // percent change
    previousClose?: number;
    lastUpdated: number;
}

interface MarketDataContextType {
    prices: Record<string, MarketData>;
    isLoading: boolean;
    refresh: () => Promise<void>;
    getQuote: (symbol: string) => Promise<MarketData | null>;
}

const MarketDataContext = createContext<MarketDataContextType | undefined>(undefined);

export const useMarketData = () => {
    const context = useContext(MarketDataContext);
    if (!context) {
        throw new Error('useMarketData must be used within a MarketDataProvider');
    }
    return context;
};

// Cache duration in milliseconds (e.g., 5 minutes) to avoid frequent re-fetching
const CACHE_DURATION = 5 * 60 * 1000;

export const MarketDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [prices, setPrices] = useState<Record<string, MarketData>>({});
    const [isLoading, setIsLoading] = useState(false);

    // 1. Monitor ALL open trades for the user to know which symbols to track
    const openTrades = useLiveQuery(async () => {
        if (!user) return [];
        // We want ALL open trades for this user, regardless of account, 
        // effectively "Global Watchlist" based on portfolio.
        return await db.trades
            .where('userId').equals(user.uid)
            .filter(t => t.status === 'Open')
            .toArray();
    }, [user]);

    // 2. Derive unique symbols
    const trackedSymbols = React.useMemo(() => {
        if (!openTrades) return [];
        const symbols = new Set<string>();
        openTrades.forEach(t => {
            if (t.symbol) symbols.add(t.symbol.toUpperCase());
        });
        return Array.from(symbols);
    }, [openTrades]);

    // 3. Fetch function
    const fetchQuotes = useCallback(async (symbols: string[], force = false) => {
        if (symbols.length === 0) return;

        // Filter out symbols that are recently updated (unless force)
        const now = Date.now();
        const symbolsToFetch = force ? symbols : symbols.filter(sym => {
            const cached = prices[sym];
            return !cached || (now - cached.lastUpdated > CACHE_DURATION);
        });

        if (symbolsToFetch.length === 0) return;

        setIsLoading(true);
        const newPrices: Record<string, MarketData> = {};

        // Fetch sequentially or in parallel chunks to be nice to the proxy
        // Parallel of 3?
        const chunkSize = 3;
        for (let i = 0; i < symbolsToFetch.length; i += chunkSize) {
            const chunk = symbolsToFetch.slice(i, i + chunkSize);
            await Promise.all(chunk.map(async (symbol) => {
                try {
                    const quote = await MarketDataService.getQuote(symbol);
                    if (quote) {
                        newPrices[symbol] = {
                            price: quote.price,
                            previousClose: quote.previousClose,
                            change: quote.previousClose ? ((quote.price - quote.previousClose) / quote.previousClose) * 100 : 0,
                            lastUpdated: Date.now()
                        };
                    }
                } catch (e) {
                    console.warn(`MarketData: Failed to fetch ${symbol}`, e);
                }
            }));
        }

        setPrices(prev => ({ ...prev, ...newPrices }));
        setIsLoading(false);
    }, [prices]);

    // 4. Effect: Initial fetch when symbols change
    useEffect(() => {
        if (trackedSymbols.length > 0) {
            fetchQuotes(trackedSymbols);
        }
    }, [trackedSymbols, fetchQuotes]);

    // Helper to get a single quote (checks cache first)
    const getQuote = async (symbol: string): Promise<MarketData | null> => {
        const sym = symbol.toUpperCase();
        const cached = prices[sym];
        const now = Date.now();

        if (cached && (now - cached.lastUpdated < CACHE_DURATION)) {
            return cached;
        }

        // Fetch specifically
        try {
            const quote = await MarketDataService.getQuote(sym);
            if (quote) {
                const data = {
                    price: quote.price,
                    previousClose: quote.previousClose,
                    change: quote.previousClose ? ((quote.price - quote.previousClose) / quote.previousClose) * 100 : 0,
                    lastUpdated: Date.now()
                };
                setPrices(prev => ({ ...prev, [sym]: data }));
                return data;
            }
        } catch (e) {
            console.error(e);
        }
        return null;
    };

    const refresh = async () => {
        await fetchQuotes(trackedSymbols, true);
    };

    return (
        <MarketDataContext.Provider value={{ prices, isLoading, refresh, getQuote }}>
            {children}
        </MarketDataContext.Provider>
    );
};
