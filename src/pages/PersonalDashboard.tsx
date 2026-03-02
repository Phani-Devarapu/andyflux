import { useMemo, useState } from 'react';
import {
    Box, Card, CardContent, Typography, LinearProgress, Chip, Stack,
    useTheme, Button, Dialog, DialogTitle, DialogContent, Paper, Divider,
    alpha, Grid
} from '@mui/material';
import {
    TrendingUp, TrendingDown, DollarSign, Activity, Upload,
    ArrowRight, Wallet, Zap, ShieldCheck, CreditCard, Calendar
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFirestoreExpenses } from '../hooks/useFirestoreExpenses';
import {
    calculateFinancialHealth, calculateSavingsRate,
    calculateBudgetAdherence, calculateSpendingTrend
} from '../utils/financialHealthCalculator';
import { formatCurrency } from '../utils/calculations';
import { startOfMonth, endOfMonth, subMonths, isWithinInterval, format } from 'date-fns';
import { PDFStatementUpload } from '../components/expenses/PDFStatementUpload';
import { DEFAULT_EXPENSE_CATEGORIES } from '../types/expenseTypes';
import { getCategoryIcon } from '../utils/categoryIcons';
import { buildMonthlyTotals, generateInsights, loadBudgets } from '../utils/expenseUIUtils';

// ---------------------------------------------------------------------------
// Health Score Ring (SVG)
// ---------------------------------------------------------------------------
function HealthRing({ score, grade }: { score: number; grade: string }) {
    const theme = useTheme();
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const ringColor =
        score >= 80 ? theme.palette.success.main :
            score >= 60 ? theme.palette.info.main :
                score >= 40 ? theme.palette.warning.main :
                    theme.palette.error.main;

    return (
        <Box sx={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
            <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
                {/* Track */}
                <circle cx="70" cy="70" r={radius} fill="none"
                    stroke={alpha(ringColor, 0.15)} strokeWidth="12" />
                {/* Progress */}
                <circle cx="70" cy="70" r={radius} fill="none"
                    stroke={ringColor} strokeWidth="12"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                />
            </svg>
            {/* Centre label */}
            <Box sx={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center'
            }}>
                <Typography variant="h4" fontWeight={800} sx={{ color: ringColor, lineHeight: 1 }}>
                    {score}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Grade {grade}
                </Typography>
            </Box>
        </Box>
    );
}

// ---------------------------------------------------------------------------
// Mini Stat Card
// ---------------------------------------------------------------------------
interface StatCardProps {
    label: string;
    value: string;
    sub?: string;
    icon: React.ReactNode;
    color: string;
    trend?: { value: number; label: string };
}

