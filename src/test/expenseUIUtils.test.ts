/**
 * Unit tests for expenseUIUtils pure functions.
 * Covers: buildMonthlyTotals, buildTopMerchants, computeBudgetProgress,
 *         loadBudgets/saveBudgets, computeCompareBanner
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    buildMonthlyTotals,
    buildTopMerchants,
    computeBudgetProgress,
    loadBudgets,
    saveBudgets,
    computeCompareBanner,
    type CategoryBudget,
} from '../utils/expenseUIUtils';
import type { Expense } from '../types/expenseTypes';

function makeExpense(overrides: Partial<Expense> & { date: Date }): Expense {
    return {
        userId: 'u1',
        accountId: 'personal',
        category: 'food',
        amount: 10,
        isRecurring: false,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// buildMonthlyTotals
// ---------------------------------------------------------------------------
describe('buildMonthlyTotals', () => {
    it('returns `count` entries (default 6)', () => {
        const result = buildMonthlyTotals([], new Date(2026, 1, 1));
        expect(result).toHaveLength(6);
    });

    it('respects custom count', () => {
        expect(buildMonthlyTotals([], new Date(2026, 1, 1), 3)).toHaveLength(3);
    });

    it('sums expenses in the correct month bucket', () => {
        const expenses = [
            makeExpense({ date: new Date(2026, 1, 10), amount: 50 }),  // Feb 2026
            makeExpense({ date: new Date(2026, 1, 20), amount: 30 }),  // Feb 2026
            makeExpense({ date: new Date(2026, 0, 5), amount: 100 }),  // Jan 2026
        ];
        const result = buildMonthlyTotals(expenses, new Date(2026, 1, 28), 3);
        const febEntry = result.find(r => r.month === 1 && r.year === 2026);
        const janEntry = result.find(r => r.month === 0 && r.year === 2026);
        expect(febEntry?.total).toBe(80);
        expect(janEntry?.total).toBe(100);
    });

    it('sets total to 0 for months with no expenses', () => {
        const result = buildMonthlyTotals([], new Date(2026, 5, 1), 4);
        result.forEach(r => expect(r.total).toBe(0));
    });

    it('results are ordered chronologically (oldest first)', () => {
        const result = buildMonthlyTotals([], new Date(2026, 2, 1), 3);
        // months should be: Jan, Feb, Mar 2026
        expect(result[0].month).toBeLessThanOrEqual(result[1].month);
        expect(result[1].month).toBeLessThanOrEqual(result[2].month);
    });

    it('label format is "Mon YY"', () => {
        const result = buildMonthlyTotals([], new Date(2026, 0, 1), 1);
        expect(result[0].label).toBe('Jan 26');
    });
});

// ---------------------------------------------------------------------------
// buildTopMerchants
// ---------------------------------------------------------------------------
describe('buildTopMerchants', () => {
    it('aggregates expenses by description', () => {
        const expenses = [
            makeExpense({ date: new Date(), description: 'Starbucks', amount: 5 }),
            makeExpense({ date: new Date(), description: 'Starbucks', amount: 6 }),
            makeExpense({ date: new Date(), description: 'Uber', amount: 20 }),
        ];
        const result = buildTopMerchants(expenses);
        const sbucks = result.find(m => m.name === 'Starbucks');
        expect(sbucks?.total).toBe(11);
        expect(sbucks?.count).toBe(2);
    });

    it('returns results sorted by total spend descending', () => {
        const expenses = [
            makeExpense({ date: new Date(), description: 'A', amount: 10 }),
            makeExpense({ date: new Date(), description: 'B', amount: 50 }),
            makeExpense({ date: new Date(), description: 'C', amount: 30 }),
        ];
        const result = buildTopMerchants(expenses);
        expect(result[0].name).toBe('B');
        expect(result[1].name).toBe('C');
        expect(result[2].name).toBe('A');
    });

    it('respects topN limit', () => {
        const expenses = Array.from({ length: 10 }, (_, i) =>
            makeExpense({ date: new Date(), description: `Merchant ${i}`, amount: i + 1 })
        );
        expect(buildTopMerchants(expenses, 3)).toHaveLength(3);
    });

    it('groups expenses with no description under "Unknown"', () => {
        const expenses = [
            makeExpense({ date: new Date(), description: undefined, amount: 20 }),
            makeExpense({ date: new Date(), description: undefined, amount: 10 }),
        ];
        const result = buildTopMerchants(expenses);
        expect(result[0].name).toBe('Unknown');
        expect(result[0].total).toBe(30);
    });

    it('returns empty array for empty input', () => {
        expect(buildTopMerchants([])).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// computeBudgetProgress
// ---------------------------------------------------------------------------
describe('computeBudgetProgress', () => {
    it('calculates correct percentage for under-budget category', () => {
        const expenses = [makeExpense({ date: new Date(), category: 'food', amount: 50 })];
        const budgets: CategoryBudget[] = [{ categoryId: 'food', limit: 200 }];
        const result = computeBudgetProgress(expenses, budgets);
        expect(result[0].pct).toBe(25);
        expect(result[0].overBudget).toBe(false);
    });

    it('marks overBudget when spent equals limit', () => {
        const expenses = [makeExpense({ date: new Date(), category: 'food', amount: 200 })];
        const budgets: CategoryBudget[] = [{ categoryId: 'food', limit: 200 }];
        const [result] = computeBudgetProgress(expenses, budgets);
        expect(result.overBudget).toBe(true);
    });

    it('clamps pct at 150 when severely over budget', () => {
        const expenses = [makeExpense({ date: new Date(), category: 'food', amount: 9999 })];
        const budgets: CategoryBudget[] = [{ categoryId: 'food', limit: 100 }];
        const [result] = computeBudgetProgress(expenses, budgets);
        expect(result.pct).toBe(150);
    });

    it('returns spent=0 for a budgeted category with no matching expenses', () => {
        const budgets: CategoryBudget[] = [{ categoryId: 'housing', limit: 1500 }];
        const [result] = computeBudgetProgress([], budgets);
        expect(result.spent).toBe(0);
        expect(result.pct).toBe(0);
    });

    it('returns empty array when no budgets are set', () => {
        const expenses = [makeExpense({ date: new Date(), amount: 100 })];
        expect(computeBudgetProgress(expenses, [])).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// loadBudgets / saveBudgets
// ---------------------------------------------------------------------------
describe('localStorage budget persistence', () => {
    const STORAGE_KEY = 'expense_category_budgets';

    beforeEach(() => localStorage.clear());
    afterEach(() => localStorage.clear());

    it('loadBudgets returns empty array when nothing is stored', () => {
        expect(loadBudgets()).toEqual([]);
    });

    it('round-trips save and load correctly', () => {
        const budgets: CategoryBudget[] = [
            { categoryId: 'food', limit: 300 },
            { categoryId: 'transport', limit: 150 },
        ];
        saveBudgets(budgets);
        expect(loadBudgets()).toEqual(budgets);
    });

    it('loadBudgets returns empty array on malformed JSON', () => {
        localStorage.setItem(STORAGE_KEY, 'not-json');
        expect(loadBudgets()).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// computeCompareBanner
// ---------------------------------------------------------------------------
describe('computeCompareBanner', () => {
    it('counts better categories correctly (B < A)', () => {
        const a = new Map([['food', 100], ['transport', 50]]);
        const b = new Map([['food', 60], ['transport', 55]]);
        const result = computeCompareBanner(a, b);
        expect(result.betterCount).toBe(1); // food improved
        expect(result.worseCount).toBe(1);  // transport worsened
    });

    it('computes savedAmount correctly', () => {
        const a = new Map([['food', 200]]);
        const b = new Map([['food', 150]]);
        const result = computeCompareBanner(a, b);
        expect(result.savedAmount).toBeCloseTo(50);
        expect(result.extraAmount).toBe(0);
    });

    it('computes extraAmount correctly when B > A', () => {
        const a = new Map([['food', 100]]);
        const b = new Map([['food', 180]]);
        const result = computeCompareBanner(a, b);
        expect(result.extraAmount).toBeCloseTo(80);
        expect(result.savedAmount).toBe(0);
    });

    it('handles new categories in B not present in A', () => {
        const a = new Map<string, number>();
        const b = new Map([['coffee', 30]]);
        const result = computeCompareBanner(a, b);
        expect(result.worseCount).toBe(1);
        expect(result.betterCount).toBe(0);
    });

    it('ignores categories with identical spending (within 1 cent)', () => {
        const a = new Map([['food', 100]]);
        const b = new Map([['food', 100]]);
        const result = computeCompareBanner(a, b);
        expect(result.betterCount).toBe(0);
        expect(result.worseCount).toBe(0);
    });

    it('returns all zeros for two empty maps', () => {
        const result = computeCompareBanner(new Map(), new Map());
        expect(result).toEqual({ betterCount: 0, worseCount: 0, savedAmount: 0, extraAmount: 0 });
    });
});
