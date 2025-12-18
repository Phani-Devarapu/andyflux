import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { formatCurrency, calculateProfitFactor, calculateExpectancy, calculateWinRate } from '../utils/calculations';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Grid,
    useTheme,
    ToggleButtonGroup,
    ToggleButton,
    Paper,
    Tabs,
    Tab
} from '@mui/material';
import { subWeeks, subMonths, startOfYear, isAfter } from 'date-fns';

import { useAccount } from '../context/AccountContext';
import { TickerAnalytics } from './TickerAnalytics';
import { StrategyAnalytics } from './StrategyAnalytics';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type TimeRange = '1W' | '1M' | 'YTD' | 'ALL';

function AnalyticsOverview() { // Renamed from Analytics
    const { selectedAccount } = useAccount();
    const [timeRange, setTimeRange] = useState<TimeRange>('ALL');
    const trades = useLiveQuery(() => db.trades.where('accountId').equals(selectedAccount).toArray(), [selectedAccount]);
    const theme = useTheme();

    if (!trades) return <Typography>Loading analytics...</Typography>;

    // Filter Trades based on Time Range
    const filteredTrades = trades.filter(t => {
        const date = new Date(t.date);
        const now = new Date();
        switch (timeRange) {
            case '1W': return isAfter(date, subWeeks(now, 1));
            case '1M': return isAfter(date, subMonths(now, 1));
            case 'YTD': return isAfter(date, startOfYear(now));
            case 'ALL': default: return true;
        }
    });

    const closedTrades = filteredTrades.filter(t => t.status === 'Closed');

    // Strategy Performance
    const strategyPerformance: Record<string, number> = {};
    const tickerPerformance: Record<string, number> = {};

    closedTrades.forEach(t => {
        // Strategy Stats
        const strategy = t.strategy || 'No Strategy';
        strategyPerformance[strategy] = (strategyPerformance[strategy] || 0) + (t.pnl || 0);

        // Ticker Stats
        const ticker = t.symbol || 'Unknown';
        tickerPerformance[ticker] = (tickerPerformance[ticker] || 0) + (t.pnl || 0);
    });

    // Sort Tickers by P/L
    const sortedTickers = Object.entries(tickerPerformance)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10); // Top 10

    return (
        <Box sx={{ flexGrow: 1, animation: 'fade-in 0.5s' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: -0.5 }}>
                    Overview
                </Typography>

                <Paper elevation={0} variant="outlined" sx={{ borderRadius: 2 }}>
                    <ToggleButtonGroup
                        value={timeRange}
                        exclusive
                        onChange={(_, newRange) => newRange && setTimeRange(newRange)}
                        size="small"
                        sx={{ p: 0.5 }}
                    >
                        <ToggleButton value="1W" sx={{ borderRadius: 1.5, px: 2, fontWeight: 'bold' }}>1 Week</ToggleButton>
                        <ToggleButton value="1M" sx={{ borderRadius: 1.5, px: 2, fontWeight: 'bold' }}>1 Month</ToggleButton>
                        <ToggleButton value="YTD" sx={{ borderRadius: 1.5, px: 2, fontWeight: 'bold' }}>YTD</ToggleButton>
                        <ToggleButton value="ALL" sx={{ borderRadius: 1.5, px: 2, fontWeight: 'bold' }}>All Time</ToggleButton>
                    </ToggleButtonGroup>
                </Paper>
            </Box>

            {/* Key Metrics Grid */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <MetricCard
                        label="Net P/L"
                        value={formatCurrency(filteredTrades.reduce((acc, t) => acc + (t.pnl || 0), 0))}
                        isCurrency
                        trend={filteredTrades.reduce((acc, t) => acc + (t.pnl || 0), 0) >= 0 ? 'up' : 'down'}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <MetricCard
                        label="Profit Factor"
                        value={calculateProfitFactor(filteredTrades).toString()}
                        subtext="Target > 1.5"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <MetricCard
                        label="Win Rate"
                        value={`${calculateWinRate(filteredTrades)}%`}
                        subtext={`Out of ${filteredTrades.length} trades`}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <MetricCard
                        label="Expectancy"
                        value={formatCurrency(calculateExpectancy(filteredTrades))}
                        isCurrency
                        trend={calculateExpectancy(filteredTrades) > 0 ? 'up' : 'down'}
                    />
                </Grid>
            </Grid>

            <Grid container spacing={4}>
                {/* Ticker Performance */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card variant="outlined" sx={{ height: '100%', borderRadius: 4 }}>
                        <CardContent>
                            <Typography variant="h6" fontWeight="bold" gutterBottom>Profit by Ticker (Top 10)</Typography>
                            <Box sx={{ height: 300 }}>
                                <Bar
                                    data={{
                                        labels: sortedTickers.map(([t]) => t),
                                        datasets: [{
                                            label: 'Net P/L',
                                            data: sortedTickers.map(([, pnl]) => pnl),
                                            backgroundColor: sortedTickers.map(([, pnl]) => pnl >= 0 ? theme.palette.success.main : theme.palette.error.main),
                                            borderRadius: 4
                                        }]
                                    }}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: { legend: { display: false } },
                                        scales: {
                                            y: { grid: { color: theme.palette.divider } },
                                            x: { grid: { display: false } }
                                        }
                                    }}
                                />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Strategy Performance */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card variant="outlined" sx={{ height: '100%', borderRadius: 4 }}>
                        <CardContent>
                            <Typography variant="h6" fontWeight="bold" gutterBottom>Performance by Strategy</Typography>
                            <Box sx={{ height: 300 }}>
                                <Bar
                                    data={{
                                        labels: Object.keys(strategyPerformance),
                                        datasets: [{
                                            label: 'Net P/L',
                                            data: Object.values(strategyPerformance),
                                            backgroundColor: theme.palette.primary.main,
                                            borderRadius: 4
                                        }]
                                    }}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: { legend: { display: false } },
                                        scales: {
                                            y: { grid: { color: theme.palette.divider } },
                                            x: { grid: { display: false } }
                                        }
                                    }}
                                />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
}

