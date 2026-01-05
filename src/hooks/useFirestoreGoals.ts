import { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useAuth } from '../context/AuthContext';
import type { Goal } from '../types/goal';

export function useFirestoreGoals() {
    const { user } = useAuth();
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setGoals([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const ref = collection(db, 'users', user.uid, 'goals');
        // Order by createdAt or priority? Let's default to createdAt desc
        // But goals might not have createdAt in all legacy data?
        // Let's just fetch default query for now.
        const q = query(ref);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items: Goal[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                items.push({
                    ...data,
                    id: doc.id,
                    deadline: data.deadline?.toDate?.() || (data.deadline ? new Date(data.deadline) : undefined),
                    createdAt: data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : undefined),
                } as unknown as Goal);
            });
            // Sort client side if needed, or by query
            setGoals(items);
            setLoading(false);
        }, (err) => {
            console.error("Firestore Goals Error:", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    return { goals, loading };
}
