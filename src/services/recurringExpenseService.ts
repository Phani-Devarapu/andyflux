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
        try {
            const rulesRef = collection(db, 'users', userId, 'recurring_rules');
            const q = query(rulesRef, where('accountId', '==', accountId), where('isActive', '==', true));

            const snapshot = await getDocs(q);
            const rules = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as RecurringExpenseRule));

            if (rules.length === 0) return 0;

            // Fetch recent expenses to check for duplicates in memory
            // We fetch all expenses for this account to be safe and avoid composite index issues
            const expensesRef = collection(db, 'users', userId, 'expenses');
            const expQuery = query(expensesRef, where('accountId', '==', accountId));
            const expSnapshot = await getDocs(expQuery);
            const accountExpenses = expSnapshot.docs.map(d => {
                const data = d.data();
                return {
                    ...data,
                    date: data.date?.toDate ? data.date.toDate() : new Date(data.date)
                } as any;
            }) as any[];

            const today = startOfDay(new Date());
            let totalGeneratedCount = 0;

            for (const rule of rules) {
                let ruleGeneratedCount = 0;
                // Handle both Date and Firestore Timestamp objects
                let nextDue = (rule.nextDueDate as any).toDate ? (rule.nextDueDate as any).toDate() : new Date(rule.nextDueDate);

                if (isNaN(nextDue.getTime())) {
                    console.error(`Invalid nextDueDate for rule ${rule.id}:`, rule.nextDueDate);
                    continue;
                }

                const originalNextDueTime = nextDue.getTime();

                // Loop in case multiple periods were missed
                while (isBefore(nextDue, today) || nextDue.getTime() === today.getTime()) {
                    // Check for duplicates in memory
                    const startOfNextDue = startOfDay(nextDue).getTime();
                    const endOfNextDue = startOfNextDue + (24 * 60 * 60 * 1000) - 1;

                    const isDuplicate = accountExpenses.some(e =>
                        e.category === rule.category &&
                        Math.abs(e.amount - rule.amount) < 0.01 &&
                        e.date.getTime() >= startOfNextDue &&
                        e.date.getTime() <= endOfNextDue
                    );

                    if (!isDuplicate) {
                        await this.generateExpenseFromRule(userId, rule, nextDue);
                        ruleGeneratedCount++;
                        // Add to local list to prevent duplicate in SAME run (e.g. if missed multiple months)
                        accountExpenses.push({
                            category: rule.category,
                            amount: rule.amount,
                            date: new Date(nextDue)
                        });
                    }

                    // Update next due date
                    if (rule.frequency === 'monthly') {
                        nextDue = addMonths(nextDue, 1);
                    } else {
                        nextDue = addYears(nextDue, 1);
                    }
                }

                // If we advanced the date, update the rule in Firestore
                if (nextDue.getTime() !== originalNextDueTime) {
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
        } catch (error) {
            console.error("Error in processRules:", error);
            throw error;
        }
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
