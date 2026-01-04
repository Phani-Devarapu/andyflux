import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useAuth } from '../../context/AuthContext';
import { useAccount } from '../../context/AccountContext';
import {
    Box,
    Typography,
    LinearProgress,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Stack
} from '@mui/material';
import { Target, Edit2 } from 'lucide-react';
import { formatCurrency } from '../../utils/calculations';

export function GoalsWidget() {
    const { user } = useAuth();
    const { selectedAccount } = useAccount();
    const [open, setOpen] = useState(false);

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-12

    // Fetch Goal for valid account
    const goal = useLiveQuery(async () => {
        if (!user || !selectedAccount) return null;
        return await db.goals
            .where('[userId+accountId+year+month]')
            .equals([user.uid, selectedAccount, currentYear, currentMonth])
            .first();
    }, [user, selectedAccount, currentYear, currentMonth]);

    // Fetch Stats to compare against goal
    const currentStats = useLiveQuery(async () => {
        if (!user || !selectedAccount) return { pnl: 0, volume: 0, winRate: 0 };

        const trades = await db.trades
            .where('[userId+accountId]')
            .equals([user.uid, selectedAccount])
            .filter(t =>
                t.status === 'Closed' &&
                t.exitDate !== undefined &&
                t.exitDate.getFullYear() === currentYear &&
                t.exitDate.getMonth() + 1 === currentMonth
            )
            .toArray();

        const pnl = trades.reduce((acc, t) => acc + (t.pnl || 0), 0);
        // Volume could be 'number of trades' or 'total traded volume'. Let's use # of trades for simplicity or allow user to choose?
        // User request: "Monthly Goals". Usually PnL.
        // Let's support PnL primarily.

        return { pnl };
    }, [user, selectedAccount, currentYear, currentMonth]);

    // Form State
    const [targetAmount, setTargetAmount] = useState<string>('');

    useEffect(() => {
        if (open && goal) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setTargetAmount(goal.targetAmount.toString());
        }
    }, [open, goal]);

    const handleSave = async () => {
        if (!user || !selectedAccount) return;
        const amount = parseFloat(targetAmount);
        if (isNaN(amount)) return;

        try {
            if (goal && goal.id) {
                await db.goals.update(goal.id, {
                    targetAmount: amount,
                    updatedAt: new Date()
                });
            } else {
                await db.goals.add({
                    userId: user.uid,
                    accountId: selectedAccount,
                    year: currentYear,
                    month: currentMonth,
                    type: 'PnL', // Default to PnL for now
                    targetAmount: amount,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }
            setOpen(false);
        } catch (error) {
            console.error('Failed to save goal:', error);
            alert('Failed to save goal');
        }
    };

    if (!user || !selectedAccount) return null;

    const progress = currentStats && goal
        ? Math.min(Math.max((currentStats.pnl / goal.targetAmount) * 100, 0), 100)
        : 0;

    const isGoalReached = currentStats && goal && currentStats.pnl >= goal.targetAmount;

    return (
        <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Target size={16} /> Monthly Goal
                </Typography>
                <IconButton size="small" onClick={() => setOpen(true)}>
                    <Edit2 size={14} />
                </IconButton>
            </Stack>

            {goal ? (
                <>
                    <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
                        <Typography
                            variant="h5"
                            fontWeight="800"
                            sx={{
                                background: isGoalReached
                                    ? 'linear-gradient(45deg, #10B981 30%, #34D399 90%)' // Emerald gradient
                                    : 'linear-gradient(45deg, #2563EB 30%, #7C3AED 90%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            {currentStats ? formatCurrency(currentStats.pnl) : '$0.00'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" fontWeight="500">
                            / {formatCurrency(goal.targetAmount)}
                        </Typography>
                    </Stack>
                    <Box sx={{ position: 'relative' }}>
                        <LinearProgress
                            variant="determinate"
                            value={progress}
                            sx={{
                                height: 8,
                                borderRadius: 4,
                                bgcolor: 'action.hover',
                                '& .MuiLinearProgress-bar': {
                                    borderRadius: 4,
                                    background: isGoalReached
                                        ? 'linear-gradient(90deg, #10B981, #34D399)'
                                        : 'linear-gradient(90deg, #2563EB, #7C3AED)',
                                }
                            }}
                        />
                    </Box>
                    {isGoalReached && (
                        <Typography variant="caption" sx={{
                            display: 'block',
                            mt: 1.5,
                            textAlign: 'center',
                            fontWeight: 'bold',
                            color: 'success.main',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            animation: 'pulse 2s infinite'
                        }}>
                            🎉 Goal Reached!
                        </Typography>
                    )}
                </>
            ) : (
                <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    startIcon={<Target size={14} />}
                    onClick={() => setOpen(true)}
                    sx={{ mt: 1, borderStyle: 'dashed' }}
                >
                    Set Monthly Target
                </Button>
            )}

            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Set Monthly PnL Goal</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 1 }}>
                        <TextField
                            autoFocus
                            label="Target PnL Amount ($)"
                            type="number"
                            fullWidth
                            value={targetAmount}
                            onChange={(e) => setTargetAmount(e.target.value)}
                            placeholder="1000"
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave} variant="contained">Save Goal</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
