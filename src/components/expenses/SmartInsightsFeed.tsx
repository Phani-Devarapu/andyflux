import { useState } from 'react';
import { Box, Paper, Typography, IconButton, Collapse, useTheme, alpha } from '@mui/material';
import { X, Sparkles } from 'lucide-react';
import type { SpendingInsight } from '../../utils/expenseUIUtils';

interface SmartInsightsFeedProps {
    insights: SpendingInsight[];
}

export function SmartInsightsFeed({ insights }: SmartInsightsFeedProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    const visible = insights.filter(i => !dismissed.has(i.id));
    if (visible.length === 0) return null;

    const dismiss = (id: string) => setDismissed(prev => new Set([...prev, id]));

    return (
        <Box sx={{ mb: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Sparkles size={16} color={theme.palette.warning.main} />
                <Typography variant="caption" fontWeight={700} sx={{
                    textTransform: 'uppercase', letterSpacing: 1.2,
                    color: 'text.secondary'
                }}>
                    Smart Insights
                </Typography>
            </Box>

            {/* Insight Cards */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {visible.map(insight => {
                    const sev = insight.severity;

                    // map severity → MUI colour token for alpha
                    const colorToken =
                        sev === 'positive' ? theme.palette.success.main :
                            sev === 'warning' ? theme.palette.warning.main :
                                sev === 'info' ? theme.palette.info.main :
                                    theme.palette.divider;

                    const borderColor =
                        sev === 'positive' ? theme.palette.success.main :
                            sev === 'warning' ? theme.palette.warning.main :
                                sev === 'info' ? theme.palette.info.main :
                                    theme.palette.divider;

                    return (
                        <Collapse key={insight.id} in unmountOnExit>
                            <Paper
                                elevation={0}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5,
                                    px: 2,
                                    py: 1.5,
                                    borderRadius: 3,
                                    border: `1px solid ${alpha(borderColor, 0.35)}`,
                                    bgcolor: alpha(colorToken, isDark ? 0.1 : 0.07),
                                    transition: 'opacity 0.2s',
                                }}
                            >
                                {/* Emoji */}
                                <Typography sx={{ fontSize: '1.25rem', lineHeight: 1, flexShrink: 0 }}>
                                    {insight.emoji}
                                </Typography>

                                {/* Text */}
                                <Typography variant="body2" sx={{ flex: 1, fontWeight: 500, lineHeight: 1.5 }}>
                                    {insight.text}
                                </Typography>

                                {/* Dismiss */}
                                <IconButton
                                    size="small"
                                    onClick={() => dismiss(insight.id)}
                                    sx={{ opacity: 0.4, '&:hover': { opacity: 1 }, flexShrink: 0 }}
                                >
                                    <X size={14} />
                                </IconButton>
                            </Paper>
                        </Collapse>
                    );
                })}
            </Box>
        </Box>
    );
}
