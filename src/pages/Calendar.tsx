import { useState, forwardRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { expenseDb } from '../db/expenseDb';
import { formatCurrency } from '../utils/calculations';
import { useAccount } from '../context/AccountContext';
import { useAuth } from '../context/AuthContext';
import { formatSymbolForDisplay } from '../utils/optionSymbolParser';
import { ContributionGraph } from '../components/analytics/ContributionGraph';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Close, ArrowForward } from '@mui/icons-material';
import {
    Box,
    Paper,
    Typography,
    IconButton,
    Stack,
    Chip,
    useTheme,
    Dialog,
    DialogTitle,
    DialogContent,
    Slide,
    CardActionArea
} from '@mui/material';
import type { TransitionProps } from '@mui/material/transitions';
import { DEFAULT_EXPENSE_CATEGORIES } from '../types/expenseTypes';
import * as LucideIcons from 'lucide-react';

const Transition = forwardRef(function Transition(
    props: TransitionProps & {
        children: React.ReactElement<unknown>;
    },
    ref: React.Ref<unknown>,
) {
    return <Slide direction="up" ref={ref} {...props} />;
});

// Helper to render Lucide icon by name
const ExpenseIcon = ({ name, color, size = 20 }: { name: string, color: string, size?: number }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Icon = (LucideIcons as any)[name] || LucideIcons.DollarSign;
    return <Icon size={size} color={color} />;
};

