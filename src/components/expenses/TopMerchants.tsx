import { useMemo } from 'react';
import { Box, Paper, Typography, useTheme } from '@mui/material';
import { ShoppingBag } from 'lucide-react';
import type { Expense } from '../../types/expenseTypes';
import { DEFAULT_EXPENSE_CATEGORIES } from '../../types/expenseTypes';
import { buildTopMerchants } from '../../utils/expenseUIUtils';
import { getCategoryIcon } from '../../utils/categoryIcons';

interface TopMerchantsProps {
    expenses: Expense[];
}

export function TopMerchants({ expenses }: TopMerchantsProps) {
    const theme = useTheme();
    const merchants = useMemo(() => buildTopMerchants(expenses, 5), [expenses]);

    if (merchants.length === 0) return null;

    const maxTotal = merchants[0]?.total ?? 1;

    return (
        <Paper sx={{ p: 3, borderRadius: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                <ShoppingBag size={20} color={theme.palette.secondary.main} />
                <Typography variant="h6" fontWeight={600}>Top Merchants This Month</Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {merchants.map((m, idx) => {
                    const cat = DEFAULT_EXPENSE_CATEGORIES.find(c => c.id === m.category);
                    const Icon = getCategoryIcon(cat?.icon ?? 'MoreHorizontal');
                    const barPct = (m.total / maxTotal) * 100;

                    return (
                        <Box key={m.name}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    {/* Rank badge */}
                                    <Typography variant="caption" sx={{
                                        width: 20, height: 20, borderRadius: '50%',
                                        bgcolor: idx === 0 ? 'warning.main' : 'action.selected',
                                        color: idx === 0 ? 'warning.contrastText' : 'text.secondary',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 700, fontSize: '0.65rem', flexShrink: 0
                                    }}>
                                        {idx + 1}
                                    </Typography>
                                    <Icon size={16} color={cat?.color ?? theme.palette.text.secondary} />
                                    <Box>
                                        <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 200 }}>
                                            {m.name}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {m.count} transaction{m.count !== 1 ? 's' : ''} · {cat?.name ?? m.category}
                                        </Typography>
                                    </Box>
                                </Box>
                                <Typography variant="body2" fontWeight={700} color="error.main">
                                    ${m.total.toFixed(2)}
                                </Typography>
                            </Box>
                            {/* Mini progress bar */}
                            <Box sx={{ height: 4, bgcolor: 'action.hover', borderRadius: 2, overflow: 'hidden' }}>
                                <Box sx={{
                                    height: '100%', width: `${barPct}%`,
                                    bgcolor: cat?.color ?? theme.palette.primary.main,
                                    borderRadius: 2,
                                    transition: 'width 0.6s ease'
                                }} />
                            </Box>
                        </Box>
                    );
                })}
            </Box>
        </Paper>
    );
}
