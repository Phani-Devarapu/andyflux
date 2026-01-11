import { useMemo, useState } from 'react';
import { Box, Card, CardContent, Typography, LinearProgress, Chip, Stack, useTheme, Alert, Button, Dialog, DialogTitle, DialogContent } from '@mui/material';
import { TrendingUp, TrendingDown, DollarSign, Activity, PlusCircle, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFirestoreExpenses } from '../hooks/useFirestoreExpenses';
import { calculateFinancialHealth, calculateSavingsRate, calculateBudgetAdherence, calculateSpendingTrend } from '../utils/financialHealthCalculator';
import { analyzeSpending } from '../utils/spendingAnalyzer';
import { formatCurrency } from '../utils/calculations';
import { startOfMonth, endOfMonth, subMonths, isWithinInterval, format } from 'date-fns';
import { PDFStatementUpload } from '../components/expenses/PDFStatementUpload';

export function PersonalDashboard() {
    const theme = useTheme();
    const { expenses, loading } = useFirestoreExpenses();
    const [showUpload, setShowUpload] = useState(false);

    // Calculate current month data
    const monthlyData = useMemo(() => {
        const now = new Date();
        const currentMonthStart = startOfMonth(now);
        const currentMonthEnd = endOfMonth(now);
        const lastMonthStart = startOfMonth(subMonths(now, 1));
        const lastMonthEnd = endOfMonth(subMonths(now, 1));

        // Filter by PERSONAL account only
        const personalExpenses = expenses.filter(e => e.accountId === 'PERSONAL');

        const currentMonthExpenses = personalExpenses.filter(e =>
            isWithinInterval(new Date(e.date), { start: currentMonthStart, end: currentMonthEnd })
        );

        const lastMonthExpenses = personalExpenses.filter(e =>
            isWithinInterval(new Date(e.date), { start: lastMonthStart, end: lastMonthEnd })
        );

        const currentTotal = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
        const lastTotal = lastMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

        // Group by category
        const byCategory: Record<string, number> = {};
        currentMonthExpenses.forEach(e => {
            const cat = e.category || 'Other';
            byCategory[cat] = (byCategory[cat] || 0) + e.amount;
        });

        return {
            currentTotal,
            lastTotal,
            currentMonthExpenses,
            lastMonthExpenses,
            byCategory,
        };
    }, [expenses]);

    // Calculate financial health
    const healthData = useMemo(() => {
        // For demo: assume $5000 monthly income
        const monthlyIncome = 5000;
        const savingsRate = calculateSavingsRate(monthlyIncome, monthlyData.currentTotal);

        // Budget adherence (assume $4000 total budget)
        const budgets = {
            Groceries: 800,
            Entertainment: 300,
            Transportation: 400,
            Utilities: 200,
            Other: 500,
        };
        const budgetAdherence = calculateBudgetAdherence(monthlyData.currentMonthExpenses, budgets);

        const spendingTrend = calculateSpendingTrend(monthlyData.currentTotal, monthlyData.lastTotal);

        return calculateFinancialHealth({
            savingsRate,
            budgetAdherence,
            spendingTrend,
        });
    }, [monthlyData]);

    // Spending insights (PERSONAL account only)
    const insights = useMemo(() => {
        const personalExpenses = expenses.filter(e => e.accountId === 'PERSONAL');
        if (personalExpenses.length === 0) return null;
        return analyzeSpending(personalExpenses);
    }, [expenses]);

    // Recent transactions (PERSONAL account only)
    const recentTransactions = useMemo(() => {
        return expenses
            .filter(e => e.accountId === 'PERSONAL')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5);
    }, [expenses]);

    // Top spending categories
    const topCategories = useMemo(() => {
        return Object.entries(monthlyData.byCategory)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);
    }, [monthlyData.byCategory]);

    if (loading) {
        return (
            <Box sx={{ p: 4 }}>
                <Typography>Loading your financial dashboard...</Typography>
            </Box>
        );
    }

    const changePercent = monthlyData.lastTotal > 0
        ? ((monthlyData.currentTotal - monthlyData.lastTotal) / monthlyData.lastTotal) * 100
        : 0;

    return (
        <Box sx={{ p: 4 }}>
            {/* Header */}
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Typography variant="h4" fontWeight="bold" gutterBottom>
                        Financial Dashboard
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Your personal finance overview for {format(new Date(), 'MMMM yyyy')}
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<Upload size={20} />}
                    onClick={() => setShowUpload(true)}
                >
                    Upload Statement
                </Button>
            </Box>

            {/* PDF Upload Dialog */}
            <Dialog open={showUpload} onClose={() => setShowUpload(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Upload Credit Card Statement</DialogTitle>
                <DialogContent>
                    <PDFStatementUpload />
                </DialogContent>
            </Dialog>

            {/* Financial Health Score - Hero Section */}
            <Card sx={{ mb: 3, background: `linear-gradient(135deg, ${theme.palette.primary.main}15, ${theme.palette.secondary.main}15)`, borderRadius: 3 }}>
                <CardContent sx={{ p: 4 }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="center">
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="h6" gutterBottom>
                                Financial Health Score
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 2 }}>
                                <Typography variant="h2" fontWeight="bold" color="primary.main">
                                    {healthData.score}
                                </Typography>
                                <Typography variant="h4" color="text.secondary">
                                    / 100
                                </Typography>
                                <Chip
                                    label={`Grade: ${healthData.grade}`}
                                    color={healthData.grade === 'A' ? 'success' : healthData.grade === 'B' ? 'info' : healthData.grade === 'C' ? 'warning' : 'error'}
                                    sx={{ ml: 2 }}
                                />
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                                {healthData.message}
                            </Typography>
                        </Box>
                        <Box sx={{ flex: 1, width: '100%' }}>
                            <Stack spacing={2}>
                                <Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Typography variant="caption">Savings Rate</Typography>
                                        <Typography variant="caption" fontWeight="bold">{healthData.breakdown.savingsScore}/40</Typography>
                                    </Box>
                                    <LinearProgress variant="determinate" value={(healthData.breakdown.savingsScore / 40) * 100} sx={{ height: 8, borderRadius: 4 }} />
                                </Box>
                                <Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Typography variant="caption">Budget Adherence</Typography>
                                        <Typography variant="caption" fontWeight="bold">{healthData.breakdown.budgetScore}/35</Typography>
                                    </Box>
                                    <LinearProgress variant="determinate" value={(healthData.breakdown.budgetScore / 35) * 100} sx={{ height: 8, borderRadius: 4 }} color="secondary" />
                                </Box>
                                <Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Typography variant="caption">Spending Trend</Typography>
                                        <Typography variant="caption" fontWeight="bold">{healthData.breakdown.trendScore}/25</Typography>
                                    </Box>
                                    <LinearProgress variant="determinate" value={(healthData.breakdown.trendScore / 25) * 100} sx={{ height: 8, borderRadius: 4 }} color="success" />
                                </Box>
                            </Stack>
                        </Box>
                    </Stack>
                </CardContent>
            </Card>

            {/* Quick Stats Row */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
                <Card sx={{ flex: 1, borderRadius: 3 }}>
                    <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ p: 1.5, bgcolor: 'primary.main', borderRadius: 2, color: 'white' }}>
                                <DollarSign size={24} />
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">This Month</Typography>
                                <Typography variant="h6" fontWeight="bold">{formatCurrency(monthlyData.currentTotal)}</Typography>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>
                <Card sx={{ flex: 1, borderRadius: 3 }}>
                    <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ p: 1.5, bgcolor: changePercent > 0 ? 'error.main' : 'success.main', borderRadius: 2, color: 'white' }}>
                                {changePercent > 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">vs Last Month</Typography>
                                <Typography variant="h6" fontWeight="bold" color={changePercent > 0 ? 'error.main' : 'success.main'}>
                                    {changePercent > 0 ? '+' : ''}{changePercent.toFixed(1)}%
                                </Typography>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>
                <Card sx={{ flex: 1, borderRadius: 3 }}>
                    <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ p: 1.5, bgcolor: 'info.main', borderRadius: 2, color: 'white' }}>
                                <Activity size={24} />
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Transactions</Typography>
                                <Typography variant="h6" fontWeight="bold">{monthlyData.currentMonthExpenses.length}</Typography>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>
            </Stack>

            {/* Main Content */}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
                {/* Left Column */}
                <Box sx={{ flex: 2 }}>
                    <Stack spacing={3}>
                        {/* Spending Insights */}
                        {insights && insights.insights.length > 0 && (
                            <Card sx={{ borderRadius: 3 }}>
                                <CardContent>
                                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                                        💡 Spending Insights
                                    </Typography>
                                    <Stack spacing={1}>
                                        {insights.insights.map((insight, i) => (
                                            <Alert key={i} severity="info" sx={{ borderRadius: 2 }}>
                                                {insight}
                                            </Alert>
                                        ))}
                                    </Stack>
                                </CardContent>
                            </Card>
                        )}

                        {/* Top Spending Categories */}
                        <Card sx={{ borderRadius: 3 }}>
                            <CardContent>
                                <Typography variant="h6" fontWeight="bold" gutterBottom>
                                    📊 Top Spending Categories
                                </Typography>
                                <Stack spacing={2} sx={{ mt: 2 }}>
                                    {topCategories.length === 0 ? (
                                        <Typography variant="body2" color="text.secondary">
                                            No expenses yet this month
                                        </Typography>
                                    ) : (
                                        topCategories.map(([category, amount]) => {
                                            const percent = (amount / monthlyData.currentTotal) * 100;
                                            return (
                                                <Box key={category}>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                        <Typography variant="body2">{category}</Typography>
                                                        <Typography variant="body2" fontWeight="bold">
                                                            {formatCurrency(amount)} ({percent.toFixed(0)}%)
                                                        </Typography>
                                                    </Box>
                                                    <LinearProgress variant="determinate" value={percent} sx={{ height: 6, borderRadius: 3 }} />
                                                </Box>
                                            );
                                        })
                                    )}
                                </Stack>
                            </CardContent>
                        </Card>
                    </Stack>
                </Box>

                {/* Right Column */}
                <Box sx={{ flex: 1 }}>
                    <Card sx={{ borderRadius: 3 }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="h6" fontWeight="bold">
                                    📝 Recent Transactions
                                </Typography>
                                <Button
                                    component={Link}
                                    to="/expenses"
                                    size="small"
                                    startIcon={<PlusCircle size={16} />}
                                >
                                    Add
                                </Button>
                            </Box>
                            <Stack spacing={2}>
                                {recentTransactions.length === 0 ? (
                                    <Typography variant="body2" color="text.secondary">
                                        No transactions yet
                                    </Typography>
                                ) : (
                                    recentTransactions.map((expense) => (
                                        <Box key={expense.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Box>
                                                <Typography variant="body2" fontWeight="medium">
                                                    {expense.description || expense.category}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {format(new Date(expense.date), 'MMM dd')} • {expense.category}
                                                </Typography>
                                            </Box>
                                            <Typography variant="body2" fontWeight="bold" color="error.main">
                                                -{formatCurrency(expense.amount)}
                                            </Typography>
                                        </Box>
                                    ))
                                )}
                            </Stack>
                        </CardContent>
                    </Card>
                </Box>
            </Stack>
        </Box>
    );
}
