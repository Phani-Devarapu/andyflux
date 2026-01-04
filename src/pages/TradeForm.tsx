/* eslint-disable react-hooks/incompatible-library */
import { useForm, Controller, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Trade } from '../types/trade';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../db/db';
import { calculatePnL, calculatePnLPercent, calculateRiskReward } from '../utils/calculations';
import { useEffect } from 'react';
import { useAccount } from '../context/AccountContext';
import { useAuth } from '../context/AuthContext';
import { MarketDataService } from '../services/MarketDataService';
import { ChevronLeft, Save } from 'lucide-react';
import {
    Box,
    TextField,
    Button,
    Grid,
    Typography,
    Paper,
    FormControl,
    RadioGroup,
    FormControlLabel,
    Radio,
    InputAdornment,
    Alert,
    Autocomplete,
    Chip
} from '@mui/material';

// Helper for optional number fields that handles empty strings/NaN from forms
const numberFromAny = z.union([z.number(), z.nan(), z.string(), z.null(), z.undefined()])
    .transform((val) => {
        if (val === '' || val === null || val === undefined) return undefined;
        const parsed = Number(val);
        return isNaN(parsed) ? undefined : parsed;
    });

const tradeSchema = z.object({
    date: z.string(),
    exitDate: z.string().optional(),
    symbol: z.string().min(1, 'Symbol is required').toUpperCase(),
    type: z.enum(['Stock', 'ETF', 'Option', 'Future', 'Crypto', 'Forex']),
    side: z.enum(['Buy', 'Sell']),
    entryPrice: z.number().positive('Price must be positive'),
    exitPrice: numberFromAny.pipe(z.number().min(0, 'Price cannot be negative').optional()),
    quantity: z.number().positive('Quantity must be positive'),
    // Option fields
    strike: numberFromAny.pipe(z.number().positive().optional()),
    expiration: z.string().optional(),
    optionType: z.enum(['Call', 'Put']).optional(),
    stopLoss: numberFromAny.pipe(z.number().positive().optional()),
    target: numberFromAny.pipe(z.number().positive().optional()),
    status: z.enum(['Open', 'Closed']),
    strategy: z.string().optional(),
    mistakes: z.array(z.string()).optional(),
    emotions: z.array(z.string()).optional(),
    screenshots: z.array(z.string()).optional(),
    notes: z.string().optional(),

}).refine((data) => {
    // If status is Closed, exitDate should be provided
    if (data.status === 'Closed' && !data.exitDate) {
        return false;
    }
    return true;
}, {
    message: 'Exit date is required for closed trades',
    path: ['exitDate'],
});

type TradeFormValues = z.infer<typeof tradeSchema>;

