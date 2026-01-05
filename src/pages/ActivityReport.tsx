import { useState, useMemo } from 'react';

import {
    Box,
    Typography,
    Paper,
    Grid,
    Card,
    CardContent,
    Stack,
    Button,
    IconButton,
    Select,
    MenuItem,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    CircularProgress,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TableSortLabel,
    Tooltip
} from '@mui/material';
import {
    CloudUpload,
    Download,
    Trash2,
    FileText,
    TrendingUp,
    DollarSign,
    ChevronRight,
    BarChart3,
    PieChart,
    CloudCheck,
    CloudOff
} from 'lucide-react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip as ChartTooltip,
    Legend
} from 'chart.js';
import { Bar, Chart, Doughnut } from 'react-chartjs-2';

// import { db } from '../db/db'; // Removed
import { useAuth } from '../context/AuthContext';
import { useAccount } from '../context/AccountContext';
import { formatCurrency } from '../utils/calculations';
import { documentService } from '../services/DocumentService';
import { importFromCsv } from '../utils/importExport';
import type { StoredDocument } from '../types/document';
// import { expenseDb } from '../db/expenseDb'; // Removed
import { DEFAULT_EXPENSE_CATEGORIES } from '../types/expenseTypes';
import { useTrades } from '../context/TradesContext';
import { useFirestoreDocuments } from '../hooks/useFirestoreDocuments';
import { useFirestoreExpenses } from '../hooks/useFirestoreExpenses';


// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    ChartTooltip,
    Legend
);

