import { useMemo, useState } from 'react';
import {
    Box, Paper, Typography, Grid, FormControl, InputLabel,
    Select, MenuItem, Chip, Divider, useTheme, alpha, Stack, Alert
} from '@mui/material';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement,
    Tooltip, Legend
} from 'chart.js';
import { ArrowUpRight, ArrowDownRight, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { Expense } from '../../types/expenseTypes';
import { DEFAULT_EXPENSE_CATEGORIES } from '../../types/expenseTypes';
import { ExpenseCard } from './ExpenseCard';
import { filterByMonth, buildCategoryMap, computeComparisonStats } from '../../utils/monthComparisonUtils';
import { computeCompareBanner } from '../../utils/expenseUIUtils';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface MonthComparisonViewProps {
    allExpenses: Expense[];
    availableYears: number[];
    onEdit: (expense: Expense) => void;
    onDelete: (id: string) => void;
}

interface PeriodSelector {
    month: number;
    year: number;
}

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];



interface DeltaBadgeProps {
    value: number | null; // percentage delta
    lowerIsBetter?: boolean;
}

function DeltaBadge({ value, lowerIsBetter = true }: DeltaBadgeProps) {
    if (value === null) return <Chip label="N/A" size="small" sx={{ fontSize: '0.7rem' }} />;

    const positive = value > 0;
    // "good" means spending went DOWN (lower is better for expenses)
    const good = lowerIsBetter ? !positive : positive;
    const color = Math.abs(value) < 0.5 ? 'default' : good ? 'success' : 'error';
    const Icon = Math.abs(value) < 0.5 ? Minus : positive ? ArrowUpRight : ArrowDownRight;

    return (
        <Chip
            icon={<Icon size={12} />}
            label={`${positive ? '+' : ''}${value.toFixed(1)}%`}
            size="small"
            color={color as 'default' | 'success' | 'error'}
            variant="outlined"
            sx={{ fontSize: '0.7rem', height: 22 }}
        />
    );
}

interface PeriodPickerProps {
    label: string;
    value: PeriodSelector;
    onChange: (v: PeriodSelector) => void;
    availableYears: number[];
    accentColor: string;
}

