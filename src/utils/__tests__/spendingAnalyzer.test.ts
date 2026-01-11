import { describe, it, expect } from 'vitest';
import { analyzeSpending } from '../spendingAnalyzer';
import type { Expense } from '../../types/expenseTypes';
import { subMonths } from 'date-fns';

describe('Spending Analyzer', () => {
    const createExpense = (amount: number, category: string, daysAgo: number): Expense => ({
        id: Math.random().toString(),
        amount,
        category,
        date: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
        description: 'Test expense',
        userId: 'test',
        accountId: 'PERSONAL',
        isRecurring: false,
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    it('should calculate current and last month totals', () => {
        const expenses: Expense[] = [
            createExpense(100, 'Groceries', 5),   // This month
            createExpense(200, 'Groceries', 10),  // This month
            createExpense(150, 'Groceries', 35),  // Last month
        ];

        const result = analyzeSpending(expenses);

        expect(result.currentMonth.total).toBe(300);
        expect(result.lastMonth.total).toBe(150);
        expect(result.changes.totalChange).toBe(150);
        expect(result.changes.totalChangePercent).toBe(100); // 100% increase
    });

    it('should group expenses by category', () => {
        const expenses: Expense[] = [
            createExpense(100, 'Groceries', 5),
            createExpense(50, 'Entertainment', 10),
            createExpense(200, 'Groceries', 35),
        ];

        const result = analyzeSpending(expenses);

        expect(result.currentMonth.byCategory['Groceries']).toBe(100);
        expect(result.currentMonth.byCategory['Entertainment']).toBe(50);
        expect(result.lastMonth.byCategory['Groceries']).toBe(200);
    });

    it('should calculate category changes', () => {
        const expenses: Expense[] = [
            createExpense(200, 'Groceries', 5),   // This month
            createExpense(100, 'Groceries', 35),  // Last month
        ];

        const result = analyzeSpending(expenses);

        expect(result.changes.categoryChanges['Groceries'].amount).toBe(100);
        expect(result.changes.categoryChanges['Groceries'].percent).toBe(100);
    });

    it('should generate insights for spending increase', () => {
        const expenses: Expense[] = [
            createExpense(500, 'Groceries', 5),   // This month
            createExpense(200, 'Groceries', 35),  // Last month
        ];

        const result = analyzeSpending(expenses);

        expect(result.insights.length).toBeGreaterThan(0);
        expect(result.insights.some(i => i.includes('increased'))).toBe(true);
    });

    it('should generate insights for spending decrease', () => {
        const expenses: Expense[] = [
            createExpense(100, 'Groceries', 5),   // This month
            createExpense(500, 'Groceries', 35),  // Last month
        ];

        const result = analyzeSpending(expenses);

        expect(result.insights.some(i => i.includes('reduced') || i.includes('down'))).toBe(true);
    });

    it('should handle empty expenses', () => {
        const result = analyzeSpending([]);

        expect(result.currentMonth.total).toBe(0);
        expect(result.lastMonth.total).toBe(0);
        expect(result.changes.totalChange).toBe(0);
        expect(result.insights.length).toBeGreaterThan(0);
    });

    it('should count transactions', () => {
        const expenses: Expense[] = [
            createExpense(100, 'Groceries', 5),
            createExpense(50, 'Entertainment', 10),
            createExpense(200, 'Groceries', 35),
            createExpense(100, 'Entertainment', 40),
        ];

        const result = analyzeSpending(expenses);

        expect(result.currentMonth.transactionCount).toBe(2);
        expect(result.lastMonth.transactionCount).toBe(2);
    });
});
