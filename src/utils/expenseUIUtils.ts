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

// ---------------------------------------------------------------------------
// Smart Insights
// ---------------------------------------------------------------------------

export type InsightSeverity = 'positive' | 'warning' | 'info' | 'neutral';

export interface SpendingInsight {
    id: string;
    emoji: string;
    text: string;
    severity: InsightSeverity;
}

/**
 * Generate a list of data-driven spending insights for the current month.
 * @param currentMonthExpenses  expenses for the selected month
 * @param allAccountExpenses    all-time expenses for the account (for averages)
 * @param referenceDate         the date representing "now" (injectable for tests)
 * @param budgets               optional category budgets
 */
export function generateInsights(
    currentMonthExpenses: Expense[],
    allAccountExpenses: Expense[],
    referenceDate: Date,
    budgets: CategoryBudget[] = []
): SpendingInsight[] {
    const insights: SpendingInsight[] = [];

    if (currentMonthExpenses.length === 0) return insights;

    // --- helpers ---
    const currentTotal = currentMonthExpenses.reduce((s, e) => s + e.amount, 0);
    const daysInMonth = endOfMonth(referenceDate).getDate();
    const dayOfMonth = referenceDate.getDate();
    const projectedTotal = dayOfMonth > 0 ? (currentTotal / dayOfMonth) * daysInMonth : 0;

    // Category map for current month
    const catMap = new Map<string, number>();
    currentMonthExpenses.forEach(e => {
        catMap.set(e.category, (catMap.get(e.category) ?? 0) + e.amount);
    });

    // Build previous 5 months totals for average
    const prevMonths = buildMonthlyTotals(allAccountExpenses, subMonths(referenceDate, 1), 5);
    const prevAvg = prevMonths.reduce((s, m) => s + m.total, 0) / (prevMonths.filter(m => m.total > 0).length || 1);

    // 1. vs historical avg
    if (prevAvg > 0) {
        const pct = ((currentTotal - prevAvg) / prevAvg) * 100;
        if (pct <= -15) {
            insights.push({
                id: 'below-avg',
                emoji: '📉',
                text: `Great month — you're tracking ${Math.abs(pct).toFixed(0)}% below your 6-month average.`,
                severity: 'positive',
            });
        } else if (pct >= 20) {
            insights.push({
                id: 'above-avg',
                emoji: '📈',
                text: `Heads up — spending is ${pct.toFixed(0)}% above your 6-month average this month.`,
                severity: 'warning',
            });
        }
    }

    // 2. Projected monthly total (only meaningful after day 5)
    if (dayOfMonth >= 5 && dayOfMonth < daysInMonth - 3) {
        insights.push({
            id: 'projected',
            emoji: '🔮',
            text: `At this pace, you'll spend ~$${projectedTotal.toFixed(0)} this month.`,
            severity: projectedTotal > prevAvg * 1.15 ? 'warning' : 'info',
        });
    }

    // 3. Top category callout
    const topCat = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1])[0];
    if (topCat) {
        const catPct = (topCat[1] / currentTotal) * 100;
        if (catPct >= 40) {
            insights.push({
                id: 'top-cat',
                emoji: '🎯',
                text: `${formatCategoryName(topCat[0])} accounts for ${catPct.toFixed(0)}% of spending this month ($${topCat[1].toFixed(0)}).`,
                severity: 'neutral',
            });
        }
    }

    // 4. Budget warnings — approaching limit (>80%) but not over
    budgets.forEach(b => {
        const spent = catMap.get(b.categoryId) ?? 0;
        const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
        if (pct >= 80 && pct < 100) {
            insights.push({
                id: `budget-warn-${b.categoryId}`,
                emoji: '⚠️',
                text: `${formatCategoryName(b.categoryId)} budget is ${pct.toFixed(0)}% used — $${(b.limit - spent).toFixed(0)} remaining.`,
                severity: 'warning',
            });
        } else if (pct >= 100) {
            insights.push({
                id: `budget-over-${b.categoryId}`,
                emoji: '🚨',
                text: `You've exceeded your ${formatCategoryName(b.categoryId)} budget by $${(spent - b.limit).toFixed(0)}.`,
                severity: 'warning',
            });
        }
    });

    // 5. Highest single transaction callout
    const biggest = currentMonthExpenses.reduce<Expense | null>(
        (max, e) => (!max || e.amount > max.amount ? e : max), null
    );
    if (biggest && biggest.amount > 200) {
        insights.push({
            id: 'biggest-txn',
            emoji: '💸',
            text: `Biggest purchase this month: $${biggest.amount.toFixed(2)} on ${biggest.description ?? formatCategoryName(biggest.category)}.`,
            severity: 'info',
        });
    }

    // 6. Recurring cost awareness
    const recurringTotal = currentMonthExpenses
        .filter(e => e.isRecurring)
        .reduce((s, e) => s + e.amount, 0);
    if (recurringTotal > 0 && currentTotal > 0) {
        const fixedPct = (recurringTotal / currentTotal) * 100;
        if (fixedPct >= 50) {
            insights.push({
                id: 'high-fixed',
                emoji: '🔁',
                text: `${fixedPct.toFixed(0)}% of this month's spend ($${recurringTotal.toFixed(0)}) is recurring fixed costs.`,
                severity: 'neutral',
            });
        }
    }

    // Return max 4 most relevant insights
    return insights.slice(0, 4);
}

function formatCategoryName(categoryId: string): string {
    return categoryId
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}

// ---------------------------------------------------------------------------
// Anomaly Detection
// ---------------------------------------------------------------------------

export interface AnomalyResult {
    expenseId: string;
    categoryId: string;
    amount: number;
    /** How many times larger than the category avg this is */
    multiplier: number;
}

/**
 * Find expenses that are unusually large compared to the per-category average.
 * threshold: how many × the avg qualifies as anomalous (default 2×).
 */
export function detectAnomalies(
    currentMonthExpenses: Expense[],
    threshold = 2
): AnomalyResult[] {
    // Build per-category avg
    const catAmounts = new Map<string, number[]>();
    currentMonthExpenses.forEach(e => {
        const arr = catAmounts.get(e.category) ?? [];
        arr.push(e.amount);
        catAmounts.set(e.category, arr);
    });

    const catAvg = new Map<string, number>();
    catAmounts.forEach((amounts, cat) => {
        catAvg.set(cat, amounts.reduce((s, v) => s + v, 0) / amounts.length);
    });

    const anomalies: AnomalyResult[] = [];
    currentMonthExpenses.forEach(e => {
        if (!e.id) return;
        const avg = catAvg.get(e.category) ?? 0;
        if (avg > 0 && e.amount >= avg * threshold) {
            anomalies.push({
                expenseId: e.id,
                categoryId: e.category,
                amount: e.amount,
                multiplier: parseFloat((e.amount / avg).toFixed(1)),
            });
        }
    });

    return anomalies;
}

