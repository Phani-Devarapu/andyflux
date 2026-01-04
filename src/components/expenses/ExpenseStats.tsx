import { useMemo } from 'react';
import { Box, Paper, Typography, Grid, useTheme } from '@mui/material';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { DollarSign, TrendingUp, Calendar as CalendarIcon } from 'lucide-react';
import type { Expense } from '../../types/expenseTypes';
import { DEFAULT_EXPENSE_CATEGORIES } from '../../types/expenseTypes';

ChartJS.register(ArcElement, Tooltip, Legend);

interface ExpenseStatsProps {
    expenses: Expense[];
}

export function ExpenseStats({ expenses }: ExpenseStatsProps) {
    const theme = useTheme();

    // 1. Calculate Stats
    const stats = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const thisMonthExpenses = expenses.filter(e =>
            e.date.getMonth() === currentMonth &&
            e.date.getFullYear() === currentYear
        );

        const totalThisMonth = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

        // Recurring "Burn Rate" (Projected Monthly Fixed Cost)
        // Monthly + (Yearly / 12)
        const monthlyRecurring = expenses.filter(e => e.isRecurring && e.frequency === 'monthly')
            .reduce((sum, e) => sum + e.amount, 0);
        const yearlyRecurring = expenses.filter(e => e.isRecurring && e.frequency === 'yearly')
            .reduce((sum, e) => sum + e.amount / 12, 0);

        const monthlyBurn = monthlyRecurring + yearlyRecurring;

        const totalYTD = expenses.filter(e => e.date.getFullYear() === currentYear)
            .reduce((sum, e) => sum + e.amount, 0);

        return { totalThisMonth, monthlyBurn, totalYTD };
    }, [expenses]);

    // 2. Prepare Chart Data (Category Breakdown)
    const chartData = useMemo(() => {
        const categoryMap = new Map<string, number>();
        expenses.forEach(e => {
            categoryMap.set(e.category, (categoryMap.get(e.category) || 0) + e.amount);
        });

        const labels = Array.from(categoryMap.keys()).map(id => {
            return DEFAULT_EXPENSE_CATEGORIES.find(c => c.id === id)?.name || id;
        });
        const data = Array.from(categoryMap.values());
        const bgColors = Array.from(categoryMap.keys()).map(id => {
            return DEFAULT_EXPENSE_CATEGORIES.find(c => c.id === id)?.color || '#9ca3af';
        });

        return {
            labels,
            datasets: [{
                data,
                backgroundColor: bgColors,
                borderWidth: 0,
            }]
        };
    }, [expenses]);

    const statCards = [
        { title: 'Total This Month', value: stats.totalThisMonth, icon: DollarSign, color: theme.palette.primary.main },
        { title: 'Monthly Burn Rate', value: stats.monthlyBurn, sub: 'Fixed Costs', icon: TrendingUp, color: theme.palette.warning.main },
        { title: 'YTD Spend', value: stats.totalYTD, icon: CalendarIcon, color: theme.palette.info.main },
    ];

    return (
        <Grid container spacing={3} sx={{ mb: 4 }}>
            {/* Stat Cards */}
            {statCards.map((stat, index) => (
                <Grid size={{ xs: 12, md: 4 }} key={index}>
                    <Paper sx={{ p: 3, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box>
                            <Typography variant="body2" color="text.secondary" fontWeight={500}>
                                {stat.title}
                            </Typography>
                            <Typography variant="h4" fontWeight={700} sx={{ my: 0.5 }}>
                                ${stat.value.toFixed(2)}
                            </Typography>
                            {stat.sub && (
                                <Typography variant="caption" color="text.secondary">
                                    {stat.sub}
                                </Typography>
                            )}
                        </Box>
                        <Box sx={{
                            p: 1.5,
                            borderRadius: '50%',
                            bgcolor: `${stat.color}15`,
                            color: stat.color,
                            display: 'flex'
                        }}>
                            <stat.icon size={24} />
                        </Box>
                    </Paper>
                </Grid>
            ))}

            {/* Chart (Hidden if empty) */}
            {expenses.length > 0 && (
                <Grid size={{ xs: 12 }}>
                    <Paper sx={{ p: 3, borderRadius: 3 }}>
                        <Typography variant="h6" fontWeight={600} gutterBottom>
                            Spending by Category
                        </Typography>
                        <Box sx={{ height: 300, display: 'flex', justifyContent: 'center' }}>
                            <Doughnut
                                data={chartData}
                                options={{
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: { position: 'right' }
                                    }
                                }}
                            />
                        </Box>
                    </Paper>
                </Grid>
            )}
        </Grid>
    );
}
