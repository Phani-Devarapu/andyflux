import { useMemo } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Filler,
    type ScriptableContext,
    type ChartDataset
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useTheme, alpha } from '@mui/material';
import { format } from 'date-fns';
import { formatCurrency } from '../../utils/calculations';
import type { Trade } from '../../types/trade';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Filler
);

interface EquityChartProps {
    trades: Trade[];
    unrealizedPnL?: number | null;
}

export function EquityChart({ trades, unrealizedPnL }: EquityChartProps) {
    const theme = useTheme();

    // Aggregate PnL by Day to create a Daily Equity Curve
    const chartData = useMemo(() => {
        if (!trades || trades.length === 0) return null;

        // 1. Sort trades by exit date (or date for open, but equity usually relies on closed)
        // We filter for closed trades only for realized equity
        const closedTrades = trades
            .filter(t => t.status === 'Closed' && t.exitDate)
            .sort((a, b) => new Date(a.exitDate!).getTime() - new Date(b.exitDate!).getTime());

        if (closedTrades.length === 0 && (unrealizedPnL === null || unrealizedPnL === undefined)) return null;

        // 2. Group by Day
        const dailyPnL: Record<string, number> = {};

        closedTrades.forEach(t => {
            // Validate exitDate before formatting
            const exitDate = new Date(t.exitDate!);
            if (isNaN(exitDate.getTime())) {
                console.warn('Invalid exitDate found in trade:', t);
                return; // Skip this trade
            }
            const dateStr = format(exitDate, 'yyyy-MM-dd');
            if (!dailyPnL[dateStr]) dailyPnL[dateStr] = 0;
            dailyPnL[dateStr] += (t.pnl || 0);
        });

        // 3. Calculate Cumulative (Running) PnL
        const sortedDates = Object.keys(dailyPnL).sort();
        const dataPoints: number[] = [];
        const labels: string[] = [];
        let runningTotal = 0;

        sortedDates.forEach(date => {
            runningTotal += dailyPnL[date];
            labels.push(format(new Date(date), 'MMM d'));
            dataPoints.push(runningTotal);
        });

        // 4. Append Unrealized PnL (Projected)
        // Only if we have specific value
        // 4. Append Unrealized PnL (Projected)
        // Only if we have specific value
        const datasets: ChartDataset<'line'>[] = [];

        // Add Realized Equity only if we have data points
        if (dataPoints.length > 0) {
            datasets.push({
                label: 'Realized Equity',
                data: [...dataPoints],
                fill: true,
                backgroundColor: (context: ScriptableContext<'line'>) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                    // Use alpha() from @mui/material which handles both hex and rgb
                    gradient.addColorStop(0, alpha(theme.palette.success.main, 0.4));
                    gradient.addColorStop(1, alpha(theme.palette.success.main, 0.0));
                    return gradient;
                },
                borderColor: theme.palette.success.main,
                borderWidth: 3,
                pointRadius: 0,
                pointHoverRadius: 6,
                tension: 0.4,
            });
        }

        if (unrealizedPnL !== null && unrealizedPnL !== undefined) {
            const projectedTotal = runningTotal + unrealizedPnL;
            // Add a point for "Today/Now"
            // We need to connect the last realized point to this new point.
            // Chart.js trick: Add nulls to the first dataset? Or just overlap?
            // Simplest: Add a second dataset that starts at the last Realized point.

            const lastRealizedDate = labels.length > 0 ? labels[labels.length - 1] : format(new Date(), 'MMM d');
            const lastRealizedValue = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1] : 0;

            // Ensure we have a label for "Now" if it's different or just append.
            // Let's verify if the last date is today.
            const todayStr = format(new Date(), 'MMM d');
            let nowLabel = todayStr;
            if (lastRealizedDate === todayStr) {
                nowLabel = 'Now';
            }

            // We extend the main labels
            labels.push(nowLabel);

            // Extend realized data with null so it doesn't draw there?
            // Or better: Use specific data for the projected line
            // Projected line: [null, ..., null, lastRealizedValue, projectedTotal]
            // If dataPoints is empty (no closed trades), we just show projected from 0 to projectedTotal?
            // Or just a single point? 
            // If empty, projectedData should be just [0, projectedTotal] (if we assume start at 0)
            // or just [projectedTotal] but we need 2 points for a line.

            let projectedData;
            if (dataPoints.length === 0) {
                // No closed trades, so Realized Equity is 0. 
                // Create a line from 0 (at 'Start') to projectedTotal (at 'Now')
                // But we only have 'Now' in labels.
                // We should probably add a 'Start' label if it's empty?
                // For simplicity, let's assume we start at 0.
                if (labels.length === 1) { // Only 'Now'
                    labels.unshift('Start');
                    projectedData = [0, projectedTotal];
                } else {
                    // Should not happen if logic above is correct (labels only pushed 'Now')
                    projectedData = [0, projectedTotal];
                }
            } else {
                projectedData = new Array(dataPoints.length - 1).fill(null);
                projectedData.push(lastRealizedValue);
                projectedData.push(projectedTotal);
            }

            datasets.push({
                label: 'Unrealized (Projected)',
                data: projectedData,
                borderColor: theme.palette.info.main,
                borderDash: [5, 5], // Dashed line
                borderWidth: 2,
                pointRadius: 4,
                pointBackgroundColor: theme.palette.background.paper,
                pointBorderColor: theme.palette.info.main,
                fill: false
            });
        }

        return {
            labels,
            datasets
        };
    }, [trades, theme, unrealizedPnL]);

    if (!chartData) {
        return null;
    }

    return (
        <Line
            data={chartData}
            options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (context) => formatCurrency(context.parsed.y)
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { maxTicksLimit: 8 }
                    },
                    y: {
                        grid: { color: theme.palette.divider },
                        ticks: {
                            callback: (val) => formatCurrency(Number(val))
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }}
        />
    );
}