// Helper to get week number
function getWeekNumber(d: Date): number {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Premium color palette for chart series (Vibrant & Distinct)
const CHART_COLORS = [
    '#4361ee', // Bright Blue
    '#3a0ca3', // Deep Purple
    '#7209b7', // Vibrant Violet
    '#f72585', // Hot Pink
    '#4cc9f0', // Cyan
    '#2ec4b6', // Teal
    '#ff9f1c', // Orange
    '#e71d36', // Red
    '#011627', // Dark Blue
    '#ffc8dd', // Soft Pink (for contrast)
    '#bde0fe', // Light Blue
    '#a2d2ff'  // Baby Blue
];

// ... imports
import { useMarketData } from '../context/MarketDataContext';

// ... class definition
export function ActivityReport() {
    const { user } = useAuth();
    const { selectedAccount } = useAccount();
    const { prices } = useMarketData();

    const [year, setYear] = useState(new Date().getFullYear());
    const [selectedPeriod, setSelectedPeriod] = useState(new Date().getMonth() + 1);
    const [periodType, setPeriodType] = useState<'year' | 'month' | 'week'>('month');
    const [drillDownOpen, setDrillDownOpen] = useState(false);
    const [drillDownSymbol, setDrillDownSymbol] = useState<string | null>(null);
    const [othersDrillDownOpen, setOthersDrillDownOpen] = useState(false);

    // File Upload State
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<string>('');
    const [uploadError, setUploadError] = useState<string | null>(null);

    // Fetch Trades
    const { trades: rawTrades } = useTrades();

    // Fetch Documents
    const { documents: allDocuments } = useFirestoreDocuments();
    const documents = useMemo(() => {
        if (!selectedAccount) return [];
        return allDocuments.filter(d => d.accountId === selectedAccount);
    }, [allDocuments, selectedAccount]);

    // Fetch Expenses (for Personal Account)
    const { expenses: allExpenses } = useFirestoreExpenses();
    const rawExpenses = useMemo(() => {
        if (!selectedAccount || selectedAccount !== 'PERSONAL') return [];
        return allExpenses.filter(e => e.accountId === selectedAccount);
    }, [allExpenses, selectedAccount]);

    // Filter Trades by Period
    const filteredTrades = useMemo(() => {
        if (!rawTrades) return [];
        return rawTrades.filter(t => {
            const d = t.date;
            if (d.getFullYear() !== year) return false;
            if (periodType === 'month' && d.getMonth() + 1 !== selectedPeriod) return false;
            if (periodType === 'week' && getWeekNumber(d) !== selectedPeriod) return false;
            return t.side === 'Buy';
        });
    }, [rawTrades, year, periodType, selectedPeriod]);

    // Group by Symbol (reportData)
    const reportData = useMemo(() => {
        const groups: Record<string, { symbol: string, count: number, qtyAdded: number, invested: number, avgPrice: number }> = {};

        filteredTrades.forEach(t => {
            if (!groups[t.symbol]) {
                groups[t.symbol] = { symbol: t.symbol, count: 0, qtyAdded: 0, invested: 0, avgPrice: 0 };
            }
            groups[t.symbol].count++;
            groups[t.symbol].qtyAdded += t.quantity;
            groups[t.symbol].invested += (t.entryPrice * t.quantity) + (t.fees || 0);
        });

        // Calculate avgPrice and convert to array
        return Object.values(groups).map(g => ({
            ...g,
            avgPrice: g.invested / g.qtyAdded
        })).sort((a, b) => b.invested - a.invested);
    }, [filteredTrades]);

    // Sort Config state (missing)
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'invested', direction: 'desc' });

    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    // Chart Options & Data (missing)
    const chartOptions = {
        responsive: true,
        plugins: {
            legend: { display: false },
            title: { display: false }
        },
        scales: {
            y: { display: false },
            x: { grid: { display: false } }
        }
    };

    const chartData = useMemo(() => {
        // Basic placeholder for the Monthly Capital Allocation chart
        // If we need real data, we need to iterate filteredTrades or rawTrades.
        // Let's assume standard accumulation distribution per month.
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        // ... implementation of chart data ...
        // For now, let's keep it simple or check if it was used below.
        // The render uses chartData.
        // Let's implement a simple version based on rawTrades for the selected year.
        if (!rawTrades) return null;

        const monthlyInvested = new Array(12).fill(0);
        rawTrades.filter(t => t.date.getFullYear() === year && t.side === 'Buy').forEach(t => {
            monthlyInvested[t.date.getMonth()] += (t.entryPrice * t.quantity);
        });

        return {
            labels: months,
            datasets: [{
                label: 'Invested',
                data: monthlyInvested,
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }]
        };
    }, [rawTrades, year]);

    // Allocation Data (Doughnut)
    const doughnutOptions = {
        responsive: true,
        plugins: { legend: { position: 'right' as const } }
    };

    const allocationData = useMemo(() => {
        // Top 5 holdings + Others
        const othersThreshold = 5;
        const sorted = [...reportData].sort((a, b) => b.invested - a.invested);
        const top = sorted.slice(0, othersThreshold);
        const others = sorted.slice(othersThreshold);

        const labels = top.map(t => t.symbol);
        const data = top.map(t => t.invested);
        const bgColors = CHART_COLORS.slice(0, top.length);

        if (others.length > 0) {
            labels.push('Others');
            data.push(others.reduce((acc, c) => acc + c.invested, 0));
            bgColors.push('#9ca3af'); // Gray for others
        }

        return {
            labels,
            datasets: [{
                data,
                backgroundColor: bgColors,
                borderWidth: 0
            }]
        };
    }, [reportData]);

    // Drill down logic helpers
    const othersItems = useMemo(() => {
        const othersThreshold = 5;
        const sorted = [...reportData].sort((a, b) => b.invested - a.invested);
        return sorted.slice(othersThreshold);
    }, [reportData]);

    const drillDownTrades = useMemo(() => {
        if (!drillDownSymbol) return [];
        return filteredTrades.filter(t => t.symbol === drillDownSymbol).sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [filteredTrades, drillDownSymbol]);

    // Calculate Summary Stats (Updated to include Unrealized PnL)
    const summary = useMemo(() => {
        const totalInvested = reportData.reduce((acc, curr) => acc + curr.invested, 0);
        const totalTx = reportData.reduce((acc, curr) => acc + curr.count, 0);
        const totalFees = filteredTrades.reduce((acc, t) => acc + (t.fees || 0), 0);

        // Calculate Unrealized PnL for Open trades in this period
        let unrealizedPnL = 0;
        filteredTrades.filter(t => t.status === 'Open').forEach(t => {
            if (t.symbol) {
                const marketData = prices[t.symbol.toUpperCase()];
                if (marketData) {
                    const currentDiff = marketData.price - t.entryPrice;
                    const tradePnL = t.side === 'Buy'
                        ? currentDiff * t.quantity
                        : -currentDiff * t.quantity;
                    unrealizedPnL += tradePnL;
                }
            }
        });

        return { totalInvested, totalTx, totalFees, unrealizedPnL };
    }, [reportData, filteredTrades, prices]);

    // NEW: Calculate Strategy Performance (Win Rate & PnL)
    const strategyStats = useMemo(() => {
        if (!rawTrades) return [];

        // 1. Filter for Closed trades with a Strategy
        const closedTrades = rawTrades.filter(t => t.status === 'Closed' && t.strategy);

        // 2. Group by Strategy
        const groupByStrategy: Record<string, {
            strategy: string,
            wins: number,
            losses: number,
            total: number,
            pnl: number
        }> = {};

        closedTrades.forEach(t => {
            const s = t.strategy!;
            if (!groupByStrategy[s]) {
                groupByStrategy[s] = { strategy: s, wins: 0, losses: 0, total: 0, pnl: 0 };
            }
            groupByStrategy[s].total += 1;
            groupByStrategy[s].pnl += (t.pnl || 0);
            if ((t.pnl || 0) > 0) groupByStrategy[s].wins += 1;
            else groupByStrategy[s].losses += 1;
        });

        // 3. Convert to Array and Sort by PnL
        return Object.values(groupByStrategy).sort((a, b) => b.pnl - a.pnl);
    }, [rawTrades]);

    // Chart Data for Strategy Performance
    const strategyChartData = useMemo(() => {
        const labels = strategyStats.map(s => s.strategy);
        const pnlData = strategyStats.map(s => s.pnl);
        const winRateData = strategyStats.map(s => (s.wins / s.total) * 100);

        return {
            labels,
            datasets: [
                {
                    type: 'bar' as const,
                    label: 'Net PnL ($)',
                    data: pnlData,
                    backgroundColor: pnlData.map(v => v >= 0 ? '#10B981' : '#EF4444'),
                    order: 2,
                    yAxisID: 'y'
                },
                {
                    type: 'line' as const,
                    label: 'Win Rate (%)',
                    data: winRateData,
                    borderColor: '#3B82F6',
                    borderWidth: 2,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#3B82F6',
                    pointRadius: 4,
                    order: 1,
                    yAxisID: 'y1'
                }
            ]
        };
    }, [strategyStats]);

    // --- EXPENSE ANALYTICS (Personal Account) ---

    // Filter Expenses by Period
    const filteredExpenses = useMemo(() => {
        if (!rawExpenses) return [];
        return rawExpenses.filter(e => {
            const d = e.date;
            if (d.getFullYear() !== year) return false;
            if (periodType === 'month' && d.getMonth() + 1 !== selectedPeriod) return false;
            if (periodType === 'week' && getWeekNumber(d) !== selectedPeriod) return false;
            return true;
        });
    }, [rawExpenses, year, periodType, selectedPeriod]);

    // Expense Summary Stats
    const expenseSummary = useMemo(() => {
        const totalSpent = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
        const totalTx = filteredExpenses.length;
        const avgTx = totalTx > 0 ? totalSpent / totalTx : 0;
        return { totalSpent, totalTx, avgTx };
    }, [filteredExpenses]);

    // Expense Category Breakdown (Pie Chart)
    const expenseCategoryData = useMemo(() => {
        const categoryMap = new Map<string, number>();
        filteredExpenses.forEach(e => {
            const current = categoryMap.get(e.category) || 0;
            categoryMap.set(e.category, current + e.amount);
        });

        const sortedIds = Array.from(categoryMap.keys()).sort((a, b) => (categoryMap.get(b) || 0) - (categoryMap.get(a) || 0));

        const labels = sortedIds.map(id => DEFAULT_EXPENSE_CATEGORIES.find(c => c.id === id)?.name || id);
        const data = sortedIds.map(id => categoryMap.get(id) || 0);
        const bgColors = sortedIds.map(id => DEFAULT_EXPENSE_CATEGORIES.find(c => c.id === id)?.color || '#9ca3af');

        return {
            labels,
            datasets: [{
                data,
                backgroundColor: bgColors,
                borderWidth: 0
            }]
        };
    }, [filteredExpenses]);

    // Expense Monthly Trend (Bar Chart) - For the selected year
    const expenseTrendData = useMemo(() => {
        if (!rawExpenses) return null;

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthlyData = new Array(12).fill(0);

        rawExpenses.filter(e => e.date.getFullYear() === year).forEach(e => {
            monthlyData[e.date.getMonth()] += e.amount;
        });

        return {
            labels: months,
            datasets: [{
                label: 'Monthly Spending',
                data: monthlyData,
                backgroundColor: '#EF4444',
                borderRadius: 4
            }]
        };
    }, [rawExpenses, year]);

    // Handlers
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0] || !user || !selectedAccount) return;
        const file = e.target.files[0];

        setIsUploading(true);
        setUploadStatus('Importing trades locally...');
        setUploadError(null);

        try {
            // 1. Import Data to Trades
            // We use 'auto' broker detection
            // Adding a small timeout to allow UI to render the 'loading' state
            await new Promise(r => setTimeout(r, 100));

            const result = await importFromCsv(file, 'auto', selectedAccount, user.uid);

            if (result.success === 0 && result.failed > 0) {
                throw new Error('No valid trades found in file.');
            }

            // 2. Upload Document to Storage
            setUploadStatus('Syncing file to cloud...');

            // Timeout race wrapper to prevent infinite loading
            const uploadPromise = documentService.uploadDocument(user.uid, selectedAccount, file);

            // We don't reject on timeout anymore, we just proceed with a warning/info state
            const timeoutPromise = new Promise((resolve) =>
                setTimeout(() => resolve('TIMEOUT'), 15000)
            );

            const raceResult = await Promise.race([uploadPromise, timeoutPromise]);

            // 3. Success Message
            if (raceResult === 'TIMEOUT') {
                alert(`Imported ${result.success} trades. File saved locally (Cloud sync continues in background).`);
            } else {
                alert(`Imported ${result.success} trades and verified cloud sync.`);
            }
        } catch (err) {
            console.error(err);
            setUploadError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setIsUploading(false);
            setUploadStatus('');
            // Clear input
            e.target.value = '';
        }
    };

    const handleDownload = async (doc: StoredDocument) => {
        try {
            const url = await documentService.getDownloadUrl(doc.storagePath);
            window.open(url, '_blank');
        } catch {
            alert('Error downloading file');
        }
    };

    const handleDeleteDoc = async (doc: StoredDocument) => {
        if (!confirm(`Delete ${doc.name}? This will NOT delete the imported trades, only the file record.`)) return;
        if (!doc.id || !user) return;
        try {
            await documentService.deleteDocument(doc.id, doc.storagePath, user.uid);
        } catch {
            alert('Error deleting file');
        }
    };

    const openDrillDown = (symbol: string) => {
        setDrillDownSymbol(symbol);
        setDrillDownOpen(true);
    };

    const months = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: new Date(0, i).toLocaleString('default', { month: 'long' }) }));
    const weeks = Array.from({ length: 52 }, (_, i) => i + 1);

    return (
        <Box sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column', gap: 3 }}>

            {/* Header & Controls */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="h4" fontWeight="bold">Activity Report</Typography>

                <Stack direction="row" spacing={2} alignItems="center" sx={{ overflowX: 'auto', maxWidth: '100%', pb: 1 }}>
                    <Select
                        size="small"
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        sx={{ minWidth: 100, bgcolor: 'background.paper' }}
                    >
                        {[2023, 2024, 2025, 2026].map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                    </Select>

                    <Select
                        size="small"
                        value={periodType}
                        onChange={(e) => setPeriodType(e.target.value as 'year' | 'month' | 'week')}
                        sx={{ minWidth: 100, bgcolor: 'background.paper' }}
                    >
                        <MenuItem value="year">Yearly</MenuItem>
                        <MenuItem value="month">Monthly</MenuItem>
                        <MenuItem value="week">Weekly</MenuItem>
                    </Select>

                    {periodType !== 'year' && (
                        <Select
                            size="small"
                            value={selectedPeriod}
                            onChange={(e) => setSelectedPeriod(Number(e.target.value))}
                            sx={{ minWidth: 120, bgcolor: 'background.paper' }}
                        >
                            {periodType === 'month'
                                ? months.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)
                                : weeks.map(w => <MenuItem key={w} value={w}>Week {w}</MenuItem>)
                            }
                        </Select>
                    )}
                </Stack>
            </Box>

            {/* Summary Cards */}
            {selectedAccount === 'PERSONAL' ? (
                // --- EXPENSE SUMMARY CARDS ---
                <Grid container spacing={3}>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Card sx={{ bgcolor: 'secondary.soft', border: '1px solid', borderColor: 'secondary.main', height: '100%' }}>
                            <CardContent>
                                <Stack direction="row" alignItems="center" gap={2}>
                                    <Box sx={{ p: 1.5, borderRadius: '50%', bgcolor: 'secondary.main', color: 'white' }}>
                                        <DollarSign size={24} />
                                    </Box>
                                    <Box>
                                        <Typography variant="body2" color="text.secondary">Total Spent</Typography>
                                        <Typography variant="h5" fontWeight="bold">{formatCurrency(expenseSummary.totalSpent)}</Typography>
                                    </Box>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Card sx={{ bgcolor: 'warning.soft', border: '1px solid', borderColor: 'warning.main', height: '100%' }}>
                            <CardContent>
                                <Stack direction="row" alignItems="center" gap={2}>
                                    <Box sx={{ p: 1.5, borderRadius: '50%', bgcolor: 'warning.main', color: 'white' }}>
                                        <TrendingUp size={24} />
                                    </Box>
                                    <Box>
                                        <Typography variant="body2" color="text.secondary">Transactions</Typography>
                                        <Typography variant="h5" fontWeight="bold">{expenseSummary.totalTx}</Typography>
                                    </Box>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Card sx={{ bgcolor: 'info.soft', border: '1px solid', borderColor: 'info.main', height: '100%' }}>
                            <CardContent>
                                <Stack direction="row" alignItems="center" gap={2}>
                                    <Box sx={{ p: 1.5, borderRadius: '50%', bgcolor: 'info.main', color: 'white' }}>
                                        <BarChart3 size={24} />
                                    </Box>
                                    <Box>
                                        <Typography variant="body2" color="text.secondary">Avg. Transaction</Typography>
                                        <Typography variant="h5" fontWeight="bold">{formatCurrency(expenseSummary.avgTx)}</Typography>
                                    </Box>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            ) : (
                // --- EXISTING TRADE SUMMARY CARDS ---
                <Grid container spacing={3}>
                    <Grid size={{ xs: 12, md: 3 }}>
                        <Card sx={{ bgcolor: 'primary.soft', border: '1px solid', borderColor: 'primary.main', height: '100%' }}>
                            <CardContent>
                                <Stack direction="row" alignItems="center" gap={2}>
                                    <Box sx={{ p: 1.5, borderRadius: '50%', bgcolor: 'primary.main', color: 'white' }}>
                                        <DollarSign size={24} />
                                    </Box>
                                    <Box>
                                        <Typography variant="body2" color="text.secondary">Total Invested</Typography>
                                        <Typography variant="h5" fontWeight="bold">{formatCurrency(summary.totalInvested)}</Typography>
                                    </Box>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                        <Card sx={{ bgcolor: 'emerald.soft', border: '1px solid', borderColor: 'emerald.main', height: '100%' }}>
                            <CardContent>
                                <Stack direction="row" alignItems="center" gap={2}>
                                    <Box sx={{ p: 1.5, borderRadius: '50%', bgcolor: 'emerald.main', color: 'white' }}>
                                        <TrendingUp size={24} />
                                    </Box>
                                    <Box>
                                        <Typography variant="body2" color="text.secondary">Transactions</Typography>
                                        <Typography variant="h5" fontWeight="bold">{summary.totalTx}</Typography>
                                    </Box>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                        <Card sx={{ bgcolor: 'orange.soft', border: '1px solid', borderColor: 'orange.main', height: '100%' }}>
                            <CardContent>
                                <Stack direction="row" alignItems="center" gap={2}>
                                    <Box sx={{ p: 1.5, borderRadius: '50%', bgcolor: 'orange.main', color: 'white' }}>
                                        <DollarSign size={24} />
                                    </Box>
                                    <Box>
                                        <Typography variant="body2" color="text.secondary">Total Fees Paid</Typography>
                                        <Typography variant="h5" fontWeight="bold">{formatCurrency(summary.totalFees)}</Typography>
                                    </Box>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                        <Card sx={{ bgcolor: 'indigo.soft', border: '1px solid', borderColor: 'indigo.main', height: '100%' }}>
                            <CardContent>
                                <Stack direction="row" alignItems="center" gap={2}>
                                    <Box sx={{ p: 1.5, borderRadius: '50%', bgcolor: 'indigo.main', color: 'white' }}>
                                        <TrendingUp size={24} />
                                    </Box>
                                    <Box>
                                        <Typography variant="body2" color="text.secondary">Unrealized PnL</Typography>
                                        <Typography
                                            variant="h5"
                                            fontWeight="bold"
                                            color={summary.unrealizedPnL >= 0 ? 'success.main' : 'error.main'}
                                        >
                                            {summary.unrealizedPnL > 0 ? '+' : ''}{formatCurrency(summary.unrealizedPnL)}
                                        </Typography>
                                    </Box>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}

            {/* Main Content Area: Split View */}
            <Grid container spacing={3} sx={{ flexGrow: 1, minHeight: 0 }}>
                {/* Strategy Analytics Section */}
                {/* Main Content Area: Split View */}
                {selectedAccount === 'PERSONAL' ? (
                    // --- EXPENSE CHARTS ---
                    <Grid size={{ xs: 12 }}>
                        <Grid container spacing={3}>
                            {/* Monthly Spending Trend */}
                            <Grid size={{ xs: 12, md: 8 }}>
                                <Paper sx={{ p: 3, mb: 3 }}>
                                    <Typography variant="h6" fontWeight="bold" gutterBottom>Monthly Spending Trend</Typography>
                                    <Box sx={{ height: 350 }}>
                                        {expenseTrendData && (
                                            <Bar
                                                data={expenseTrendData}
                                                options={{
                                                    responsive: true,
                                                    maintainAspectRatio: false,
                                                    scales: { y: { beginAtZero: true } },
                                                    plugins: {
                                                        legend: { display: false }
                                                    }
                                                }}
                                            />
                                        )}
                                    </Box>
                                </Paper>
                            </Grid>

                            {/* Category Breakdown */}
                            <Grid size={{ xs: 12, md: 4 }}>
                                <Paper sx={{ p: 3, mb: 3 }}>
                                    <Typography variant="h6" fontWeight="bold" gutterBottom>Category Breakdown</Typography>
                                    <Box sx={{ height: 350, display: 'flex', justifyContent: 'center' }}>
                                        <Doughnut
                                            data={expenseCategoryData}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: { legend: { position: 'right' } }
                                            }}
                                        />
                                    </Box>
                                </Paper>
                            </Grid>
                        </Grid>
                    </Grid>
                ) : (
                    // --- EXISTING STRATEGY ANALYTICS ---
                    <Grid size={{ xs: 12 }}>
                        <Paper sx={{ p: 3, mb: 3 }}>
                            <Stack direction="row" alignItems="center" gap={2} sx={{ mb: 3 }}>
                                <Box sx={{ p: 1, bgcolor: 'indigo.soft', borderRadius: '50%', color: 'indigo.main' }}>
                                    <BarChart3 size={20} />
                                </Box>
                                <Box>
                                    <Typography variant="h6" fontWeight="bold">Strategy Performance</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Analyze which setups are working best (Net PnL vs Win Rate)
                                    </Typography>
                                </Box>
                            </Stack>

                            {strategyStats.length > 0 ? (
                                <Box sx={{ height: 350 }}>
                                    <Chart
                                        type='bar'
                                        data={strategyChartData}
                                        options={{
                                            responsive: true,
                                            interaction: {
                                                mode: 'index' as const,
                                                intersect: false,
                                            },
                                            plugins: {
                                                legend: { position: 'top' as const },
                                                tooltip: {
                                                    callbacks: {
                                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                        label: function (context: any) {
                                                            const label = context.dataset.label || '';
                                                            const value = context.parsed.y;
                                                            if (context.dataset.yAxisID === 'y1') {
                                                                return `${label}: ${value.toFixed(1)}%`;
                                                            }
                                                            return `${label}: ${formatCurrency(value)}`;
                                                        }
                                                    }
                                                }
                                            },
                                            scales: {
                                                y: {
                                                    type: 'linear' as const,
                                                    display: true,
                                                    position: 'left' as const,
                                                    title: { display: true, text: 'Net PnL ($)' },
                                                    grid: { display: true }
                                                },
                                                y1: {
                                                    type: 'linear' as const,
                                                    display: true,
                                                    position: 'right' as const,
                                                    title: { display: true, text: 'Win Rate (%)' },
                                                    min: 0,
                                                    max: 100,
                                                    grid: { display: false }
                                                },
                                                x: {
                                                    grid: { display: false }
                                                }
                                            }
                                        }}
                                    />
                                </Box>
                            ) : (
                                <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary', bgcolor: 'background.default', borderRadius: 2 }}>
                                    <Typography>No strategy data available.</Typography>
                                    <Typography variant="caption">Tag your trades with a Strategy to see analytics here.</Typography>
                                </Box>
                            )}
                        </Paper>
                    </Grid>
                )}

                {/* Left: Documents Manager */}
                <Grid size={{ xs: 12, md: 4 }}>
                    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        {/* ... (Documents content remains the same, assuming it's inside here, but I just replaced the header) */}
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                            <Typography variant="h6" fontWeight="bold">Uploaded Files</Typography>
                            <Button
                                component="label"
                                variant="contained"
                                startIcon={isUploading ? <CircularProgress size={20} color="inherit" /> : <CloudUpload size={18} />}
                                disabled={isUploading}
                                size="small"
                            >
                                {isUploading ? 'Processing...' : 'Upload Report'}
                                <input type="file" hidden accept=".csv,.txt" onChange={handleFileUpload} />
                            </Button>
                        </Stack>

                        {isUploading && (
                            <Alert severity="info" sx={{ mb: 2 }}>
                                {uploadStatus}
                            </Alert>
                        )}

                        {uploadError && (
                            <Alert severity="error" sx={{ mb: 2 }}>{uploadError}</Alert>
                        )}

                        <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                            {documents && documents.length > 0 ? (
                                <Stack spacing={1}>
                                    {documents.map(doc => (
                                        <Card key={doc.id} variant="outlined" sx={{ p: 1.5 }}>
                                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                                                <Stack direction="row" alignItems="center" gap={1.5}>
                                                    <FileText size={20} className="text-gray-500" />
                                                    <Box>
                                                        <Stack direction="row" alignItems="center" gap={1}>
                                                            <Typography variant="subtitle2" noWrap sx={{ maxWidth: 180 }}>
                                                                {doc.name}
                                                            </Typography>
                                                            {doc.synced ? (
                                                                <Tooltip title="Synced to Firebase Cloud">
                                                                    <CloudCheck size={14} color="#10B981" />
                                                                </Tooltip>
                                                            ) : (
                                                                <Tooltip title="Local Only (Upload Pending/Failed)">
                                                                    <CloudOff size={14} color="#F59E0B" />
                                                                </Tooltip>
                                                            )}
                                                        </Stack>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {new Date(doc.createdAt).toLocaleDateString()} • {(doc.size / 1024).toFixed(1)} KB
                                                        </Typography>
                                                        <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: '0.65rem', mt: 0.5, wordBreak: 'break-all' }}>
                                                            📍 {doc.storagePath}
                                                        </Typography>
                                                    </Box>
                                                </Stack>
                                                <Stack direction="row">
                                                    <IconButton size="small" onClick={() => handleDownload(doc)} color="primary">
                                                        <Download size={16} />
                                                    </IconButton>
                                                    <IconButton size="small" onClick={() => handleDeleteDoc(doc)} color="error">
                                                        <Trash2 size={16} />
                                                    </IconButton>
                                                </Stack>
                                            </Stack>
                                        </Card>
                                    ))}
                                </Stack>
                            ) : (
                                <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                                    <CloudUpload size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
                                    <Typography>No uploaded reports yet.</Typography>
                                    <Typography variant="caption">Upload your broker CSVs to see them here.</Typography>
                                </Box>
                            )}
                        </Box>
                    </Paper>
                </Grid>

                {/* Right: Data Table */}
                <Grid size={{ xs: 12, md: 8 }}>
                    <Paper sx={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        {selectedAccount === 'PERSONAL' ? (
                            // --- EXPENSE TABLE ---
                            <TableContainer sx={{ flexGrow: 1 }}>
                                <Table stickyHeader size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Category</TableCell>
                                            <TableCell align="right">Transactions</TableCell>
                                            <TableCell align="right">Total Spent</TableCell>
                                            <TableCell align="right">% of Total</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {(() => {
                                            // Re-calculate category data for table rows
                                            const categoryMap = new Map<string, { amount: number, count: number }>();
                                            filteredExpenses.forEach(e => {
                                                const current = categoryMap.get(e.category) || { amount: 0, count: 0 };
                                                categoryMap.set(e.category, { amount: current.amount + e.amount, count: current.count + 1 });
                                            });

                                            const sortedIds = Array.from(categoryMap.keys()).sort((a, b) => (categoryMap.get(b)?.amount || 0) - (categoryMap.get(a)?.amount || 0));
                                            const grandTotal = Array.from(categoryMap.values()).reduce((sum, v) => sum + v.amount, 0);

                                            if (sortedIds.length === 0) {
                                                return (
                                                    <TableRow>
                                                        <TableCell colSpan={4} align="center" sx={{ py: 8, color: 'text.secondary' }}>
                                                            No expenses found for this period.
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            }

                                            return sortedIds.map(id => {
                                                const data = categoryMap.get(id);
                                                if (!data) return null;
                                                const cat = DEFAULT_EXPENSE_CATEGORIES.find(c => c.id === id);
                                                const pct = grandTotal > 0 ? (data.amount / grandTotal) * 100 : 0;

                                                return (
                                                    <TableRow key={id} hover>
                                                        <TableCell sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            {/* We could render the icon here if we had a mapping component, simpler to just use color dot */}
                                                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: cat?.color || '#9ca3af' }} />
                                                            <Typography variant="body2" fontWeight="bold">{cat?.name || id}</Typography>
                                                        </TableCell>
                                                        <TableCell align="right">{data.count}</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(data.amount)}</TableCell>
                                                        <TableCell align="right">{pct.toFixed(1)}%</TableCell>
                                                    </TableRow>
                                                );
                                            });
                                        })()}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            // --- TRADE TABLE ---
                            <TableContainer sx={{ flexGrow: 1 }}>
                                <Table stickyHeader size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>
                                                <TableSortLabel
                                                    active={sortConfig.key === 'symbol'}
                                                    direction={sortConfig.key === 'symbol' ? sortConfig.direction : 'asc'}
                                                    onClick={() => handleSort('symbol')}
                                                >
                                                    Symbol
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell align="right">
                                                <TableSortLabel
                                                    active={sortConfig.key === 'count'}
                                                    direction={sortConfig.key === 'count' ? sortConfig.direction : 'asc'}
                                                    onClick={() => handleSort('count')}
                                                >
                                                    Buys Count
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell align="right">
                                                <TableSortLabel
                                                    active={sortConfig.key === 'qtyAdded'}
                                                    direction={sortConfig.key === 'qtyAdded' ? sortConfig.direction : 'asc'}
                                                    onClick={() => handleSort('qtyAdded')}
                                                >
                                                    Qty Added
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell align="right">
                                                <TableSortLabel
                                                    active={sortConfig.key === 'avgPrice'}
                                                    direction={sortConfig.key === 'avgPrice' ? sortConfig.direction : 'asc'}
                                                    onClick={() => handleSort('avgPrice')}
                                                >
                                                    Avg Price
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell align="right">
                                                <TableSortLabel
                                                    active={sortConfig.key === 'invested'}
                                                    direction={sortConfig.key === 'invested' ? sortConfig.direction : 'asc'}
                                                    onClick={() => handleSort('invested')}
                                                >
                                                    Total Invested
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell align="right">Last Price</TableCell>
                                            <TableCell align="right">PnL</TableCell>
                                            <TableCell padding="checkbox"></TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {reportData.map((row) => {
                                            const currentPrice = prices[row.symbol.toUpperCase()]?.price || 0;
                                            const currentValue = currentPrice * row.qtyAdded;
                                            const pnl = currentPrice ? (currentValue - row.invested) : 0;
                                            return (
                                                <TableRow
                                                    key={row.symbol}
                                                    hover
                                                    onClick={() => openDrillDown(row.symbol)}
                                                    sx={{ cursor: 'pointer' }}
                                                >
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight="bold">
                                                            {row.symbol}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="right">{row.count}</TableCell>
                                                    <TableCell align="right">
                                                        <Chip label={row.qtyAdded.toFixed(4)} size="small" variant="outlined" />
                                                    </TableCell>
                                                    <TableCell align="right">{formatCurrency(row.avgPrice)}</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                                        {formatCurrency(row.invested)}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {currentPrice ? formatCurrency(currentPrice) : '-'}
                                                    </TableCell>
                                                    <TableCell align="right" sx={{
                                                        fontWeight: 'bold',
                                                        color: pnl >= 0 ? 'success.main' : 'error.main'
                                                    }}>
                                                        {currentPrice ? formatCurrency(pnl) : '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <ChevronRight size={16} className="text-gray-400" />
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                        {reportData.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                                                    <Typography color="text.secondary">
                                                        No purchases found for this period.
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Paper>
                </Grid>

                {/* NEW: Charts Row (Split) - Hide for Personal Account as we already showed charts above */}
                {selectedAccount !== 'PERSONAL' && (
                    <>
                        <Grid size={{ xs: 12, md: 8 }}>
                            <Paper sx={{ p: 3, height: '100%' }}>
                                <Stack direction="row" alignItems="center" gap={2} sx={{ mb: 2 }}>
                                    <Box sx={{ p: 1, bgcolor: 'primary.soft', borderRadius: '50%', color: 'primary.main' }}>
                                        <BarChart3 size={20} />
                                    </Box>
                                    <Typography variant="h6" fontWeight="bold">Monthly Capital Allocation</Typography>
                                </Stack>
                                <Box sx={{ height: 350 }}>
                                    {chartData ? (
                                        <Bar options={chartOptions} data={chartData} />
                                    ) : (
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                            <CircularProgress />
                                        </Box>
                                    )}
                                </Box>
                            </Paper>
                        </Grid>

                        <Grid size={{ xs: 12, md: 4 }}>
                            <Paper sx={{ p: 3, height: '100%' }}>
                                <Stack direction="row" alignItems="center" gap={2} sx={{ mb: 2 }}>
                                    <Box sx={{ p: 1, bgcolor: 'warning.soft', borderRadius: '50%', color: 'warning.main' }}>
                                        <PieChart size={20} />
                                    </Box>
                                    <Typography variant="h6" fontWeight="bold">Allocation</Typography>
                                </Stack>
                                <Box sx={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {reportData.length > 0 ? (
                                        <Doughnut options={doughnutOptions} data={allocationData} />
                                    ) : (
                                        <Typography color="text.secondary">No data</Typography>
                                    )}
                                </Box>
                            </Paper>
                        </Grid>
                    </>
                )}

                {/* NEW: Ticker Analysis Section */}
                {selectedAccount !== 'PERSONAL' && (
                    <Grid size={{ xs: 12 }}>
                        <Paper sx={{ p: 3 }}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
                                <Stack direction="row" alignItems="center" gap={2}>
                                    <Box sx={{ p: 1, bgcolor: 'secondary.soft', borderRadius: '50%', color: 'secondary.main' }}>
                                        <TrendingUp size={20} />
                                    </Box>
                                    <Typography variant="h6" fontWeight="bold">Ticker Accumulation Analysis</Typography>
                                </Stack>
                                <Select
                                    size="small"
                                    displayEmpty
                                    value={drillDownSymbol || ''}
                                    onChange={(e) => setDrillDownSymbol(e.target.value)}
                                    sx={{ minWidth: 200 }}
                                >
                                    <MenuItem value="" disabled>Select Ticker</MenuItem>
                                    {Array.from(new Set(rawTrades?.map(t => t.symbol))).sort().map(sym => (
                                        <MenuItem key={sym} value={sym}>{sym}</MenuItem>
                                    ))}
                                </Select>
                            </Stack>

                            {drillDownSymbol ? (
                                <Box sx={{ height: 400 }}>
                                    {(() => {
                                        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                        const symbolTrades = rawTrades?.filter(t => t.symbol === drillDownSymbol) || [];

                                        // Calculate Data: Net Invested Capital (Active Holdings)
                                        const monthlyGrowth: number[] = [];
                                        const cumulativeTotal: number[] = [];

                                        for (let i = 0; i < 12; i++) {
                                            // Define end of this month
                                            const monthEnd = new Date(year, i + 1, 0, 23, 59, 59); // Last second of the month

                                            // Filter trades that were ACTIVE at the end of this month
                                            // Criteria:
                                            // 1. Entered on or before this month end
                                            // 2. Status is Open OR (Status is Closed but Exit Date is AFTER this month end)
                                            const activeTrades = symbolTrades.filter(t => {
                                                const entryDate = new Date(t.date);
                                                const isEntered = entryDate <= monthEnd;

                                                if (!isEntered) return false;

                                                if (t.status === 'Open') return true;

                                                // If closed, check if it was closed AFTER this month
                                                if (t.exitDate) {
                                                    const exitDate = new Date(t.exitDate);
                                                    return exitDate > monthEnd;
                                                }

                                                return true; // Fallback (should have exitDate if closed)
                                            });

                                            // Calculate total invested capital for these active trades
                                            const totalInvested = activeTrades.reduce((sum, t) => sum + (t.entryPrice * t.quantity) + (t.fees || 0), 0);

                                            cumulativeTotal.push(totalInvested);

                                            // Calculate Growth % (Month over Month change in invested capital)
                                            // This is a bit tricky for "Growth". usually growth implies PnL.
                                            // But the chart label is "Monthly Growth %". 
                                            // If the user wants to see how much they *added* to the position:
                                            // Let's calculate the Net Change in Invested Capital
                                            const prevInv = i > 0 ? cumulativeTotal[i - 1] : 0;
                                            let changePct = 0;

                                            if (prevInv > 0) {
                                                changePct = ((totalInvested - prevInv) / prevInv) * 100;
                                            } else if (totalInvested > 0) {
                                                changePct = 100; // New position started
                                            }

                                            monthlyGrowth.push(changePct);
                                        }

                                        const drillDownChartData = {
                                            labels: months,
                                            datasets: [
                                                {
                                                    type: 'line' as const,
                                                    label: 'Total Invested (Cumulative)',
                                                    data: cumulativeTotal,
                                                    borderColor: '#10b981', // Emerald
                                                    backgroundColor: '#10b981',
                                                    borderWidth: 3,
                                                    tension: 0.3,
                                                    pointRadius: 4,
                                                    pointBackgroundColor: '#fff',
                                                    pointBorderWidth: 2,
                                                    yAxisID: 'y',
                                                    order: 1
                                                },
                                                {
                                                    type: 'bar' as const,
                                                    label: 'Monthly Growth %',
                                                    data: monthlyGrowth,
                                                    backgroundColor: 'rgba(59, 130, 246, 0.6)', // Blue transparent
                                                    borderColor: '#3b82f6',
                                                    borderWidth: 1,
                                                    yAxisID: 'y1',
                                                    order: 2
                                                }
                                            ]
                                        };

                                        const drillDownOptions = {
                                            responsive: true,
                                            interaction: {
                                                mode: 'index' as const,
                                                intersect: false,
                                            },
                                            plugins: {
                                                tooltip: {
                                                    callbacks: {
                                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                        label: function (context: any) {
                                                            let label = context.dataset.label || '';
                                                            if (label) label += ': ';

                                                            if (context.dataset.type === 'line') {
                                                                if (context.parsed.y !== null) {
                                                                    label += formatCurrency(context.parsed.y);
                                                                }
                                                            } else {
                                                                if (context.parsed.y !== null) {
                                                                    label += context.parsed.y.toFixed(1) + '%';
                                                                }
                                                            }
                                                            return label;
                                                        }
                                                    }
                                                }
                                            },
                                            scales: {
                                                y: {
                                                    type: 'linear' as const,
                                                    display: true,
                                                    position: 'left' as const,
                                                    title: { display: true, text: 'Total Value ($)' },
                                                    ticks: {
                                                        callback: (v: string | number) => {
                                                            const val = Number(v);
                                                            if (Math.abs(val) >= 1000) {
                                                                return '$' + (val / 1000).toFixed(1) + 'k';
                                                            }
                                                            return '$' + val;
                                                        }
                                                    },
                                                    grid: { display: false }
                                                },
                                                y1: {
                                                    type: 'linear' as const,
                                                    display: true,
                                                    position: 'right' as const,
                                                    title: { display: true, text: 'Monthly Growth (%)' },
                                                    ticks: { callback: (v: string | number) => v + '%' },
                                                    grid: { drawOnChartArea: true, color: '#f3f4f6' },
                                                },
                                            }
                                        };

                                        return <Chart type='bar' data={drillDownChartData} options={drillDownOptions} />;
                                    })()}
                                </Box>
                            ) : (
                                <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary', bgcolor: 'background.default', borderRadius: 2 }}>
                                    <Typography>Select a ticker from the dropdown to view its growth graph.</Typography>
                                </Box>
                            )}
                        </Paper>
                    </Grid>
                )}
            </Grid>

            {/* Drill Down Dialog */}
            <Dialog
                open={drillDownOpen}
                onClose={() => setDrillDownOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    {drillDownSymbol} - Purchase History
                    <Typography variant="subtitle2" color="text.secondary">
                        {periodType === 'year' ? year.toString() :
                            periodType === 'month' ? `${new Date(2024, selectedPeriod - 1).toLocaleString('default', { month: 'long' })} ${year}` :
                                `Week ${selectedPeriod}, ${year}`}
                    </Typography>
                </DialogTitle>
                <DialogContent dividers>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Date</TableCell>
                                    <TableCell align="right">Quantity</TableCell>
                                    <TableCell align="right">Price</TableCell>
                                    <TableCell align="right">Cost</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {drillDownTrades.map((t) => (
                                    <TableRow key={t.id}>
                                        <TableCell>{t.date.toLocaleDateString()}</TableCell>
                                        <TableCell align="right">{t.quantity}</TableCell>
                                        <TableCell align="right">{formatCurrency(t.entryPrice)}</TableCell>
                                        <TableCell align="right">{formatCurrency(t.entryPrice * t.quantity)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDrillDownOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Others Breakdown Dialog */}
            <Dialog
                open={othersDrillDownOpen}
                onClose={() => setOthersDrillDownOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Others - Portfolio Breakdown
                    <Typography variant="body2" color="text.secondary">
                        Small holdings not in top 5
                    </Typography>
                </DialogTitle>
                <DialogContent dividers>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Symbol</TableCell>
                                    <TableCell align="right">Invested</TableCell>
                                    <TableCell align="right">% of Others</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {othersItems.map((item) => {
                                    const totalOthers = othersItems.reduce((acc, curr) => acc + curr.invested, 0);
                                    return (
                                        <TableRow key={item.symbol} hover>
                                            <TableCell sx={{ fontWeight: 'bold' }}>{item.symbol}</TableCell>
                                            <TableCell align="right">{formatCurrency(item.invested)}</TableCell>
                                            <TableCell align="right">
                                                {((item.invested / totalOthers) * 100).toFixed(1)}%
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOthersDrillDownOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box >
    );
}


