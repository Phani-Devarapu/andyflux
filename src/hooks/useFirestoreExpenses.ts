import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useAuth } from '../context/AuthContext';
// import { useAccount } from '../context/AccountContext'; // Expenses might not be account-bound yet, check model.
// Assuming expenses are global per user for now based on previous sync service, 
// OR they might be account bound? Let's check ExpenseManagerPage usage later. 
// Standardizing on User-Global or Account-Bound?
// The SyncService mirrored `users/{uid}/expenses`.
// Checking ExpenseManager schema... usually it's handy to have them per user.

import type { Expense } from '../types/expenseTypes';

export function useFirestoreExpenses() {
    const { user } = useAuth();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setExpenses([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const ref = collection(db, 'users', user.uid, 'expenses');
        // Order by date descending
        const q = query(ref, orderBy('date', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items: Expense[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                items.push({
                    ...data,
                    id: doc.id,
                    date: data.date?.toDate?.() || new Date(data.date),
                    createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
                    updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
                } as unknown as Expense);
            });
            setExpenses(items);
            setLoading(false);
        }, (err) => {
            console.error("Firestore Expenses Error:", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    return { expenses, loading };
}