interface MetricCardProps {
    label: string;
    value: string | number;
    subtext?: string;
    trend?: 'up' | 'down';
    isCurrency?: boolean;
}

const MetricCard = ({ label, value, subtext, trend }: MetricCardProps) => (
    <Card variant="outlined" sx={{ height: '100%', borderRadius: 3 }}>
        <CardContent>
            <Typography variant="overline" color="text.secondary" fontWeight="bold" letterSpacing={1}>
                {label}
            </Typography>
            <Typography
                variant="h4"
                fontWeight="900"
                sx={{ mt: 1 }}
                color={trend === 'up' ? 'success.main' : trend === 'down' ? 'error.main' : 'text.primary'}
            >
                {value}
            </Typography>
            {subtext && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontWeight: 'medium' }}>{subtext}</Typography>}
        </CardContent>
    </Card>
);

export function Analytics() {
    const [tabIndex, setTabIndex] = useState(0);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabIndex(newValue);
    };

    return (
        <Box sx={{ width: '100%' }}>
            <Typography variant="h3" fontWeight={900} sx={{ letterSpacing: -1, mb: 3 }}>
                Analytics
            </Typography>

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs value={tabIndex} onChange={handleTabChange} aria-label="analytics tabs">
                    <Tab label="Overview" sx={{ fontWeight: 'bold' }} />
                    <Tab label="By Ticker" sx={{ fontWeight: 'bold' }} />
                    <Tab label="By Strategy" sx={{ fontWeight: 'bold' }} />
                </Tabs>
            </Box>

            <CustomTabPanel value={tabIndex} index={0}>
                <AnalyticsOverview />
            </CustomTabPanel>
            <CustomTabPanel value={tabIndex} index={1}>
                <TickerAnalytics />
            </CustomTabPanel>
            <CustomTabPanel value={tabIndex} index={2}>
                <StrategyAnalytics />
            </CustomTabPanel>
        </Box>
    );
}

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function CustomTabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`simple-tabpanel-${index}`}
            aria-labelledby={`simple-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{ py: 3 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}
