import { useState, useMemo } from 'react';
import {
    Box, Paper, Typography, Button, LinearProgress, useTheme, alpha,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Tooltip
} from '@mui/material';
import { Target, Plus, Trash2, Edit2 } from 'lucide-react';
import type { Expense } from '../../types/expenseTypes';
import { DEFAULT_EXPENSE_CATEGORIES } from '../../types/expenseTypes';
import { loadBudgets, saveBudgets, computeBudgetProgress, type CategoryBudget } from '../../utils/expenseUIUtils';
import { getCategoryIcon } from '../../utils/categoryIcons';

interface CategoryBudgetsProps {
    expenses: Expense[]; // current month expenses
}

export function CategoryBudgets({ expenses }: CategoryBudgetsProps) {
    const theme = useTheme();
    const [budgets, setBudgets] = useState<CategoryBudget[]>(loadBudgets);
    const [editOpen, setEditOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    const progress = useMemo(() => computeBudgetProgress(expenses, budgets), [expenses, budgets]);

    const openAdd = () => {
        setEditingId(null);
        setEditValue('');
        setEditOpen(true);
    };

    const openEdit = (b: CategoryBudget) => {
        setEditingId(b.categoryId);
        setEditValue(String(b.limit));
        setEditOpen(true);
    };

    const handleSave = (categoryId: string, limit: number) => {
        let updated: CategoryBudget[];
        if (editingId) {
            updated = budgets.map(b => b.categoryId === categoryId ? { ...b, limit } : b);
        } else {
            // avoid duplicate
            if (budgets.some(b => b.categoryId === categoryId)) {
                updated = budgets.map(b => b.categoryId === categoryId ? { ...b, limit } : b);
            } else {
                updated = [...budgets, { categoryId, limit }];
            }
        }
        setBudgets(updated);
        saveBudgets(updated);
        setEditOpen(false);
    };

    const handleDelete = (categoryId: string) => {
        const updated = budgets.filter(b => b.categoryId !== categoryId);
        setBudgets(updated);
        saveBudgets(updated);
    };

    return (
        <>
            <Paper sx={{ p: 3, borderRadius: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Target size={20} color={theme.palette.success.main} />
                        <Typography variant="h6" fontWeight={600}>Category Budgets</Typography>
                    </Box>
                    <Button
                        size="small" startIcon={<Plus size={14} />}
                        onClick={openAdd}
                        sx={{ textTransform: 'none', borderRadius: 2 }}
                        variant="outlined"
                    >
                        Set Budget
                    </Button>
                </Box>

                {progress.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 3 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            No budgets set yet.
                        </Typography>
                        <Button size="small" onClick={openAdd} sx={{ textTransform: 'none' }}>
                            + Add your first budget
                        </Button>
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {progress.map(p => {
                            const cat = DEFAULT_EXPENSE_CATEGORIES.find(c => c.id === p.categoryId);
                            const Icon = getCategoryIcon(cat?.icon ?? 'MoreHorizontal');
                            const barColor = p.pct >= 100 ? theme.palette.error.main
                                : p.pct >= 75 ? theme.palette.warning.main
                                    : theme.palette.success.main;
                            const budget = budgets.find(b => b.categoryId === p.categoryId)!;

                            return (
                                <Box key={p.categoryId}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Icon size={16} color={cat?.color} />
                                            <Typography variant="body2" fontWeight={600}>{cat?.name ?? p.categoryId}</Typography>
                                            {p.overBudget && (
                                                <Box sx={{
                                                    px: 1, py: 0.2, borderRadius: 1, fontSize: '0.65rem', fontWeight: 700,
                                                    bgcolor: alpha(theme.palette.error.main, 0.12),
                                                    color: 'error.main'
                                                }}>
                                                    OVER
                                                </Box>
                                            )}
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography variant="caption" color="text.secondary">
                                                ${p.spent.toFixed(0)} / ${p.limit.toFixed(0)}
                                            </Typography>
                                            <Tooltip title="Edit budget">
                                                <IconButton size="small" onClick={() => openEdit(budget)}>
                                                    <Edit2 size={12} />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Remove budget">
                                                <IconButton size="small" color="error" onClick={() => handleDelete(p.categoryId)}>
                                                    <Trash2 size={12} />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </Box>
                                    <LinearProgress
                                        variant="determinate"
                                        value={Math.min(p.pct, 100)}
                                        sx={{
                                            height: 8, borderRadius: 4,
                                            bgcolor: alpha(barColor, 0.15),
                                            '& .MuiLinearProgress-bar': { bgcolor: barColor, borderRadius: 4 }
                                        }}
                                    />
                                </Box>
                            );
                        })}
                    </Box>
                )}
            </Paper>

            {/* Add/Edit Budget Dialog */}
            <AddBudgetDialog
                open={editOpen}
                editingId={editingId}
                defaultValue={editValue}
                existingBudgetIds={budgets.map(b => b.categoryId)}
                onSave={handleSave}
                onClose={() => setEditOpen(false)}
            />
        </>
    );
}

// --- Internal dialog ---
interface AddBudgetDialogProps {
    open: boolean;
    editingId: string | null;
    defaultValue: string;
    existingBudgetIds: string[];
    onSave: (categoryId: string, limit: number) => void;
    onClose: () => void;
}

function AddBudgetDialog({ open, editingId, defaultValue, existingBudgetIds, onSave, onClose }: AddBudgetDialogProps) {
    const theme = useTheme();
    const [selectedCat, setSelectedCat] = useState(editingId ?? '');
    const [limitStr, setLimitStr] = useState(defaultValue);

    // Reset when reopened
    const handleOpen = () => {
        setSelectedCat(editingId ?? '');
        setLimitStr(defaultValue);
    };

    const availableCategories = editingId
        ? DEFAULT_EXPENSE_CATEGORIES
        : DEFAULT_EXPENSE_CATEGORIES.filter(c => !existingBudgetIds.includes(c.id ?? ''));

    const limit = parseFloat(limitStr);
    const valid = (editingId ? true : selectedCat !== '') && !isNaN(limit) && limit > 0;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            TransitionProps={{ onEnter: handleOpen }}
            maxWidth="xs"
            fullWidth
        >
            <DialogTitle fontWeight={700}>
                {editingId ? 'Edit Budget' : 'Set Category Budget'}
            </DialogTitle>
            <DialogContent>
                {!editingId && (
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>Category</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                            {availableCategories.map(cat => {
                                const Icon = getCategoryIcon(cat.icon);
                                const sel = selectedCat === cat.id;
                                return (
                                    <Box
                                        key={cat.id}
                                        onClick={() => setSelectedCat(cat.id ?? '')}
                                        sx={{
                                            display: 'flex', alignItems: 'center', gap: 0.5,
                                            px: 1.5, py: 0.8, borderRadius: 2, cursor: 'pointer',
                                            border: `1.5px solid ${sel ? cat.color : theme.palette.divider}`,
                                            bgcolor: sel ? alpha(cat.color, 0.1) : 'transparent',
                                            fontSize: '0.8rem', fontWeight: sel ? 700 : 400,
                                            transition: 'all 0.15s'
                                        }}
                                    >
                                        <Icon size={14} color={cat.color} />
                                        {cat.name}
                                    </Box>
                                );
                            })}
                        </Box>
                    </Box>
                )}
                <TextField
                    label="Monthly Limit (CAD $)"
                    value={limitStr}
                    onChange={e => setLimitStr(e.target.value)}
                    type="number"
                    fullWidth
                    size="small"
                    inputProps={{ min: 1, step: 10 }}
                    sx={{ mt: 1 }}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} sx={{ textTransform: 'none' }}>Cancel</Button>
                <Button
                    variant="contained"
                    disabled={!valid}
                    onClick={() => onSave(editingId ?? selectedCat, limit)}
                    sx={{ textTransform: 'none', borderRadius: 2 }}
                >
                    Save Budget
                </Button>
            </DialogActions>
        </Dialog>
    );
}
