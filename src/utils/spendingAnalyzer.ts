import type { Expense } from '../types/expenseTypes';
import { startOfMonth, endOfMonth, subMonths, isWithinInterval } from 'date-fns';

export interface SpendingComparison {
    currentMonth: {
        total: number;
        byCategory: Record<string, number>;
        transactionCount: number;
    };
    lastMonth: {
        total: number;
        byCategory: Record<string, number>;
        transactionCount: number;
    };
    changes: {
        totalChange: number;
        totalChangePercent: number;
        categoryChanges: Record<string, { amount: number; percent: number }>;
    };
    insights: string[];
}

/**
 * Analyze spending patterns and compare current month vs last month
 */
export function analyzeSpending(expenses: Expense[]): SpendingComparison {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);

    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    // Filter expenses by month
    const currentMonthExpenses = expenses.filter(e =>
        isWithinInterval(new Date(e.date), { start: currentMonthStart, end: currentMonthEnd })
    );

    const lastMonthExpenses = expenses.filter(e =>
        isWithinInterval(new Date(e.date), { start: lastMonthStart, end: lastMonthEnd })
    );

    // Calculate totals and category breakdowns
    const currentMonth = calculateMonthStats(currentMonthExpenses);
    const lastMonth = calculateMonthStats(lastMonthExpenses);

    // Calculate changes
    const totalChange = currentMonth.total - lastMonth.total;
    const totalChangePercent = lastMonth.total > 0
        ? (totalChange / lastMonth.total) * 100
        : 0;

    const categoryChanges: Record<string, { amount: number; percent: number }> = {};

    const allCategories = new Set([
        ...Object.keys(currentMonth.byCategory),
        ...Object.keys(lastMonth.byCategory)
    ]);

    allCategories.forEach(category => {
        const current = currentMonth.byCategory[category] || 0;
        const last = lastMonth.byCategory[category] || 0;
        const change = current - last;
        const percent = last > 0 ? (change / last) * 100 : 0;

        categoryChanges[category] = { amount: change, percent };
    });

    // Generate insights
    const insights = generateInsights(currentMonth, lastMonth, totalChangePercent, categoryChanges);

    return {
        currentMonth,
        lastMonth,
        changes: {
            totalChange,
            totalChangePercent,
            categoryChanges,
        },
        insights,
    };
}

function calculateMonthStats(expenses: Expense[]) {
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const byCategory: Record<string, number> = {};

    expenses.forEach(e => {
        const category = e.category || 'Other';
        byCategory[category] = (byCategory[category] || 0) + e.amount;
    });

    return {
        total,
        byCategory,
        transactionCount: expenses.length,
    };
}

function generateInsights(
    current: ReturnType<typeof calculateMonthStats>,
    last: ReturnType<typeof calculateMonthStats>,
    totalChangePercent: number,
    categoryChanges: Record<string, { amount: number; percent: number }>
): string[] {
    const insights: string[] = [];

    // Overall spending trend
    if (totalChangePercent > 10) {
        insights.push(`⚠️ Your spending increased by ${totalChangePercent.toFixed(1)}% this month`);
    } else if (totalChangePercent < -10) {
        insights.push(`✅ Great job! You reduced spending by ${Math.abs(totalChangePercent).toFixed(1)}% this month`);
    } else {
        insights.push(`📊 Your spending is stable (${totalChangePercent > 0 ? '+' : ''}${totalChangePercent.toFixed(1)}%)`);
    }

    // Find biggest category changes
    const significantChanges = Object.entries(categoryChanges)
        .filter(([_, change]) => Math.abs(change.percent) > 20 && Math.abs(change.amount) > 50)
        .sort((a, b) => Math.abs(b[1].amount) - Math.abs(a[1].amount))
        .slice(0, 2);

    significantChanges.forEach(([category, change]) => {
        if (change.amount > 0) {
            insights.push(`📈 ${category} spending up $${change.amount.toFixed(0)} (${change.percent.toFixed(0)}%)`);
        } else {
            insights.push(`📉 ${category} spending down $${Math.abs(change.amount).toFixed(0)} (${Math.abs(change.percent).toFixed(0)}%)`);
        }
    });

    // Transaction count insight
    const txnChange = current.transactionCount - last.transactionCount;
    if (Math.abs(txnChange) > 5) {
        insights.push(`${txnChange > 0 ? '📊' : '📉'} ${Math.abs(txnChange)} ${txnChange > 0 ? 'more' : 'fewer'} transactions this month`);
    }

    return insights;
}
