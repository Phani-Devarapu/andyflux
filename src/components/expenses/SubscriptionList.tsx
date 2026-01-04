import { Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Box, useTheme, alpha } from '@mui/material';
import { RefreshCw } from 'lucide-react';
import type { Expense } from '../../types/expenseTypes';
import { DEFAULT_EXPENSE_CATEGORIES } from '../../types/expenseTypes';

interface SubscriptionListProps {
    expenses: Expense[];
}

export function SubscriptionList({ expenses }: SubscriptionListProps) {
    const theme = useTheme();
    const subscriptions = expenses.filter(e => e.isRecurring);

    if (subscriptions.length === 0) return null;

    return (
        <Paper sx={{ p: 0, borderRadius: 3, overflow: 'hidden', mb: 4, border: `1px solid ${theme.palette.divider}`, boxShadow: 'none' }}>
            <Box sx={{ p: 2, bgcolor: alpha(theme.palette.info.main, 0.05), borderBottom: `1px solid ${theme.palette.divider}` }}>
                <Typography variant="h6" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <RefreshCw size={18} /> Active Subscriptions
                </Typography>
            </Box>
            <TableContainer>
                <Table size="medium">
                    <TableHead>
                        <TableRow>
                            <TableCell>Service</TableCell>
                            <TableCell>Cost</TableCell>
                            <TableCell>Frequency</TableCell>
                            <TableCell align="right">Annual Cost</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {subscriptions.map((sub) => {
                            const category = DEFAULT_EXPENSE_CATEGORIES.find(c => c.id === sub.category);
                            const annualCost = sub.frequency === 'monthly' ? sub.amount * 12 : sub.amount;

                            return (
                                <TableRow key={sub.id} hover>
                                    <TableCell>
                                        <Typography variant="subtitle2" fontWeight={600}>
                                            {sub.description || category?.name}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {category?.name}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>${sub.amount.toFixed(2)}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={sub.frequency}
                                            size="small"
                                            sx={{ textTransform: 'capitalize' }}
                                        />
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                                        ${annualCost.toFixed(2)}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}
