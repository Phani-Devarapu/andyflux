/* eslint-disable react-hooks/incompatible-library */
import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    MenuItem,
    Grid,
    FormControlLabel,
    Switch,
    InputAdornment,
    Typography,
    Box
} from '@mui/material';
import { DollarSign, RefreshCw } from 'lucide-react';
import { DEFAULT_EXPENSE_CATEGORIES, type Expense } from '../../types/expenseTypes';
import { expenseDb } from '../../db/expenseDb';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { useAuth } from '../../context/AuthContext';
import { useAccount } from '../../context/AccountContext';
import { format } from 'date-fns';
import { RecurringExpenseService } from '../../services/RecurringExpenseService';

interface AddExpenseDialogProps {
    open: boolean;
    onClose: () => void;
    editExpense?: Expense | null;
    onSave?: () => void;
}

interface ExpenseFormValues {
    date: string; // YYYY-MM-DD for date input
    amount: string;
    category: string;
    description: string;
    isRecurring: boolean;
    frequency: 'monthly' | 'yearly';
}

export function AddExpenseDialog({ open, onClose, editExpense, onSave }: AddExpenseDialogProps) {
    const { user } = useAuth();
    const { selectedAccount } = useAccount();

    const { control, handleSubmit, reset, watch } = useForm<ExpenseFormValues>({
        defaultValues: {
            date: format(new Date(), 'yyyy-MM-dd'),
            amount: '',
            category: 'software',
            description: '',
            isRecurring: false,
            frequency: 'monthly'
        }
    });

    const isRecurring = watch('isRecurring');

    useEffect(() => {
        if (open) {
            if (editExpense) {
                reset({
                    date: format(editExpense.date, 'yyyy-MM-dd'),
                    amount: editExpense.amount.toString(),
                    category: editExpense.category,
                    description: editExpense.description || '',
                    isRecurring: editExpense.isRecurring,
                    frequency: editExpense.frequency || 'monthly'
                });
            } else {
                reset({
                    date: format(new Date(), 'yyyy-MM-dd'),
                    amount: '',
                    category: 'software',
                    description: '',
                    isRecurring: false,
                    frequency: 'monthly'
                });
            }
        }
    }, [open, editExpense, reset]);

    const onSubmit = async (data: ExpenseFormValues) => {
        if (!user) return;

        try {
            // Parse date string back to Date object (noon to avoid timezone shift issues on simple dates)
            const dateObj = new Date(data.date + 'T12:00:00');

            const expenseData: Expense = {
                userId: user.uid,
                accountId: selectedAccount,
                date: dateObj,
                amount: parseFloat(data.amount),
                category: data.category,
                description: data.description,
                isRecurring: data.isRecurring,
                frequency: data.isRecurring ? data.frequency : undefined,
                updatedAt: new Date(),
                createdAt: editExpense?.createdAt || new Date() // Keep original creation date if editing
            };

            if (editExpense?.id) {
                await expenseDb.expenses.update(editExpense.id, expenseData);
                // Note: Updating a recurring expense's rule is a separate feature ("Manage Subscriptions")
                // We could implement rule updates here too if we linked expense->ruleId
            } else {
                await expenseDb.expenses.add(expenseData);

                // If adding a new expense and it's recurring, CREATE A RULE
                if (expenseData.isRecurring) {
                    await RecurringExpenseService.createRuleFromExpense(expenseData);
                }
            }

            onSave?.();
            onClose();
        } catch (error) {
            console.error('Failed to save expense:', error);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                {editExpense ? 'Edit Expense' : 'Add New Expense'}
            </DialogTitle>
            <form onSubmit={handleSubmit(onSubmit)}>
                <DialogContent>
                    <Grid container spacing={2}>
                        {/* Amount */}
                        <Grid size={{ xs: 12 }}>
                            <Controller
                                name="amount"
                                control={control}
                                rules={{ required: 'Amount is required', min: 0 }}
                                render={({ field, fieldState: { error } }) => (
                                    <TextField
                                        {...field}
                                        label="Amount"
                                        type="number"
                                        fullWidth
                                        error={!!error}
                                        helperText={error?.message}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <DollarSign size={18} />
                                                </InputAdornment>
                                            ),
                                        }}
                                        autoFocus
                                    />
                                )}
                            />
                        </Grid>

                        {/* Date */}
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Controller
                                name="date"
                                control={control}
                                render={({ field: { value, onChange } }) => (
                                    <DatePicker
                                        label="Date"
                                        value={value ? new Date(value) : null}
                                        onChange={(newValue) => {
                                            if (newValue) {
                                                onChange(format(newValue, 'yyyy-MM-dd'));
                                            }
                                        }}
                                        slotProps={{ textField: { fullWidth: true } }}
                                    />
                                )}
                            />
                        </Grid>

                        {/* Category */}
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Controller
                                name="category"
                                control={control}
                                rules={{ required: true }}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        select
                                        label="Category"
                                        fullWidth
                                    >
                                        {DEFAULT_EXPENSE_CATEGORIES.map((cat) => {
                                            const Icon = getCategoryIcon(cat.icon);
                                            return (
                                                <MenuItem key={cat.id} value={cat.id}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                        <Icon size={18} color={cat.color} />
                                                        {cat.name}
                                                    </Box>
                                                </MenuItem>
                                            );
                                        })}
                                    </TextField>
                                )}
                            />
                        </Grid>

                        {/* Description */}
                        <Grid size={{ xs: 12 }}>
                            <Controller
                                name="description"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        label="Description (Optional)"
                                        fullWidth
                                        placeholder="e.g. TradingView Subscription"
                                    />
                                )}
                            />
                        </Grid>

                        {/* Recurring Switch */}
                        <Grid size={{ xs: 12 }}>
                            <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <Controller
                                    name="isRecurring"
                                    control={control}
                                    render={({ field: { value, onChange } }) => (
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={value}
                                                    onChange={onChange}
                                                    color="primary"
                                                />
                                            }
                                            label={
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <RefreshCw size={16} />
                                                    <Typography fontWeight={500}>Recurring Subscription?</Typography>
                                                </Box>
                                            }
                                        />
                                    )}
                                />

                                {isRecurring && (
                                    <Controller
                                        name="frequency"
                                        control={control}
                                        render={({ field }) => (
                                            <TextField
                                                {...field}
                                                select
                                                label="Billing Frequency"
                                                size="small"
                                                fullWidth
                                            >
                                                <MenuItem value="monthly">Monthly</MenuItem>
                                                <MenuItem value="yearly">Yearly</MenuItem>
                                            </TextField>
                                        )}
                                    />
                                )}
                            </Box>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button type="submit" variant="contained">
                        {editExpense ? 'Save Changes' : 'Add Expense'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
