import { useState, useMemo, useEffect } from 'react';
import {
    Box, Typography, Button, Container, Grid, Fab, useTheme,
    MenuItem, Select, FormControl, InputLabel, InputAdornment,
    TextField, Paper
} from '@mui/material';
import { Plus, Wallet, GitCompare, Search, Receipt } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAccount } from '../context/AccountContext';
import { ExpenseStats } from '../components/expenses/ExpenseStats';
import { SubscriptionList } from '../components/expenses/SubscriptionList';
import { ExpenseCard } from '../components/expenses/ExpenseCard';
import { AddExpenseDialog } from '../components/expenses/AddExpenseDialog';
import { MonthComparisonView } from '../components/expenses/MonthComparisonView';
import { SpendingTrendChart } from '../components/expenses/SpendingTrendChart';
import { TopMerchants } from '../components/expenses/TopMerchants';
import { CategoryBudgets } from '../components/expenses/CategoryBudgets';
import { SmartInsightsFeed } from '../components/expenses/SmartInsightsFeed';
import { DEFAULT_EXPENSE_CATEGORIES, type Expense } from '../types/expenseTypes';
import { useFirestoreExpenses } from '../hooks/useFirestoreExpenses';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { RecurringExpenseService } from '../services/recurringExpenseService';
import { generateInsights, detectAnomalies, loadBudgets } from '../utils/expenseUIUtils';

