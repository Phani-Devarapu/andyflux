import { db as localDb } from '../db/db';
import { db as remoteDb, auth } from '../utils/firebase';
import { collection, doc, setDoc, getDocs, writeBatch, serverTimestamp, deleteDoc } from 'firebase/firestore';
import type { Goal } from '../types/goal';
import { onAuthStateChanged } from 'firebase/auth';

class GoalSyncService {
    private _unsubAuth: (() => void) | null = null;
    private isSyncing = false;

    init() {
        this._unsubAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                console.debug('[GoalSync] User signed in, starting sync...');
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

    // Pull from cloud and merge
    async syncPull(uid: string) {
        if (this.isSyncing) return;
        this.isSyncing = true;
        try {
            const collectionRef = collection(remoteDb, 'users', uid, 'goals');
            const snapshot = await getDocs(collectionRef);

            if (snapshot.empty) {
                console.debug('[GoalSync] No remote data. Pushing local data...');
                await this.syncPushAll(uid);
            } else {
                console.debug(`[GoalSync] Found ${snapshot.size} remote goals.`);
                const remoteItems: Goal[] = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const item = {
                        ...data,
                        id: parseInt(doc.id),
                        createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
                        updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
                    } as Goal;
                    remoteItems.push(item);
                });
                await localDb.goals.bulkPut(remoteItems);
            }
        } catch (error) {
            console.error('[GoalSync] Error syncing pull:', error);
        } finally {
            this.isSyncing = false;
        }
    }

    async syncPushAll(uid: string) {
        const allItems = await localDb.goals.toArray();
        if (allItems.length === 0) return;

        const batch = writeBatch(remoteDb);
        const collectionRef = collection(remoteDb, 'users', uid, 'goals');
        const updates: Goal[] = [];

        allItems.forEach(item => {
            if (!item.id) return;
            const updatedItem = { ...item, userId: uid, updatedAt: serverTimestamp() };
            const localUpdate = { ...item, userId: uid, updatedAt: new Date() };
            updates.push(localUpdate);

            const docRef = doc(collectionRef, item.id.toString());
            batch.set(docRef, updatedItem);
        });

        await batch.commit();
        await localDb.goals.bulkPut(updates);
        console.debug(`[GoalSync] Pushed ${allItems.length} goals.`);
    }

    setupHooks(uid: string) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        localDb.goals.hook('creating', function (this: any, _primKey, obj) {
            this.onsuccess = (key: number) => {
                self.pushSingle(uid, { ...obj, id: key } as Goal, key);
            };
        });

        localDb.goals.hook('updating', (mods, primKey, obj) => {
            const updated = { ...obj, ...mods } as Goal;
            this.pushSingle(uid, updated, primKey);
        });

        localDb.goals.hook('deleting', (primKey) => {
            this.deleteSingle(uid, primKey);
        });
    }

    removeHooks() {
        // Hooks are global, relied on auth check in push methods
    }

    async pushSingle(uid: string, item: Goal, id?: number | string) {
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

            const clean = sanitize(item);
            if (id) {
                const docRef = doc(remoteDb, 'users', uid, 'goals', id.toString());
                setDoc(docRef, { ...clean, id: id, updatedAt: serverTimestamp() }).catch(e => console.error(e));
            }
        } catch (e) {
            console.error('[GoalSync] Push failed:', e);
        }
    }

    async deleteSingle(uid: string, id: number | string) {
        if (!auth.currentUser) return;
        try {
            const docRef = doc(remoteDb, 'users', uid, 'goals', id.toString());
            deleteDoc(docRef);
        } catch (e) {
            console.error('[GoalSync] Delete failed:', e);
        }
    }
}

export const goalSyncService = new GoalSyncService();
