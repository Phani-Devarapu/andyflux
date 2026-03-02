import { useMemo } from 'react';
import { Box, Paper, Typography, useTheme, alpha } from '@mui/material';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement,
    LineElement, Tooltip, Legend, Filler
} from 'chart.js';
import { TrendingUp } from 'lucide-react';
import type { Expense } from '../../types/expenseTypes';
import { buildMonthlyTotals } from '../../utils/expenseUIUtils';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

interface SpendingTrendChartProps {
    expenses: Expense[];
}

export function SpendingTrendChart({ expenses }: SpendingTrendChartProps) {
    const theme = useTheme();
    const now = new Date();

    const monthlyTotals = useMemo(() => buildMonthlyTotals(expenses, now, 6), [expenses]);

    const avgSpend = monthlyTotals.reduce((s, m) => s + m.total, 0) / (monthlyTotals.length || 1);
    const latestTotal = monthlyTotals[monthlyTotals.length - 1]?.total ?? 0;
    const prevTotal = monthlyTotals[monthlyTotals.length - 2]?.total ?? 0;
    const trend = prevTotal === 0 ? null : ((latestTotal - prevTotal) / prevTotal) * 100;

    const primaryColor = theme.palette.primary.main;

    const chartData = {
        labels: monthlyTotals.map(m => m.label),
        datasets: [
            {
                label: 'Monthly Spend',
                data: monthlyTotals.map(m => m.total),
                fill: true,
                backgroundColor: alpha(primaryColor, 0.08),
                borderColor: primaryColor,
                borderWidth: 2.5,
                pointBackgroundColor: primaryColor,
                pointRadius: 4,
                pointHoverRadius: 7,
                tension: 0.4,
            },
            {
                label: 'Average',
                data: monthlyTotals.map(() => avgSpend),
                borderColor: alpha(theme.palette.warning.main, 0.6),
                borderWidth: 1.5,
                borderDash: [6, 4],
                pointRadius: 0,
                fill: false,
                tension: 0,
            }
        ],
    };

    return (
        <Paper sx={{ p: 3, borderRadius: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TrendingUp size={20} color={primaryColor} />
                    <Typography variant="h6" fontWeight={600}>6-Month Spending Trend</Typography>
                </Box>
                {trend !== null && (
                    <Box sx={{
                        px: 1.5, py: 0.5, borderRadius: 2,
                        bgcolor: trend > 0 ? alpha(theme.palette.error.main, 0.1) : alpha(theme.palette.success.main, 0.1),
                        color: trend > 0 ? 'error.main' : 'success.main',
                        fontSize: '0.8rem', fontWeight: 700
                    }}>
                        {trend > 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}% vs last month
                    </Box>
                )}
            </Box>
            <Box sx={{ height: 200 }}>
                <Line
                    data={chartData}
                    options={{
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: ctx => ctx.dataset.label === 'Average'
                                        ? ` Avg: $${(ctx.raw as number).toFixed(2)}`
                                        : ` $${(ctx.raw as number).toFixed(2)}`
                                }
                            }
                        },
                        scales: {
                            y: {
                                ticks: { callback: v => `$${v}` },
                                grid: { color: alpha(theme.palette.divider, 0.5) },
                                beginAtZero: true,
                            },
                            x: { grid: { display: false } }
                        }
                    }}
                />
            </Box>
        </Paper>
    );
}