export function ExpenseManagerPage() {
    const { user } = useAuth();
    const { selectedAccount } = useAccount();
    const theme = useTheme();
    const [openAdd, setOpenAdd] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [compareMode, setCompareMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Date filtering state
    const currentDate = new Date();
    const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
    const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
    const [showAllTime, setShowAllTime] = useState(false);

    // Fetch expenses from Firestore hook
    const { expenses: allExpenses, loading } = useFirestoreExpenses();

    // Filter expenses by account and date
    const expenses = useMemo(() => {
        if (!user || !selectedAccount) return [];

        let filtered = allExpenses.filter(e => e.accountId === selectedAccount);

        // Apply date filter if not showing all time
        if (!showAllTime) {
            const monthStart = startOfMonth(new Date(selectedYear, selectedMonth));
            const monthEnd = endOfMonth(new Date(selectedYear, selectedMonth));

            filtered = filtered.filter(e => {
                const expenseDate = new Date(e.date);
                return isWithinInterval(expenseDate, { start: monthStart, end: monthEnd });
            });
        }

        return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [allExpenses, user, selectedAccount, selectedMonth, selectedYear, showAllTime]);

    // Filter by search query
    const filteredExpenses = useMemo(() => {
        if (!searchQuery.trim()) return expenses;
        const q = searchQuery.toLowerCase();
        return expenses.filter(e => {
            const cat = DEFAULT_EXPENSE_CATEGORIES.find(c => c.id === e.category);
            return (
                (e.description ?? '').toLowerCase().includes(q) ||
                (cat?.name ?? '').toLowerCase().includes(q)
            );
        });
    }, [expenses, searchQuery]);

    // Account-scoped all-time expenses
    const accountExpenses = useMemo(
        () => allExpenses.filter(e => e.accountId === selectedAccount),
        [allExpenses, selectedAccount]
    );

    // Smart Insights + Anomaly Detection
    const budgets = useMemo(() => loadBudgets(), []);
    const insights = useMemo(
        () => generateInsights(expenses, accountExpenses, new Date(), budgets),
        [expenses, accountExpenses, budgets]
    );
    const anomalyIds = useMemo(
        () => new Set(detectAnomalies(expenses).map(a => a.expenseId)),
        [expenses]
    );

    // Get available years from expenses
    const availableYears = useMemo(() => {
        const years = new Set(allExpenses.map(e => new Date(e.date).getFullYear()));
        return Array.from(years).sort((a, b) => b - a);
    }, [allExpenses]);

    const handleEdit = (expense: Expense) => {
        setEditingExpense(expense);
        setOpenAdd(true);
    };

    const handleDelete = async (id: number | string) => {
        if (!user) return;
        if (window.confirm('Are you sure you want to delete this expense?')) {
            try {
                await deleteDoc(doc(db, 'users', user.uid, 'expenses', id.toString()));
            } catch (err) {
                console.error("Delete failed", err);
                alert("Failed to delete expense");
            }
        }
    };

    const handleCloseDialog = () => {
        setOpenAdd(false);
        setEditingExpense(null);
    };

    // Auto-process recurring rules on load or account change
    useEffect(() => {
        if (user && selectedAccount) {
            RecurringExpenseService.processRules(user.uid, selectedAccount)
                .then(count => {
                    if (count > 0) {
                        console.log(`Generated ${count} recurring expenses`);
                    }
                })
                .catch(err => console.error("Failed to process rules:", err));
        }
    }, [user, selectedAccount]);

    if (loading) return null;

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return (
        <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 }, pb: { xs: 12, md: 10 } }}>

            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4, flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Typography variant="h4" fontWeight={800} sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, fontSize: { xs: '1.5rem', md: '2.125rem' } }}>
                        <Wallet size={32} color={theme.palette.primary.main} />
                        Expense Manager
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                        Track your operational costs, subscriptions, and overhead.
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Button
                        variant={compareMode ? 'contained' : 'outlined'}
                        startIcon={<GitCompare />}
                        onClick={() => setCompareMode(v => !v)}
                        color={compareMode ? 'secondary' : 'inherit'}
                        sx={{ px: 2.5, py: 1.5, borderRadius: 3, textTransform: 'none', fontWeight: 600 }}
                    >
                        Compare Months
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<Plus />}
                        onClick={() => setOpenAdd(true)}
                        sx={{ px: 3, py: 1.5, borderRadius: 3, textTransform: 'none', fontWeight: 600 }}
                    >
                        Add Expense
                    </Button>
                </Box>
            </Box>

            {/* Date Filter Controls */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Month</InputLabel>
                    <Select
                        value={showAllTime ? '' : selectedMonth}
                        label="Month"
                        onChange={(e) => {
                            setSelectedMonth(Number(e.target.value));
                            setShowAllTime(false);
                        }}
                        disabled={showAllTime}
                    >
                        {months.map((month, index) => (
                            <MenuItem key={index} value={index}>{month}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Year</InputLabel>
                    <Select
                        value={showAllTime ? '' : selectedYear}
                        label="Year"
                        onChange={(e) => {
                            setSelectedYear(Number(e.target.value));
                            setShowAllTime(false);
                        }}
                        disabled={showAllTime}
                    >
                        {availableYears.length > 0 ? (
                            availableYears.map(year => (
                                <MenuItem key={year} value={year}>{year}</MenuItem>
                            ))
                        ) : (
                            <MenuItem value={currentDate.getFullYear()}>{currentDate.getFullYear()}</MenuItem>
                        )}
                    </Select>
                </FormControl>

                <Button
                    variant={showAllTime ? 'contained' : 'outlined'}
                    onClick={() => setShowAllTime(!showAllTime)}
                    sx={{ textTransform: 'none' }}
                >
                    {showAllTime ? 'Showing All Time' : 'Show All Time'}
                </Button>

                <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
                    {showAllTime
                        ? `${accountExpenses.length} total expenses`
                        : `${expenses.length} expenses in ${months[selectedMonth]} ${selectedYear}`}
                </Typography>
            </Box>

            {compareMode ? (
                /* ---- Compare Mode ---- */
                <MonthComparisonView
                    allExpenses={accountExpenses}
                    availableYears={availableYears}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                />
            ) : (
                /* ---- Normal Mode ---- */
                <>
                    {/* Smart Insights */}
                    <SmartInsightsFeed insights={insights} />

                    {/* Spending Trend Chart */}
                    <SpendingTrendChart expenses={accountExpenses} />

                    {/* Stats & Analytics */}
                    <ExpenseStats
                        expenses={expenses}
                        allExpenses={accountExpenses}
                        selectedYear={selectedYear}
                    />

                    {/* Category Budgets + Top Merchants — side by side on md+ */}
                    <Grid container spacing={3} sx={{ mb: 1 }}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <CategoryBudgets expenses={expenses} />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TopMerchants expenses={expenses} />
                        </Grid>
                    </Grid>

                    {/* Subscriptions */}
                    <SubscriptionList />

                    {/* Transactions Header + Search */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                        <Typography variant="h6" fontWeight={700}>
                            {showAllTime ? 'All Transactions' : `Transactions — ${months[selectedMonth]} ${selectedYear}`}
                        </Typography>
                        <TextField
                            size="small"
                            placeholder="Search by name or category…"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            sx={{ ml: 'auto', minWidth: 240 }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Search size={16} color={theme.palette.text.secondary} />
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Box>

                    {filteredExpenses.length === 0 ? (
                        /* ---- Empty State ---- */
                        <Paper sx={{
                            py: 8, textAlign: 'center', borderRadius: 4,
                            border: `2px dashed ${theme.palette.divider}`,
                            bgcolor: 'transparent'
                        }}>
                            <Box sx={{
                                width: 72, height: 72, borderRadius: '50%', mx: 'auto', mb: 2,
                                bgcolor: `${theme.palette.primary.main}15`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Receipt size={36} color={theme.palette.primary.main} strokeWidth={1.5} />
                            </Box>
                            <Typography variant="h6" fontWeight={600} gutterBottom>
                                {searchQuery ? 'No matching transactions' : 'No expenses yet'}
                            </Typography>
                            <Typography color="text.secondary" variant="body2" sx={{ mb: 3, maxWidth: 320, mx: 'auto' }}>
                                {searchQuery
                                    ? `No transactions match "${searchQuery}". Try a different search term.`
                                    : showAllTime
                                        ? 'This account has no expenses recorded.'
                                        : `Nothing recorded for ${months[selectedMonth]} ${selectedYear}. Start tracking your spend!`}
                            </Typography>
                            {!searchQuery && (
                                <Button variant="contained" startIcon={<Plus />} onClick={() => setOpenAdd(true)}
                                    sx={{ textTransform: 'none', borderRadius: 3 }}>
                                    Add your first expense
                                </Button>
                            )}
                        </Paper>
                    ) : (
                        <Grid container spacing={2}>
                            {filteredExpenses.map((expense) => (
                                <Grid size={{ xs: 12 }} key={expense.id}>
                                    <ExpenseCard
                                        expense={expense}
                                        category={DEFAULT_EXPENSE_CATEGORIES.find(c => c.id === expense.category)}
                                        onEdit={handleEdit}
                                        onDelete={handleDelete}
                                        isAnomaly={expense.id ? anomalyIds.has(expense.id) : false}
                                    />
                                </Grid>
                            ))}
                        </Grid>
                    )}
                </>
            )}

            <AddExpenseDialog
                open={openAdd}
                onClose={handleCloseDialog}
                editExpense={editingExpense}
            />

            {/* Mobile FAB */}
            <Fab
                color="primary"
                sx={{ position: 'fixed', bottom: 90, right: 24, display: { md: 'none' }, zIndex: 1100 }}
                onClick={() => setOpenAdd(true)}
            >
                <Plus />
            </Fab>
        </Container>
    );
}
