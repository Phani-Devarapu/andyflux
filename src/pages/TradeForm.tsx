/* eslint-disable react-hooks/incompatible-library */
import { useForm, Controller, type Resolver, type SubmitHandler } from 'react-hook-form';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
// import type { Trade } from '../types/trade'; // Unused
import { useNavigate, useParams } from 'react-router-dom';
// import { db } from '../db/db'; // Unused
import { calculatePnL, calculatePnLPercent, calculateRiskReward } from '../utils/calculations';
import { useEffect } from 'react';
import { useAccount } from '../context/AccountContext';
import { useAuth } from '../context/AuthContext';
import { MarketDataService } from '../services/MarketDataService';
import { ChevronLeft, Save } from 'lucide-react';
import {
    addDoc,
    setDoc,
    doc,
    collection,
    serverTimestamp,
    getDoc
} from 'firebase/firestore';
import { db as remoteDb } from '../utils/firebase';
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
    const { user } = useAuth();
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
        if (isEditMode && id && user) {
            const fetchTrade = async () => {
                // Static imports used
                // const { doc, getDoc } = await import('firebase/firestore');
                // const { db: remoteDb } = await import('../utils/firebase');

                const docSnap = await getDoc(doc(remoteDb, 'users', user.uid, 'trades', id));
                if (docSnap.exists()) {
                    const trade = docSnap.data();
                    reset({
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        ...(trade as any),
                        date: trade.date?.toDate?.().toISOString().split('T')[0] || new Date(trade.date).toISOString().split('T')[0],
                        exitDate: trade.exitDate ? (trade.exitDate.toDate?.().toISOString().split('T')[0] || new Date(trade.exitDate).toISOString().split('T')[0]) : undefined,
                        expiration: trade.expiration ? (trade.expiration.toDate?.().toISOString().split('T')[0] || new Date(trade.expiration).toISOString().split('T')[0]) : undefined,
                    });
                }
            };
            fetchTrade();
        }
    }, [id, isEditMode, reset, user]);

    // user moved to top
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
        console.log("Submitting trade form...", data);
        if (!user) {
            console.error("User not found!");
            alert('You must be logged in to save a trade.');
            return;
        }
        if (!selectedAccount) {
            console.error("No account selected!");
            alert("No account selected. Please select an account from the sidebar.");
            return;
        }

        try {
            console.log("Calculations starting...");
            const hasExitPrice = data.exitPrice !== null && data.exitPrice !== undefined;
            const pnl = (hasExitPrice && data.status === 'Closed' && data.exitPrice !== undefined)
                ? calculatePnL(data.entryPrice, data.exitPrice, data.quantity, data.side)
                : undefined;

            const pnlPercentage = (hasExitPrice && data.status === 'Closed' && data.exitPrice !== undefined)
                ? calculatePnLPercent(data.entryPrice, data.exitPrice, data.side)
                : undefined;

            // Calculate annualized return for closed trades
            let annualizedReturn: number | undefined = undefined;
            if (data.status === 'Closed' && pnlPercentage !== undefined && data.exitDate) {
                const entryDate = new Date(data.date);
                const exitDate = new Date(data.exitDate);
                const daysHeld = Math.max(1, Math.floor((exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)));

                // Annualized Return = (Return% / Days Held) * 365
                annualizedReturn = (pnlPercentage / 100) * (365 / daysHeld) * 100;
                console.log(`Calculated annualized return: ${annualizedReturn.toFixed(2)}% (${daysHeld} days held, ${pnlPercentage.toFixed(2)}% return)`);
            }

            const riskRewardRatio = (data.stopLoss && data.target)
                ? calculateRiskReward(data.entryPrice, data.stopLoss, data.target, data.side)
                : undefined;

            let formattedSymbol = data.symbol;
            if (data.type === 'Option' && data.strike && data.optionType) {
                const underlying = data.symbol.split(' ')[0];
                const typeLabel = data.optionType.toUpperCase();
                formattedSymbol = `${underlying} $${data.strike} ${typeLabel}`;
            }

            const tradeData = {
                ...data,
                userId: user.uid,
                symbol: formattedSymbol,
                accountId: selectedAccount,
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
                annualizedReturn,  // Add annualized return
                riskRewardRatio,
                updatedAt: new Date(),
            };

            console.log("Importing Firestore...");
            // Static imports are now at the top
            // const { addDoc, setDoc, doc, collection, serverTimestamp } = await import('firebase/firestore');
            // const { db: remoteDb } = await import('../utils/firebase');

            const cleanData = (obj: any) => {
                const newObj: any = {};
                Object.keys(obj).forEach(key => {
                    const val = obj[key];
                    if (val !== undefined) newObj[key] = val;
                });
                return newObj;
            };

            const firestoreData = cleanData({
                ...tradeData,
                updatedAt: serverTimestamp(),
                createdAt: isEditMode ? undefined : serverTimestamp()
            });

            console.log("Saving to Firestore...", firestoreData);

            // Timeout Promise to prevent hanging
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Request timed out - check your connection")), 10000)
            );

            const savePromise = (async () => {
                if (isEditMode && id) {
                    await setDoc(doc(remoteDb, 'users', user.uid, 'trades', id), firestoreData, { merge: true });
                } else {
                    await addDoc(collection(remoteDb, 'users', user.uid, 'trades'), firestoreData);
                }
            })();

            await Promise.race([savePromise, timeoutPromise]);
            console.log("Save successful!");
            navigate('/trades');
        } catch (error) {
            console.error('Failed to save trade:', error);
            alert(`Failed to save trade: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const onError = (errors: any) => {
        console.error("Validation Errors:", errors);
        alert("Please fix the errors in the form before saving.");
    };

    const previewRR = (entryPrice && stopLoss && target)
        ? calculateRiskReward(Number(entryPrice), Number(stopLoss), Number(target), side)
        : 0;

    return (
        <Box sx={{ maxWidth: '1400px', mx: 'auto', p: 3 }}>
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

            <Paper
                component="form"
                onSubmit={handleSubmit(onSubmit, onError)}
                sx={{
                    p: 4,
                    borderRadius: 3,
                    background: theme => theme.palette.mode === 'dark'
                        ? 'linear-gradient(135deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.9) 100%)'
                        : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: theme => theme.palette.mode === 'dark'
                        ? '0 8px 32px rgba(0,0,0,0.4)'
                        : '0 8px 32px rgba(0,0,0,0.08)'
                }}
            >
                <Grid container spacing={3}>
                    {/* Section: Basic Information */}
                    <Grid size={{ xs: 12 }}>
                        <Typography
                            variant="h6"
                            fontWeight="bold"
                            sx={{
                                mb: 2,
                                pb: 1,
                                borderBottom: '2px solid',
                                borderColor: 'primary.main',
                                background: 'linear-gradient(to right, #60A5FA, #34D399)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent'
                            }}
                        >
                            Basic Information
                        </Typography>
                    </Grid>

                    <Grid size={{ xs: 12, md: 4 }}>
                        <Controller
                            name="date"
                            control={control}
                            render={({ field: { value, onChange }, fieldState: { error } }) => (
                                <DatePicker
                                    label="Date"
                                    value={value ? new Date(value) : null}
                                    onChange={(newValue) => {
                                        if (newValue) {
                                            // Handle potential timezone issues by keeping local YYYY-MM-DD
                                            const offset = newValue.getTimezoneOffset();
                                            const adjustedDate = new Date(newValue.getTime() - (offset * 60 * 1000));
                                            onChange(adjustedDate.toISOString().split('T')[0]);
                                        }
                                    }}
                                    slotProps={{
                                        textField: {
                                            fullWidth: true,
                                            error: !!error,
                                            helperText: error?.message
                                        }
                                    }}
                                />
                            )}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <TextField
                            label="Symbol"
                            fullWidth
                            placeholder="AAPL"
                            {...register('symbol')}
                            error={!!errors.symbol}
                            helperText={errors.symbol?.message}
                            slotProps={{
                                input: {
                                    style: { textTransform: 'uppercase' },
                                    sx: {
                                        fontSize: '1.1rem',
                                        fontWeight: 600
                                    }
                                }
                            }}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    '&:hover fieldset': {
                                        borderColor: 'primary.main',
                                    },
                                    '&.Mui-focused fieldset': {
                                        borderWidth: 2,
                                    }
                                }
                            }}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, md: 4 }}>
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
                                    onChange={(_, newValue) => {
                                        onChange(newValue);
                                        // Auto-select 'Option' type if strategy contains option-related keywords
                                        const optionStrategies = ['Cash Secured Put', 'Covered Call', 'Long Call', 'Long Put', 'Put', 'Call'];
                                        if (newValue && optionStrategies.some(s => newValue.includes(s))) {
                                            setValue('type', 'Option');
                                        }
                                    }}
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

                    <Grid size={{ xs: 12, md: 4 }}>
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

                    <Grid size={{ xs: 12, md: 4 }}>
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

                    <Grid size={{ xs: 12, md: 4 }}>
                        <FormControl component="fieldset" fullWidth>
                            <Typography
                                variant="subtitle2"
                                sx={{
                                    mb: 1.5,
                                    fontWeight: 600,
                                    color: 'text.secondary'
                                }}
                            >
                                Side
                            </Typography>
                            <Controller
                                name="side"
                                control={control}
                                render={({ field }) => (
                                    <RadioGroup row {...field} sx={{ gap: 1 }}>
                                        <FormControlLabel
                                            value="Buy"
                                            control={<Radio color="success" />}
                                            label={type === 'Option' ? 'Buy to Open' : 'Long'}
                                            sx={{
                                                flex: 1,
                                                m: 0,
                                                p: 1.5,
                                                border: '2px solid',
                                                borderColor: field.value === 'Buy' ? 'success.main' : 'divider',
                                                borderRadius: 2,
                                                bgcolor: field.value === 'Buy'
                                                    ? theme => theme.palette.mode === 'dark'
                                                        ? 'rgba(16, 185, 129, 0.1)'
                                                        : 'rgba(16, 185, 129, 0.05)'
                                                    : 'transparent',
                                                transition: 'all 0.2s',
                                                '&:hover': {
                                                    borderColor: 'success.main',
                                                    bgcolor: theme => theme.palette.mode === 'dark'
                                                        ? 'rgba(16, 185, 129, 0.08)'
                                                        : 'rgba(16, 185, 129, 0.03)'
                                                },
                                                '& .MuiFormControlLabel-label': {
                                                    fontWeight: field.value === 'Buy' ? 700 : 500,
                                                    fontSize: '0.875rem'
                                                }
                                            }}
                                        />
                                        <FormControlLabel
                                            value="Sell"
                                            control={<Radio color="error" />}
                                            label={type === 'Option' ? 'Sell to Open' : 'Short'}
                                            sx={{
                                                flex: 1,
                                                m: 0,
                                                p: 1.5,
                                                border: '2px solid',
                                                borderColor: field.value === 'Sell' ? 'error.main' : 'divider',
                                                borderRadius: 2,
                                                bgcolor: field.value === 'Sell'
                                                    ? theme => theme.palette.mode === 'dark'
                                                        ? 'rgba(239, 68, 68, 0.1)'
                                                        : 'rgba(239, 68, 68, 0.05)'
                                                    : 'transparent',
                                                transition: 'all 0.2s',
                                                '&:hover': {
                                                    borderColor: 'error.main',
                                                    bgcolor: theme => theme.palette.mode === 'dark'
                                                        ? 'rgba(239, 68, 68, 0.08)'
                                                        : 'rgba(239, 68, 68, 0.03)'
                                                },
                                                '& .MuiFormControlLabel-label': {
                                                    fontWeight: field.value === 'Sell' ? 700 : 500,
                                                    fontSize: '0.875rem'
                                                }
                                            }}
                                        />
                                    </RadioGroup>
                                )}
                            />
                        </FormControl>
                    </Grid>



                    {/* Option Details - Only shown if type is Option */}
                    {type === 'Option' && (
                        <Grid size={{ xs: 12 }}>
                            <Paper
                                variant="outlined"
                                sx={{
                                    p: 3,
                                    bgcolor: theme => theme.palette.mode === 'dark'
                                        ? 'rgba(99, 102, 241, 0.05)'
                                        : 'rgba(99, 102, 241, 0.02)',
                                    borderColor: 'primary.main',
                                    borderRadius: 2,
                                    borderWidth: 1.5
                                }}
                            >
                                <Typography
                                    variant="subtitle2"
                                    gutterBottom
                                    sx={{
                                        color: 'primary.main',
                                        fontWeight: 700,
                                        mb: 2,
                                        textTransform: 'uppercase',
                                        letterSpacing: 1
                                    }}
                                >
                                    Option Details
                                </Typography>
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
                                        <Controller
                                            name="expiration"
                                            control={control}
                                            render={({ field: { value, onChange } }) => (
                                                <DatePicker
                                                    label="Expiration"
                                                    value={value ? new Date(value) : null}
                                                    onChange={(newValue) => {
                                                        if (newValue) {
                                                            const offset = newValue.getTimezoneOffset();
                                                            const adjustedDate = new Date(newValue.getTime() - (offset * 60 * 1000));
                                                            onChange(adjustedDate.toISOString().split('T')[0]);
                                                        } else {
                                                            onChange(undefined);
                                                        }
                                                    }}
                                                    slotProps={{ textField: { fullWidth: true } }}
                                                />
                                            )}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 4 }}>
                                        <TextField
                                            select
                                            label="Option Type"
                                            fullWidth
                                            {...register('optionType')}
                                            SelectProps={{ native: true }}
                                            InputLabelProps={{ shrink: true }}
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

                    {/* Section: Price & Quantity */}
                    <Grid size={{ xs: 12 }}>
                        <Typography
                            variant="h6"
                            fontWeight="bold"
                            sx={{
                                mt: 2,
                                mb: 2,
                                pb: 1,
                                borderBottom: '2px solid',
                                borderColor: 'success.main',
                                background: 'linear-gradient(to right, #10B981, #34D399)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent'
                            }}
                        >
                            Price & Quantity
                        </Typography>
                    </Grid>

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
                        <Controller
                            name="exitDate"
                            control={control}
                            render={({ field: { value, onChange }, fieldState: { error } }) => (
                                <DatePicker
                                    label="Exit Date"
                                    value={value ? new Date(value) : null}
                                    disabled={status === 'Open'}
                                    onChange={(newValue) => {
                                        if (newValue) {
                                            const offset = newValue.getTimezoneOffset();
                                            const adjustedDate = new Date(newValue.getTime() - (offset * 60 * 1000));
                                            onChange(adjustedDate.toISOString().split('T')[0]);
                                        } else {
                                            onChange(undefined);
                                        }
                                    }}
                                    slotProps={{
                                        textField: {
                                            fullWidth: true,
                                            error: !!error,
                                            helperText: error?.message || (status === 'Open' ? 'Not applicable for open trades' : '')
                                        }
                                    }}
                                />
                            )}
                        />
                    </Grid>

                    {/* Section: Risk Management */}
                    <Grid size={{ xs: 12 }}>
                        <Typography
                            variant="h6"
                            fontWeight="bold"
                            sx={{
                                mt: 2,
                                mb: 2,
                                pb: 1,
                                borderBottom: '2px solid',
                                borderColor: 'warning.main',
                                background: 'linear-gradient(to right, #F59E0B, #FBBF24)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent'
                            }}
                        >
                            Risk Management
                        </Typography>
                    </Grid>

                    {/* Risk Management */}
                    <Grid size={{ xs: 12 }}>
                        <Paper variant="outlined" sx={{
                            p: 3,
                            bgcolor: 'background.default',
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: 'divider'
                        }}>
                            <Grid container spacing={3}>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField
                                        label="Stop Loss"
                                        type="number"
                                        fullWidth
                                        InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                                        {...register('stopLoss')}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
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



                    {/* Section: Psychology & Analysis */}
                    <Grid size={{ xs: 12 }}>
                        <Typography
                            variant="h6"
                            fontWeight="bold"
                            sx={{
                                mt: 2,
                                mb: 2,
                                pb: 1,
                                borderBottom: '2px solid',
                                borderColor: 'error.main',
                                background: 'linear-gradient(to right, #EF4444, #F87171)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent'
                            }}
                        >
                            Psychology & Mistakes
                        </Typography>
                    </Grid>

                    {/* Psychology & Mistakes */}
                    <Grid size={{ xs: 12, md: 4 }}>
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
                    <Grid size={{ xs: 12, md: 4 }}>
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

                    <Grid size={{ xs: 12 }} sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
                        <Button
                            type="submit"
                            variant="contained"
                            size="large"
                            disabled={isSubmitting}
                            startIcon={<Save />}
                            sx={{
                                px: 6,
                                py: 1.5,
                                borderRadius: 2,
                                fontWeight: 'bold',
                                fontSize: '1.1rem',
                                background: 'linear-gradient(45deg, #10B981 30%, #34D399 90%)',
                                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
                                transition: 'all 0.3s',
                                '&:hover': {
                                    background: 'linear-gradient(45deg, #059669 30%, #10B981 90%)',
                                    boxShadow: '0 6px 25px rgba(16, 185, 129, 0.6)',
                                    transform: 'translateY(-2px)'
                                },
                                '&:disabled': {
                                    background: 'linear-gradient(45deg, #6B7280 30%, #9CA3AF 90%)',
                                    boxShadow: 'none'
                                }
                            }}
                        >
                            {isSubmitting ? 'Saving...' : 'Save Trade'}
                        </Button>
                    </Grid>
                </Grid >
            </Paper >
        </Box >
    );
}
