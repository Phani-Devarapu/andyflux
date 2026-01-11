import { useState, useMemo } from 'react';
import { Box, Typography, Button, Container, Grid, Fab, useTheme, MenuItem, Select, FormControl, InputLabel } from '@mui/material';
import { Plus, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAccount } from '../context/AccountContext';
import { ExpenseStats } from '../components/expenses/ExpenseStats';
import { SubscriptionList } from '../components/expenses/SubscriptionList';
import { ExpenseCard } from '../components/expenses/ExpenseCard';
import { AddExpenseDialog } from '../components/expenses/AddExpenseDialog';
import { DEFAULT_EXPENSE_CATEGORIES, type Expense } from '../types/expenseTypes';
import { useFirestoreExpenses } from '../hooks/useFirestoreExpenses';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

export function ExpenseManagerPage() {
    const { user } = useAuth();
    const { selectedAccount } = useAccount();
    const theme = useTheme();
    const [openAdd, setOpenAdd] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

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
                <Button
                    variant="contained"
                    startIcon={<Plus />}
                    onClick={() => setOpenAdd(true)}
                    sx={{ px: 3, py: 1.5, borderRadius: 3, textTransform: 'none', fontWeight: 600 }}
                >
                    Add Expense
                </Button>
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
                    {showAllTime ? `${allExpenses.filter(e => e.accountId === selectedAccount).length} total expenses` : `${expenses.length} expenses in ${months[selectedMonth]} ${selectedYear}`}
                </Typography>
            </Box>

            {/* Stats & Analytics */}
            <ExpenseStats expenses={expenses} allExpenses={allExpenses.filter(e => e.accountId === selectedAccount)} />

            {/* Subscriptions */}
            <SubscriptionList expenses={expenses} />

            {/* Recent Transactions List */}
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                {showAllTime ? 'All Transactions' : `Transactions - ${months[selectedMonth]} ${selectedYear}`}
            </Typography>

            {expenses.length === 0 ? (
                <Box sx={{ py: 8, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 4 }}>
                    <Typography color="text.secondary">
                        {showAllTime ? 'No expenses found for this account.' : `No expenses found for ${months[selectedMonth]} ${selectedYear}.`}
                    </Typography>
                    <Button sx={{ mt: 2 }} onClick={() => setOpenAdd(true)}>
                        Add your first expense
                    </Button>
                </Box>
            ) : (
                <Grid container spacing={2}>
                    {expenses.map((expense) => (
                        <Grid size={{ xs: 12 }} key={expense.id}>
                            <ExpenseCard
                                expense={expense}
                                category={DEFAULT_EXPENSE_CATEGORIES.find(c => c.id === expense.category)}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                            />
                        </Grid>
                    ))}
                </Grid>
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
