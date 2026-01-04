import { expenseDb as localDb } from '../db/expenseDb';
import { db as remoteDb, auth } from '../utils/firebase';
import { collection, doc, setDoc, getDocs, writeBatch, serverTimestamp, deleteDoc } from 'firebase/firestore';
import type { Expense } from '../types/expenseTypes';
import { onAuthStateChanged } from 'firebase/auth';

class ExpenseSyncService {
    private _unsubAuth: (() => void) | null = null;
    private isSyncing = false;

    init() {
        this._unsubAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                console.debug('[ExpenseManager] User signed in, starting sync...');
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
            const expensesRef = collection(remoteDb, 'users', uid, 'expenses');
            const snapshot = await getDocs(expensesRef);

            if (snapshot.empty) {
                console.debug('[ExpenseManager] No remote data found. Pushing local data to cloud...');
                await this.syncPushAll(uid);
            } else {
                console.debug(`[ExpenseManager] Found ${snapshot.size} remote expenses. Syncing...`);

                const remoteExpenses: Expense[] = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const expense = {
                        ...data,
                        id: parseInt(doc.id),
                        date: data.date?.toDate?.() || new Date(data.date),
                        createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
                        updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
                    } as Expense;
                    remoteExpenses.push(expense);
                });

                await localDb.expenses.bulkPut(remoteExpenses);
                console.debug('[ExpenseManager] Sync complete.');
            }
        } catch (error) {
            console.error('[ExpenseManager] Error syncing pull:', error);
        } finally {
            this.isSyncing = false;
        }
    }

    // Push all local data to cloud (Initial migration / First Sync)
    async syncPushAll(uid: string) {
        const allExpenses = await localDb.expenses.toArray();
        if (allExpenses.length === 0) return;

        const batch = writeBatch(remoteDb);
        const expensesRef = collection(remoteDb, 'users', uid, 'expenses');
        const updates: Expense[] = [];

        allExpenses.forEach(expense => {
            if (!expense.id) return;
            const updatedExpense = { ...expense, userId: uid, updatedAt: serverTimestamp() };
            const localUpdate = { ...expense, userId: uid, updatedAt: new Date() }; // Local stores Date object
            updates.push(localUpdate);

            const docRef = doc(expensesRef, expense.id.toString());
            batch.set(docRef, updatedExpense);
        });

        await batch.commit();
        await localDb.expenses.bulkPut(updates);

        console.debug(`[ExpenseManager] Pushed ${allExpenses.length} expenses to cloud for user ${uid}.`);
    }

    setupHooks(uid: string) {
        const self = this;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        localDb.expenses.hook('creating', function (this: any, _primKey, obj) {
            this.onsuccess = (key: number) => {
                self.pushSingleExpense(uid, { ...obj, id: key } as Expense, key);
            };
        });

        localDb.expenses.hook('updating', (mods, primKey, obj) => {
            const updatedExpense = { ...obj, ...mods } as Expense;
            this.pushSingleExpense(uid, updatedExpense, primKey);
        });

        localDb.expenses.hook('deleting', (primKey) => {
            this.deleteSingleExpense(uid, primKey);
        });
    }

    removeHooks() {
        // Dexie hooks are global on the table instance, so strictly speaking
        // we can't 'remove' them easily without keeping track of them.
        // However, checking `auth.currentUser` inside the push methods is the standard safeguard.
    }

    async pushSingleExpense(uid: string, expense: Expense, id?: number | string) {
        try {
            if (!auth.currentUser) return;

            const sanitizeForFirestore = (obj: any): any => {
                if (obj === undefined || obj === null) return null;
                if (typeof obj !== 'object') return obj;
                if (obj instanceof Date) return obj;
                if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);

                const newObj: any = {};
                for (const key in obj) {
                    const val = obj[key];
                    if (val !== undefined) {
                        newObj[key] = sanitizeForFirestore(val);
                    }
                }
                return newObj;
            };

            const cleanExpense = sanitizeForFirestore(expense);

            if (id) {
                const expensesRef = collection(remoteDb, 'users', uid, 'expenses');
                const docRef = doc(expensesRef, id.toString());
                setDoc(docRef, { ...cleanExpense, id: id, updatedAt: serverTimestamp() }).catch(e => console.error(e));
            }
        } catch (e) {
            console.error('[ExpenseManager] Error pushing expense:', e);
        }
    }

    async deleteSingleExpense(uid: string, id: number | string) {
        if (!auth.currentUser) return;
        try {
            const expensesRef = collection(remoteDb, 'users', uid, 'expenses');
            const docRef = doc(expensesRef, id.toString());
            deleteDoc(docRef);
        } catch (e) {
            console.error('[ExpenseManager] Error deleting expense:', e);
        }
    }
}

export const expenseSyncService = new ExpenseSyncService();
