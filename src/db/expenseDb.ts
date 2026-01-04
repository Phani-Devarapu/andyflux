import Dexie, { type Table } from 'dexie';
import type { Expense, RecurringExpenseRule } from '../types/expenseTypes';

export class ExpenseManagerDatabase extends Dexie {
    expenses!: Table<Expense>;
    recurring_rules!: Table<RecurringExpenseRule>;

    constructor() {
        super('ExpenseManagerDB');

        // Version 1: Initial Schema
        // [userId+accountId] is the primary compound index for isolation
        this.version(1).stores({
            expenses: '++id, [userId+accountId], userId, accountId, date, category, isRecurring, frequency'
        });

        // Version 2: Recurring Rules
        this.version(2).stores({
            recurring_rules: '++id, [userId+accountId], nextDueDate'
        });
    }
}

export const expenseDb = new ExpenseManagerDatabase();
