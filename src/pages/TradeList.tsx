import { useLiveQuery } from 'dexie-react-hooks';
import { useState, useRef } from 'react';
import { db } from '../db/db';
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
    Tooltip,
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
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon, CloudUpload, Refresh, CloudDownload } from '@mui/icons-material';
import { formatCurrency } from '../utils/calculations';
import { useAccount } from '../context/AccountContext';
import type { BrokerName } from '../utils/brokerAdapters';
import { formatSymbolForDisplay } from '../utils/optionSymbolParser';
import { TradeDetailsDialog } from '../components/TradeDetailsDialog';
import type { Trade } from '../types/trade';
import { Visibility } from '@mui/icons-material';

export function TradeList() {
    const { selectedAccount } = useAccount();
    const [paginationModel, setPaginationModel] = useState({
        pageSize: 10,
        page: 0,
    });
    const [rowCount, setRowCount] = useState(0);
    const [csvImportOpen, setCsvImportOpen] = useState(false);
    const [selectedBroker, setSelectedBroker] = useState<BrokerName | 'auto'>('auto');
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [importStatus, setImportStatus] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
    const csvFileInputRef = useRef<HTMLInputElement>(null);
    const jsonFileInputRef = useRef<HTMLInputElement>(null);

    // Lazy query: fetches only the needed slice
    const trades = useLiveQuery(async () => {
        if (!selectedAccount) {
            setRowCount(0);
            return [];
        }

        const allTrades = await db.trades
            .where('accountId')
            .equals(selectedAccount)
            .reverse()
            .sortBy('date');

        setRowCount(allTrades.length);

        // Manually paginate after sorting
        const start = paginationModel.page * paginationModel.pageSize;
        const end = start + paginationModel.pageSize;
        return allTrades.slice(start, end);
    }, [paginationModel, selectedAccount]); // Re-run when page or selectedAccount changes

    const totalCount = rowCount;
    const isLoading = trades === undefined;

    const handleDelete = async (id: number) => {
        if (confirm('Are you sure you want to delete this trade?')) {
            await db.trades.delete(id);
        }
    };

    const columns: GridColDef[] = [
        {
            field: 'date',
            headerName: 'Entry Date',
            width: 120,
            valueFormatter: (value: unknown) => value ? new Date(value as string).toLocaleDateString() : ''
        },
        {
            field: 'exitDate',
            headerName: 'Exit Date',
            width: 120,
            valueFormatter: (value: unknown) => value ? new Date(value as string).toLocaleDateString() : '-'
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
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays;
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
        {
            field: 'side',
            headerName: 'Side',
            width: 100,
            renderCell: (params: GridRenderCellParams) => (
                <Chip
                    label={params.value}
                    color={params.value === 'Buy' ? 'success' : 'error'}
                    size="small"
                    variant="outlined"
                />
            )
        },
        { field: 'strategy', headerName: 'Strategy', width: 130 },
        {
            field: 'entryPrice',
            headerName: 'Entry',
            width: 120,
            type: 'number',
            valueFormatter: (value: unknown) => formatCurrency(value as number)
        },
        {
            field: 'exitPrice',
            headerName: 'Exit',
            width: 120,
            type: 'number',
            valueFormatter: (value: unknown) => value ? formatCurrency(value as number) : '-'
        },
        {
            field: 'pnl',
            headerName: 'P/L',
            width: 140,
            type: 'number',
            renderCell: (params: GridRenderCellParams) => {
                const val = params.value as number;
                if (val === undefined || val === null) return '-';
                return (
                    <Typography
                        variant="body2"
                        fontWeight="bold"
                        color={val >= 0 ? 'success.main' : 'error.main'}
                    >
                        {val > 0 ? '+' : ''}{formatCurrency(val)}
                    </Typography>
                );
            }
        },
        {
            field: 'status',
            headerName: 'Status',
            width: 120,
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

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            try {
                await import('../utils/importExport').then(m => m.importFromJson(e.target.files![0]));
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
            setImportStatus(null); // Clear previous status
            const { importFromCsv } = await import('../utils/importExport');
            const result = await importFromCsv(csvFile, selectedBroker, selectedAccount);
            setImportStatus(result);

            // Log results to console for debugging


            if (result.success > 0) {
                setTimeout(() => {
                    setCsvImportOpen(false);
                    setCsvFile(null);
                    setSelectedBroker('auto');
                    setImportStatus(null);
                    window.location.reload();
                }, 3000); // Give more time to review errors
            }
        } catch (err) {
            console.error('Import error:', err);
            alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
            setImportStatus(null);
        }
    };

    const handleCloseCsvDialog = () => {
        setCsvImportOpen(false);
        setCsvFile(null);
        setSelectedBroker('auto');
        setImportStatus(null);
    };

    const handleSeed = async () => {
        if (confirm('Clear all and seed 1000 trades?')) {
            try {
                const { generateTrades } = await import('../utils/generateTrades');
                await generateTrades(1000);
                window.location.reload();
            } catch (e) {
                console.error(e);
            }
        }
    };

    return (
        <Box sx={{ height: 'calc(100vh - 120px)', width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h4" fontWeight="bold">Trade Log</Typography>
                <Stack direction="row" spacing={2}>
                    <Tooltip title="Clear & Seed 5 Test Trades">
                        <Button
                            variant="outlined"
                            color="warning"
                            onClick={async () => {
                                const { generateTestTrades } = await import('../utils/generateTestTrades');
                                await generateTestTrades();
                                window.location.reload(); // Reload to refresh count
                            }}
                        >
                            Test 5
                        </Button>
                    </Tooltip>

                    <Tooltip title="Seed 1000 Trades">
                        <IconButton onClick={handleSeed} color="secondary">
                            <Refresh />
                        </IconButton>
                    </Tooltip>

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
                            const allTrades = await db.trades.toArray();
                            const { exportToCsv } = await import('../utils/importExport');
                            exportToCsv(allTrades);
                        }}
                        startIcon={<CloudDownload />}
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

            <Paper sx={{ flexGrow: 1, width: '100%', overflow: 'hidden', boxShadow: 3, borderRadius: 3 }}>
                <DataGrid
                    rows={trades}
                    columns={columns}
                    rowCount={totalCount}
                    loading={isLoading}
                    pageSizeOptions={[25, 50, 100]}
                    paginationModel={paginationModel}
                    paginationMode="server"
                    onPaginationModelChange={setPaginationModel}
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
