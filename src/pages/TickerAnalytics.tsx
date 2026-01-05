import { useState, useMemo } from 'react';
import { formatCurrency, calculateProfitFactor, calculateExpectancy, calculateWinRate } from '../utils/calculations';
import { isAfter, subWeeks, subMonths, startOfYear } from 'date-fns';
import {
    Box,
    Paper,
    Typography,
    Autocomplete,
    TextField,
    Card,
    CardContent,
    InputAdornment,
    ToggleButton,
    ToggleButtonGroup,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow
} from '@mui/material';
import { Search } from '@mui/icons-material';

import { useMarketData } from '../context/MarketDataContext';

type TimeRange = '1W' | '1M' | 'YTD' | 'ALL';

import { useFirestoreTrades } from '../hooks/useFirestoreTrades';

export const TickerAnalytics = () => {
    // const { selectedAccount } = useAccount(); // Unused
    const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<TimeRange>('ALL');
    // const { user } = useAuth(); // Unused
    const { prices } = useMarketData();

    // Switch to Cloud Data
    const { trades } = useFirestoreTrades();

    const allTickers = useMemo(() => {
        if (!trades) return [];
        const tickers = new Set(trades.map(t => t.symbol).filter(Boolean));
        return Array.from(tickers).sort();
    }, [trades]);

    // Filter trades by Ticker AND Time Range
    const filteredTrades = useMemo(() => {
        if (!trades || !selectedTicker) return [];

        const now = new Date();
        return trades
            .filter(t => t.symbol === selectedTicker)
            .filter(t => {
                const date = new Date(t.date);
                switch (timeRange) {
                    case '1W': return isAfter(date, subWeeks(now, 1));
                    case '1M': return isAfter(date, subMonths(now, 1));
                    case 'YTD': return isAfter(date, startOfYear(now));
                    case 'ALL': default: return true;
                }
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [trades, selectedTicker, timeRange]);

    // Calculate Dynamic Metrics based on filtered view
    const stats = useMemo(() => {
        const closed = filteredTrades.filter(t => t.status === 'Closed');
        const pnl = closed.reduce((acc, t) => acc + (t.pnl || 0), 0);
        const winRate = calculateWinRate(closed);
        const pf = calculateProfitFactor(closed);
        const expectancy = calculateExpectancy(closed);
        return { pnl, winRate, pf, expectancy, count: closed.length };
    }, [filteredTrades]);

    return (
        <Box sx={{ animation: 'fade-in 0.5s' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, flexWrap: 'wrap', gap: 2 }}>
                <div>
                    <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: -1, mb: 1 }}>
                        Ticker Analytics
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Deep dive into individual stock performance
                    </Typography>
                </div>

                <Paper elevation={0} variant="outlined" sx={{ borderRadius: 2 }}>
                    <ToggleButtonGroup
                        value={timeRange}
                        exclusive
                        onChange={(_, newRange) => newRange && setTimeRange(newRange)}
                        size="small"
                        sx={{ p: 0.5 }}
                    >
                        <ToggleButton value="1W" sx={{ borderRadius: 1.5, px: 2, fontWeight: 'bold' }}>1W</ToggleButton>
                        <ToggleButton value="1M" sx={{ borderRadius: 1.5, px: 2, fontWeight: 'bold' }}>1M</ToggleButton>
                        <ToggleButton value="YTD" sx={{ borderRadius: 1.5, px: 2, fontWeight: 'bold' }}>YTD</ToggleButton>
                        <ToggleButton value="ALL" sx={{ borderRadius: 1.5, px: 2, fontWeight: 'bold' }}>ALL</ToggleButton>
                    </ToggleButtonGroup>
                </Paper>
            </Box>

            {/* Search Section */}
            <Paper sx={{ p: 3, mb: 4, borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <Autocomplete
                    options={allTickers}
                    value={selectedTicker}
                    onChange={(_, newValue) => {
                        setSelectedTicker(newValue);
                    }}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            placeholder="Select Ticker (e.g. SPY, TSLA)"
                            variant="outlined"
                            sx={{ width: 300, '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                            InputProps={{
                                ...params.InputProps,
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Search color="action" />
                                    </InputAdornment>
                                )
                            }}
                        />
                    )}
                    sx={{ width: 300 }}
                />
            </Paper>

            {selectedTicker && (
                <>
                    {/* Metrics Grid */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' }, gap: 3, mb: 4 }}>
                        {(() => {
                            const currentData = prices[selectedTicker.toUpperCase()];
                            return (
                                <MetricCard
                                    label="Last Price"
                                    value={currentData ? formatCurrency(currentData.price) : '---'}
                                    subtext={currentData?.change ? `${currentData.change > 0 ? '+' : ''}${currentData.change.toFixed(2)}%` : 'Real-time'}
                                    trend={currentData?.change ? (currentData.change >= 0 ? 'up' : 'down') : undefined}
                                    highlight={!!currentData}
                                />
                            );
                        })()}
                        <MetricCard
                            label="Net P/L"
                            value={formatCurrency(stats.pnl)}
                            trend={stats.pnl >= 0 ? 'up' : 'down'}
                            highlight
                        />
                        <MetricCard
                            label="Win Rate"
                            value={`${stats.winRate}%`}
                            subtext={`Out of ${stats.count} trades`}
                        />
                        <MetricCard
                            label="Profit Factor"
                            value={stats.pf.toString()}
                            subtext="Target > 1.5"
                        />
                        <MetricCard
                            label="Expectancy"
                            value={formatCurrency(stats.expectancy)}
                            trend={stats.expectancy > 0 ? 'up' : 'down'}
                            highlight
                        />
                    </Box>

                    {/* Trade History */}
                    <Paper sx={{ mb: 4, borderRadius: 4, overflow: 'hidden' }}>
                        <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="h6" fontWeight="bold">Trade History</Typography>
                            <Chip label={`${filteredTrades.length} Trades`} size="small" />
                        </Box>
                        <TableContainer sx={{ maxHeight: 600 }}>
                            <Table stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Date</TableCell>
                                        <TableCell>Side</TableCell>
                                        <TableCell>Setup</TableCell>
                                        <TableCell align="right">Quantity</TableCell>
                                        <TableCell align="right">Entry</TableCell>
                                        <TableCell align="right">Exit</TableCell>
                                        <TableCell align="right">P/L</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {filteredTrades.map((trade) => (
                                        <TableRow key={trade.id} hover>
                                            <TableCell>{new Date(trade.date).toLocaleDateString()}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={trade.side}
                                                    color={trade.side === 'Buy' ? 'success' : 'error'}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{ fontWeight: 'bold' }}
                                                />
                                            </TableCell>
                                            <TableCell>{trade.strategy || '-'}</TableCell>
                                            <TableCell align="right">{trade.quantity}</TableCell>
                                            <TableCell align="right">{trade.entryPrice}</TableCell>
                                            <TableCell align="right">{trade.exitPrice}</TableCell>
                                            <TableCell align="right">
                                                <Typography
                                                    fontWeight="bold"
                                                    color={(trade.pnl || 0) >= 0 ? 'success.main' : 'error.main'}
                                                >
                                                    {formatCurrency(trade.pnl || 0)}
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredTrades.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} align="center" sx={{ py: 8, color: 'text.secondary' }}>
                                                No trades found for {selectedTicker} in this range.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                </>
            )}
        </Box>
    );
};

interface MetricCardProps {
    label: string;
    value: string;
    subtext?: string;
    trend?: 'up' | 'down';
    highlight?: boolean;
}

const MetricCard = ({ label, value, subtext, trend, highlight }: MetricCardProps) => (
    <Card variant="outlined" sx={{ height: '100%', borderRadius: 3 }}>
        <CardContent>
            <Typography variant="overline" color="text.secondary" fontWeight="bold" letterSpacing={1}>
                {label}
            </Typography>
            <Typography
                variant="h4"
                fontWeight="900"
                sx={{ mt: 1 }}
                color={highlight ? (trend === 'up' || (!trend && !label.includes('Loss')) ? 'success.main' : 'error.main') : 'text.primary'}
            >
                {value}
            </Typography>
            {subtext && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontWeight: 'medium' }}>{subtext}</Typography>}
        </CardContent>
    </Card>
);
