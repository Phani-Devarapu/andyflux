/**
 * Unit tests for monthComparisonUtils pure functions.
 * Covers: filterByMonth, buildCategoryMap, computeComparisonStats
 */
import { describe, it, expect } from 'vitest';
import { filterByMonth, buildCategoryMap, computeComparisonStats } from '../utils/monthComparisonUtils';
import type { Expense } from '../types/expenseTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeExpense(overrides: Partial<Expense> & { date: Date }): Expense {
    return {
        userId: 'user1',
        accountId: 'personal',
        category: 'food',
        amount: 10,
        isRecurring: false,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// filterByMonth
// ---------------------------------------------------------------------------

describe('filterByMonth', () => {
    const jan1 = makeExpense({ date: new Date(2026, 0, 1), amount: 50 });
    const jan31 = makeExpense({ date: new Date(2026, 0, 31), amount: 20 });
    const feb1 = makeExpense({ date: new Date(2026, 1, 1), amount: 30 });
    const feb28 = makeExpense({ date: new Date(2026, 1, 28), amount: 15 });
    const dec31 = makeExpense({ date: new Date(2025, 11, 31), amount: 5 });
    const all = [jan1, jan31, feb1, feb28, dec31];

    it('returns only expenses within the selected month', () => {
        const result = filterByMonth(all, 0, 2026);
        expect(result).toHaveLength(2);
        expect(result.map(e => e.amount).sort()).toEqual([20, 50].sort());
    });

    it('includes boundary days (first and last day of month)', () => {
        const result = filterByMonth(all, 0, 2026);
        expect(result.some(e => new Date(e.date).getDate() === 1)).toBe(true);
        expect(result.some(e => new Date(e.date).getDate() === 31)).toBe(true);
    });

    it('excludes expenses from adjacent months', () => {
        const result = filterByMonth(all, 0, 2026);
        expect(result.every(e => {
            const d = new Date(e.date);
            return d.getFullYear() === 2026 && d.getMonth() === 0;
        })).toBe(true);
    });

    it('returns expenses sorted descending by date', () => {
        const result = filterByMonth(all, 0, 2026);
        expect(new Date(result[0].date).getDate()).toBeGreaterThan(new Date(result[1].date).getDate());
    });

    it('returns empty array when no expenses match the month', () => {
        expect(filterByMonth(all, 5, 2026)).toHaveLength(0);
    });

    it('returns empty array for empty input', () => {
        expect(filterByMonth([], 0, 2026)).toHaveLength(0);
    });

    it('handles February correctly (month index 1)', () => {
        const result = filterByMonth(all, 1, 2026);
        expect(result).toHaveLength(2);
        expect(result.map(e => e.amount).sort()).toEqual([15, 30].sort());
    });
});

// ---------------------------------------------------------------------------
// buildCategoryMap
// ---------------------------------------------------------------------------

describe('buildCategoryMap', () => {
    it('sums amounts by category', () => {
        const expenses = [
            makeExpense({ date: new Date(), category: 'food', amount: 25 }),
            makeExpense({ date: new Date(), category: 'food', amount: 15 }),
            makeExpense({ date: new Date(), category: 'transport', amount: 40 }),
        ];
        const map = buildCategoryMap(expenses);
        expect(map.get('food')).toBe(40);
        expect(map.get('transport')).toBe(40);
    });

    it('returns correct number of unique categories', () => {
        const expenses = [
            makeExpense({ date: new Date(), category: 'housing', amount: 900 }),
            makeExpense({ date: new Date(), category: 'groceries', amount: 200 }),
        ];
        expect(buildCategoryMap(expenses).size).toBe(2);
    });

    it('returns empty map for empty input', () => {
        expect(buildCategoryMap([])).toEqual(new Map());
    });

    it('accumulates multiple entries in one category correctly', () => {
        const expenses = Array.from({ length: 5 }, () =>
            makeExpense({ date: new Date(), category: 'coffee', amount: 5 })
        );
        const map = buildCategoryMap(expenses);
        expect(map.get('coffee')).toBe(25);
        expect(map.size).toBe(1);
    });

    it('handles floating-point amounts within acceptable precision', () => {
        const expenses = [
            makeExpense({ date: new Date(), category: 'food', amount: 10.55 }),
            makeExpense({ date: new Date(), category: 'food', amount: 5.45 }),
        ];
        expect(buildCategoryMap(expenses).get('food')).toBeCloseTo(16, 1);
    });
});

// ---------------------------------------------------------------------------
// computeComparisonStats
// ---------------------------------------------------------------------------

describe('computeComparisonStats', () => {
    const makeList = (amounts: number[], category = 'food') =>
        amounts.map(amount => makeExpense({ date: new Date(), category, amount }));

    it('computes totals correctly', () => {
        const stats = computeComparisonStats(makeList([100, 50]), makeList([200]));
        expect(stats.totalA).toBe(150);
        expect(stats.totalB).toBe(200);
    });

    it('computes transaction counts correctly', () => {
        const stats = computeComparisonStats(makeList([10, 20, 30]), makeList([5]));
        expect(stats.countA).toBe(3);
        expect(stats.countB).toBe(1);
    });

    it('computes average per transaction correctly', () => {
        const stats = computeComparisonStats(makeList([40, 60]), makeList([30]));
        expect(stats.avgA).toBe(50);
        expect(stats.avgB).toBe(30);
    });

    it('deltaTotal is positive when period B spend exceeds A', () => {
        const stats = computeComparisonStats(makeList([100]), makeList([150]));
        expect(stats.deltaTotal).toBeCloseTo(50, 1);
    });

    it('deltaTotal is negative when period B spend is lower than A', () => {
        const stats = computeComparisonStats(makeList([200]), makeList([100]));
        expect(stats.deltaTotal).toBeCloseTo(-50, 1);
    });

    it('deltaTotal is null when period A is empty (no base for division)', () => {
        const stats = computeComparisonStats([], makeList([100]));
        expect(stats.deltaTotal).toBeNull();
    });

    it('deltaTotal is 0 when both periods have identical totals', () => {
        const stats = computeComparisonStats(makeList([100]), makeList([100]));
        expect(stats.deltaTotal).toBe(0);
    });

    it('all values are zero and deltas are null when both periods are empty', () => {
        const stats = computeComparisonStats([], []);
        expect(stats.totalA).toBe(0);
        expect(stats.totalB).toBe(0);
        expect(stats.countA).toBe(0);
        expect(stats.countB).toBe(0);
        expect(stats.avgA).toBe(0);
        expect(stats.avgB).toBe(0);
        expect(stats.deltaTotal).toBeNull();
        expect(stats.deltaAvg).toBeNull();
        expect(stats.deltaCount).toBeNull();
    });

    it('deltaAvg is null when period A has no transactions (avg = 0)', () => {
        const stats = computeComparisonStats([], makeList([50]));
        expect(stats.deltaAvg).toBeNull();
    });

    it('deltaCount is null when period A has no transactions', () => {
        const stats = computeComparisonStats([], makeList([50]));
        expect(stats.deltaCount).toBeNull();
    });

    it('deltaCount is +100% when period B has double the transactions of A', () => {
        const stats = computeComparisonStats(makeList([10]), makeList([10, 20]));
        expect(stats.deltaCount).toBeCloseTo(100, 1);
    });

    it('handles multi-category expenses in total calculations', () => {
        const a = [
            makeExpense({ date: new Date(), category: 'food', amount: 100 }),
            makeExpense({ date: new Date(), category: 'transport', amount: 50 }),
        ];
        const b = [
            makeExpense({ date: new Date(), category: 'food', amount: 80 }),
            makeExpense({ date: new Date(), category: 'housing', amount: 120 }),
        ];
        const stats = computeComparisonStats(a, b);
        expect(stats.totalA).toBe(150);
        expect(stats.totalB).toBe(200);
        expect(stats.deltaTotal).toBeCloseTo(33.33, 1);
    });
});
