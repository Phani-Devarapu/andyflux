import { useState, useEffect, useCallback, useRef } from 'react';
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    getDocs,
    type DocumentData,
    type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useAuth } from '../context/AuthContext';
import { useAccount } from '../context/AccountContext';
import type { Trade } from '../types/trade';

const PAGE_SIZE = 50;

export function usePaginatedTrades() {
    const { user } = useAuth();
    const { selectedAccount } = useAccount();
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [hasMore, setHasMore] = useState(true);

    // Prevent double fetch in React Strict Mode
    const initialLoadDone = useRef(false);
    const prevAccount = useRef<string | null>(null);

    const resetState = useCallback(() => {
        setTrades([]);
        setLastDoc(null);
        setHasMore(true);
        initialLoadDone.current = false;
    }, []);

    const fetchTrades = useCallback(async (isInitial = false) => {
        if (!user || !selectedAccount) return;
        if (loading) return;

        // If it's a "load more" call but we have no cursor, abort (safety)
        if (!isInitial && !lastDoc) return;

        setLoading(true);
        setError(null);

        try {
            const tradesRef = collection(db, 'users', user.uid, 'trades');

            // Build Query
            let q = query(
                tradesRef,
                where('accountId', '==', selectedAccount),
                orderBy('date', 'desc'),
                limit(PAGE_SIZE)
            );

            // Apply Cursor
            // Note: If isInitial is true, we ignore lastDoc and fetch from top
            if (!isInitial && lastDoc) {
                q = query(q, startAfter(lastDoc));
            }

            const snapshot = await getDocs(q);
            const fetchedTrades: Trade[] = [];

            snapshot.forEach((doc) => {
                const data = doc.data();
                fetchedTrades.push({
                    ...data,
                    id: doc.id,
                    date: data.date?.toDate?.() || new Date(data.date),
                    exitDate: data.exitDate?.toDate?.() || (data.exitDate ? new Date(data.exitDate) : undefined),
                    expiration: data.expiration?.toDate?.() || (data.expiration ? new Date(data.expiration) : undefined),
                    createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
                    updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
                } as unknown as Trade);
            });

            setTrades(prev => isInitial ? fetchedTrades : [...prev, ...fetchedTrades]);
            setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
            setHasMore(snapshot.docs.length === PAGE_SIZE);

        } catch (err) {
            console.error("Error fetching paginated trades:", err);
            setError(err as Error);
        } finally {
            setLoading(false);
        }
    }, [user, selectedAccount, lastDoc, loading]);

    // Handle Account/User Change & Initial Load
    useEffect(() => {
        if (!user || !selectedAccount) return;

        // If account changed, reset and fetch
        if (selectedAccount !== prevAccount.current) {
            resetState();
            prevAccount.current = selectedAccount;
            fetchTrades(true);
        }
        // If not changed but initial load not done (e.g. first mount)
        else if (!initialLoadDone.current) {
            fetchTrades(true);
            initialLoadDone.current = true;
        }
    }, [user, selectedAccount, fetchTrades, resetState]);

    const deleteTrade = useCallback(async (tradeId: string) => {
        if (!user || !tradeId) return;
        try {
            const { deleteDoc, doc } = await import('firebase/firestore');
            await deleteDoc(doc(db, 'users', user.uid, 'trades', tradeId));
            setTrades(prev => prev.filter(t => t.id !== tradeId));
        } catch (err) {
            console.error("Error deleting trade:", err);
            throw err;
        }
    }, [user]);

    return {
        trades,
        loading,
        error,
        loadMore: () => fetchTrades(false),
        hasMore,
        refresh: () => {
            resetState();
            fetchTrades(true);
        },
        deleteTrade
    };
}
