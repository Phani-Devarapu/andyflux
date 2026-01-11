import { Link } from 'react-router-dom';
// import { useLiveQuery } from 'dexie-react-hooks'; // Removed
import * as React from 'react';
// import { db } from '../db/db'; // Removed
import { useMarketData } from '../context/MarketDataContext';
// import { useTrades } from '../context/TradesContext';
import {
    Chart as ChartJS,
    CategoryScale,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    BarElement,
    LinearScale,
    PointElement,
    LineElement,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { formatCurrency } from '../utils/calculations';
import { Grid, Card, CardContent, Typography, Box, useTheme, Skeleton, Button, Stack } from '@mui/material';
import { BarChart3, PlusCircle } from 'lucide-react';
import { EquityChart } from '../components/charts/EquityChart';
import { useAuth } from '../context/AuthContext';

// Register ChartJS components
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

// ... imports
import { useTradeStats } from '../hooks/useTradeStats';
import { useRecentTrades } from '../hooks/useRecentTrades';
import { useAccount } from '../context/AccountContext';
import { PersonalDashboard } from './PersonalDashboard';

export function Dashboard() {
    const { user } = useAuth();
    const { selectedAccount } = useAccount();

    // Show PersonalDashboard for PERSONAL account
    if (selectedAccount === 'PERSONAL') {
        return <PersonalDashboard />;
    }

    // Trading dashboard for other accounts
    // Replaced useTrades with optimized hooks
    const { stats, loading: statsLoading, error } = useTradeStats();
    const { trades: recentTrades, loading: recentLoading } = useRecentTrades(100);

    const theme = useTheme();
    const { prices } = useMarketData();
    const [unrealizedPnL, setUnrealizedPnL] = React.useState<number>(0);

    const greeting = React.useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    }, []);

    // Calculate Unrealized PnL from recent trades (approximation for performance)
    React.useEffect(() => {
        if (!recentTrades) return;
        const openTrades = recentTrades.filter(t => t.status === 'Open');

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
    }, [recentTrades, prices]);

    // Error Display
    if (error) {
        return (
            <Box sx={{ p: 4 }}>
                <Typography color="error" variant="h6" gutterBottom>Error loading dashboard data</Typography>
                <Typography variant="body2" paragraph>{error.message.split('https://')[0]}</Typography>
                {error.message.includes('https://console.firebase.google.com') && (
                    <Button
                        variant="contained"
                        color="error"
                        onClick={() => {
                            const match = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
                            if (match) window.open(match[0], '_blank');
                        }}
                        sx={{ mt: 1, textTransform: 'none' }}
                    >
                        Create Missing Index
                    </Button>
                )}
            </Box>
        );
    }

    if (statsLoading || recentLoading) {
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

    // Empty State Check (using stats.totalTrades)
    if (!stats || stats.totalTrades === 0) {
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

    // Use aggregations from stats directly
    const { totalPnL, winRate, avgWin, avgLoss, wins, losses } = stats;

    const winRateData = {
        labels: ['Wins', 'Losses'],
        datasets: [
            {
                data: [wins, losses],
                backgroundColor: [theme.palette.success.main, theme.palette.error.main],
                borderColor: [theme.palette.success.main, theme.palette.error.main],
                borderWidth: 1,
            },
        ],
    };

    return (
        <Box sx={{ flexGrow: 1 }} >
            {/* Header */}
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
                    <StatsCard title="WIN RATE" value={`${winRate.toFixed(1)}%`} subValue={`${wins}W - ${losses}L`} />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <StatsCard title="AVG WIN" value={avgWin} highlight />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <StatsCard title="AVG LOSS" value={avgLoss} highlight />
                </Grid>
            </Grid>

            {/* Charts */}
            <Grid container spacing={3} >
                <Grid size={{ xs: 12, lg: 8 }}>
                    <Card variant="outlined" sx={{ height: { xs: 300, md: 400 } }}>
                        <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }}>
                                Equity Curve (Daily Growth)
                            </Typography>
                            <Box sx={{ flexGrow: 1, position: 'relative' }}>
                                {recentTrades && recentTrades.length > 0 ? (
                                    <EquityChart trades={recentTrades} unrealizedPnL={unrealizedPnL} />
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
                                {stats.totalTrades > 0 ? (
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
