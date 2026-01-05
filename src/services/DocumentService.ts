import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage, db } from '../utils/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import type { StoredDocument } from '../types/document';

export class DocumentService {

    /**
     * Upload a file to Firebase Storage and save metadata to Firestore
     */
    async uploadDocument(userId: string, accountId: string, file: File): Promise<StoredDocument> {
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `users/${userId}/documents/${timestamp}_${safeName}`;
        const storageRef = ref(storage, storagePath);

        // 1. Create metadata record
        const documentData: StoredDocument = {
            userId,
            accountId,
            name: file.name,
            type: file.type,
            size: file.size,
            storagePath,
            createdAt: new Date(),
            synced: false // Initially false until upload completes
        };

        // 2. Save to Firestore (Optimistic)
        const docRef = await addDoc(collection(db, 'users', userId, 'documents'), documentData);
        const savedDoc = { ...documentData, id: docRef.id };

        // 3. Upload to Firebase Storage
        try {
            await uploadBytes(storageRef, file);
            // 4. Update Firestore to confirm sync
            await updateDoc(docRef, { synced: true });
            savedDoc.synced = true;
        } catch (error) {
            console.error('Cloud upload failed, but record saved:', error);
            // Update Firestore to indicate failure? Or just leave as synced: false
            throw error;
        }

        // Return with string ID (Firestore ID)
        return savedDoc as any as StoredDocument;
    }

    /**
     * Get download URL for a document
     */
    async getDownloadUrl(storagePath: string): Promise<string> {
        const storageRef = ref(storage, storagePath);
        return await getDownloadURL(storageRef);
    }

    /**
     * Delete document from Storage and Firestore
     */
    async deleteDocument(id: string, storagePath: string, userId: string) {
        // 1. Delete from Storage
        const storageRef = ref(storage, storagePath);
        try {
            await deleteObject(storageRef);
        } catch (error) {
            console.warn('Error deleting from storage (might already be gone):', error);
        }

        // 2. Delete from Firestore
        await deleteDoc(doc(db, 'users', userId, 'documents', id));
    }
}

export const documentService = new DocumentService();
