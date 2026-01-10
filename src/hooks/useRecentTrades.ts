import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useAuth } from '../context/AuthContext';
import { useAccount } from '../context/AccountContext';
import type { Trade } from '../types/trade';

export function useRecentTrades(limitCount = 100) {
    const { user } = useAuth();
    const { selectedAccount } = useAccount();
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchRecent() {
            if (!user || !selectedAccount) {
                setTrades([]);
                return;
            }
            setLoading(true);
            try {
                const q = query(
                    collection(db, 'users', user.uid, 'trades'),
                    where('accountId', '==', selectedAccount),
                    orderBy('date', 'desc'),
                    limit(limitCount)
                );

                const snapshot = await getDocs(q);
                const fetched: Trade[] = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    fetched.push({
                        ...data,
                        id: doc.id,
                        date: data.date?.toDate?.() || new Date(data.date),
                        // ... mappings if needed for PnL chart ...
                        pnl: data.pnl,
                        entryPrice: data.entryPrice,
                        exitPrice: data.exitPrice,
                        quantity: data.quantity,
                        fees: data.fees,

                        // Full object spread for safety
                        ...data,
                        createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
                        updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
                    } as unknown as Trade);
                });

                setTrades(fetched.reverse()); // Reverse for Chart (Oldest first)

            } catch (err) {
                console.error("Error fetching recent trades:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchRecent();
    }, [user, selectedAccount, limitCount]);

    return { trades, loading };
}
