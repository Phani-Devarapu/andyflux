/**
 * Pure utility functions for the Month Comparison feature.
 * These are framework-agnostic and fully unit-testable without JSX/React.
 */
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import type { Expense } from '../types/expenseTypes';

/** Filter expenses that fall within the given month/year, sorted newest-first */
export function filterByMonth(expenses: Expense[], month: number, year: number): Expense[] {
    const start = startOfMonth(new Date(year, month));
    const end = endOfMonth(new Date(year, month));
    return expenses
        .filter(e => isWithinInterval(new Date(e.date), { start, end }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/** Build a Map of categoryId -> totalAmount for a list of expenses */
export function buildCategoryMap(expenses: Expense[]): Map<string, number> {
    const map = new Map<string, number>();
    expenses.forEach(e => {
        map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    });
    return map;
}

export interface ComparisonStats {
    totalA: number;
    totalB: number;
    countA: number;
    countB: number;
    avgA: number;
    avgB: number;
    /** Percentage change from A to B. null when A is 0 (no base). */
    deltaTotal: number | null;
    deltaAvg: number | null;
    deltaCount: number | null;
}

/** Compute comparison stats for two arrays of expenses */
export function computeComparisonStats(expensesA: Expense[], expensesB: Expense[]): ComparisonStats {
    const totalA = expensesA.reduce((sum, e) => sum + e.amount, 0);
    const totalB = expensesB.reduce((sum, e) => sum + e.amount, 0);
    const countA = expensesA.length;
    const countB = expensesB.length;
    const avgA = countA > 0 ? totalA / countA : 0;
    const avgB = countB > 0 ? totalB / countB : 0;

    const deltaTotal = totalA === 0 ? null : ((totalB - totalA) / totalA) * 100;
    const deltaAvg = avgA === 0 ? null : ((avgB - avgA) / avgA) * 100;
    const deltaCount = countA === 0 ? null : ((countB - countA) / countA) * 100;

    return { totalA, totalB, countA, countB, avgA, avgB, deltaTotal, deltaAvg, deltaCount };
}
