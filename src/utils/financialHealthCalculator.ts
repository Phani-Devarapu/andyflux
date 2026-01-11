import type { Expense } from '../types/expenseTypes';

/**
 * Financial Health Score Calculator
 * Calculates a 0-100 score based on savings rate, budget adherence, and spending patterns
 */

export interface FinancialHealthMetrics {
    savingsRate: number;      // 0-1 (percentage of income saved)
    budgetAdherence: number;  // 0-1 (percentage of budget followed)
    spendingTrend: number;    // -1 to 1 (negative = decreasing spending, positive = increasing)
}

export interface FinancialHealthResult {
    score: number;           // 0-100
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    breakdown: {
        savingsScore: number;
        budgetScore: number;
        trendScore: number;
    };
    message: string;
}

/**
 * Calculate financial health score
 * Formula: (savingsRate * 40) + (budgetAdherence * 35) + (trendScore * 25)
 */
export function calculateFinancialHealth(
    metrics: FinancialHealthMetrics
): FinancialHealthResult {
    // Normalize inputs to 0-1 range
    const savingsRate = Math.max(0, Math.min(1, metrics.savingsRate));
    const budgetAdherence = Math.max(0, Math.min(1, metrics.budgetAdherence));
    const spendingTrend = Math.max(-1, Math.min(1, metrics.spendingTrend));

    // Convert spending trend to 0-1 scale (decreasing spending is good)
    const trendScore = (1 - spendingTrend) / 2;

    // Calculate weighted score
    const savingsScore = savingsRate * 40;
    const budgetScore = budgetAdherence * 35;
    const trendScoreWeighted = trendScore * 25;

    const totalScore = savingsScore + budgetScore + trendScoreWeighted;
    const roundedScore = Math.round(totalScore);

    // Determine grade
    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (roundedScore >= 90) grade = 'A';
    else if (roundedScore >= 80) grade = 'B';
    else if (roundedScore >= 70) grade = 'C';
    else if (roundedScore >= 60) grade = 'D';
    else grade = 'F';

    // Generate message
    const message = getHealthMessage(roundedScore);

    return {
        score: roundedScore,
        grade,
        breakdown: {
            savingsScore: Math.round(savingsScore),
            budgetScore: Math.round(budgetScore),
            trendScore: Math.round(trendScoreWeighted),
        },
        message,
    };
}

/**
 * Calculate savings rate from expenses and income
 */
export function calculateSavingsRate(
    totalIncome: number,
    totalExpenses: number
): number {
    if (totalIncome <= 0) return 0;
    const savings = totalIncome - totalExpenses;
    return Math.max(0, savings / totalIncome);
}

/**
 * Calculate budget adherence from expenses and budgets
 */
export function calculateBudgetAdherence(
    expenses: Expense[],
    budgets: Record<string, number>
): number {
    if (Object.keys(budgets).length === 0) return 1; // No budgets = perfect adherence

    let totalBudget = 0;
    let totalOverspend = 0;

    // Group expenses by category
    const expensesByCategory: Record<string, number> = {};
    expenses.forEach(expense => {
        const category = expense.category || 'Other';
        expensesByCategory[category] = (expensesByCategory[category] || 0) + expense.amount;
    });

    // Calculate overspend for each category
    Object.entries(budgets).forEach(([category, budget]) => {
        totalBudget += budget;
        const spent = expensesByCategory[category] || 0;
        if (spent > budget) {
            totalOverspend += (spent - budget);
        }
    });

    if (totalBudget === 0) return 1;

    // Adherence = 1 - (overspend / total budget)
    const adherence = 1 - (totalOverspend / totalBudget);
    return Math.max(0, Math.min(1, adherence));
}

/**
 * Calculate spending trend (this month vs last month)
 */
export function calculateSpendingTrend(
    currentMonthExpenses: number,
    lastMonthExpenses: number
): number {
    if (lastMonthExpenses === 0) return 0;

    const change = (currentMonthExpenses - lastMonthExpenses) / lastMonthExpenses;
    // Clamp to -1 to 1 range
    return Math.max(-1, Math.min(1, change));
}

/**
 * Get health message based on score
 */
function getHealthMessage(score: number): string {
    if (score >= 90) {
        return "Excellent! Your finances are in great shape. Keep up the amazing work! 🎉";
    } else if (score >= 80) {
        return "Great job! You're managing your money well. A few tweaks could make it even better.";
    } else if (score >= 70) {
        return "Good progress! You're on the right track. Focus on increasing your savings rate.";
    } else if (score >= 60) {
        return "Fair. There's room for improvement. Consider reviewing your budget and cutting unnecessary expenses.";
    } else {
        return "Needs attention. Let's work on building better financial habits. Start with tracking your spending.";
    }
}
