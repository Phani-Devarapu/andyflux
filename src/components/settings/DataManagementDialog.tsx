import { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Typography,
    Alert,
    Box
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { syncService } from '../../services/SyncService';
import { Trash2 } from 'lucide-react';

interface DataManagementDialogProps {
    open: boolean;
    onClose: () => void;
}

export function DataManagementDialog({ open, onClose }: DataManagementDialogProps) {
    const { user } = useAuth();
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleBulkDelete = async () => {
        if (!user) return;
        if (!window.confirm(`Are you sure you want to PERMANENTLY delete all trades for ${month}/${year}? This action cannot be undone.`)) {
            return;
        }

        setLoading(true);
        setMessage(null);
        try {
            await syncService.deleteTradesByMonth(user.uid, year, month);
            setMessage({ type: 'success', text: `Trades for ${month}/${year} deleted successfully.` });
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: 'Failed to delete trades. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    const months = [
        { value: 1, label: 'January' },
        { value: 2, label: 'February' },
        { value: 3, label: 'March' },
        { value: 4, label: 'April' },
        { value: 5, label: 'May' },
        { value: 6, label: 'June' },
        { value: 7, label: 'July' },
        { value: 8, label: 'August' },
        { value: 9, label: 'September' },
        { value: 10, label: 'October' },
        { value: 11, label: 'November' },
        { value: 12, label: 'December' },
    ];

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontWeight: 'bold' }}>Manage Data</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" paragraph>
                    Select a month and year to permanently delete all associated trades from both your device and the cloud.
                </Typography>

                {message && (
                    <Alert severity={message.type} sx={{ mb: 2 }}>
                        {message.text}
                    </Alert>
                )}

                <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid size={{ xs: 6 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Month</InputLabel>
                            <Select
                                value={month}
                                label="Month"
                                onChange={(e) => setMonth(Number(e.target.value))}
                            >
                                {months.map((m) => (
                                    <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Year</InputLabel>
                            <Select
                                value={year}
                                label="Year"
                                onChange={(e) => setYear(Number(e.target.value))}
                            >
                                {years.map((y) => (
                                    <MenuItem key={y} value={y}>{y}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>

                <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
                    <Button
                        variant="outlined"
                        color="error"
                        startIcon={<Trash2 size={18} />}
                        onClick={handleBulkDelete}
                        disabled={loading}
                        fullWidth
                    >
                        {loading ? 'Deleting...' : `Delete Trades for ${month}/${year}`}
                    </Button>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={loading}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}
