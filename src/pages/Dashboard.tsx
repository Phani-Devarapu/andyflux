import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import * as React from 'react';
import { db } from '../db/db';
import { useMarketData } from '../context/MarketDataContext';
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
import { Doughnut } from 'react-chartjs-2';
import { formatCurrency } from '../utils/calculations';
import { Grid, Card, CardContent, Typography, Box, useTheme, Skeleton, Button, Stack } from '@mui/material';
import { BarChart3, PlusCircle } from 'lucide-react';
import { EquityChart } from '../components/charts/EquityChart';

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
import { useAuth } from '../context/AuthContext';

export function Dashboard() {
    const { selectedAccount } = useAccount();
    const { user } = useAuth();
    const trades = useLiveQuery(async () => {
        if (!selectedAccount || !user) return [];
        return await db.trades.where('[userId+accountId]').equals([user.uid, selectedAccount]).toArray();
    }, [selectedAccount, user]);
    const theme = useTheme();

    const { prices } = useMarketData();
    const [unrealizedPnL, setUnrealizedPnL] = React.useState<number>(0);

    const greeting = React.useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    }, []);

    // Calculate Unrealized PnL from global prices
    React.useEffect(() => {
        if (!trades) return;
        const openTrades = trades.filter(t => t.status === 'Open');

        if (openTrades.length === 0) {
            setUnrealizedPnL(0);
            return;
        }

        let total = 0;
        for (const trade of openTrades) {
            if (trade.symbol) {
                const marketData = prices[trade.symbol.toUpperCase()];
                if (marketData) {
                    const currentDiff = marketData.price - trade.entryPrice;
                    const tradePnL = trade.side === 'Buy'
                        ? currentDiff * trade.quantity
                        : -currentDiff * trade.quantity;
                    total += tradePnL;
                }
            }
        }
        setUnrealizedPnL(total);
    }, [trades, prices]);

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

    // Derived state (not hooks)
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
                        sx={{ px: 4, py: 1.5, fontSize: '1.rem' }}
                    >
                        Log First Trade
                    </Button>

                </Stack>
            </Box>
        );
    }

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
    // We now use EquityChart component which handles aggregation

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
            {/* Premium Header */}
            <Box sx={{ mb: 4, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: 2 }}>
                <Box>
                    <Typography variant="h4" sx={{
                        fontWeight: 800,
                        fontSize: { xs: '1.75rem', md: '2.125rem' },
                        background: theme.palette.mode === 'dark'
                            ? 'linear-gradient(45deg, #60A5FA 30%, #A78BFA 90%)'
                            : 'linear-gradient(45deg, #2563EB 30%, #7C3AED 90%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        mb: 0.5,
                        letterSpacing: '-0.02em'
                    }}>
                        {greeting}, {user?.displayName ? user.displayName.split(' ')[0] : 'Trader'}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500, fontSize: { xs: '0.875rem', md: '1rem' } }}>
                        Here is your portfolio performance for today.
                    </Typography>
                </Box>
                <Button
                    component={Link}
                    to="/add"
                    variant="contained"
                    startIcon={<PlusCircle size={20} />}
                    sx={{
                        width: { xs: '100%', md: 'auto' },
                        px: 3,
                        py: 1,
                        borderRadius: '100px',
                        fontWeight: 700,
                        textTransform: 'none',
                        boxShadow: theme.palette.mode === 'dark' ? '0 0 20px rgba(59, 130, 246, 0.5)' : 2
                    }}
                >
                    New Trade
                </Button>
            </Box>

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
                    <Card variant="outlined" sx={{ height: { xs: 300, md: 400 } }}>
                        <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }}>
                                Equity Curve (Daily Growth)
                            </Typography>
                            <Box sx={{ flexGrow: 1, position: 'relative' }}>
                                {trades && trades.length > 0 ? (
                                    <EquityChart trades={trades} unrealizedPnL={unrealizedPnL} />
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
                    <Card variant="outlined" sx={{ height: { xs: 300, md: 400 } }}>
                        <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }}>
                                Win/Loss Ratio
                            </Typography>
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