export function Calendar() {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const { selectedAccount } = useAccount();
    const { user } = useAuth();
    const theme = useTheme();

    // Fetch Trades
    const trades = useLiveQuery(async () => {
        if (!selectedAccount || !user || selectedAccount === 'PERSONAL') return [];
        return await db.trades.where('[userId+accountId]').equals([user.uid, selectedAccount]).toArray();
    }, [selectedAccount, user]);

    // Fetch Expenses (Personal Account)
    const expenses = useLiveQuery(async () => {
        if (!selectedAccount || !user || selectedAccount !== 'PERSONAL') return [];
        return await expenseDb.expenses.where('[userId+accountId]').equals([user.uid, selectedAccount]).toArray();
    }, [selectedAccount, user]);

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const startDayOfWeek = monthStart.getDay();
    const emptySlots = Array(startDayOfWeek).fill(null);

    const getDayStats = (date: Date) => {
        if (!trades) return { pnl: 0, count: 0, wins: 0, losses: 0, invested: 0, trades: [] };
        const daysTrades = trades.filter(t => isSameDay(new Date(t.date), date));
        const pnl = daysTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
        const count = daysTrades.length;
        const wins = daysTrades.filter(t => (t.pnl || 0) > 0).length;
        const losses = daysTrades.filter(t => (t.pnl || 0) < 0).length;
        // Calculate Invested: Only for Open trades or just general activity? 
        // User wants "if its invested display as black".
        // Let's sum invested for all Buy trades on that day, or just focus on the display logic.
        // Ideally, if PnL is 0 (all open trades), we show the total cost of those trades.
        const invested = daysTrades.reduce((acc, t) => acc + (t.entryPrice * t.quantity) + (t.fees || 0), 0);

        return { pnl, count, wins, losses, invested, trades: daysTrades };
    };

    // Expense Stats Helper
    const getExpenseDayStats = (date: Date) => {
        if (!expenses) return { totalSpent: 0, count: 0, items: [] };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dayExpenses = expenses.filter((e: any) => isSameDay(new Date(e.date), date));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const totalSpent = dayExpenses.reduce((acc: number, e: any) => acc + e.amount, 0);
        return { totalSpent, count: dayExpenses.length, items: dayExpenses };
    };

    // ... (rest of code)


    // Calculate intensity for heatmap
    // Simple logic: Scale based on PnL magnitude relative to a baseline?
    // Or just fixed buckets for now.


    const selectedDayData = selectedDate ? (selectedAccount === 'PERSONAL' ? getExpenseDayStats(selectedDate) : getDayStats(selectedDate)) : null;

    // Header Stats
    let headerStatLabel = '';
    let headerStatValue = '';
    let headerStatColor: 'success' | 'error' | 'default' | 'primary' | 'secondary' | 'info' | 'warning' = 'default';

    if (selectedAccount === 'PERSONAL') {
        const monthlySpent = expenses
            ? expenses
                .filter(e => {
                    const d = new Date(e.date);
                    return d.getMonth() === currentMonth.getMonth() && d.getFullYear() === currentMonth.getFullYear();
                })
                .reduce((acc, e) => acc + e.amount, 0)
            : 0;
        headerStatLabel = 'Monthly Spent: ';
        headerStatValue = formatCurrency(monthlySpent);
        headerStatColor = 'warning';
    } else {
        const monthlyPnL = trades
            ? trades
                .filter(t => {
                    const d = new Date(t.date);
                    return d.getMonth() === currentMonth.getMonth() && d.getFullYear() === currentMonth.getFullYear();
                })
                .reduce((acc, t) => acc + (t.pnl || 0), 0)
            : 0;
        headerStatLabel = 'Monthly P/L: ';
        headerStatValue = formatCurrency(monthlyPnL);
        headerStatColor = monthlyPnL >= 0 ? 'success' : 'error';
    }

    return (
        <Box sx={{ animation: 'fade-in 0.5s', '@keyframes fade-in': { from: { opacity: 0 }, to: { opacity: 1 } } }}>
            {/* Header */}
            <Paper
                elevation={3}
                sx={{
                    p: 4,
                    mb: 4,
                    borderRadius: 4,
                    background: theme.palette.mode === 'dark'
                        ? 'linear-gradient(135deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.9) 100%)'
                        : 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
                    backdropFilter: 'blur(20px)',
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 2
                }}
            >
                <Box>
                    <Typography
                        variant="h3"
                        fontWeight={900}
                        sx={{
                            background: 'linear-gradient(to right, #60A5FA, #34D399)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            mb: 1
                        }}
                    >
                        {selectedAccount === 'PERSONAL' ? 'Expense Calendar' : 'Trading Journal'}
                    </Typography>
                    <Stack direction="row" spacing={2} alignItems="center">
                        <Typography variant="subtitle1" color="text.secondary" fontWeight="medium">
                            {selectedAccount === 'PERSONAL' ? 'Track your spending habits 💸' : 'Consistency is Key 🔑'}
                        </Typography>
                        <Chip
                            label={`${headerStatLabel}${headerStatValue}`}
                            color={headerStatColor}
                            variant="outlined"
                            sx={{ fontWeight: 'bold', fontSize: '1rem', bgcolor: 'background.paper' }}
                        />
                    </Stack>
                </Box>

                <Paper sx={{ p: 1, px: 2, borderRadius: 3, bgcolor: 'background.paper', display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Stack direction="row" spacing={1}>
                        <IconButton onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                            <ChevronLeft />
                        </IconButton>
                        <IconButton onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                            <ChevronRight />
                        </IconButton>
                    </Stack>
                    <Typography variant="h5" fontWeight="bold" sx={{ minWidth: 200, textAlign: 'right' }}>
                        {format(currentMonth, 'MMMM yyyy')}
                    </Typography>
                </Paper>
            </Paper>

            {/* Calendar Grid */}
            <Paper
                elevation={4}
                sx={{
                    p: 3,
                    borderRadius: 4,
                    bgcolor: 'background.paper',
                    // Only apply dark glass effect in dark mode
                    background: theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.6)' : undefined,
                    backdropFilter: 'blur(10px)',
                    overflowX: 'auto' // Allow scrolling on small screens
                }}
            >
                <Box sx={{ minWidth: 600 }}> {/* Ensure minimum width to prevent squashing */}
                    {/* Weekday Headers */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 2 }}>
                        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
                            <Typography key={day} variant="caption" fontWeight="bold" align="center" color="text.secondary" sx={{ letterSpacing: 2 }}>
                                {day}
                            </Typography>
                        ))}
                    </Box>

                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, autoRows: '140px' }}>
                        {/* Empty Slots */}
                        {emptySlots.map((_, i) => (
                            <Box key={`empty-${i}`} sx={{ borderRadius: 3, bgcolor: 'rgba(255,255,255,0.02)' }} />
                        ))}

                        {/* Days */}
                        {daysInMonth.map(day => {
                            let count = 0;
                            let content = null;
                            const today = isToday(day);
                            const isLight = theme.palette.mode === 'light';

                            // Default styles
                            const borderColor = today ? theme.palette.primary.main : (isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)');
                            const bgcolor = isLight ? '#ffffff' : '#1e293b';

                            if (selectedAccount === 'PERSONAL') {
                                const stats = getExpenseDayStats(day);
                                count = stats.count;
                                if (count > 0) {
                                    content = (
                                        <Box sx={{ width: '100%' }}>
                                            <Typography
                                                variant="body1"
                                                fontWeight="bold"
                                                color="warning.main"
                                                align="center"
                                                sx={{ my: 1 }}
                                            >
                                                {formatCurrency(stats.totalSpent)}
                                            </Typography>
                                            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                                <Typography variant="caption" color="text.secondary" fontWeight="medium">
                                                    {count} {count === 1 ? 'Item' : 'Items'}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    );
                                }
                            } else {
                                const stats = getDayStats(day);
                                count = stats.count;
                                if (count > 0) {
                                    content = (
                                        <Box sx={{ width: '100%' }}>
                                            <Typography
                                                variant="body1"
                                                fontWeight="bold"
                                                color={stats.pnl !== 0 ? (stats.pnl > 0 ? 'success.main' : 'error.main') : 'text.primary'}
                                                align="center"
                                                sx={{ my: 1 }}
                                            >
                                                {formatCurrency(stats.pnl !== 0 ? stats.pnl : stats.invested)}
                                            </Typography>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Typography variant="caption" color="text.secondary" fontWeight="medium">
                                                    {count} {count === 1 ? 'Trade' : 'Trades'}
                                                </Typography>
                                                {/* Small dots for wins/losses */}
                                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                    {stats.wins > 0 && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'success.main' }} />}
                                                    {stats.losses > 0 && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'error.main' }} />}
                                                </Box>
                                            </Box>
                                        </Box>
                                    );
                                }
                            }

                            return (
                                <Paper
                                    key={day.toString()}
                                    variant="outlined"
                                    onClick={() => count > 0 && setSelectedDate(day)}
                                    sx={{
                                        p: 1.5,
                                        borderRadius: 3,
                                        bgcolor: count > 0 ? bgcolor : (isLight ? '#f8fafc' : 'rgba(30, 41, 59, 0.4)'),
                                        borderColor: today ? (selectedAccount === 'PERSONAL' ? 'warning.main' : 'info.main') : borderColor,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        transition: 'all 0.3s',
                                        cursor: count > 0 ? 'pointer' : 'default',
                                        borderWidth: today ? 2 : 1,
                                        borderStyle: today ? 'solid' : undefined,
                                        '&:hover': {
                                            transform: count > 0 ? 'translateY(-2px)' : 'none',
                                            boxShadow: count > 0 ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
                                            bgcolor: count > 0 ? bgcolor : (isLight ? '#f1f5f9' : 'rgba(30, 41, 59, 0.6)')
                                        }
                                    }}
                                >
                                    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <Typography variant="body2" fontWeight={today ? "900" : "medium"} color={today ? (selectedAccount === 'PERSONAL' ? 'warning.main' : 'primary.main') : 'text.secondary'}>
                                            {format(day, 'd')}
                                        </Typography>
                                    </Box>

                                    {count > 0 ? content : <Box sx={{ flexGrow: 1 }} />}
                                </Paper>
                            );
                        })}
                    </Box>
                </Box> {/* End minWidth wrapper */}
            </Paper>

            {/* Contribution Heatmap */}
            {selectedAccount !== 'PERSONAL' && trades && <ContributionGraph trades={trades} />}

            {/* Premium Details Dialog */}
            <Dialog
                open={!!selectedDate}
                onClose={() => setSelectedDate(null)}
                TransitionComponent={Transition}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 4,
                        bgcolor: 'background.paper',
                        backgroundImage: 'none',
                        border: '1px solid rgba(255,255,255,0.05)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                    }
                }}
            >
                {selectedDate && selectedDayData && (
                    <>
                        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 3, pb: 2 }}>
                            <Box>
                                <Typography variant="h5" fontWeight="900" sx={{ letterSpacing: -0.5 }}>
                                    {format(selectedDate, 'MMMM do')}
                                </Typography>
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                                    <Typography variant="body2" color="text.secondary" fontWeight="medium">
                                        {selectedAccount === 'PERSONAL' ? 'Total Spent:' : 'Total Daily P/L:'}
                                    </Typography>
                                    <Chip
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        label={formatCurrency((selectedAccount === 'PERSONAL' ? (selectedDayData as any).totalSpent : (selectedDayData as any).pnl))}
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        color={selectedAccount === 'PERSONAL' ? 'warning' : ((selectedDayData as any).pnl >= 0 ? 'success' : 'error')}
                                        size="small"
                                        variant="filled"
                                        sx={{ fontWeight: 'bold' }}
                                    />
                                </Stack>
                            </Box>
                            <IconButton onClick={() => setSelectedDate(null)} sx={{ bgcolor: 'action.hover' }}>
                                <Close />
                            </IconButton>
                        </DialogTitle>

                        <DialogContent sx={{ p: 3, pt: 0 }}>
                            <Stack spacing={2} sx={{ mt: 2 }}>
                                {selectedAccount === 'PERSONAL' ? (
                                    // EXPENSE LIST
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    (selectedDayData as any).items.map((expense: any) => {
                                        const category = DEFAULT_EXPENSE_CATEGORIES.find(c => c.id === expense.category);
                                        return (
                                            <Paper
                                                key={expense.id}
                                                elevation={0}
                                                sx={{
                                                    p: 2,
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    borderRadius: 3,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 2
                                                }}
                                            >
                                                <Box sx={{
                                                    p: 1.5,
                                                    borderRadius: '50%',
                                                    bgcolor: (category?.color || '#9ca3af') + '20',
                                                    color: category?.color || '#9ca3af',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <ExpenseIcon name={category?.icon || 'DollarSign'} color={category?.color || '#9ca3af'} size={24} />
                                                </Box>
                                                <Box sx={{ flexGrow: 1 }}>
                                                    <Typography variant="body1" fontWeight="bold">{category?.name || expense.category}</Typography>
                                                    {expense.description && (
                                                        <Typography variant="caption" color="text.secondary">{expense.description}</Typography>
                                                    )}
                                                </Box>
                                                <Typography variant="h6" fontWeight="bold">
                                                    {formatCurrency(expense.amount)}
                                                </Typography>
                                            </Paper>
                                        );
                                    })
                                ) : (
                                    // TRADE LIST
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    (selectedDayData as any).trades.map((trade: any) => (
                                        <Paper
                                            key={trade.id}
                                            elevation={0}
                                            sx={{
                                                p: 0,
                                                border: '1px solid',
                                                borderColor: 'divider',
                                                borderRadius: 3,
                                                overflow: 'hidden',
                                                transition: 'transform 0.2s',
                                                '&:hover': {
                                                    borderColor: 'primary.main',
                                                    transform: 'translateY(-2px)',
                                                    boxShadow: 2
                                                }
                                            }}
                                        >
                                            <CardActionArea component={Link} to={`/edit/${trade.id}`} sx={{ p: 2 }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                    <Stack direction="row" spacing={1.5} alignItems="center">
                                                        <Box
                                                            sx={{
                                                                width: 4,
                                                                height: 24,
                                                                bgcolor: (trade.pnl || 0) >= 0 ? 'success.main' : 'error.main',
                                                                borderRadius: 1
                                                            }}
                                                        />
                                                        <Typography variant="h6" fontWeight="bold">
                                                            {formatSymbolForDisplay(trade.symbol, trade.type)}
                                                        </Typography>
                                                        <Chip
                                                            label={trade.side}
                                                            size="small"
                                                            color={trade.side === 'Buy' ? 'success' : 'error'}
                                                            variant="outlined"
                                                            sx={{ height: 20, fontSize: '0.7rem', fontWeight: 'bold' }}
                                                        />
                                                    </Stack>
                                                    <Box sx={{ textAlign: 'right' }}>
                                                        <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                                            {(trade.pnl && trade.pnl !== 0) ? 'REALIZED P/L' : 'INVESTED'}
                                                        </Typography>
                                                        <Typography
                                                            variant="h6"
                                                            fontWeight="900"
                                                            color={(trade.pnl && trade.pnl !== 0)
                                                                ? (trade.pnl >= 0 ? 'success.main' : 'error.main')
                                                                : 'text.primary'}
                                                        >
                                                            {(trade.pnl && trade.pnl !== 0)
                                                                ? formatCurrency(trade.pnl)
                                                                : formatCurrency((trade.entryPrice * trade.quantity) + (trade.fees || 0))}
                                                        </Typography>
                                                    </Box>
                                                </Box>

                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pl: 2 }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {trade.strategy || 'No Strategy'}
                                                    </Typography>
                                                    <Stack direction="row" spacing={0.5} alignItems="center" color="primary.main">
                                                        <Typography variant="caption" fontWeight="bold">DETAILS</Typography>
                                                        <ArrowForward fontSize="small" sx={{ fontSize: 14 }} />
                                                    </Stack>
                                                </Box>
                                            </CardActionArea>
                                        </Paper>
                                    ))
                                )}
                            </Stack>
                        </DialogContent>
                    </>
                )}
            </Dialog>
        </Box>
    );
};