function StatCard({ label, value, sub, icon, color, trend }: StatCardProps) {
    const theme = useTheme();
    return (
        <Paper sx={{
            p: 2.5, borderRadius: 3,
            border: `1px solid ${theme.palette.divider}`,
            height: '100%'
        }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <Box sx={{
                    p: 1.25, borderRadius: 2, bgcolor: alpha(color, 0.12),
                    color: color, display: 'flex', alignItems: 'center'
                }}>
                    {icon}
                </Box>
                {trend && (
                    <Box sx={{
                        display: 'flex', alignItems: 'center', gap: 0.3,
                        px: 1, py: 0.3, borderRadius: 2, fontSize: '0.72rem', fontWeight: 700,
                        bgcolor: trend.value > 0
                            ? alpha(theme.palette.error.main, 0.1)
                            : alpha(theme.palette.success.main, 0.1),
                        color: trend.value > 0 ? 'error.main' : 'success.main',
                    }}>
                        {trend.value > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {Math.abs(trend.value).toFixed(1)}%
                    </Box>
                )}
            </Box>
            <Typography variant="h5" fontWeight={800} sx={{ mt: 1.5, mb: 0.25 }}>
                {value}
            </Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={500}>{label}</Typography>
            {sub && (
                <Typography variant="caption" display="block" color="text.disabled">{sub}</Typography>
            )}
        </Paper>
    );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------
export function PersonalDashboard() {
    const theme = useTheme();
    const { expenses, loading } = useFirestoreExpenses();
    const [showUpload, setShowUpload] = useState(false);
    const now = new Date();

    // --- Data derivation ---
    const personalExpenses = useMemo(
        () => expenses.filter(e => e.accountId === 'PERSONAL'),
        [expenses]
    );

    const monthlyData = useMemo(() => {
        const currentStart = startOfMonth(now);
        const currentEnd = endOfMonth(now);
        const lastStart = startOfMonth(subMonths(now, 1));
        const lastEnd = endOfMonth(subMonths(now, 1));

        const current = personalExpenses.filter(e =>
            isWithinInterval(new Date(e.date), { start: currentStart, end: currentEnd })
        );
        const last = personalExpenses.filter(e =>
            isWithinInterval(new Date(e.date), { start: lastStart, end: lastEnd })
        );

        const currentTotal = current.reduce((s, e) => s + e.amount, 0);
        const lastTotal = last.reduce((s, e) => s + e.amount, 0);

        const byCategory: Record<string, number> = {};
        current.forEach(e => {
            byCategory[e.category || 'other'] = (byCategory[e.category || 'other'] || 0) + e.amount;
        });

        return { current, last, currentTotal, lastTotal, byCategory };
    }, [personalExpenses]);

    const healthData = useMemo(() => {
        const monthlyIncome = 5000;
        const savingsRate = calculateSavingsRate(monthlyIncome, monthlyData.currentTotal);
        const budgets = { Groceries: 800, Entertainment: 300, Transportation: 400, Utilities: 200, Other: 500 };
        const budgetAdherence = calculateBudgetAdherence(monthlyData.current, budgets);
        const spendingTrend = calculateSpendingTrend(monthlyData.currentTotal, monthlyData.lastTotal);
        return calculateFinancialHealth({ savingsRate, budgetAdherence, spendingTrend });
    }, [monthlyData]);

    const trendData = useMemo(
        () => buildMonthlyTotals(personalExpenses, now, 6),
        [personalExpenses]
    );

    const budgets = useMemo(() => loadBudgets(), []);
    const insights = useMemo(
        () => generateInsights(monthlyData.current, personalExpenses, now, budgets),
        [monthlyData.current, personalExpenses, budgets]
    );

    const recentTransactions = useMemo(
        () => personalExpenses
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 6),
        [personalExpenses]
    );

    const topCategories = useMemo(
        () => Object.entries(monthlyData.byCategory)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5),
        [monthlyData.byCategory]
    );

    if (loading) {
        return (
            <Box sx={{ p: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Zap size={20} color={theme.palette.primary.main} />
                <Typography color="text.secondary">Loading your dashboard…</Typography>
            </Box>
        );
    }

    const changePercent = monthlyData.lastTotal > 0
        ? ((monthlyData.currentTotal - monthlyData.lastTotal) / monthlyData.lastTotal) * 100
        : 0;
    const avgTxn = monthlyData.current.length > 0
        ? monthlyData.currentTotal / monthlyData.current.length
        : 0;
    const trendMax = Math.max(...trendData.map(t => t.total), 1);

    return (
        <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto' }}>

            {/* ── Header ── */}
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                        <Wallet size={28} color={theme.palette.primary.main} />
                        <Typography variant="h4" fontWeight={800}>Financial Dashboard</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                        Personal account overview · {format(now, 'MMMM yyyy')}
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<Upload size={16} />}
                    onClick={() => setShowUpload(true)}
                    sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 600, px: 2.5 }}
                >
                    Upload Statement
                </Button>
            </Box>

            {/* ── Upload Dialog ── */}
            <Dialog open={showUpload} onClose={() => setShowUpload(false)} maxWidth="sm" fullWidth>
                <DialogTitle fontWeight={700}>Upload Credit Card Statement</DialogTitle>
                <DialogContent><PDFStatementUpload /></DialogContent>
            </Dialog>

            {/* ── Row 1: Health Score + 3 Stat Cards ── */}
            <Grid container spacing={2.5} sx={{ mb: 3 }}>

                {/* Health Score (spans 2 rows on md) */}
                <Grid size={{ xs: 12, md: 4 }}>
                    <Paper sx={{
                        p: 3, borderRadius: 3, height: '100%',
                        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.06)}, ${alpha(theme.palette.secondary.main, 0.06)})`,
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`
                    }}>
                        <Typography variant="overline" color="text.secondary" fontWeight={700} letterSpacing={1.5}>
                            Financial Health
                        </Typography>

                        {/* Ring + score */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, my: 2.5 }}>
                            <HealthRing score={healthData.score} grade={healthData.grade} />
                            <Box>
                                <Chip
                                    label={healthData.grade === 'A' ? 'Excellent' : healthData.grade === 'B' ? 'Good' : healthData.grade === 'C' ? 'Fair' : 'Needs Work'}
                                    size="small"
                                    color={healthData.grade === 'A' ? 'success' : healthData.grade === 'B' ? 'info' : healthData.grade === 'C' ? 'warning' : 'error'}
                                    sx={{ mb: 1, fontWeight: 700 }}
                                />
                                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 160 }}>
                                    {healthData.message}
                                </Typography>
                            </Box>
                        </Box>

                        <Divider sx={{ mb: 2 }} />

                        {/* Sub-scores */}
                        <Stack spacing={1.5}>
                            {[
                                { label: 'Savings Rate', value: healthData.breakdown.savingsScore, max: 40, color: theme.palette.primary.main },
                                { label: 'Budget Adherence', value: healthData.breakdown.budgetScore, max: 35, color: theme.palette.secondary.main },
                                { label: 'Spending Trend', value: healthData.breakdown.trendScore, max: 25, color: theme.palette.success.main },
                            ].map(s => (
                                <Box key={s.label}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                                        <Typography variant="caption" fontWeight={700}>{s.value}/{s.max}</Typography>
                                    </Box>
                                    <LinearProgress
                                        variant="determinate"
                                        value={(s.value / s.max) * 100}
                                        sx={{
                                            height: 6, borderRadius: 3,
                                            bgcolor: alpha(s.color, 0.12),
                                            '& .MuiLinearProgress-bar': { bgcolor: s.color, borderRadius: 3 }
                                        }}
                                    />
                                </Box>
                            ))}
                        </Stack>
                    </Paper>
                </Grid>

                {/* Right 3 stat cards + mini trend */}
                <Grid size={{ xs: 12, md: 8 }}>
                    <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <StatCard
                                label="Spent This Month"
                                value={formatCurrency(monthlyData.currentTotal)}
                                sub={`${monthlyData.current.length} transactions`}
                                icon={<DollarSign size={20} />}
                                color={theme.palette.primary.main}
                                trend={monthlyData.lastTotal > 0 ? { value: changePercent, label: 'vs last month' } : undefined}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <StatCard
                                label="Avg per Transaction"
                                value={formatCurrency(avgTxn)}
                                sub="current month"
                                icon={<CreditCard size={20} />}
                                color={theme.palette.info.main}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <StatCard
                                label="Last Month"
                                value={formatCurrency(monthlyData.lastTotal)}
                                sub={`${monthlyData.last.length} transactions`}
                                icon={<Calendar size={20} />}
                                color={theme.palette.secondary.main}
                            />
                        </Grid>
                    </Grid>

                    {/* Mini 6-month bar chart */}
                    <Paper sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="subtitle2" fontWeight={700}>6-Month Trend</Typography>
                            <Button
                                component={Link} to="/expenses" size="small"
                                endIcon={<ArrowRight size={14} />}
                                sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                            >
                                View Details
                            </Button>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 72 }}>
                            {trendData.map((m, i) => {
                                const isLast = i === trendData.length - 1;
                                const barH = trendMax > 0 ? (m.total / trendMax) * 100 : 0;
                                return (
                                    <Box key={m.label} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                                        <Box sx={{
                                            width: '100%', height: `${barH}%`, minHeight: 3,
                                            bgcolor: isLast ? theme.palette.primary.main : alpha(theme.palette.primary.main, 0.3),
                                            borderRadius: '4px 4px 0 0',
                                            transition: 'height 0.5s ease'
                                        }} />
                                        <Typography variant="caption" color="text.secondary"
                                            sx={{ fontSize: '0.6rem', fontWeight: isLast ? 700 : 400 }}>
                                            {m.label}
                                        </Typography>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            {/* ── Row 2: Smart Insights + Categories + Transactions ── */}
            <Grid container spacing={2.5}>

                {/* Smart Insights — only when present */}
                {insights.length > 0 && (
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Paper sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${theme.palette.divider}`, height: '100%' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                <Zap size={16} color={theme.palette.warning.main} />
                                <Typography variant="subtitle2" fontWeight={700}>Smart Insights</Typography>
                            </Box>
                            <Stack spacing={1}>
                                {insights.map(ins => {
                                    const bgColor =
                                        ins.severity === 'positive' ? theme.palette.success.main :
                                            ins.severity === 'warning' ? theme.palette.warning.main :
                                                ins.severity === 'info' ? theme.palette.info.main :
                                                    theme.palette.divider;
                                    return (
                                        <Box key={ins.id} sx={{
                                            display: 'flex', gap: 1.5, p: 1.5, borderRadius: 2.5,
                                            bgcolor: alpha(bgColor, 0.07),
                                            border: `1px solid ${alpha(bgColor, 0.2)}`
                                        }}>
                                            <Typography sx={{ fontSize: '1rem', flexShrink: 0 }}>{ins.emoji}</Typography>
                                            <Typography variant="caption" sx={{ lineHeight: 1.5, fontWeight: 500 }}>
                                                {ins.text}
                                            </Typography>
                                        </Box>
                                    );
                                })}
                            </Stack>
                        </Paper>
                    </Grid>
                )}

                {/* Top Categories */}
                <Grid size={{ xs: 12, md: insights.length > 0 ? 4 : 5 }}>
                    <Paper sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${theme.palette.divider}`, height: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                            <Activity size={16} color={theme.palette.secondary.main} />
                            <Typography variant="subtitle2" fontWeight={700}>Top Categories</Typography>
                        </Box>
                        {topCategories.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">No expenses this month.</Typography>
                        ) : (
                            <Stack spacing={2}>
                                {topCategories.map(([catId, amount]) => {
                                    const cat = DEFAULT_EXPENSE_CATEGORIES.find(c => c.id === catId);
                                    const Icon = getCategoryIcon(cat?.icon ?? 'MoreHorizontal');
                                    const pct = (amount / monthlyData.currentTotal) * 100;
                                    return (
                                        <Box key={catId}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Icon size={14} color={cat?.color ?? theme.palette.text.secondary} />
                                                    <Typography variant="body2" fontWeight={600}>
                                                        {cat?.name ?? catId}
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Typography variant="caption" color="text.secondary">{pct.toFixed(0)}%</Typography>
                                                    <Typography variant="body2" fontWeight={700}>{formatCurrency(amount)}</Typography>
                                                </Box>
                                            </Box>
                                            <LinearProgress
                                                variant="determinate"
                                                value={pct}
                                                sx={{
                                                    height: 6, borderRadius: 3,
                                                    bgcolor: alpha(cat?.color ?? theme.palette.primary.main, 0.15),
                                                    '& .MuiLinearProgress-bar': {
                                                        bgcolor: cat?.color ?? theme.palette.primary.main,
                                                        borderRadius: 3
                                                    }
                                                }}
                                            />
                                        </Box>
                                    );
                                })}
                            </Stack>
                        )}
                    </Paper>
                </Grid>

                {/* Recent Transactions */}
                <Grid size={{ xs: 12, md: insights.length > 0 ? 4 : 7 }}>
                    <Paper sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${theme.palette.divider}`, height: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <ShieldCheck size={16} color={theme.palette.success.main} />
                                <Typography variant="subtitle2" fontWeight={700}>Recent Transactions</Typography>
                            </Box>
                            <Button
                                component={Link} to="/expenses"
                                size="small" endIcon={<ArrowRight size={14} />}
                                sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                            >
                                View All
                            </Button>
                        </Box>
                        {recentTransactions.length === 0 ? (
                            <Box sx={{ textAlign: 'center', py: 4 }}>
                                <Typography variant="body2" color="text.secondary">No transactions yet.</Typography>
                                <Button component={Link} to="/expenses" size="small"
                                    sx={{ mt: 1, textTransform: 'none' }}>
                                    Add your first expense →
                                </Button>
                            </Box>
                        ) : (
                            <Stack divider={<Divider />} spacing={0}>
                                {recentTransactions.map(expense => {
                                    const cat = DEFAULT_EXPENSE_CATEGORIES.find(c => c.id === expense.category);
                                    const Icon = getCategoryIcon(cat?.icon ?? 'MoreHorizontal');
                                    return (
                                        <Box key={expense.id} sx={{
                                            display: 'flex', alignItems: 'center',
                                            justifyContent: 'space-between', py: 1.25, gap: 1
                                        }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                                                <Box sx={{
                                                    p: 0.8, borderRadius: 1.5, flexShrink: 0,
                                                    bgcolor: alpha(cat?.color ?? theme.palette.primary.main, 0.12),
                                                }}>
                                                    <Icon size={14} color={cat?.color ?? theme.palette.primary.main} />
                                                </Box>
                                                <Box sx={{ minWidth: 0 }}>
                                                    <Typography variant="body2" fontWeight={600} noWrap>
                                                        {expense.description || cat?.name || 'Expense'}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {format(new Date(expense.date), 'MMM d')} · {cat?.name ?? expense.category}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                            <Typography variant="body2" fontWeight={700} color="error.main" sx={{ flexShrink: 0 }}>
                                                −{formatCurrency(expense.amount)}
                                            </Typography>
                                        </Box>
                                    );
                                })}
                            </Stack>
                        )}
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
}
