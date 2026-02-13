import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    doc,
    Timestamp
} from 'firebase/firestore';
import { db } from '../utils/firebase';
import type { RecurringExpenseRule, Expense } from '../types/expenseTypes';
import { addMonths, addYears, isBefore, startOfDay } from 'date-fns';

export class RecurringExpenseService {
    /**
     * Process all rules for a user and generate pending expenses
     */
    static async processRules(userId: string, accountId: string) {
        const rulesRef = collection(db, 'users', userId, 'recurring_rules');
        const q = query(rulesRef, where('accountId', '==', accountId), where('isActive', '==', true));

        const snapshot = await getDocs(q);
        const rules = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as RecurringExpenseRule));

        const today = startOfDay(new Date());
        let totalGeneratedCount = 0;

        for (const rule of rules) {
            let ruleGeneratedCount = 0;
            // Handle both Date and Firestore Timestamp objects
            let nextDue = (rule.nextDueDate as any).toDate ? (rule.nextDueDate as any).toDate() : new Date(rule.nextDueDate);

            // Loop in case multiple periods were missed
            while (isBefore(nextDue, today) || nextDue.getTime() === today.getTime()) {
                // BUG FIX: Prevent duplicate generation if expense already exists (e.g. from PDF import)
                const startOfNextDue = startOfDay(nextDue);
                const endOfNextDue = new Date(startOfNextDue);
                endOfNextDue.setHours(23, 59, 59, 999);

                const existingExpensesRef = collection(db, 'users', userId, 'expenses');
                const dupQuery = query(
                    existingExpensesRef,
                    where('accountId', '==', rule.accountId),
                    where('category', '==', rule.category),
                    where('amount', '==', rule.amount),
                    where('date', '>=', Timestamp.fromDate(startOfNextDue)),
                    where('date', '<=', Timestamp.fromDate(endOfNextDue))
                );
                const dupSnapshot = await getDocs(dupQuery);

                if (dupSnapshot.empty) {
                    await this.generateExpenseFromRule(userId, rule, nextDue);
                    ruleGeneratedCount++;
                } else {
                    console.log(`Skipping duplicate expense for ${rule.description} on ${nextDue.toLocaleDateString()}`);
                }

                // Update next due date
                if (rule.frequency === 'monthly') {
                    nextDue = addMonths(nextDue, 1);
                } else {
                    nextDue = addYears(nextDue, 1);
                }
            }

            // If we generated any expenses for THIS rule (or skipped due to duplicates), update it in Firestore
            // We update the rule even if we skipped so that it doesn't keep trying to generate for that date.
            // If the loop ran at all, nextDue has advanced.
            let originalNextDue = (rule.nextDueDate as any).toDate ? (rule.nextDueDate as any).toDate() : new Date(rule.nextDueDate);
            if (nextDue.getTime() !== originalNextDue.getTime()) {
                const ruleRef = doc(db, 'users', userId, 'recurring_rules', rule.id!);
                await updateDoc(ruleRef, {
                    nextDueDate: Timestamp.fromDate(nextDue),
                    lastGeneratedDate: Timestamp.fromDate(new Date()),
                    updatedAt: Timestamp.now()
                });
                totalGeneratedCount += ruleGeneratedCount;
            }
        }

        return totalGeneratedCount;
    }

    private static async generateExpenseFromRule(userId: string, rule: RecurringExpenseRule, date: Date) {
        const expenseData: Omit<Expense, 'id'> = {
            userId,
            accountId: rule.accountId,
            category: rule.category,
            amount: rule.amount,
            description: rule.description,
            date: date,
            isRecurring: true,
            frequency: rule.frequency,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await addDoc(collection(db, 'users', userId, 'expenses'), expenseData);
    }


    /**
     * Helper to find an existing rule by description/category to update it
     */
    static async findRuleForExpense(userId: string, accountId: string, description: string, category: string) {
        const rulesRef = collection(db, 'users', userId, 'recurring_rules');

        let q = query(
            rulesRef,
            where('accountId', '==', accountId),
            where('category', '==', category)
        );

        if (description) {
            q = query(q, where('description', '==', description));
        }

        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;

        // If there are multiple, try to find the best match for description
        if (snapshot.docs.length > 1 && !description) {
            // If we are looking for a rule with NO description, find the one that has an empty or missing description
            const bestMatch = snapshot.docs.find(d => !d.data().description);
            if (bestMatch) return { ...bestMatch.data(), id: bestMatch.id } as RecurringExpenseRule;
        }

        return { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as RecurringExpenseRule;
    }
}
