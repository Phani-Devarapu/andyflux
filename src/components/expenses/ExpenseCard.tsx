import { Box, Card, CardContent, Chip, IconButton, Typography, useTheme, alpha } from '@mui/material';
import { Edit2, Trash2, RefreshCw } from 'lucide-react';
import type { Expense, ExpenseCategory } from '../../types/expenseTypes';
import { format } from 'date-fns';
import { getCategoryIcon } from '../../utils/categoryIcons';

interface ExpenseCardProps {
    expense: Expense;
    category?: ExpenseCategory;
    onEdit: (expense: Expense) => void;
    onDelete: (id: number) => void;
}

export function ExpenseCard({ expense, category, onEdit, onDelete }: ExpenseCardProps) {
    const theme = useTheme();

    return (
        <Card sx={{
            mb: 2,
            borderRadius: 3,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: 'none',
            '&:hover': {
                borderColor: theme.palette.primary.main,
                bgcolor: alpha(theme.palette.primary.main, 0.02)
            }
        }}>
            <CardContent sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
                gap: { xs: 2, sm: 0 },
                p: 2,
                '&:last-child': { pb: 2 }
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {/* Date Box */}
                    <Box sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        minWidth: 50,
                        p: 1,
                        bgcolor: alpha(theme.palette.background.default, 0.5),
                        borderRadius: 2,
                        border: `1px solid ${theme.palette.divider}`
                    }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                            {format(expense.date, 'MMM').toUpperCase()}
                        </Typography>
                        <Typography variant="h6" fontWeight={700} lineHeight={1}>
                            {format(expense.date, 'dd')}
                        </Typography>
                    </Box>

                    {/* Details */}
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            {category && (() => {
                                const Icon = getCategoryIcon(category.icon);
                                return <Icon size={18} color={category.color} strokeWidth={2.5} />;
                            })()}
                            <Typography variant="subtitle1" fontWeight={600}>
                                {expense.description || category?.name || 'Expense'}
                            </Typography>
                            {expense.isRecurring && (
                                <Chip
                                    icon={<RefreshCw size={12} />}
                                    label={expense.frequency}
                                    size="small"
                                    color="info"
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: '0.7rem' }}
                                />
                            )}
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                            {category?.name} • {expense.accountId}
                        </Typography>
                    </Box>
                </Box>

                {/* Amount & Actions */}
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    width: { xs: '100%', sm: 'auto' },
                    justifyContent: { xs: 'space-between', sm: 'flex-start' },
                    mt: { xs: 1, sm: 0 },
                    pt: { xs: 1, sm: 0 },
                    borderTop: { xs: `1px solid ${theme.palette.divider}`, sm: 'none' }
                }}>
                    <Typography variant="h6" fontWeight={700} color="error.main">
                        -${expense.amount.toFixed(2)}
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton size="small" onClick={() => onEdit(expense)}>
                            <Edit2 size={16} />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => expense.id && onDelete(expense.id)}>
                            <Trash2 size={16} />
                        </IconButton>
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
}