function PeriodPicker({ label, value, onChange, availableYears, accentColor }: PeriodPickerProps) {
    return (
        <Box sx={{
            p: 2, borderRadius: 3, border: `2px solid ${accentColor}`,
            bgcolor: alpha(accentColor, 0.05), flex: 1, minWidth: 220
        }}>
            <Typography variant="caption" fontWeight={700} sx={{ color: accentColor, letterSpacing: 1, textTransform: 'uppercase', mb: 1.5, display: 'block' }}>
                {label}
            </Typography>
            <Stack direction="row" spacing={1}>
                <FormControl size="small" fullWidth>
                    <InputLabel>Month</InputLabel>
                    <Select value={value.month} label="Month" onChange={e => onChange({ ...value, month: Number(e.target.value) })}>
                        {MONTHS.map((m, i) => <MenuItem key={i} value={i}>{m}</MenuItem>)}
                    </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 90 }}>
                    <InputLabel>Year</InputLabel>
                    <Select value={value.year} label="Year" onChange={e => onChange({ ...value, year: Number(e.target.value) })}>
                        {(availableYears.length > 0 ? availableYears : [new Date().getFullYear()]).map(y => (
                            <MenuItem key={y} value={y}>{y}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Stack>
        </Box>
    );
}

interface StatCardProps {
    title: string;
    valueA: number | string;
    valueB: number | string;
    delta: number | null;
    lowerIsBetter?: boolean;
    colorA: string;
    colorB: string;
    isCurrency?: boolean;
}

function StatCard({ title, valueA, valueB, delta, lowerIsBetter = true, colorA, colorB, isCurrency = true }: StatCardProps) {
    const fmt = (v: number | string) => {
        if (typeof v === 'number') return isCurrency ? `$${v.toFixed(2)}` : v.toString();
        return v;
    };

    return (
        <Paper sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {title}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                <Box>
                    <Typography variant="h6" fontWeight={700} sx={{ color: colorA }}>{fmt(valueA)}</Typography>
                    <Typography variant="h6" fontWeight={700} sx={{ color: colorB }}>{fmt(valueB)}</Typography>
                </Box>
                <DeltaBadge value={delta} lowerIsBetter={lowerIsBetter} />
            </Box>
        </Paper>
    );
}

// ---------- Main Component ----------

export function MonthComparisonView({ allExpenses, availableYears, onEdit, onDelete }: MonthComparisonViewProps) {
    const theme = useTheme();
    const now = new Date();

    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    const [periodA, setPeriodA] = useState<PeriodSelector>({ month: prevMonth, year: prevYear });
    const [periodB, setPeriodB] = useState<PeriodSelector>({ month: now.getMonth(), year: now.getFullYear() });

    const COLOR_A = theme.palette.primary.main;
    const COLOR_B = theme.palette.warning.main;

    const expensesA = useMemo(() => filterByMonth(allExpenses, periodA.month, periodA.year), [allExpenses, periodA]);
    const expensesB = useMemo(() => filterByMonth(allExpenses, periodB.month, periodB.year), [allExpenses, periodB]);

    const stats = useMemo(() => computeComparisonStats(expensesA, expensesB), [expensesA, expensesB]);

    // Collect all categories present in either period
    const categoryIds = useMemo(() => {
        const catA = buildCategoryMap(expensesA);
        const catB = buildCategoryMap(expensesB);
        const ids = new Set([...catA.keys(), ...catB.keys()]);
        return Array.from(ids).sort((idA, idB) => {
            const totalA = (catA.get(idA) ?? 0) + (catB.get(idA) ?? 0);
            const totalB = (catA.get(idB) ?? 0) + (catB.get(idB) ?? 0);
            return totalB - totalA; // descending by combined total
        });
    }, [expensesA, expensesB]);

    const catMapA = useMemo(() => buildCategoryMap(expensesA), [expensesA]);
    const catMapB = useMemo(() => buildCategoryMap(expensesB), [expensesB]);

    // Bar chart data
    const barChartData = useMemo(() => ({
        labels: categoryIds.map(id => DEFAULT_EXPENSE_CATEGORIES.find(c => c.id === id)?.name ?? id),
        datasets: [
            {
                label: `${MONTHS[periodA.month]} ${periodA.year}`,
                data: categoryIds.map(id => catMapA.get(id) ?? 0),
                backgroundColor: alpha(COLOR_A, 0.8),
                borderRadius: 6,
            },
            {
                label: `${MONTHS[periodB.month]} ${periodB.year}`,
                data: categoryIds.map(id => catMapB.get(id) ?? 0),
                backgroundColor: alpha(COLOR_B, 0.8),
                borderRadius: 6,
            }
        ]
    }), [categoryIds, catMapA, catMapB, periodA, periodB, COLOR_A, COLOR_B]);

    const labelA = `${MONTHS[periodA.month]} ${periodA.year}`;
    const labelB = `${MONTHS[periodB.month]} ${periodB.year}`;

    const bannerData = useMemo(
        () => computeCompareBanner(catMapA, catMapB),
        [catMapA, catMapB]
    );

    return (
        <Box>
            {/* Period Selectors */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
                <PeriodPicker label="Period A" value={periodA} onChange={setPeriodA} availableYears={availableYears} accentColor={COLOR_A} />
                <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary', fontSize: '1.5rem', px: 1 }}>⇄</Box>
                <PeriodPicker label="Period B" value={periodB} onChange={setPeriodB} availableYears={availableYears} accentColor={COLOR_B} />
            </Stack>

            {/* Legend labels */}
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                <Chip label={`A: ${labelA}`} sx={{ bgcolor: alpha(COLOR_A, 0.15), color: COLOR_A, fontWeight: 700 }} />
                <Chip label={`B: ${labelB}`} sx={{ bgcolor: alpha(COLOR_B, 0.15), color: COLOR_B, fontWeight: 700 }} />
            </Stack>

            {/* Summary Banner */}
            {(bannerData.betterCount > 0 || bannerData.worseCount > 0) && (
                <Alert
                    severity={bannerData.savedAmount >= bannerData.extraAmount ? 'success' : 'warning'}
                    icon={bannerData.savedAmount >= bannerData.extraAmount ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
                    sx={{ mb: 3, borderRadius: 2, fontWeight: 500 }}
                >
                    {bannerData.savedAmount >= bannerData.extraAmount
                        ? `${labelB} was better in ${bannerData.betterCount} categor${bannerData.betterCount !== 1 ? 'ies' : 'y'}, saving $${bannerData.savedAmount.toFixed(2)} vs ${labelA}.`
                        : `${labelB} spent $${bannerData.extraAmount.toFixed(2)} more across ${bannerData.worseCount} categor${bannerData.worseCount !== 1 ? 'ies' : 'y'} compared to ${labelA}.`
                    }
                </Alert>
            )}

            {/* Summary Stats */}
            <Grid container spacing={2} sx={{ mb: 4 }}>
                <Grid size={{ xs: 12, sm: 4 }}>
                    <StatCard title="Total Spend" valueA={stats.totalA} valueB={stats.totalB} delta={stats.deltaTotal} colorA={COLOR_A} colorB={COLOR_B} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                    <StatCard title="# of Transactions" valueA={stats.countA} valueB={stats.countB} delta={stats.deltaCount} colorA={COLOR_A} colorB={COLOR_B} isCurrency={false} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                    <StatCard title="Avg. per Transaction" valueA={stats.avgA} valueB={stats.avgB} delta={stats.deltaAvg} colorA={COLOR_A} colorB={COLOR_B} />
                </Grid>
            </Grid>

            {/* Bar Chart */}
            {categoryIds.length > 0 && (
                <Paper sx={{ p: 3, borderRadius: 3, mb: 4 }}>
                    <Typography variant="h6" fontWeight={600} gutterBottom>Spending by Category</Typography>
                    <Box sx={{ height: 280 }}>
                        <Bar
                            data={barChartData}
                            options={{
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: { position: 'top' },
                                    tooltip: {
                                        callbacks: {
                                            label: ctx => ` $${(ctx.raw as number).toFixed(2)}`
                                        }
                                    }
                                },
                                scales: {
                                    y: {
                                        ticks: { callback: v => `$${v}` },
                                        grid: { color: alpha(theme.palette.divider, 0.5) }
                                    },
                                    x: { grid: { display: false } }
                                }
                            }}
                        />
                    </Box>
                </Paper>
            )}

            {/* Category Breakdown Table */}
            {categoryIds.length > 0 && (
                <Paper sx={{ p: 3, borderRadius: 3, mb: 4 }}>
                    <Typography variant="h6" fontWeight={600} gutterBottom>Category Breakdown</Typography>
                    <Box sx={{ overflowX: 'auto' }}>
                        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <Box component="thead">
                                <Box component="tr" sx={{ borderBottom: `2px solid ${theme.palette.divider}` }}>
                                    {['Category', labelA, labelB, 'Δ Amount', 'Δ %'].map(h => (
                                        <Box component="th" key={h} sx={{ p: 1.5, textAlign: h === 'Category' ? 'left' : 'right', color: 'text.secondary', fontWeight: 600 }}>
                                            {h}
                                        </Box>
                                    ))}
                                </Box>
                            </Box>
                            <Box component="tbody">
                                {categoryIds.map(id => {
                                    const cat = DEFAULT_EXPENSE_CATEGORIES.find(c => c.id === id);
                                    const amtA = catMapA.get(id) ?? 0;
                                    const amtB = catMapB.get(id) ?? 0;
                                    const delta = amtB - amtA;
                                    const deltaPct = amtA === 0 ? null : (delta / amtA) * 100;
                                    const isPositive = delta > 0;
                                    const deltaColor = Math.abs(delta) < 0.01 ? 'text.secondary' : isPositive ? 'error.main' : 'success.main';

                                    return (
                                        <Box component="tr" key={id} sx={{
                                            borderBottom: `1px solid ${theme.palette.divider}`,
                                            '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.5) }
                                        }}>
                                            <Box component="td" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: cat?.color ?? '#9ca3af', flexShrink: 0 }} />
                                                {cat?.name ?? id}
                                            </Box>
                                            <Box component="td" sx={{ p: 1.5, textAlign: 'right', color: COLOR_A, fontWeight: 600 }}>
                                                {amtA > 0 ? `$${amtA.toFixed(2)}` : '—'}
                                            </Box>
                                            <Box component="td" sx={{ p: 1.5, textAlign: 'right', color: COLOR_B, fontWeight: 600 }}>
                                                {amtB > 0 ? `$${amtB.toFixed(2)}` : '—'}
                                            </Box>
                                            <Box component="td" sx={{ p: 1.5, textAlign: 'right', color: deltaColor, fontWeight: 600 }}>
                                                {Math.abs(delta) < 0.01 ? '—' : `${isPositive ? '+' : ''}$${delta.toFixed(2)}`}
                                            </Box>
                                            <Box component="td" sx={{ p: 1.5, textAlign: 'right', color: deltaColor }}>
                                                {deltaPct === null ? 'N/A' : `${isPositive ? '+' : ''}${deltaPct.toFixed(1)}%`}
                                            </Box>
                                        </Box>
                                    );
                                })}
                            </Box>
                            {/* Totals row */}
                            <Box component="tfoot">
                                <Box component="tr" sx={{ borderTop: `2px solid ${theme.palette.divider}`, fontWeight: 700 }}>
                                    <Box component="td" sx={{ p: 1.5, fontWeight: 700 }}>Total</Box>
                                    <Box component="td" sx={{ p: 1.5, textAlign: 'right', color: COLOR_A, fontWeight: 700 }}>${stats.totalA.toFixed(2)}</Box>
                                    <Box component="td" sx={{ p: 1.5, textAlign: 'right', color: COLOR_B, fontWeight: 700 }}>${stats.totalB.toFixed(2)}</Box>
                                    <Box component="td" sx={{ p: 1.5, textAlign: 'right', fontWeight: 700, color: stats.totalB > stats.totalA ? 'error.main' : 'success.main' }}>
                                        {stats.totalB > stats.totalA ? '+' : ''}${(stats.totalB - stats.totalA).toFixed(2)}
                                    </Box>
                                    <Box component="td" sx={{ p: 1.5, textAlign: 'right', fontWeight: 700, color: stats.totalB > stats.totalA ? 'error.main' : 'success.main' }}>
                                        {stats.deltaTotal === null ? 'N/A' : `${stats.totalB > stats.totalA ? '+' : ''}${stats.deltaTotal.toFixed(1)}%`}
                                    </Box>
                                </Box>
                            </Box>
                        </Box>
                    </Box>
                </Paper>
            )}

            {/* Side-by-side Transaction Lists */}
            <Grid container spacing={3}>
                {([
                    { label: labelA, expenses: expensesA, color: COLOR_A },
                    { label: labelB, expenses: expensesB, color: COLOR_B },
                ] as const).map(({ label, expenses, color }) => (
                    <Grid size={{ xs: 12, md: 6 }} key={label}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: color }} />
                            <Typography variant="h6" fontWeight={700}>{label}</Typography>
                            <Chip label={`${expenses.length} txns`} size="small" sx={{ ml: 'auto' }} />
                        </Box>
                        {expenses.length === 0 ? (
                            <Paper sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
                                <Typography color="text.secondary">No expenses for this period.</Typography>
                            </Paper>
                        ) : (
                            <Box sx={{ maxHeight: 520, overflowY: 'auto', pr: 0.5 }}>
                                {expenses.map(expense => (
                                    <ExpenseCard
                                        key={expense.id}
                                        expense={expense}
                                        category={DEFAULT_EXPENSE_CATEGORIES.find(c => c.id === expense.category)}
                                        onEdit={onEdit}
                                        onDelete={onDelete}
                                    />
                                ))}
                            </Box>
                        )}
                        <Divider sx={{ mt: 2 }} />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5, px: 1 }}>
                            <Typography variant="body2" color="text.secondary">Period Total</Typography>
                            <Typography variant="body1" fontWeight={700} sx={{ color }}>
                                ${expenses.reduce((s, e) => s + e.amount, 0).toFixed(2)}
                            </Typography>
                        </Box>
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
}
