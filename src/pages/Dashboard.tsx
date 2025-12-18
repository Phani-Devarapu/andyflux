import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    BarElement,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { formatCurrency } from '../utils/calculations';
import { Grid, Card, CardContent, Typography, Box, useTheme, Skeleton, Button, Stack } from '@mui/material';
import { BarChart3, PlusCircle } from 'lucide-react';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

import { useAccount } from '../context/AccountContext';

export function Dashboard() {
    const { selectedAccount } = useAccount();
    const trades = useLiveQuery(() => db.trades.where('accountId').equals(selectedAccount).toArray(), [selectedAccount]);
    const theme = useTheme();

    if (!trades) {
        return (
            <Grid container spacing={3}>
                {[1, 2, 3, 4].map(i => (
                    <Grid size={{ xs: 12, md: 3 }} key={i}>
                        <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 2 }} />
                    </Grid>
                ))}
            </Grid>
        );
    }

    const closedTrades = trades.filter(t => t.status === 'Closed');

    // Empty State
    if (trades.length === 0) {
        return (
            <Box sx={{
                height: '80vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                gap: 3
            }}>
                <Box sx={{
                    p: 4,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    color: 'white',
                    boxShadow: '0 0 40px rgba(16, 185, 129, 0.4)'
                }}>
                    <BarChart3 size={64} strokeWidth={1.5} />
                </Box>

                <Typography variant="h3" fontWeight={800} sx={{
                    background: 'linear-gradient(45deg, #10B981, #3B82F6)',
                    backgroundClip: 'text',
                    textFillColor: 'transparent',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                }}>
                    Welcome to Andy Flux
                </Typography>

                <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600 }}>
                    Your ultimate trading journal. Track your performance, analyze your strategies,
                    and master the market. Start by logging your first trade!
                </Typography>

                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                    <Button
                        component={Link}
                        to="/add"
                        variant="contained"
                        size="large"
                        startIcon={<PlusCircle />}
                        sx={{ px: 4, py: 1.5, borderRadius: 3, fontSize: '1.rem' }}
                    >
                        Log First Trade
                    </Button>
                    <Button
                        variant="outlined"
                        size="large"
                        color="warning"
                        onClick={async () => {
                            const { generateTestTrades } = await import('../utils/generateTestTrades');
                            await generateTestTrades(selectedAccount);
                            window.location.reload();
                        }}
                        sx={{ px: 4, py: 1.5, borderRadius: 3 }}
                    >
                        Generate Test Data
                    </Button>
                </Stack>
            </Box>
        );
    }

    const sortedTrades = [...closedTrades].sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculations
    const totalPnL = closedTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
    const winCount = closedTrades.filter(t => (t.pnl || 0) > 0).length;
    const lossCount = closedTrades.filter(t => (t.pnl || 0) < 0).length;
    const totalTrades = winCount + lossCount;
    const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;

    const wins = closedTrades.filter(t => (t.pnl || 0) > 0);
    const losses = closedTrades.filter(t => (t.pnl || 0) < 0);
    const avgWin = wins.length > 0 ? wins.reduce((acc, t) => acc + (t.pnl || 0), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((acc, t) => acc + (t.pnl || 0), 0) / losses.length : 0;

    // Equity Curve Data
    let runningPnL = 0;
    const equityData = sortedTrades.map(t => {
        runningPnL += (t.pnl || 0);
        return runningPnL;
    });
    const equityLabels = sortedTrades.map(t => t.date.toISOString().split('T')[0]);

    const lineChartData = {
        labels: equityLabels,
        datasets: [
            {
                label: 'Equity Curve',
                data: equityData,
                borderColor: theme.palette.success.main,
                backgroundColor: theme.palette.success.main,
                tension: 0.3,
                pointRadius: 0,
                borderWidth: 2,
            },
        ],
    };

    const winRateData = {
        labels: ['Wins', 'Losses'],
        datasets: [
            {
                data: [winCount, lossCount],
                backgroundColor: [theme.palette.success.main, theme.palette.error.main],
                borderColor: [theme.palette.success.main, theme.palette.error.main],
                borderWidth: 1,
            },
        ],
    };

    interface StatsCardProps {
        title: string;
        value: string | number;
        subValue?: string;
        highlight?: boolean;
    }

    const StatsCard = ({ title, value, subValue, highlight }: StatsCardProps) => (
        <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
                <Typography variant="overline" color="text.secondary" fontWeight="bold" letterSpacing={1}>
                    {title}
                </Typography>
                <Typography variant="h4" fontWeight="bold" color={highlight ? (typeof value === 'number' ? (value >= 0 ? 'success.main' : 'error.main') : 'text.primary') : 'text.primary'} sx={{ mt: 1 }}>
                    {typeof value === 'number' && (title.includes('P/L') || title.includes('AVG')) ? formatCurrency(value) : value}
                </Typography>
                {subValue && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {subValue}
                    </Typography>
                )}
            </CardContent>
        </Card>
    );

    return (
        <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h4" fontWeight={700} sx={{ mb: 4, letterSpacing: -1 }}>
                Dashboard
            </Typography>

            {/* Stats Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid size={{ xs: 12, md: 3 }}>
                    <StatsCard title="NET P/L" value={totalPnL} highlight />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <StatsCard title="WIN RATE" value={`${winRate.toFixed(1)}%`} subValue={`${winCount}W - ${lossCount}L`} />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <StatsCard title="AVG WIN" value={avgWin} highlight />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <StatsCard title="AVG LOSS" value={avgLoss} highlight />
                </Grid>
            </Grid>

            {/* Charts */}
            <Grid container spacing={3}>
                <Grid size={{ xs: 12, lg: 8 }}>
                    <Card variant="outlined" sx={{ height: 400 }}>
                        <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="h6" fontWeight="bold" gutterBottom>Equity Curve</Typography>
                            <Box sx={{ flexGrow: 1, position: 'relative' }}>
                                {sortedTrades.length > 0 ? (
                                    <Line
                                        data={lineChartData}
                                        options={{
                                            maintainAspectRatio: false,
                                            responsive: true,
                                            plugins: { legend: { display: false } },
                                            scales: {
                                                x: { grid: { display: false } },
                                                y: { grid: { color: theme.palette.divider } }
                                            }
                                        }}
                                    />
                                ) : (
                                    <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Typography color="text.secondary">No closed trades yet.</Typography>
                                    </Box>
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, lg: 4 }}>
                    <Card variant="outlined" sx={{ height: 400 }}>
                        <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="h6" fontWeight="bold" gutterBottom>Win/Loss Ratio</Typography>
                            <Box sx={{ flexGrow: 1, position: 'relative', display: 'flex', justifyContent: 'center' }}>
                                {totalTrades > 0 ? (
                                    <Doughnut
                                        data={winRateData}
                                        options={{
                                            maintainAspectRatio: false,
                                            plugins: { legend: { position: 'bottom' } }
                                        }}
                                    />
                                ) : (
                                    <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Typography color="text.secondary">No trades yet.</Typography>
                                    </Box>
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
}
