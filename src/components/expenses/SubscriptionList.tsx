import { Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Box, useTheme, alpha, IconButton, Tooltip, Stack } from '@mui/material';
import { RefreshCw, Trash2, Play, Pause } from 'lucide-react';
import { DEFAULT_EXPENSE_CATEGORIES } from '../../types/expenseTypes';
import { useFirestoreRecurringRules } from '../../hooks/useFirestoreRecurringRules';
import { format } from 'date-fns';

export function SubscriptionList() {
    const theme = useTheme();
    const { rules, loading, deleteRule, updateRule } = useFirestoreRecurringRules();

    if (loading || rules.length === 0) return null;

    return (
        <Paper sx={{ p: 0, borderRadius: 3, overflow: 'hidden', mb: 4, border: `1px solid ${theme.palette.divider}`, boxShadow: 'none' }}>
            <Box sx={{ p: 2, bgcolor: alpha(theme.palette.info.main, 0.05), borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <RefreshCw size={18} /> Active Subscriptions & Rules
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    Expenses will be auto-generated on due dates
                </Typography>
            </Box>
            <TableContainer>
                <Table size="medium">
                    <TableHead>
                        <TableRow>
                            <TableCell>Service / Rule</TableCell>
                            <TableCell>Amount</TableCell>
                            <TableCell>Frequency</TableCell>
                            <TableCell>Next Due Date</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rules.map((rule) => {
                            const category = DEFAULT_EXPENSE_CATEGORIES.find(c => c.id === rule.category);

                            return (
                                <TableRow key={rule.id} hover>
                                    <TableCell>
                                        <Typography variant="subtitle2" fontWeight={600}>
                                            {rule.description || category?.name}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {category?.name}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>${rule.amount.toFixed(2)}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={rule.frequency}
                                            size="small"
                                            variant="outlined"
                                            sx={{ textTransform: 'capitalize' }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {rule.nextDueDate ? format(rule.nextDueDate, 'MMM dd, yyyy') : 'N/A'}
                                    </TableCell>
                                    <TableCell align="right">
                                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                                            <Tooltip title={rule.isActive ? "Pause Rule" : "Resume Rule"}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => updateRule(rule.id!, { isActive: !rule.isActive })}
                                                    color={rule.isActive ? "primary" : "default"}
                                                >
                                                    {rule.isActive ? <Pause size={18} /> : <Play size={18} />}
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete Rule">
                                                <IconButton size="small" color="error" onClick={() => deleteRule(rule.id!)}>
                                                    <Trash2 size={18} />
                                                </IconButton>
                                            </Tooltip>
                                        </Stack>
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
