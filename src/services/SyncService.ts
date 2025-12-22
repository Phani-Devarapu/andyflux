import { db as localDb } from '../db/db';
import { db as remoteDb, auth } from '../utils/firebase';
import { collection, doc, setDoc, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import type { Trade } from '../types/trade';
import { onAuthStateChanged } from 'firebase/auth';

// Sync Service
// Strategy:
// 1. Listen for Auth Changes.
// 2. On Login: Pull all trades from Firestore -> Merge with Local.
// 3. On Local Change (Hook): Push to Firestore.

class SyncService {
    private _unsubAuth: (() => void) | null = null;
    private isSyncing = false;

    init() {
        this._unsubAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                console.debug('User signed in, starting sync...');
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
            const tradesRef = collection(remoteDb, 'users', uid, 'trades');
            const snapshot = await getDocs(tradesRef);

            if (snapshot.empty) {
                console.debug('No remote data found. Pushing local data to cloud...');
                await this.syncPushAll(uid);
            } else {
                console.debug(`Found ${snapshot.size} remote trades. Syncing...`);
                // Simple strategy: Remote overwrites local if ID matches, else add.
                // ideally we compare updatedAt, but for now let's just merge.

                const remoteTrades: Trade[] = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    // Convert timestamps back to Dates
                    const trade = {
                        ...data,
                        id: parseInt(doc.id), // Firestore ID is string, but our Local ID is number.
                        date: data.date?.toDate?.() || new Date(data.date),
                        createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
                        updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
                        exitDate: data.exitDate?.toDate?.() || (data.exitDate ? new Date(data.exitDate) : undefined),
                    } as Trade;
                    remoteTrades.push(trade);
                });

                await localDb.trades.bulkPut(remoteTrades);
                console.debug('Sync complete.');
            }
        } catch (error) {
            console.error('Error syncing pull:', error);
        } finally {
            this.isSyncing = false;
        }
    }

    // Push all local data to cloud (Initial migration / First Sync)
    async syncPushAll(uid: string) {
        const allTrades = await localDb.trades.toArray();
        if (allTrades.length === 0) return;

        const batch = writeBatch(remoteDb);
        const tradesRef = collection(remoteDb, 'users', uid, 'trades');
        const updates: Trade[] = [];

        allTrades.forEach(trade => {
            if (!trade.id) return;
            // Claim this trade for the user if it doesn't have one
            const updatedTrade = { ...trade, userId: uid, updatedAt: serverTimestamp() };
            // For local update (timestamp must be Date, not serverTimestamp object)
            const localUpdate = { ...trade, userId: uid, updatedAt: new Date() };
            updates.push(localUpdate);

            const docRef = doc(tradesRef, trade.id.toString());
            batch.set(docRef, updatedTrade);
        });

        await batch.commit();
        // Update local DB to reflect that these trades now belong to this user
        // This ensures they show up in queries filtering by userId
        await localDb.trades.bulkPut(updates);

        console.debug(`Pushed and migrated ${allTrades.length} trades to cloud for user ${uid}.`);
    }

    setupHooks(uid: string) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        // Dexie Hooks
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        localDb.trades.hook('creating', function (this: any, _primKey, obj) {
            // onSuccess gives us the primary key for auto-incremented tables
            this.onsuccess = (key: number) => {
                self.pushSingleTrade(uid, { ...obj, id: key } as Trade, key);
            };
        });

        localDb.trades.hook('updating', (mods, primKey, obj) => {
            const updatedTrade = { ...obj, ...mods } as Trade;
            this.pushSingleTrade(uid, updatedTrade, primKey);
        });

        localDb.trades.hook('deleting', (primKey) => {
            this.deleteSingleTrade(uid, primKey);
        });
    }

    removeHooks() {
        // Dexie doesn't have an easy 'removeHook', so we handle this by checking auth inside the hook?
        // OR we just rely on the fact that if auth is null, we shouldn't push.
        // But the hooks are registered globally on the DB instance.
        // Better to check auth state inside the methods `pushSingleTrade`.
    }

    async pushSingleTrade(uid: string, trade: Trade, id?: number | string) {
        try {
            // If ID is missing (auto-inc), wait? 
            // For creating, primitives are resolved.
            // But if auto-increment, we might need to handle it.
            // Let's assume for now we use 'put' which works.

            // Note: Dexie 'creating' hook for auto-increment keys is tricky.
            // We might just subscribe to 'changes' observable if available, but hooks are better.

            // If primary key is not yet assigned, we can't push to Firestore with the correct ID.
            // Workaround: We can't easily hook 'creating' for auto-inc. 
            // Instead, let's allow the ID to be assigned, then we need to capture it.

            // Actually, simplest is to use `db.on('changes')` from `dexie-cloud-addon` or similar, 
            // but we are vanilla.

            // Alternative: Just use the ID if available. 
            if (!auth.currentUser) return;

            const sanitizeForFirestore = (obj: any): any => {
                if (obj === undefined) return null; // or could delete
                if (obj === null) return null;
                if (typeof obj !== 'object') return obj;
                if (obj instanceof Date) return obj;
                if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);

                const newObj: any = {};
                for (const key in obj) {
                    const val = obj[key];
                    if (val !== undefined) {
                        newObj[key] = sanitizeForFirestore(val);
                    } else {
                        // Explicitly set undefined fields to null? Or just omit?
                        // "Unsupported field value: undefined"
                        // Safer to omit.
                        // But if we omit, previous values might stay? 
                        // setDoc with merge:false overwrites, so omitting works for removing.
                        // But wait, setDoc replaces the document unless merge:true.
                        // So omitting is effectively "deleting" that field.
                    }
                }
                return newObj;
            };

            const cleanTrade = sanitizeForFirestore(trade);

            if (id) {
                const tradesRef = collection(remoteDb, 'users', uid, 'trades');
                const docRef = doc(tradesRef, id.toString());
                // Don't await, fire and forget (or queue)
                setDoc(docRef, { ...cleanTrade, id: id, updatedAt: serverTimestamp() }).catch(e => console.error(e));
            } else {
                // If ID is undefined (creation), we might miss it.
                // We'll rely on the fact that 'put' usually has an ID or we can query it?
                // Actually, for auto-inc, hook('creating') returns primKey as undefined.
                // But the 'onSuccess' callback of the hook receives the key!
            }

        } catch (e) {
            console.error('Error pushing trade:', e);
        }
    }

    async deleteSingleTrade(uid: string, id: number | string) {
        if (!auth.currentUser) return;
        try {
            const tradesRef = collection(remoteDb, 'users', uid, 'trades');
            const docRef = doc(tradesRef, id.toString());
            // deleteDoc is not imported, fetching it...
            // (Lazy load or import above)
            const { deleteDoc } = await import('firebase/firestore');
            deleteDoc(docRef);
        } catch (e) {
            console.error('Error deleting trade:', e);
        }
    }

    // Bulk Delete by Month/Year
    async deleteTradesByMonth(uid: string, year: number, month: number) {
        if (!auth.currentUser) return;
        this.isSyncing = true; // Prevent sync loops
        try {
            console.debug(`Deleting trades for ${month}/${year}...`);

            // 1. Calculate Date Range
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59, 999); // Last day of month

            // 2. Find IDs in Local DB
            const tradesToDelete = await localDb.trades
                .where('date')
                .between(startDate, endDate, true, true)
                .toArray();

            const ids = tradesToDelete.map(t => t.id).filter(id => id !== undefined) as number[];

            if (ids.length === 0) {
                console.debug('No trades found for this period.');
                return;
            }

            console.debug(`Found ${ids.length} trades to delete.`);

            // 3. Delete from Firestore (Batched)
            const { writeBatch } = await import('firebase/firestore');
            // Firestore batch limit is 500
            const chunkSize = 400;
            for (let i = 0; i < ids.length; i += chunkSize) {
                const chunk = ids.slice(i, i + chunkSize);
                const batch = writeBatch(remoteDb);
                const tradesRef = collection(remoteDb, 'users', uid, 'trades');

                chunk.forEach(id => {
                    const docRef = doc(tradesRef, id.toString());
                    batch.delete(docRef);
                });

                await batch.commit();
                console.debug(`Deleted batch ${i / chunkSize + 1} from Firestore.`);
            }

            // 4. Delete from Local DB (Bulk delete to avoid individual hooks if possible, 
            // but Dexie hooks still fire on bulkDelete? 
            // Actually bulkDelete does NOT fire 'deleting' hook for each item usually, 
            // but let's be safe: we set isSyncing=true so our hooks knowing that?
            // Our hooks don't check isSyncing yet.
            // But since we already deleted from Firestore above, if the hook fires and tries to delete again,
            // it's redundant but harmless (firestore delete is idempotent).

            await localDb.trades.bulkDelete(ids);
            console.debug('Deleted from Local DB.');

        } catch (error) {
            console.error('Error in bulk delete:', error);
            throw error;
        } finally {
            this.isSyncing = false;
        }
    }
}

export const syncService = new SyncService();