export function TradeForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { selectedAccount } = useAccount();
    const isEditMode = !!id;

    // Fix for setValue type inference
    const {
        register,
        control,
        handleSubmit,
        watch,
        reset,
        setValue,
        getValues,
        formState: { errors, isSubmitting },
    } = useForm<TradeFormValues>({
        resolver: zodResolver(tradeSchema) as unknown as Resolver<TradeFormValues>,
        defaultValues: {
            date: new Date().toISOString().split('T')[0],
            type: 'Stock',
            side: 'Buy',
            status: 'Open',
            quantity: 1,
        },
    });

    const entryPrice = watch('entryPrice');
    const stopLoss = watch('stopLoss');
    const target = watch('target');
    const side = watch('side');
    const type = watch('type');
    const strategy = watch('strategy');
    const status = watch('status');

    // Auto-configure form based on strategy
    useEffect(() => {
        if (!strategy) return;

        const s = strategy.toLowerCase();
        if (s.includes('cash secured put') || s.includes('csp')) {
            setValue('type', 'Option');
            setValue('side', 'Sell'); // Credit
            setValue('optionType', 'Put');
        } else if (s.includes('covered call') || s.includes('cc')) {
            setValue('type', 'Option');
            setValue('side', 'Sell'); // Credit
            setValue('optionType', 'Call');
        } else if (s.includes('long call')) {
            setValue('type', 'Option');
            setValue('side', 'Buy'); // Debit
            setValue('optionType', 'Call');
        } else if (s.includes('long put')) {
            setValue('type', 'Option');
            setValue('side', 'Buy'); // Debit
            setValue('optionType', 'Put');
        }
    }, [strategy, setValue]);

    // Market Data Auto-fill
    const symbol = watch('symbol');
    useEffect(() => {
        const fetchPrice = async () => {
            if (!symbol || symbol.length < 2 || isEditMode) return;
            // Only fetch if entry price is empty/zero to avoid overwriting user input
            // OR if user just typed the symbol and hasn't touched price yet.
            const currentPrice = getValues('entryPrice');
            if (currentPrice && currentPrice > 0) return;

            // Debounce slightly to avoid spamming while typing
            const timeoutId = setTimeout(async () => {
                try {
                    const quote = await MarketDataService.getQuote(symbol);
                    if (quote && quote.price) {
                        // Check again before setting
                        if (!getValues('entryPrice')) {
                            setValue('entryPrice', quote.price);
                        }
                    }
                } catch (err) {
                    console.error("Failed to auto-fill price", err);
                }
            }, 1000);

            return () => clearTimeout(timeoutId);
        };
        fetchPrice();
    }, [symbol, isEditMode, setValue, getValues]);

    const isCreditStrategy = side === 'Sell' && type === 'Option';

    useEffect(() => {
        if (isEditMode && id) {
            db.trades.get(Number(id)).then((trade) => {
                if (trade) {
                    reset({
                        ...trade,
                        date: trade.date.toISOString().split('T')[0],
                        exitDate: trade.exitDate ? trade.exitDate.toISOString().split('T')[0] : undefined,
                        expiration: trade.expiration ? trade.expiration.toISOString().split('T')[0] : undefined,
                        strike: trade.strike || undefined,
                        optionType: trade.optionType || undefined,
                        exitPrice: trade.exitPrice || undefined,
                        stopLoss: trade.stopLoss || undefined,
                        target: trade.target || undefined,
                        mistakes: trade.mistakes || [],
                        emotions: trade.emotions || [],
                        screenshots: trade.screenshots || [],
                    });
                }
            });
        }
    }, [id, isEditMode, reset]);

    const { user } = useAuth();
    // Image Handling
    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const base64 = event.target?.result as string;
                        const currentImages = getValues('screenshots') || [];
                        setValue('screenshots', [...currentImages, base64]);
                    };
                    reader.readAsDataURL(blob);
                }
            }
        }
    };

    const removeImage = (index: number) => {
        const currentImages = getValues('screenshots') || [];
        setValue('screenshots', currentImages.filter((_, i) => i !== index));
    };

    const onSubmit: SubmitHandler<TradeFormValues> = async (data) => {
        if (!user) {
            alert('You must be logged in to save a trade.');
            return;
        }
        try {
            const hasExitPrice = data.exitPrice !== null && data.exitPrice !== undefined;
            const pnl = (hasExitPrice && data.status === 'Closed' && data.exitPrice !== undefined)
                ? calculatePnL(data.entryPrice, data.exitPrice, data.quantity, data.side)
                : undefined;

            const pnlPercentage = (hasExitPrice && data.status === 'Closed' && data.exitPrice !== undefined)
                ? calculatePnLPercent(data.entryPrice, data.exitPrice, data.side)
                : undefined;

            const riskRewardRatio = (data.stopLoss && data.target)
                ? calculateRiskReward(data.entryPrice, data.stopLoss, data.target, data.side)
                : undefined;

            let formattedSymbol = data.symbol;
            if (data.type === 'Option' && data.strike && data.optionType) {
                // Determine underlying symbol (remove any existing option clutter if user typed it manually)
                // But generally user types just TICKER.
                const underlying = data.symbol.split(' ')[0];
                const typeLabel = data.optionType.toUpperCase();
                formattedSymbol = `${underlying} $${data.strike} ${typeLabel}`;
            }

            const tradeData = {
                ...data,
                userId: user.uid,
                symbol: formattedSymbol,
                accountId: selectedAccount, // Assign current account
                date: new Date(data.date),
                exitDate: data.exitDate ? new Date(data.exitDate) : undefined,
                expiration: data.expiration ? new Date(data.expiration) : undefined,
                strike: data.strike ? Number(data.strike) : undefined,
                optionType: data.optionType,
                entryPrice: Number(data.entryPrice),
                exitPrice: data.exitPrice ? Number(data.exitPrice) : undefined,
                quantity: Number(data.quantity),
                stopLoss: data.stopLoss ? Number(data.stopLoss) : undefined,
                target: data.target ? Number(data.target) : undefined,
                mistakes: data.mistakes,

                emotions: data.emotions,
                screenshots: data.screenshots,
                pnl,
                pnlPercentage,
                riskRewardRatio,
                updatedAt: new Date(),
            };

            if (isEditMode && id) {
                // When editing, we preserve the original accountId if it exists, or update it if undefined.
                // But simplified: just update.
                await db.trades.update(Number(id), tradeData);
            } else {
                await db.trades.add({
                    ...tradeData,
                    createdAt: new Date(),
                } as Trade);
            }
            navigate('/trades');
        } catch (error) {
            console.error('Failed to save trade:', error);
            alert('Failed to save trade');
        }
    };

    const previewRR = (entryPrice && stopLoss && target)
        ? calculateRiskReward(Number(entryPrice), Number(stopLoss), Number(target), side)
        : 0;

    return (
        <Box sx={{ maxWidth: 'md', mx: 'auto', p: 2 }}>
            <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h4" fontWeight="bold">
                    {isEditMode ? 'Edit Trade' : 'New Trade'}
                </Typography>
                <Button
                    startIcon={<ChevronLeft />}
                    onClick={() => navigate(-1)}
                    color="inherit"
                >
                    Back
                </Button>
            </Box>

            <Paper component="form" onSubmit={handleSubmit(onSubmit)} sx={{ p: 4 }}>
                <Grid container spacing={3}>
                    {/* Basic Info */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                            type="date"
                            label="Date"
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            {...register('date')}
                            error={!!errors.date}
                            helperText={errors.date?.message}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                            label="Symbol"
                            fullWidth
                            placeholder="AAPL"
                            {...register('symbol')}
                            error={!!errors.symbol}
                            helperText={errors.symbol?.message}
                            slotProps={{ input: { style: { textTransform: 'uppercase' } } }}
                        />
                    </Grid>

                    {/* Type & Side */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                            select
                            label="Type"
                            fullWidth
                            {...register('type')}
                            error={!!errors.type}
                            helperText={errors.type?.message}
                            SelectProps={{ native: true }}
                        >
                            <option value="Stock">Stock</option>
                            <option value="ETF">ETF</option>
                            <option value="Option">Option</option>
                            <option value="Future">Future</option>
                            <option value="Crypto">Crypto</option>
                            <option value="Forex">Forex</option>
                        </TextField>
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                        <Controller
                            name="strategy"
                            control={control}
                            render={({ field: { onChange, value } }) => (
                                <Autocomplete
                                    freeSolo
                                    options={[
                                        'Trend Following', 'Reversal', 'Breakout', 'Scalp', 'Swing', 'News Catalyst', 'FOMO',
                                        'Cash Secured Put', 'Covered Call', 'Long Call', 'Long Put', 'Long Stock', 'Short Stock'
                                    ]}
                                    value={value || ''}
                                    onChange={(_, newValue) => onChange(newValue)}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Strategy / Setup"
                                            placeholder="e.g. Reversal, Trend..."
                                            helperText="Select or type custom strategy"
                                        />
                                    )}
                                />
                            )}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 12 }}>
                        <FormControl component="fieldset">
                            <Typography variant="caption" color="text.secondary">Side</Typography>
                            <Controller
                                name="side"
                                control={control}
                                render={({ field }) => (
                                    <RadioGroup row {...field}>
                                        <FormControlLabel
                                            value="Buy"
                                            control={<Radio color="success" />}
                                            label={type === 'Option' ? 'Buy to Open (Debit)' : 'Long (Buy)'}
                                            sx={{ color: 'success.main' }}
                                        />
                                        <FormControlLabel
                                            value="Sell"
                                            control={<Radio color="error" />}
                                            label={type === 'Option' ? 'Sell to Open (Credit)' : 'Short (Sell)'}
                                            sx={{ color: 'error.main' }}
                                        />
                                    </RadioGroup>
                                )}
                            />
                        </FormControl>
                    </Grid>

                    {/* Option Details - Only shown if type is Option */}
                    {type === 'Option' && (
                        <Grid size={{ xs: 12 }}>
                            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.paper', mb: 2 }}>
                                <Typography variant="subtitle2" gutterBottom color="primary">Option Details</Typography>
                                <Grid container spacing={3}>
                                    <Grid size={{ xs: 12, md: 4 }}>
                                        <TextField
                                            label="Strike Price"
                                            type="number"
                                            fullWidth
                                            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                                            {...register('strike', { valueAsNumber: true })}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 4 }}>
                                        <TextField
                                            type="date"
                                            label="Expiration"
                                            fullWidth
                                            InputLabelProps={{ shrink: true }}
                                            {...register('expiration')}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 4 }}>
                                        <TextField
                                            select
                                            label="Option Type"
                                            fullWidth
                                            {...register('optionType')}
                                            SelectProps={{ native: true }}
                                        >
                                            <option value="">Select...</option>
                                            <option value="Call">Call</option>
                                            <option value="Put">Put</option>
                                        </TextField>
                                    </Grid>
                                </Grid>
                            </Paper>
                        </Grid>
                    )}

                    {/* Price & Qty */}
                    <Grid size={{ xs: 12, md: 4 }}>
                        <TextField
                            label={isCreditStrategy ? "Credit Received" : "Entry Price / Debit"}
                            type="number"
                            fullWidth
                            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                            inputProps={{ step: 'any' }}
                            {...register('entryPrice', { valueAsNumber: true })}
                            error={!!errors.entryPrice}
                            helperText={errors.entryPrice?.message}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <TextField
                            label="Quantity"
                            type="number"
                            fullWidth
                            inputProps={{ step: 'any' }}
                            {...register('quantity', { valueAsNumber: true })}
                            error={!!errors.quantity}
                            helperText={errors.quantity?.message}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <TextField
                            label="Exit Price"
                            type="number"
                            fullWidth
                            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                            inputProps={{ step: 'any' }}
                            {...register('exitPrice', { valueAsNumber: true })}
                            error={!!errors.exitPrice}
                            helperText={errors.exitPrice?.message || (status === 'Open' ? 'Not applicable for open trades' : '')}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <TextField
                            type="date"
                            label="Exit Date"
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            {...register('exitDate')}
                            error={!!errors.exitDate}
                            helperText={errors.exitDate?.message || (status === 'Open' ? 'Not applicable for open trades' : '')}
                            disabled={status === 'Open'}
                        />
                    </Grid>

                    {/* Risk Management */}
                    <Grid size={{ xs: 12 }}>
                        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                            <Grid container spacing={3}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        label="Stop Loss"
                                        type="number"
                                        fullWidth
                                        InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                                        {...register('stopLoss')}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        label="Target"
                                        type="number"
                                        fullWidth
                                        InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                                        {...register('target')}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12 }}>
                                    <Alert severity={previewRR >= 2 ? "success" : "warning"} icon={false}>
                                        Projected Risk:Reward Ratio: <strong>{previewRR > 0 ? `1:${previewRR.toFixed(2)}` : 'N/A'}</strong>
                                    </Alert>
                                </Grid>
                            </Grid>
                        </Paper>
                    </Grid>

                    {/* Metadata */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                            select
                            label="Status"
                            fullWidth
                            {...register('status')}
                            error={!!errors.status}
                            helperText={errors.status?.message}
                            SelectProps={{ native: true }}
                        >
                            <option value="Open">Open</option>
                            <option value="Closed">Closed</option>
                        </TextField>
                    </Grid>



                    {/* Psychology & Mistakes */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Controller
                            name="mistakes"
                            control={control}
                            render={({ field: { onChange, value } }) => (
                                <Autocomplete
                                    multiple
                                    freeSolo
                                    options={['FOMO', 'Revenge Trading', 'Chasing', 'No Plan', 'Early Exit', 'Late Entry', 'Oversizing', 'Impulsive']}
                                    value={value || []}
                                    onChange={(_, newValue) => onChange(newValue)}
                                    renderTags={(value: string[], getTagProps) =>
                                        value.map((option: string, index: number) => {
                                            const { key, ...tagProps } = getTagProps({ index });
                                            return (
                                                <Chip variant="outlined" label={option} key={key} {...tagProps} color="error" size="small" />
                                            );
                                        })
                                    }
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Mistakes"
                                            placeholder="Add mistakes..."
                                        />
                                    )}
                                />
                            )}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Controller
                            name="emotions"
                            control={control}
                            render={({ field: { onChange, value } }) => (
                                <Autocomplete
                                    multiple
                                    freeSolo
                                    options={['Confident', 'Anxious', 'Bored', 'Excited', 'Frustrated', 'Patient', 'Greedy', 'Fearful']}
                                    value={value || []}
                                    onChange={(_, newValue) => onChange(newValue)}
                                    renderTags={(value: string[], getTagProps) =>
                                        value.map((option: string, index: number) => {
                                            const { key, ...tagProps } = getTagProps({ index });
                                            return (
                                                <Chip variant="outlined" label={option} key={key} {...tagProps} color="info" size="small" />
                                            );
                                        })
                                    }
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Psychology / Emotions"
                                            placeholder="Add emotions..."
                                        />
                                    )}
                                />
                            )}
                        />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <TextField
                            label="Notes"
                            multiline
                            rows={3}
                            fullWidth
                            {...register('notes')}
                            onPaste={handlePaste}
                            placeholder="Paste stats or images here (Ctrl+V)..."
                        />
                    </Grid>
                    {/* Image Preview */}
                    <Grid size={{ xs: 12 }}>
                        {(watch('screenshots')?.length || 0) > 0 && (
                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
                                {watch('screenshots')?.map((src, index) => (
                                    <Box key={index} sx={{ position: 'relative', width: 200, height: 120 }}>
                                        <img
                                            src={src}
                                            alt={`Screenshot ${index + 1}`}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, border: '1px solid #ccc' }}
                                        />
                                        <Button
                                            size="small"
                                            color="error"
                                            variant="contained"
                                            sx={{ position: 'absolute', top: 4, right: 4, minWidth: 24, width: 24, height: 24, p: 0, borderRadius: '50%' }}
                                            onClick={() => removeImage(index)}
                                        >
                                            ×
                                        </Button>
                                    </Box>
                                ))}
                            </Box>
                        )}
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                            Paste images directly into the form (Ctrl+V) to attach them.
                        </Typography>
                    </Grid>

                    <Grid size={{ xs: 12 }} sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                        <Button
                            type="submit"
                            variant="contained"
                            size="large"
                            disabled={isSubmitting}
                            startIcon={<Save />}
                            sx={{ px: 4 }}
                        >
                            {isSubmitting ? 'Saving...' : 'Save Trade'}
                        </Button>
                    </Grid>
                </Grid >
            </Paper >
        </Box >
    );
}
