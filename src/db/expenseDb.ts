import Dexie, { type Table } from 'dexie';
import type { Expense } from '../types/expenseTypes';

export class ExpenseManagerDatabase extends Dexie {
    expenses!: Table<Expense>;

    constructor() {
        super('ExpenseManagerDB');

        // Version 1: Initial Schema
        // [userId+accountId] is the primary compound index for isolation
        this.version(1).stores({
            expenses: '++id, [userId+accountId], userId, accountId, date, category, isRecurring, frequency'
        });
    }
}

export const expenseDb = new ExpenseManagerDatabase();
