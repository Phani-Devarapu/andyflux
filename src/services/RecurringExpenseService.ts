import { expenseDb } from '../db/expenseDb';
import type { RecurringExpenseRule, Expense } from '../types/expenseTypes';
import { addMonths, addYears, startOfDay } from 'date-fns';

export class RecurringExpenseService {

    // Run this whenever the app starts (or ExpenseManagerPage mounts)
    static async checkAndGenerateExpenses() {
        const today = startOfDay(new Date());

        // 1. Get all active rules where nextDueDate <= today
        const dueRules = await expenseDb.recurring_rules
            .where('nextDueDate')
            .belowOrEqual(today)
            .toArray();

        if (dueRules.length === 0) return;

        console.log(`Creating ${dueRules.length} recurring expenses...`);

        await expenseDb.transaction('rw', expenseDb.expenses, expenseDb.recurring_rules, async () => {
            for (const rule of dueRules) {
                // Double check if we already generated for this date to avoid dupes
                // (though the logic below updating nextDueDate should prevent it)

                // Create the expense
                const newExpense: Expense = {
                    userId: rule.userId,
                    accountId: rule.accountId,
                    date: rule.nextDueDate, // Use the due date as the expense date
                    category: rule.category,
                    amount: rule.amount,
                    description: rule.description || 'Recurring Expense',
                    isRecurring: true,
                    frequency: rule.frequency,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                await expenseDb.expenses.add(newExpense);

                // Calculate next due date
                let nextDate = new Date(rule.nextDueDate);
                if (rule.frequency === 'monthly') {
                    nextDate = addMonths(nextDate, 1);
                } else if (rule.frequency === 'yearly') {
                    nextDate = addYears(nextDate, 1);
                }

                // Update the rule
                await expenseDb.recurring_rules.update(rule.id!, {
                    lastGeneratedDate: rule.nextDueDate,
                    nextDueDate: nextDate
                });
            }
        });
    }

    static async createRuleFromExpense(expense: Expense) {
        if (!expense.isRecurring || !expense.frequency) return;

        // Calculate next due date (next month/year from the expense date)
        let nextDate = new Date(expense.date);
        if (expense.frequency === 'monthly') {
            nextDate = addMonths(nextDate, 1);
        } else if (expense.frequency === 'yearly') {
            nextDate = addYears(nextDate, 1);
        }

        const rule: RecurringExpenseRule = {
            userId: expense.userId,
            accountId: expense.accountId,
            category: expense.category,
            amount: expense.amount,
            description: expense.description,
            frequency: expense.frequency,
            lastGeneratedDate: expense.date,
            nextDueDate: nextDate,
            isActive: true
        };

        await expenseDb.recurring_rules.add(rule);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static async updateRule(_expenseId: number, _updates: Partial<RecurringExpenseRule>) {
        // Find the rule associated with this expense?
        // Logic might be tricky if we don't link expense -> rule ID.
        // For now, we are just creating rules. Editing them might come later in "Manage Subscriptions".
    }
}
