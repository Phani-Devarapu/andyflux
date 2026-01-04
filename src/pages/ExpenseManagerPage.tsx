import { useState } from 'react';
import { Box, Typography, Button, Container, Grid, Fab, useTheme } from '@mui/material';
import { Plus, Wallet } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { expenseDb } from '../db/expenseDb';
import { useAuth } from '../context/AuthContext';
import { useAccount } from '../context/AccountContext';
import { ExpenseStats } from '../components/expenses/ExpenseStats';
import { SubscriptionList } from '../components/expenses/SubscriptionList';
import { ExpenseCard } from '../components/expenses/ExpenseCard';
import { AddExpenseDialog } from '../components/expenses/AddExpenseDialog';
import { DEFAULT_EXPENSE_CATEGORIES, type Expense } from '../types/expenseTypes';

export function ExpenseManagerPage() {
    const { user } = useAuth();
    const { selectedAccount } = useAccount();
    const theme = useTheme();
    const [openAdd, setOpenAdd] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

    // Fetch expenses LIVE from Dexie
    const expenses = useLiveQuery(
        async () => {
            if (!user) return [];
            const all = await expenseDb.expenses
                .where('[userId+accountId]')
                .equals([user.uid, selectedAccount])
                .reverse() // Newest first
                .sortBy('date');
            return all;
        },
        [user, selectedAccount]
    );

    const handleEdit = (expense: Expense) => {
        setEditingExpense(expense);
        setOpenAdd(true);
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('Are you sure you want to delete this expense?')) {
            await expenseDb.expenses.delete(id);
        }
    };

    const handleCloseDialog = () => {
        setOpenAdd(false);
        setEditingExpense(null);
    };

    if (!expenses) return null; // Loading state could be added

    return (
        <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 }, pb: { xs: 12, md: 10 } }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
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

            {/* Stats & Analytics */}
            <ExpenseStats expenses={expenses} />

            {/* Subscriptions */}
            <SubscriptionList expenses={expenses} />

            {/* Recent Transactions List */}
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                Recent Transactions
            </Typography>

            {expenses.length === 0 ? (
                <Box sx={{ py: 8, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 4 }}>
                    <Typography color="text.secondary">No expenses found for this account.</Typography>
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
