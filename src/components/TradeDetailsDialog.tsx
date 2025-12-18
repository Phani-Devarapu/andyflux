import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Grid,
    Typography,
    Divider,
    Box,
    Chip,
    Paper
} from '@mui/material';
import type { Trade } from '../types/trade';
import { formatCurrency } from '../utils/calculations';
import { formatSymbolForDisplay } from '../utils/optionSymbolParser';

interface TradeDetailsDialogProps {
    open: boolean;
    onClose: () => void;
    trade: Trade | null;
}

export function TradeDetailsDialog({ open, onClose, trade }: TradeDetailsDialogProps) {
    if (!trade) return null;

    const isClosed = trade.status === 'Closed';

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h6" fontWeight="bold">
                            {formatSymbolForDisplay(trade.symbol, trade.type)}
                        </Typography>
                        <Chip
                            label={trade.status}
                            color={isClosed ? 'default' : 'primary'}
                            size="small"
                        />
                        <Chip
                            label={trade.side}
                            color={trade.side === 'Buy' ? 'success' : 'error'}
                            size="small"
                            variant="outlined"
                        />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                        ID: {trade.id}
                    </Typography>
                </Box>
            </DialogTitle>
            <DialogContent dividers>
                <Grid container spacing={3}>
                    {/* Entry Details */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Paper variant="outlined" sx={{ p: 2, height: '100%', bgcolor: 'background.default' }}>
                            <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="primary">
                                Entry Details
                            </Typography>
                            <Divider sx={{ mb: 2 }} />

                            <Grid container spacing={2}>
                                <Grid size={{ xs: 6 }}>
                                    <DetailItem label="Date" value={new Date(trade.date).toLocaleDateString()} />
                                </Grid>
                                <Grid size={{ xs: 6 }}>
                                    <DetailItem label="Quantity" value={trade.quantity} />
                                </Grid>
                                <Grid size={{ xs: 6 }}>
                                    <DetailItem label="Price" value={trade.entryPrice} isCurrency />
                                </Grid>
                                <Grid size={{ xs: 6 }}>
                                    <DetailItem label="Total Cost" value={trade.entryPrice * trade.quantity} isCurrency />
                                </Grid>
                                <Grid size={{ xs: 12 }}>
                                    <DetailItem label="Strategy" value={trade.strategy} />
                                </Grid>
                            </Grid>
                        </Paper>
                    </Grid>

                    {/* Exit Details */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Paper variant="outlined" sx={{ p: 2, height: '100%', bgcolor: isClosed ? 'default' : 'action.hover' }}>
                            <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="secondary">
                                Exit Details
                            </Typography>
                            <Divider sx={{ mb: 2 }} />

                            {isClosed ? (
                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 6 }}>
                                        <DetailItem label="Date" value={trade.exitDate ? new Date(trade.exitDate).toLocaleDateString() : '-'} />
                                    </Grid>
                                    <Grid size={{ xs: 6 }}>
                                        <DetailItem label="Price" value={trade.exitPrice} isCurrency />
                                    </Grid>
                                    <Grid size={{ xs: 6 }}>
                                        <DetailItem label="Total Value" value={(trade.exitPrice || 0) * trade.quantity} isCurrency />
                                    </Grid>
                                    <Grid size={{ xs: 6 }}>
                                        <DetailItem
                                            label="P/L"
                                            value={trade.pnl}
                                            isCurrency
                                            color={((trade.pnl || 0) >= 0) ? 'success.main' : 'error.main'}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12 }}>
                                        <DetailItem
                                            label="Return %"
                                            value={trade.pnlPercentage ? `${trade.pnlPercentage.toFixed(2)}%` : '-'}
                                            color={((trade.pnlPercentage || 0) >= 0) ? 'success.main' : 'error.main'}
                                        />
                                    </Grid>
                                </Grid>
                            ) : (
                                <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', minHeight: 150 }}>
                                    <Typography color="text.secondary" fontStyle="italic">
                                        Trade is currently open
                                    </Typography>
                                </Box>
                            )}
                        </Paper>
                    </Grid>

                    {/* Additional Info */}
                    {(trade.notes || (trade.riskRewardRatio && trade.riskRewardRatio > 0)) && (
                        <Grid size={{ xs: 12 }}>
                            <Paper variant="outlined" sx={{ p: 2 }}>
                                <Typography variant="subtitle2" gutterBottom>Additional Info</Typography>
                                <Grid container spacing={2}>
                                    {trade.riskRewardRatio && (
                                        <Grid size={{ xs: 12, sm: 4 }}>
                                            <DetailItem label="Risk:Reward" value={`1:${trade.riskRewardRatio.toFixed(2)}`} />
                                        </Grid>
                                    )}
                                    {trade.notes && (
                                        <Grid size={{ xs: 12, sm: 8 }}>
                                            <DetailItem label="Notes" value={trade.notes} />
                                        </Grid>
                                    )}
                                </Grid>
                            </Paper>
                        </Grid>
                    )}
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}

const DetailItem = ({ label, value, isCurrency = false, color = 'text.primary' }: { label: string, value: string | number | undefined | null, isCurrency?: boolean, color?: string }) => (
    <Box sx={{ mb: 1 }}>
        <Typography variant="caption" color="text.secondary" display="block">
            {label}
        </Typography>
        <Typography variant="body1" fontWeight="medium" color={color}>
            {isCurrency && typeof value === 'number' ? formatCurrency(value) : value || '-'}
        </Typography>
    </Box>
);
