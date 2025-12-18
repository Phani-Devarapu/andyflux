
import { useMemo } from 'react';
import { Box, Paper, Typography, Tooltip, useTheme } from '@mui/material';
import { eachDayOfInterval, subDays, format, isSameDay, startOfWeek } from 'date-fns';
import type { Trade } from '../../types/trade';
import { formatCurrency } from '../../utils/calculations';

interface ContributionGraphProps {
    trades: Trade[];
}

export function ContributionGraph({ trades }: ContributionGraphProps) {
    const theme = useTheme();

    const days = useMemo(() => {
        // Generate last 365 days
        const today = new Date();
        const startDate = subDays(today, 365);
        // Align start date to the previous Sunday to ensure correct grid alignment
        const alignedStart = startOfWeek(startDate);
        return eachDayOfInterval({ start: alignedStart, end: today });
    }, []);

    const getDayStats = (date: Date) => {
        const daysTrades = trades.filter(t => isSameDay(new Date(t.date), date));
        if (daysTrades.length === 0) return null;

        const pnl = daysTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
        const count = daysTrades.length;
        return { pnl, count };
    };

    const getColor = (stats: { pnl: number, count: number } | null) => {
        if (!stats) return theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#ebedf0';

        const { pnl } = stats;
        const opacity = Math.min(0.9, 0.4 + (Math.abs(pnl) / 500) * 0.6);

        if (pnl > 0) return theme.palette.mode === 'dark' ? `rgba(16, 185, 129, ${opacity})` : `rgba(33, 110, 57, ${opacity})`; // Green
        if (pnl < 0) return theme.palette.mode === 'dark' ? `rgba(244, 63, 94, ${opacity})` : `rgba(200, 30, 30, ${opacity})`; // Red
        return theme.palette.text.secondary; // Breakeven
    };

    return (
        <Paper elevation={1} sx={{ p: 3, borderRadius: 4, mt: 4, bgcolor: 'background.paper' }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                Yearly Activity
            </Typography>

            <Box sx={{ overflowX: 'auto', pb: 1 }}>
                <Box sx={{
                    display: 'grid',
                    gridTemplateRows: 'repeat(7, 12px)',
                    gridAutoFlow: 'column',
                    gap: '4px',
                    width: 'fit-content'
                }}>
                    {days.map((day) => {
                        const stats = getDayStats(day);
                        return (
                            <Tooltip
                                key={day.toISOString()}
                                title={
                                    <Box sx={{ textAlign: 'center' }}>
                                        <Typography variant="caption" display="block">{format(day, 'MMM d, yyyy')}</Typography>
                                        {stats ? (
                                            <>
                                                <Typography variant="body2" fontWeight="bold">
                                                    {formatCurrency(stats.pnl)}
                                                </Typography>
                                                <Typography variant="caption">{stats.count} trades</Typography>
                                            </>
                                        ) : (
                                            <Typography variant="caption">No trades</Typography>
                                        )}
                                    </Box>
                                }
                            >
                                <Box
                                    sx={{
                                        width: 12,
                                        height: 12,
                                        borderRadius: '2px',
                                        bgcolor: getColor(stats),
                                        transition: 'all 0.2s',
                                        '&:hover': {
                                            transform: 'scale(1.2)',
                                            border: '1px solid',
                                            borderColor: 'text.primary'
                                        }
                                    }}
                                />
                            </Tooltip>
                        );
                    })}
                </Box>
            </Box>

            {/* Legend */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, fontSize: '0.75rem', color: 'text.secondary', justifyContent: 'flex-end' }}>
                <span>Less</span>
                <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#ebedf0' }} />
                <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: 'rgba(16, 185, 129, 0.4)' }} />
                <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: 'rgba(16, 185, 129, 0.9)' }} />
                <span>More</span>
            </Box>
        </Paper>
    );
}
