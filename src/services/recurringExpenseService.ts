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
        let generatedCount = 0;

        for (const rule of rules) {
            let nextDue = new Date(rule.nextDueDate);

            // Loop in case multiple periods were missed
            while (isBefore(nextDue, today) || nextDue.getTime() === today.getTime()) {
                await this.generateExpenseFromRule(userId, rule, nextDue);

                // Update next due date
                if (rule.frequency === 'monthly') {
                    nextDue = addMonths(nextDue, 1);
                } else {
                    nextDue = addYears(nextDue, 1);
                }

                generatedCount++;
            }

            // If we generated any expenses, update the rule in Firestore
            if (generatedCount > 0) {
                const ruleRef = doc(db, 'users', userId, 'recurring_rules', rule.id!);
                await updateDoc(ruleRef, {
                    nextDueDate: Timestamp.fromDate(nextDue),
                    lastGeneratedDate: Timestamp.fromDate(new Date()),
                    updatedAt: Timestamp.now()
                });
            }
        }

        return generatedCount;
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
        const q = query(
            rulesRef,
            where('accountId', '==', accountId),
            where('description', '==', description),
            where('category', '==', category)
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        return { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as RecurringExpenseRule;
    }
}
