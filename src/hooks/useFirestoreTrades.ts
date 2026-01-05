import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db as remoteDb } from '../utils/firebase';
import { useAuth } from '../context/AuthContext';
import { useAccount } from '../context/AccountContext';
import type { Trade } from '../types/trade';

export function useFirestoreTrades() {
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
        const tradesRef = collection(remoteDb, 'users', user.uid, 'trades');
        // Query: Filter by accountId and order by date (descending)
        // Note: This requires a composite index in Firestore [accountId + date]
        // If index is missing, Firestore will throw an error with a link to create it.
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
                    id: doc.id, // Firestore ID is string
                    ...data,
                    // Convert Timestamps to Dates
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
            console.error("Firestore Error:", err);
            setError(err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, selectedAccount]);

    return { trades, loading, error };
}
