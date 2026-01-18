import { useState, useEffect } from 'react';
import {
    collection,
    query,
    where,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    Timestamp
} from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useAuth } from '../context/AuthContext';
import { useAccount } from '../context/AccountContext';
import type { RecurringExpenseRule } from '../types/expenseTypes';

export function useFirestoreRecurringRules() {
    const { user } = useAuth();
    const { selectedAccount } = useAccount();
    const [rules, setRules] = useState<RecurringExpenseRule[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || !selectedAccount) {
            setRules([]);
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'users', user.uid, 'recurring_rules'),
            where('accountId', '==', selectedAccount)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const rulesData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    id: doc.id,
                    lastGeneratedDate: data.lastGeneratedDate?.toDate(),
                    nextDueDate: data.nextDueDate?.toDate()
                } as RecurringExpenseRule;
            });
            setRules(rulesData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching recurring rules:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, selectedAccount]);

    const addRule = async (rule: Omit<RecurringExpenseRule, 'id'>) => {
        if (!user) return;
        return await addDoc(collection(db, 'users', user.uid, 'recurring_rules'), {
            ...rule,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });
    };

    const updateRule = async (id: string, updates: Partial<RecurringExpenseRule>) => {
        if (!user) return;
        const ruleRef = doc(db, 'users', user.uid, 'recurring_rules', id);
        return await updateDoc(ruleRef, {
            ...updates,
            updatedAt: Timestamp.now()
        });
    };

    const deleteRule = async (id: string) => {
        if (!user) return;
        const ruleRef = doc(db, 'users', user.uid, 'recurring_rules', id);
        return await deleteDoc(ruleRef);
    };

    return { rules, loading, addRule, updateRule, deleteRule };
}
