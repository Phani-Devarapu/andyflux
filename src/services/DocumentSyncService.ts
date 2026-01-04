import { db as localDb } from '../db/db';
import { db as remoteDb, auth } from '../utils/firebase';
import { collection, doc, setDoc, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import type { StoredDocument } from '../types/document';
import { onAuthStateChanged } from 'firebase/auth';

class DocumentSyncService {
    private _unsubAuth: (() => void) | null = null;
    private isSyncing = false;

    init() {
        this._unsubAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                console.debug('[DocSync] User signed in, starting sync...');
                this.syncPull(user.uid);
                this.setupHooks(user.uid);
            } else {
                this.removeHooks();
            }
        });
    }

    dispose() {
        if (this._unsubAuth) {
            this._unsubAuth();
        }
    }

    async syncPull(uid: string) {
        if (this.isSyncing) return;
        this.isSyncing = true;
        try {
            const collectionRef = collection(remoteDb, 'users', uid, 'documents');
            const snapshot = await getDocs(collectionRef);

            if (snapshot.empty) {
                console.debug('[DocSync] No remote data. Pushing local data...');
                await this.syncPushAll(uid);
            } else {
                console.debug(`[DocSync] Found ${snapshot.size} remote documents.`);
                const remoteItems: StoredDocument[] = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const item = {
                        ...data,
                        id: parseInt(doc.id),
                        createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
                        // synced: true // If it came from cloud, it is synced.
                    } as StoredDocument;
                    remoteItems.push(item);
                });
                await localDb.documents.bulkPut(remoteItems);
            }
        } catch (error) {
            console.error('[DocSync] Error syncing pull:', error);
        } finally {
            this.isSyncing = false;
        }
    }

    async syncPushAll(uid: string) {
        const allItems = await localDb.documents.toArray();
        if (allItems.length === 0) return;

        const batch = writeBatch(remoteDb);
        const collectionRef = collection(remoteDb, 'users', uid, 'documents');
        const updates: StoredDocument[] = [];

        allItems.forEach(item => {
            if (!item.id) return;
            // Exclude 'content' blob if it exists, never push blobs to Firestore!
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { content, ...metaOnly } = item;

            const updatedItem = { ...metaOnly, userId: uid, synced: true };
            const localUpdate = { ...item, userId: uid, synced: true };
            updates.push(localUpdate);

            const docRef = doc(collectionRef, item.id.toString());
            // Use serverTimestamp for Firestore specific field if needed, but for now we keep simple
            batch.set(docRef, { ...updatedItem, createdAt: item.createdAt });
        });

        await batch.commit();
        await localDb.documents.bulkPut(updates);
        console.debug(`[DocSync] Pushed ${allItems.length} documents.`);
    }

    setupHooks(uid: string) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        localDb.documents.hook('creating', function (this: any, _primKey, obj) {
            this.onsuccess = (key: number) => {
                self.pushSingle(uid, { ...obj, id: key } as StoredDocument, key);
            };
        });

        localDb.documents.hook('updating', (mods, primKey, obj) => {
            const updated = { ...obj, ...mods } as StoredDocument;
            this.pushSingle(uid, updated, primKey);
        });

        localDb.documents.hook('deleting', (primKey) => {
            this.deleteSingle(uid, primKey);
        });
    }

    removeHooks() { }

    async pushSingle(uid: string, item: StoredDocument, id?: number | string) {
        try {
            if (!auth.currentUser) return;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sanitize = (obj: any): any => {
                if (obj === undefined || obj === null) return null;
                if (typeof obj !== 'object') return obj;
                if (obj instanceof Date) return obj;
                if (Array.isArray(obj)) return obj.map(sanitize);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const newObj: any = {};
                for (const key in obj) {
                    const val = obj[key];
                    if (val !== undefined) newObj[key] = sanitize(val);
                }
                return newObj;
            };

            // Remove content blob if present
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { content, ...metaOnly } = item;

            const clean = sanitize(metaOnly);
            if (id) {
                const docRef = doc(remoteDb, 'users', uid, 'documents', id.toString());
                setDoc(docRef, { ...clean, id: id, synced: true }).catch(e => console.error(e));
            }
        } catch (e) {
            console.error('[DocSync] Push failed:', e);
        }
    }

    async deleteSingle(uid: string, id: number | string) {
        if (!auth.currentUser) return;
        try {
            const docRef = doc(remoteDb, 'users', uid, 'documents', id.toString());
            deleteDoc(docRef);
        } catch (e) {
            console.error('[DocSync] Delete failed:', e);
        }
    }
}

export const documentSyncService = new DocumentSyncService();
