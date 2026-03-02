/**
 * Pure utility functions for Expense Manager UI enhancements.
 * All functions are framework-agnostic and fully unit-testable.
 */
import { startOfMonth, endOfMonth, isWithinInterval, subMonths, format } from 'date-fns';
import type { Expense } from '../types/expenseTypes';

// ---------------------------------------------------------------------------
// Trend Chart Utilities
// ---------------------------------------------------------------------------

export interface MonthlyTotal {
    label: string;   // e.g. "Jan 2026"
    month: number;   // 0-11
    year: number;
    total: number;
}

/**
 * Build monthly totals for the last `count` months ending at `referenceDate`.
 * Includes months with $0 if no expenses exist for that period.
 */
export function buildMonthlyTotals(
    expenses: Expense[],
    referenceDate: Date,
    count = 6
): MonthlyTotal[] {
    const result: MonthlyTotal[] = [];
    for (let i = count - 1; i >= 0; i--) {
        const monthDate = subMonths(referenceDate, i);
        const start = startOfMonth(monthDate);
        const end = endOfMonth(monthDate);
        const total = expenses
            .filter(e => isWithinInterval(new Date(e.date), { start, end }))
            .reduce((sum, e) => sum + e.amount, 0);
        result.push({
            label: format(monthDate, 'MMM yy'),
            month: monthDate.getMonth(),
            year: monthDate.getFullYear(),
            total,
        });
    }
    return result;
}

// ---------------------------------------------------------------------------
// Top Merchants Utilities
// ---------------------------------------------------------------------------

export interface MerchantSummary {
    name: string;
    total: number;
    count: number;
    category: string;
}

/**
 * Aggregate expenses by description (merchant name), returning the top N
 * sorted by total spend descending.
 */
export function buildTopMerchants(expenses: Expense[], topN = 5): MerchantSummary[] {
    const map = new Map<string, MerchantSummary>();
    expenses.forEach(e => {
        const name = (e.description ?? 'Unknown').trim();
        const existing = map.get(name);
        if (existing) {
            existing.total += e.amount;
            existing.count += 1;
        } else {
            map.set(name, { name, total: e.amount, count: 1, category: e.category });
        }
    });
    return Array.from(map.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, topN);
}

// ---------------------------------------------------------------------------
// Category Budget Utilities
// ---------------------------------------------------------------------------

const BUDGET_STORAGE_KEY = 'expense_category_budgets';

export interface CategoryBudget {
    categoryId: string;
    limit: number; // monthly spend limit in CAD
}

export function loadBudgets(): CategoryBudget[] {
    try {
        const raw = localStorage.getItem(BUDGET_STORAGE_KEY);
        return raw ? (JSON.parse(raw) as CategoryBudget[]) : [];
    } catch {
        return [];
    }
}

export function saveBudgets(budgets: CategoryBudget[]): void {
    localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(budgets));
}

export interface BudgetProgress {
    categoryId: string;
    spent: number;
    limit: number;
    /** 0–100+ (can exceed 100 when over budget) */
    pct: number;
    /** true when spent >= limit */
    overBudget: boolean;
}

/**
 * Calculate how much has been spent vs the budgeted amount for each budgeted category.
 */
export function computeBudgetProgress(
    expenses: Expense[],
    budgets: CategoryBudget[]
): BudgetProgress[] {
    const spendMap = new Map<string, number>();
    expenses.forEach(e => {
        spendMap.set(e.category, (spendMap.get(e.category) ?? 0) + e.amount);
    });

    return budgets.map(b => {
        const spent = spendMap.get(b.categoryId) ?? 0;
        const pct = b.limit > 0 ? Math.min((spent / b.limit) * 100, 150) : 0;
        return {
            categoryId: b.categoryId,
            spent,
            limit: b.limit,
            pct,
            overBudget: spent >= b.limit,
        };
    });
}

// ---------------------------------------------------------------------------
// Compare Banner Utilities
// ---------------------------------------------------------------------------

export interface CompareBannerResult {
    betterCount: number;   // categories where Period B < Period A
    worseCount: number;    // categories where Period B > Period A
    savedAmount: number;   // total $ saved in better categories
    extraAmount: number;   // total $ extra in worse categories
}

/**
 * Summarise which period performed better across categories.
 * "Better" means Period B spent LESS than Period A (lower is better for expenses).
 */
export function computeCompareBanner(
    catMapA: Map<string, number>,
    catMapB: Map<string, number>
): CompareBannerResult {
    const allIds = new Set([...catMapA.keys(), ...catMapB.keys()]);
    let betterCount = 0;
    let worseCount = 0;
    let savedAmount = 0;
    let extraAmount = 0;

    allIds.forEach(id => {
        const a = catMapA.get(id) ?? 0;
        const b = catMapB.get(id) ?? 0;
        const diff = b - a;
        if (diff < -0.01) {
            betterCount++;
            savedAmount += Math.abs(diff);
        } else if (diff > 0.01) {
            worseCount++;
            extraAmount += diff;
        }
    });

    return { betterCount, worseCount, savedAmount, extraAmount };
}
