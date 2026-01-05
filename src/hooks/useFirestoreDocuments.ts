import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useAuth } from '../context/AuthContext';
import type { StoredDocument } from '../types/document';

export function useFirestoreDocuments() {
    const { user } = useAuth();
    const [documents, setDocuments] = useState<StoredDocument[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setDocuments([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const ref = collection(db, 'users', user.uid, 'documents');
        // Order by date descending (createdAt)
        const q = query(ref, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items: StoredDocument[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                items.push({
                    ...data,
                    id: doc.id,
                    createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
                } as unknown as StoredDocument);
            });
            setDocuments(items);
            setLoading(false);
        }, (err) => {
            console.error("Firestore Documents Error:", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    return { documents, loading };
}
