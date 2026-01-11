import { useState, useRef } from 'react';
// db import removed
import { Link } from 'react-router-dom';
import {
    DataGrid,
    type GridColDef,
    type GridRenderCellParams,
    GridToolbar
} from '@mui/x-data-grid';
import {
    Box,
    Typography,
    Button,
    Chip,
    IconButton,
    Stack,
    Paper,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Alert,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon, CloudUpload, CloudDownload, Visibility } from '@mui/icons-material';
import { formatCurrency } from '../utils/calculations';
import { useAccount } from '../context/AccountContext';
import { useAuth } from '../context/AuthContext';
import type { BrokerName } from '../utils/brokerAdapters';
import { formatSymbolForDisplay, parseOptionSymbol } from '../utils/optionSymbolParser';
import { TradeDetailsDialog } from '../components/TradeDetailsDialog';
import type { Trade } from '../types/trade';
import { useMarketData } from '../context/MarketDataContext';
// ... imports
import { usePaginatedTrades } from '../hooks/usePaginatedTrades';

export function TradeList() {
    const { selectedAccount } = useAccount();
    const { user } = useAuth();
    const { prices } = useMarketData();

    // Removed paginationModel state
    const [csvImportOpen, setCsvImportOpen] = useState(false);
    const [selectedBroker, setSelectedBroker] = useState<BrokerName | 'auto'>('auto');
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [importStatus, setImportStatus] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
    const csvFileInputRef = useRef<HTMLInputElement>(null);
    const jsonFileInputRef = useRef<HTMLInputElement>(null);

    // Use Paginated Hook
    const { trades, loading: isLoading, error, deleteTrade, loadMore, hasMore } = usePaginatedTrades();

    // Total count is not available in cursor pagination without extra query. 
    // We can show "Loaded: X"

    // ... handleDelete (same) ...
    const handleDelete = async (id: number | string) => {
        if (!window.confirm('Are you sure you want to delete this trade?')) return;
        try {
            await deleteTrade(id.toString());
        } catch (err) {
            console.error("Delete failed", err);
            alert("Failed to delete trade");
        }
    };

    // ... columns (same) ...
    const columns: GridColDef[] = [
        {
            field: 'date',
            headerName: 'Entry Date',
            width: 120,
            valueFormatter: (value: unknown) => {
                if (!value) return '';
                const date = new Date(value as string);
                return date.toLocaleDateString(undefined, { timeZone: 'UTC' });
            }
        },
        {
            field: 'exitDate',
            headerName: 'Exit Date',
            width: 120,
            valueFormatter: (value: unknown) => {
                if (!value) return '-';
                const date = new Date(value as string);
                return date.toLocaleDateString(undefined, { timeZone: 'UTC' });
            }
        },
        {
            field: 'daysOpen',
            headerName: 'Days Open',
            width: 100,
            valueGetter: (_: unknown, row: Trade) => {
                if (!row.exitDate || !row.date) return null;
                const exit = new Date(row.exitDate);
                const entry = new Date(row.date);
                const diffTime = Math.abs(exit.getTime() - entry.getTime());
                return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            },
            valueFormatter: (value: unknown) => value !== null ? `${value}d` : '-'
        },
        {
            field: 'symbol',
            headerName: 'Symbol',
            width: 150,
            headerAlign: 'center',
            align: 'center',
            renderCell: (params) => (
                <strong>{formatSymbolForDisplay(params.value, params.row.type)}</strong>
            )
        },
        { field: 'type', headerName: 'Type', width: 100 },
        { field: 'side', headerName: 'Side', width: 90 },
        { field: 'strategy', headerName: 'Strategy', width: 130 },
        {
            field: 'entryPrice',
            headerName: 'Entry',
            width: 110,
            type: 'number',
            valueFormatter: (value: unknown) => formatCurrency(value as number)
        },
        {
            field: 'currentPrice',
            headerName: 'Last Price',
            width: 110,
            type: 'number',
            renderCell: (params: GridRenderCellParams) => {
                const trade = params.row as Trade;
                if (trade.status === 'Closed') return '-';
                const marketData = prices[trade.symbol?.toUpperCase()];
                if (marketData) {
                    return (
                        <Box>
                            <Typography variant="body2" fontWeight="bold">
                                {formatCurrency(marketData.price)}
                            </Typography>
                            {marketData.change !== undefined && (
                                <Typography variant="caption" color={marketData.change >= 0 ? 'success.main' : 'error.main'}>
                                    {marketData.change >= 0 ? '+' : ''}{marketData.change.toFixed(2)}%
                                </Typography>
                            )}
                        </Box>
                    );
                }
                return <Typography variant="caption" color="text.secondary">Loading...</Typography>;
            }
        },
        {
            field: 'exitPrice',
            headerName: 'Exit',
            width: 110,
            type: 'number',
            valueFormatter: (value: unknown) => value ? formatCurrency(value as number) : '-'
        },
        {
            field: 'pnl',
            headerName: 'P/L',
            width: 140,
            type: 'number',
            renderCell: (params: GridRenderCellParams) => {
                const trade = params.row as Trade;
                let val = trade.pnl;
                let isUnrealized = false;
                if (trade.status === 'Open' && trade.symbol) {
                    const marketData = prices[trade.symbol.toUpperCase()];
                    if (marketData) {
                        const currentDiff = marketData.price - trade.entryPrice;
                        val = trade.side === 'Buy'
                            ? currentDiff * trade.quantity
                            : -currentDiff * trade.quantity;
                        isUnrealized = true;
                    }
                }
                if (val === undefined || val === null) return '-';
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <Typography
                            variant="body2"
                            fontWeight="bold"
                            color={val >= 0 ? 'success.main' : 'error.main'}
                        >
                            {val > 0 ? '+' : ''}{formatCurrency(val)}
                        </Typography>
                        {isUnrealized && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                (Unrealized)
                            </Typography>
                        )}
                    </Box>
                );
            }
        },
        {
            field: 'annualizedReturn',
            headerName: 'Annualized Return',
            width: 150,
            type: 'number',
            valueGetter: (_: unknown, row: Trade) => {
                // If annualizedReturn is already saved, use it
                if (row.annualizedReturn !== undefined && row.annualizedReturn !== null) {
                    return row.annualizedReturn;
                }

                // Otherwise, calculate on-the-fly for existing trades
                // Only calculate for closed trades with P/L
                if (row.status !== 'Closed' || !row.pnl || !row.exitDate || !row.date) return null;

                // Calculate days held
                const exit = new Date(row.exitDate);
                const entry = new Date(row.date);
                const diffTime = Math.abs(exit.getTime() - entry.getTime());
                const daysHeld = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // Avoid division by zero
                if (daysHeld === 0) return null;

                // Calculate capital invested based on trade type
                let capitalInvested = 0;

                if (row.type === 'Option' && row.side === 'Sell') {
                    // For sold options (CSP, CC): use strike field if available
                    if (row.strike) {
                        capitalInvested = row.strike * row.quantity * 100;
                    } else {
                        // Fallback to parsing from symbol
                        const parsed = parseOptionSymbol(row.symbol);
                        if (parsed.strike) {
                            capitalInvested = parsed.strike * row.quantity * 100;
                        } else {
                            capitalInvested = (row.entryPrice * row.quantity * 100) + (row.fees || 0);
                        }
                    }
                } else {
                    // For bought options or stocks: use premium/price paid
                    const multiplier = row.type === 'Option' ? 100 : 1;
                    capitalInvested = (row.entryPrice * row.quantity * multiplier) + (row.fees || 0);
                }

                // Avoid division by zero
                if (capitalInvested === 0) return null;

                // Annualized Return = (P/L / Capital) × (365 / Days) × 100
                const returnPercent = (row.pnl / capitalInvested) * 100;
                const annualized = returnPercent * (365 / daysHeld);

                return annualized;
            },
            renderCell: (params: GridRenderCellParams) => {
                const value = params.value as number | null;
                if (value === null || value === undefined) return '-';

                return (
                    <Typography
                        variant="body2"
                        fontWeight="bold"
                        color={value >= 0 ? 'success.main' : 'error.main'}
                    >
                        {value > 0 ? '+' : ''}{value.toFixed(1)}%
                    </Typography>
                );
            }
        },
        {
            field: 'status',
            headerName: 'Status',
            width: 100,
            renderCell: (params: GridRenderCellParams) => (
                <Chip
                    label={params.value}
                    color={params.value === 'Open' ? 'primary' : 'default'}
                    size="small"
                />
            )
        },
        {
            field: 'actions',
            headerName: 'Actions',
            width: 156,
            sortable: false,
            renderCell: (params: GridRenderCellParams) => (
                <Stack direction="row" spacing={1}>
                    {params.row.status === 'Closed' && (
                        <IconButton
                            size="small"
                            onClick={() => {
                                setSelectedTrade(params.row as Trade);
                                setDetailsOpen(true);
                            }}
                            color="info"
                            title="View Details"
                        >
                            <Visibility fontSize="small" />
                        </IconButton>
                    )}
                    <IconButton
                        size="small"
                        component={Link}
                        to={`/edit/${params.row.id}`}
                        color="primary"
                    >
                        <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                        size="small"
                        onClick={() => handleDelete(params.row.id)}
                        color="error"
                    >
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                </Stack>
            )
        }
    ];

    // ... handlers (import/export logic same) ...
    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            try {
                if (!user) return;
                await import('../utils/importExport').then(m => m.importFromJson(e.target.files![0], user.uid));
                alert('Import successful!');
                window.location.reload();
            } catch {
                alert('Import failed');
            }
        }
    };

    const handleCsvFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setCsvFile(e.target.files[0]);
            setCsvImportOpen(true);
        }
    };

    const handleCsvImport = async () => {
        if (!csvFile || !selectedAccount) {
            alert('Please select a file and account');
            return;
        }

        try {
            if (!user) throw new Error('User not logged in');
            setImportStatus(null); // Clear previous status
            const { importFromCsv } = await import('../utils/importExport');
            const result = await importFromCsv(csvFile, selectedBroker, selectedAccount, user.uid);
            setImportStatus(result);

            if (result.success > 0) {
                setTimeout(() => {
                    setCsvImportOpen(false);
                    setCsvFile(null);
                    setSelectedBroker('auto');
                    setImportStatus(null);
                    window.location.reload();
                }, 3000);
            }
        } catch (err) {
            console.error('Import error:', err);
            alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
            setImportStatus(null);
        }
    };

    const handleBackfillAnnualizedReturn = async () => {
        if (!user) {
            alert('You must be logged in');
            return;
        }

        if (!window.confirm('This will calculate and save annualized returns for all your existing closed trades. Continue?')) {
            return;
        }

        try {
            setBackfilling(true);
            const { backfillAnnualizedReturn } = await import('../utils/backfillAnnualizedReturn');
            const result = await backfillAnnualizedReturn(user.uid);

            alert(`Backfill complete!\n\nUpdated: ${result.updated} trades\nSkipped: ${result.skipped} trades\nErrors: ${result.errors}`);

            // Reload to show updated values
            window.location.reload();
        } catch (err) {
            console.error('Backfill error:', err);
            alert(`Backfill failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setBackfilling(false);
        }
    };

    const handleDebugTrade = async () => {
        if (!user) return;
        try {
            const { debugFirstClosedTrade } = await import('../utils/debugTrade');
            await debugFirstClosedTrade(user.uid);
            alert('Check the browser console for debug output!');
        } catch (err) {
            console.error('Debug error:', err);
            alert('Debug failed - check console');
        }
    };

    const handleCloseCsvDialog = () => {
        setCsvImportOpen(false);
        setCsvFile(null);
        setSelectedBroker('auto');
        setImportStatus(null);
    };

    return (
        <Box sx={{ height: 'calc(100vh - 120px)', width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: 2 }}>
                <Typography variant="h4" fontWeight="bold">Trade Log</Typography>
                <Stack direction="row" spacing={2} sx={{ overflowX: 'auto', width: { xs: '100%', md: 'auto' }, pb: { xs: 1, md: 0 } }}>
                    <Button
                        variant="outlined"
                        startIcon={<CloudUpload />}
                        onClick={() => jsonFileInputRef.current?.click()}
                    >
                        Import JSON
                        <input
                            ref={jsonFileInputRef}
                            type="file"
                            hidden
                            accept=".json"
                            onChange={handleImport}
                        />
                    </Button>

                    <Button
                        variant="outlined"
                        startIcon={<CloudUpload />}
                        onClick={() => csvFileInputRef.current?.click()}
                    >
                        Import CSV
                        <input
                            ref={csvFileInputRef}
                            type="file"
                            hidden
                            accept=".csv,.txt"
                            onChange={handleCsvFileSelect}
                        />
                    </Button>

                    <Button
                        variant="outlined"
                        onClick={async () => {
                            const { exportToCsv } = await import('../utils/importExport');
                            exportToCsv(trades); // Exports ONLY loaded trades.
                        }}
                        startIcon={<CloudDownload />}
                        title="Export currently loaded trades"
                    >
                        Export CSV
                    </Button>

                    <Button
                        variant="contained"
                        component={Link}
                        to="/add"
                        startIcon={<AddIcon />}
                        sx={{ bgcolor: 'emerald.main' }}
                    >
                        New Trade
                    </Button>
                </Stack>
            </Box>

            {/* Error Display */}
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    <Box component="div">
                        <Typography variant="body2" gutterBottom>
                            Error loading trades: {error.message.split('https://')[0]}
                        </Typography>
                        {error.message.includes('https://console.firebase.google.com') && (
                            <Button
                                variant="contained"
                                color="error"
                                size="small"
                                onClick={() => {
                                    const match = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
                                    if (match) window.open(match[0], '_blank');
                                }}
                                sx={{ mt: 1, textTransform: 'none', fontWeight: 'bold' }}
                            >
                                ⚡ Create Missing Index (Click Here)
                            </Button>
                        )}
                        <Typography variant="caption" display="block" sx={{ mt: 1, opacity: 0.8 }}>
                            You need to click the button above and create the index in Firebase for this view to work.
                            It may take a few minutes to build.
                        </Typography>
                    </Box>
                </Alert>
            )}

            <Paper sx={{ flexGrow: 1, width: '100%', overflow: 'hidden', boxShadow: 3, borderRadius: 3, display: 'flex', flexDirection: 'column' }}>
                <DataGrid
                    rows={trades} // Uses raw trades array
                    columns={columns}
                    rowCount={trades.length}
                    loading={isLoading}
                    hideFooter
                    checkboxSelection
                    disableRowSelectionOnClick
                    slots={{ toolbar: GridToolbar }}
                    sx={{
                        height: '100%',
                        border: 'none',
                        '& .MuiDataGrid-columnHeaders': {
                            bgcolor: 'background.default',
                            fontWeight: 'bold'
                        }
                    }}
                />

                {/* Load More Footer */}
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', borderTop: '1px solid', borderColor: 'divider' }}>
                    {hasMore ? (
                        <Button
                            onClick={loadMore}
                            disabled={isLoading}
                            variant="outlined"
                        >
                            {isLoading ? 'Loading...' : 'Load More Trades'}
                        </Button>
                    ) : (
                        <Typography variant="caption" color="text.secondary">All trades loaded</Typography>
                    )}
                </Box>
            </Paper>

            {/* CSV Import Dialog */}
            <Dialog open={csvImportOpen} onClose={handleCloseCsvDialog} maxWidth="sm" fullWidth>
                <DialogTitle>Import from CSV</DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        <FormControl fullWidth>
                            <InputLabel>Broker</InputLabel>
                            <Select
                                value={selectedBroker}
                                label="Broker"
                                onChange={(e) => setSelectedBroker(e.target.value as BrokerName | 'auto')}
                            >
                                <MenuItem value="auto">Auto-detect</MenuItem>
                                <MenuItem value="wealthsimple">Wealthsimple</MenuItem>
                                <MenuItem value="generic">Generic CSV</MenuItem>
                            </Select>
                        </FormControl>

                        {csvFile && (
                            <Typography variant="body2" color="text.secondary">
                                Selected file: {csvFile.name}
                            </Typography>
                        )}

                        {importStatus && (
                            <Alert severity={importStatus.failed > 0 ? 'warning' : 'success'}>
                                <Typography variant="body2" fontWeight="bold">
                                    Successfully imported: {importStatus.success} trades
                                    {importStatus.failed > 0 && ` | Failed: ${importStatus.failed} rows`}
                                </Typography>
                                {importStatus.errors.length > 0 && (
                                    <Box sx={{ mt: 2, maxHeight: 300, overflow: 'auto' }}>
                                        <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
                                            Error Details (showing first 20):
                                        </Typography>
                                        {importStatus.errors.slice(0, 20).map((error, idx) => (
                                            <Typography
                                                key={idx}
                                                variant="caption"
                                                component="div"
                                                sx={{
                                                    fontSize: '0.75rem',
                                                    display: 'block',
                                                    mb: 0.5,
                                                    color: 'error.main',
                                                    fontFamily: 'monospace'
                                                }}
                                            >
                                                {error}
                                            </Typography>
                                        ))}
                                        {importStatus.errors.length > 20 && (
                                            <Typography variant="caption" sx={{ fontStyle: 'italic', mt: 1 }}>
                                                ... and {importStatus.errors.length - 20} more errors (check browser console for full list)
                                            </Typography>
                                        )}
                                    </Box>
                                )}
                            </Alert>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseCsvDialog}>Cancel</Button>
                    <Button
                        onClick={handleCsvImport}
                        variant="contained"
                        disabled={!csvFile || !!importStatus}
                    >
                        Import
                    </Button>
                </DialogActions>
            </Dialog>

            <TradeDetailsDialog
                open={detailsOpen}
                onClose={() => {
                    setDetailsOpen(false);
                    setSelectedTrade(null);
                }}
                trade={selectedTrade}
            />
        </Box>
    );
}
