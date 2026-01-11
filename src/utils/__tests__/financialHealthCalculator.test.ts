import { describe, it, expect } from 'vitest';
import {
    calculateFinancialHealth,
    calculateSavingsRate,
    calculateBudgetAdherence,
    calculateSpendingTrend,
    type FinancialHealthMetrics,
} from '../financialHealthCalculator';
import type { Expense } from '../../types/expenseTypes';

describe('Financial Health Calculator', () => {
    describe('calculateFinancialHealth', () => {
        it('should calculate perfect score (100) for ideal metrics', () => {
            const metrics: FinancialHealthMetrics = {
                savingsRate: 1,      // 100% savings
                budgetAdherence: 1,  // Perfect budget adherence
                spendingTrend: -1,   // Decreasing spending (good)
            };

            const result = calculateFinancialHealth(metrics);

            expect(result.score).toBe(100);
            expect(result.grade).toBe('A');
            expect(result.breakdown.savingsScore).toBe(40);
            expect(result.breakdown.budgetScore).toBe(35);
            expect(result.breakdown.trendScore).toBe(25);
        });

        it('should calculate low score for poor metrics', () => {
            const metrics: FinancialHealthMetrics = {
                savingsRate: 0,      // No savings
                budgetAdherence: 0,  // No budget adherence
                spendingTrend: 1,    // Increasing spending (bad)
            };

            const result = calculateFinancialHealth(metrics);

            expect(result.score).toBe(0);
            expect(result.grade).toBe('F');
        });

        it('should calculate mid-range score for average metrics', () => {
            const metrics: FinancialHealthMetrics = {
                savingsRate: 0.5,    // 50% savings
                budgetAdherence: 0.7, // 70% budget adherence
                spendingTrend: 0,    // Stable spending
            };

            const result = calculateFinancialHealth(metrics);

            // Expected: (0.5*40) + (0.7*35) + (0.5*25) = 20 + 24.5 + 12.5 = 57
            expect(result.score).toBeGreaterThanOrEqual(55);
            expect(result.score).toBeLessThanOrEqual(60);
            expect(result.grade).toMatch(/[DF]/);
        });

        it('should clamp inputs to valid ranges', () => {
            const metrics: FinancialHealthMetrics = {
                savingsRate: 2,      // Invalid (>1)
                budgetAdherence: -0.5, // Invalid (<0)
                spendingTrend: 5,    // Invalid (>1)
            };

            const result = calculateFinancialHealth(metrics);

            // Should not crash and should produce valid score
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);
        });

        it('should assign correct grades', () => {
            const testCases = [
                { savingsRate: 0.95, budgetAdherence: 0.95, spendingTrend: -0.9, expectedGrade: 'A' as const },
                { savingsRate: 0.85, budgetAdherence: 0.8, spendingTrend: -0.5, expectedGrade: 'B' as const },
                { savingsRate: 0.75, budgetAdherence: 0.7, spendingTrend: -0.2, expectedGrade: 'C' as const },
                { savingsRate: 0.65, budgetAdherence: 0.6, spendingTrend: 0, expectedGrade: 'D' as const },
                { savingsRate: 0.4, budgetAdherence: 0.4, spendingTrend: 0.5, expectedGrade: 'F' as const },
            ];

            testCases.forEach(({ savingsRate, budgetAdherence, spendingTrend, expectedGrade }) => {
                const result = calculateFinancialHealth({
                    savingsRate,
                    budgetAdherence,
                    spendingTrend,
                });

                expect(result.grade).toBe(expectedGrade);
            });
        });

        it('should include helpful message', () => {
            const metrics: FinancialHealthMetrics = {
                savingsRate: 0.8,
                budgetAdherence: 0.9,
                spendingTrend: -0.2,
            };

            const result = calculateFinancialHealth(metrics);

            expect(result.message).toBeTruthy();
            expect(result.message.length).toBeGreaterThan(10);
        });
    });

    describe('calculateSavingsRate', () => {
        it('should calculate correct savings rate', () => {
            const rate = calculateSavingsRate(5000, 3000);
            expect(rate).toBe(0.4); // 40% savings
        });

        it('should return 0 for zero income', () => {
            const rate = calculateSavingsRate(0, 1000);
            expect(rate).toBe(0);
        });

        it('should return 0 for negative savings', () => {
            const rate = calculateSavingsRate(1000, 1500);
            expect(rate).toBe(0);
        });

        it('should handle 100% savings', () => {
            const rate = calculateSavingsRate(5000, 0);
            expect(rate).toBe(1);
        });
    });

    describe('calculateBudgetAdherence', () => {
        it('should return 1 for perfect adherence', () => {
            const expenses: Expense[] = [
                {
                    id: '1',
                    userId: 'test',
                    accountId: 'PERSONAL',
                    amount: 500,
                    category: 'Groceries',
                    date: new Date(),
                    description: 'Food',
                    isRecurring: false,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            const budgets = { Groceries: 1000 };

            const adherence = calculateBudgetAdherence(expenses, budgets);
            expect(adherence).toBe(1);
        });

        it('should calculate adherence for overspending', () => {
            const expenses: Expense[] = [
                {
                    id: '1',
                    userId: 'test',
                    accountId: 'PERSONAL',
                    amount: 1500,
                    category: 'Groceries',
                    date: new Date(),
                    description: 'Food',
                    isRecurring: false,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            const budgets = { Groceries: 1000 };

            const adherence = calculateBudgetAdherence(expenses, budgets);
            expect(adherence).toBe(0.5); // 50% adherence (500 overspend / 1000 budget)
        });

        it('should return 1 for no budgets', () => {
            const expenses: Expense[] = [
                {
                    id: '1',
                    userId: 'test',
                    accountId: 'PERSONAL',
                    amount: 1000,
                    category: 'Groceries',
                    date: new Date(),
                    description: 'Food',
                    isRecurring: false,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            const adherence = calculateBudgetAdherence(expenses, {});
            expect(adherence).toBe(1);
        });

        it('should handle multiple categories', () => {
            const expenses: Expense[] = [
                {
                    id: '1',
                    userId: 'test',
                    accountId: 'PERSONAL',
                    amount: 600,
                    category: 'Groceries',
                    date: new Date(),
                    description: 'Food',
                    isRecurring: false,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
                {
                    id: '2',
                    userId: 'test',
                    accountId: 'PERSONAL',
                    amount: 300,
                    category: 'Entertainment',
                    date: new Date(),
                    description: 'Movies',
                    isRecurring: false,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            const budgets = {
                Groceries: 500,      // 100 overspend
                Entertainment: 400,  // 100 under budget
            };

            const adherence = calculateBudgetAdherence(expenses, budgets);
            // Total budget: 900, overspend: 100, adherence: 1 - (100/900) = 0.889
            expect(adherence).toBeCloseTo(0.889, 2);
        });
    });

    describe('calculateSpendingTrend', () => {
        it('should return 0 for stable spending', () => {
            const trend = calculateSpendingTrend(1000, 1000);
            expect(trend).toBe(0);
        });

        it('should return negative for decreasing spending', () => {
            const trend = calculateSpendingTrend(800, 1000);
            expect(trend).toBe(-0.2);
        });

        it('should return positive for increasing spending', () => {
            const trend = calculateSpendingTrend(1200, 1000);
            expect(trend).toBe(0.2);
        });

        it('should return 0 for zero last month', () => {
            const trend = calculateSpendingTrend(1000, 0);
            expect(trend).toBe(0);
        });

        it('should clamp to -1 for large decrease', () => {
            const trend = calculateSpendingTrend(0, 1000);
            expect(trend).toBe(-1);
        });

        it('should clamp to 1 for large increase', () => {
            const trend = calculateSpendingTrend(5000, 1000);
            expect(trend).toBe(1);
        });
    });
});
