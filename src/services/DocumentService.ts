import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { storage } from '../utils/firebase';
import { db } from '../db/db';
import type { StoredDocument } from '../types/document';

export class DocumentService {

    /**
     * Upload a file to Firebase Storage and save metadata to local DB
     */
    async uploadDocument(userId: string, accountId: string, file: File): Promise<StoredDocument> {
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `users/${userId}/documents/${timestamp}_${safeName}`;
        const storageRef = ref(storage, storagePath);

        // 1. Create metadata record
        const doc: StoredDocument = {
            userId,
            accountId,
            name: file.name,
            type: file.type,
            size: file.size,
            storagePath,
            createdAt: new Date(),
            synced: false // Initially false
        };

        // 2. Save to Local DB (Optimistic)
        // We do this FIRST so the user sees the file immediately, even if upload is slow.
        const id = await db.documents.add(doc);
        const savedDoc = { ...doc, id };

        // 3. Upload to Firebase Storage
        // We still await this so the UI knows when sync is done, but the record is already safe locally.
        try {
            await uploadBytes(storageRef, file);
            // 4. Update Local DB to confirm sync
            await db.documents.update(id, { synced: true });
            savedDoc.synced = true;
        } catch (error) {
            console.error('Cloud upload failed, but local record saved:', error);
            // We re-throw so the UI can show the "Upload failed/timed out" warning if needed,
            // or we could suppress it if we want "Offline Mode" behavior.
            // Given the user wants to see the file, returning the doc is priority. 
            // But let's throw so the "timeout/race" logic in UI still works to warn the user about network issues.
            throw error;
        }

        return savedDoc;
    }

    /**
     * Get download URL for a document
     */
    async getDownloadUrl(storagePath: string): Promise<string> {
        const storageRef = ref(storage, storagePath);
        return await getDownloadURL(storageRef);
    }

    /**
     * Delete document from Storage and Local DB
     */
    async deleteDocument(id: number, storagePath: string) {
        // 1. Delete from Storage
        const storageRef = ref(storage, storagePath);
        try {
            await deleteObject(storageRef);
        } catch (error) {
            console.warn('Error deleting from storage (might already be gone):', error);
        }

        // 2. Delete from Local DB
        await db.documents.delete(id);
    }

    /**
     * Sync function to populate local DB from Storage (Simple one-way sync for now)
     * This is useful if the user logs in on a new device.
     */
    async syncFromStorage(userId: string, accountId: string) {
        const listRef = ref(storage, `users/${userId}/documents/`);
        const res = await listAll(listRef);

        const existingDocs = await db.documents
            .where('[userId+accountId]')
            .equals([userId, accountId])
            .toArray();

        const existingPaths = new Set(existingDocs.map(d => d.storagePath));

        for (const itemRef of res.items) {
            if (!existingPaths.has(itemRef.fullPath)) {
                // Determine metadata (limited info available from listAll)
                // We fake some details or fetch metadata if needed. 
                // For now, let's just make it visible.
                const newDoc: StoredDocument = {
                    userId,
                    accountId,
                    name: itemRef.name.split('_').slice(1).join('_') || itemRef.name, // Remove timestamp prefix
                    type: 'application/octet-stream', // Unknown
                    size: 0, // Unknown without getting metadata
                    storagePath: itemRef.fullPath,
                    createdAt: new Date()
                };
                await db.documents.add(newDoc);
            }
        }
    }
}

export const documentService = new DocumentService();
