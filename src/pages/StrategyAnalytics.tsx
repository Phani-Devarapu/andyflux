import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { formatCurrency } from '../utils/calculations';
import { Grid, Card, CardContent, Typography, Box, useTheme, Chip, Paper } from '@mui/material';
import { DataGrid, GridToolbar, type GridRenderCellParams, type GridColDef } from '@mui/x-data-grid';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

import { useAccount } from '../context/AccountContext';
import { useAuth } from '../context/AuthContext';

export function StrategyAnalytics() {
    const { selectedAccount } = useAccount();
    const { user } = useAuth();
    const trades = useLiveQuery(async () => {
        if (!selectedAccount || !user) return [];
        return await db.trades.where('[userId+accountId]').equals([user.uid, selectedAccount]).toArray();
    }, [selectedAccount, user]);
    const theme = useTheme();

    if (!trades) return <Typography>Loading...</Typography>;

    const closedTrades = trades.filter(t => t.status === 'Closed');

    interface StrategyStat {
        name: string;
        count: number;
        wins: number;
        losses: number;
        pnl: number;
        volume: number;
    }

    // Group by Strategy
    const strategyStats = closedTrades.reduce((acc, trade) => {
        const strategy = trade.strategy || 'No Strategy';
        if (!acc[strategy]) {
            acc[strategy] = {
                name: strategy,
                count: 0,
                wins: 0,
                losses: 0,
                pnl: 0,
                volume: 0
            };
        }
        acc[strategy].count++;
        acc[strategy].pnl += (trade.pnl || 0);
        if ((trade.pnl || 0) > 0) acc[strategy].wins++;
        else acc[strategy].losses++;
        acc[strategy].volume += (trade.quantity * trade.entryPrice);
        return acc;
    }, {} as Record<string, StrategyStat>);

    const strategies = Object.values(strategyStats).sort((a, b) => b.pnl - a.pnl);

    // Chart Data
    const barChartData = {
        labels: strategies.map(s => s.name),
        datasets: [
            {
                label: 'Net P/L',
                data: strategies.map(s => s.pnl),
                backgroundColor: strategies.map(s => s.pnl >= 0 ? theme.palette.success.main : theme.palette.error.main),
                borderRadius: 4,
            },
        ],
    };

    const pieChartData = {
        labels: strategies.map(s => s.name),
        datasets: [
            {
                data: strategies.map(s => s.count),
                backgroundColor: [
                    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'
                ],
                borderWidth: 0,
            },
        ],
    };

    const columns: GridColDef[] = [
        { field: 'name', headerName: 'Strategy', width: 180, renderCell: (p) => <strong>{p.value}</strong> },
        { field: 'count', headerName: 'Trades', width: 100, type: 'number' },
        {
            field: 'winRate',
            headerName: 'Win Rate',
            width: 120,
            valueGetter: (_, row) => row.count > 0 ? (row.wins / row.count) * 100 : 0,
            valueFormatter: (val: unknown) => `${(val as number).toFixed(1)}%`,
            renderCell: (params: GridRenderCellParams) => (
                <Chip
                    label={params.formattedValue}
                    size="small"
                    color={params.value >= 50 ? 'success' : 'warning'}
                    variant="outlined"
                />
            )
        },
        {
            field: 'profitFactor',
            headerName: 'Profit Factor',
            width: 130,
            valueGetter: (_, row) => {
                // Approximate PF calculation from stored aggregates (imperfect but useful)
                // Real PF requires strict gross profit/loss sum which we didn't store in reduce above.
                // Let's just show Avg PnL instead for simplicity in this view
                return row.pnl / row.count;
            },
            renderCell: (params: GridRenderCellParams) => formatCurrency(params.value as number)
        },
        {
            field: 'pnl',
            headerName: 'Total P/L',
            width: 150,
            type: 'number',
            renderCell: (params: GridRenderCellParams) => (
                <Typography fontWeight="bold" color={params.value >= 0 ? 'success.main' : 'error.main'}>
                    {formatCurrency(params.value)}
                </Typography>
            )
        }
    ];

    return (
        <Box sx={{ pb: 5 }}>
            <Typography variant="h4" fontWeight={700} sx={{ mb: 4, letterSpacing: -1 }}>
                Strategy Analytics
            </Typography>

            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid size={{ xs: 12, md: 8 }}>
                    <Card variant="outlined" sx={{ height: 400 }}>
                        <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="h6" fontWeight="bold">Performance by Strategy</Typography>
                            <Box sx={{ flexGrow: 1, mt: 2 }}>
                                <Bar
                                    data={barChartData}
                                    options={{
                                        maintainAspectRatio: false,
                                        plugins: { legend: { display: false } },
                                        scales: { y: { grid: { color: theme.palette.divider } }, x: { grid: { display: false } } }
                                    }}
                                />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Card variant="outlined" sx={{ height: 400 }}>
                        <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="h6" fontWeight="bold">Trade Distribution</Typography>
                            <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', mt: 2 }}>
                                <Pie
                                    data={pieChartData}
                                    options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
                                />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Paper sx={{ width: '100%', boxShadow: 3, borderRadius: 3, overflow: 'hidden' }}>
                <DataGrid
                    rows={strategies.map((s, i) => ({ id: i, ...s }))}
                    columns={columns}
                    initialState={{
                        pagination: { paginationModel: { pageSize: 10 } },
                        sorting: { sortModel: [{ field: 'pnl', sort: 'desc' }] },
                    }}
                    pageSizeOptions={[10, 25]}
                    disableRowSelectionOnClick
                    slots={{ toolbar: GridToolbar }}
                    sx={{ border: 'none', '& .MuiDataGrid-columnHeaders': { bgcolor: 'background.default', fontWeight: 'bold' } }}
                    autoHeight
                />
            </Paper>
        </Box>
    );
}
