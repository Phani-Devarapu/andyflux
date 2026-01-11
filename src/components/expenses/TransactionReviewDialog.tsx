import { useState } from 'react';
import { Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Checkbox, TextField, MenuItem, IconButton, Typography, Alert, Chip } from '@mui/material';
import { Edit, Trash2, Check, X } from 'lucide-react';
import type { ExtractedTransaction } from '../../utils/transactionExtractor';
import { formatCurrency } from '../../utils/calculations';
import { format } from 'date-fns';
import { DEFAULT_EXPENSE_CATEGORIES } from '../../types/expenseTypes';

interface TransactionReviewDialogProps {
    open: boolean;
    transactions: ExtractedTransaction[];
    onClose: () => void;
    onImport: (transactions: ExtractedTransaction[]) => Promise<void>;
}

export function TransactionReviewDialog({ open, transactions, onClose, onImport }: TransactionReviewDialogProps) {
    const [selected, setSelected] = useState<Set<number>>(new Set(transactions.map((_, i) => i)));
    const [editedTransactions, setEditedTransactions] = useState<ExtractedTransaction[]>(transactions);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [importing, setImporting] = useState(false);

    const handleSelectAll = () => {
        if (selected.size === transactions.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(transactions.map((_, i) => i)));
        }
    };

    const handleToggle = (index: number) => {
        const newSelected = new Set(selected);
        if (newSelected.has(index)) {
            newSelected.delete(index);
        } else {
            newSelected.add(index);
        }
        setSelected(newSelected);
    };

    const handleEdit = (index: number, field: keyof ExtractedTransaction, value: string) => {
        const updated = [...editedTransactions];
        if (field === 'amount') {
            updated[index] = { ...updated[index], amount: parseFloat(value) || 0 };
        } else if (field === 'date') {
            updated[index] = { ...updated[index], date: new Date(value) };
        } else {
            updated[index] = { ...updated[index], [field]: value };
        }
        setEditedTransactions(updated);
    };

    const handleDelete = (index: number) => {
        const newSelected = new Set(selected);
        newSelected.delete(index);
        setSelected(newSelected);
    };

    const handleImport = async () => {
        setImporting(true);
        try {
            const selectedTransactions = editedTransactions.filter((_, i) => selected.has(i));
            await onImport(selectedTransactions);
            onClose();
        } catch (error) {
            console.error('Import error:', error);
        } finally {
            setImporting(false);
        }
    };

    const selectedCount = selected.size;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">Review Transactions</Typography>
                    <Chip
                        label={`${selectedCount} of ${transactions.length} selected`}
                        color="primary"
                        size="small"
                    />
                </Box>
            </DialogTitle>
            <DialogContent>
                {transactions.length === 0 ? (
                    <Alert severity="warning">
                        No transactions found in the statement. Please ensure it's a valid credit card statement.
                    </Alert>
                ) : (
                    <>
                        <Alert severity="info" sx={{ mb: 2 }}>
                            Review the extracted transactions below. You can edit categories, descriptions, or amounts before importing.
                        </Alert>
                        <TableContainer sx={{ maxHeight: 500 }}>
                            <Table stickyHeader size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                checked={selected.size === transactions.length && transactions.length > 0}
                                                indeterminate={selected.size > 0 && selected.size < transactions.length}
                                                onChange={handleSelectAll}
                                            />
                                        </TableCell>
                                        <TableCell>Date</TableCell>
                                        <TableCell>Description</TableCell>
                                        <TableCell>Category</TableCell>
                                        <TableCell>Location</TableCell>
                                        <TableCell align="right">Amount</TableCell>
                                        <TableCell align="center">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {editedTransactions.map((transaction, index) => (
                                        <TableRow
                                            key={index}
                                            sx={{
                                                bgcolor: selected.has(index) ? 'action.selected' : 'inherit',
                                                opacity: selected.has(index) ? 1 : 0.6,
                                            }}
                                        >
                                            <TableCell padding="checkbox">
                                                <Checkbox
                                                    checked={selected.has(index)}
                                                    onChange={() => handleToggle(index)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {editingIndex === index ? (
                                                    <TextField
                                                        type="date"
                                                        size="small"
                                                        value={format(transaction.date, 'yyyy-MM-dd')}
                                                        onChange={(e) => handleEdit(index, 'date', e.target.value)}
                                                    />
                                                ) : (
                                                    format(transaction.date, 'MMM dd, yyyy')
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {editingIndex === index ? (
                                                    <TextField
                                                        size="small"
                                                        value={transaction.description}
                                                        onChange={(e) => handleEdit(index, 'description', e.target.value)}
                                                        fullWidth
                                                    />
                                                ) : (
                                                    transaction.description
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <TextField
                                                    select
                                                    size="small"
                                                    value={transaction.category}
                                                    onChange={(e) => handleEdit(index, 'category', e.target.value)}
                                                    sx={{ minWidth: 120 }}
                                                >
                                                    {DEFAULT_EXPENSE_CATEGORIES.map((cat) => (
                                                        <MenuItem key={cat.id} value={cat.name}>
                                                            {cat.name}
                                                        </MenuItem>
                                                    ))}
                                                </TextField>
                                            </TableCell>
                                            <TableCell>{transaction.location || '-'}</TableCell>
                                            <TableCell align="right">
                                                {editingIndex === index ? (
                                                    <TextField
                                                        type="number"
                                                        size="small"
                                                        value={transaction.amount}
                                                        onChange={(e) => handleEdit(index, 'amount', e.target.value)}
                                                        sx={{ width: 100 }}
                                                    />
                                                ) : (
                                                    formatCurrency(transaction.amount)
                                                )}
                                            </TableCell>
                                            <TableCell align="center">
                                                {editingIndex === index ? (
                                                    <>
                                                        <IconButton size="small" onClick={() => setEditingIndex(null)} color="primary">
                                                            <Check size={16} />
                                                        </IconButton>
                                                        <IconButton size="small" onClick={() => setEditingIndex(null)}>
                                                            <X size={16} />
                                                        </IconButton>
                                                    </>
                                                ) : (
                                                    <>
                                                        <IconButton size="small" onClick={() => setEditingIndex(index)}>
                                                            <Edit size={16} />
                                                        </IconButton>
                                                        <IconButton size="small" onClick={() => handleDelete(index)} color="error">
                                                            <Trash2 size={16} />
                                                        </IconButton>
                                                    </>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={importing}>
                    Cancel
                </Button>
                <Button
                    onClick={handleImport}
                    variant="contained"
                    disabled={selectedCount === 0 || importing}
                >
                    {importing ? 'Importing...' : `Import ${selectedCount} Transaction${selectedCount !== 1 ? 's' : ''}`}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
