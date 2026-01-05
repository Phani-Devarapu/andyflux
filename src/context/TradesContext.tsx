import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useAuth } from './AuthContext';
import { useAccount } from './AccountContext';
import type { Trade } from '../types/trade';

interface TradesContextType {
    trades: Trade[];
    loading: boolean;
    error: Error | null;
    deleteTrade: (tradeId: string) => Promise<void>;
    refreshTrades: () => void; // meaningful mostly for manual re-fetch if we weren't using streams, but kept for compat
}

const TradesContext = createContext<TradesContextType | undefined>(undefined);

export function TradesProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const { selectedAccount } = useAccount();
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!user || !selectedAccount) {
            setTrades([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const tradesRef = collection(db, 'users', user.uid, 'trades');
        const q = query(
            tradesRef,
            where('accountId', '==', selectedAccount),
            orderBy('date', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedTrades: Trade[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                fetchedTrades.push({
                    ...data,
                    id: doc.id,
                    // Handle timestamps safely
                    date: data.date?.toDate?.() || new Date(data.date),
                    exitDate: data.exitDate?.toDate?.() || (data.exitDate ? new Date(data.exitDate) : undefined),
                    expiration: data.expiration?.toDate?.() || (data.expiration ? new Date(data.expiration) : undefined),
                    createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
                    updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
                } as unknown as Trade);
            });
            setTrades(fetchedTrades);
            setLoading(false);
        }, (err) => {
            console.error("Firestore Trades Error:", err);
            setError(err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, selectedAccount]);

    const deleteTrade = async (tradeId: string) => {
        if (!user || !tradeId) return;
        try {
            await deleteDoc(doc(db, 'users', user.uid, 'trades', tradeId));
        } catch (err) {
            console.error("Error deleting trade:", err);
            throw err;
        }
    };

    const refreshTrades = () => {
        // No-op for onSnapshot, but could be used to force-reset loading state if needed
    };

    return (
        <TradesContext.Provider value={{ trades, loading, error, deleteTrade, refreshTrades }}>
            {children}
        </TradesContext.Provider>
    );
}

export function useTrades() {
    const context = useContext(TradesContext);
    if (context === undefined) {
        throw new Error('useTrades must be used within a TradesProvider');
    }
    return context;
}
