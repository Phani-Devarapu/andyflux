/* eslint-disable react-hooks/incompatible-library */
import { useForm, Controller, useFieldArray, type Resolver, type SubmitHandler } from 'react-hook-form';
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

const legSchema = z.object({
    side: z.enum(['Buy', 'Sell']),
    strike: z.number().positive(),
    optionType: z.enum(['Call', 'Put']),
    expiration: z.string(),
    quantity: z.number().positive(),
});

const tradeSchema = z.object({
    date: z.string(),
    exitDate: z.string().optional(),
    symbol: z.string().min(1, 'Symbol is required').toUpperCase(),
    type: z.enum(['Stock', 'ETF', 'Option', 'Future', 'Crypto', 'Forex', 'Spread']),
    side: z.enum(['Buy', 'Sell']),
    entryPrice: z.number().positive('Price must be positive'),
    exitPrice: numberFromAny.pipe(z.number().min(0, 'Price cannot be negative').optional()),
    quantity: z.number().positive('Quantity must be positive'),
    // Option fields
    strike: numberFromAny.pipe(z.number().positive().optional()),
    expiration: z.string().optional(),
    optionType: z.enum(['Call', 'Put']).optional(),
    // Spread fields
    legs: z.array(legSchema).optional(),
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
}).refine((data) => {
    // If type is Spread, legs should be provided and have at least 2 legs
    if (data.type === 'Spread' && (!data.legs || data.legs.length < 2)) {
        return false;
    }
    return true;
}, {
    message: 'At least 2 legs are required for a spread',
    path: ['legs'],
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

    const { fields, append, remove, replace } = useFieldArray({
        control,
        name: "legs",
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

    // Initialize 2 legs if type is Spread and legs are empty
    useEffect(() => {
        if (type === 'Spread' && fields.length === 0) {
            replace([
                { side: 'Sell', strike: 0, optionType: 'Put', expiration: new Date().toISOString().split('T')[0], quantity: 1 },
                { side: 'Buy', strike: 0, optionType: 'Put', expiration: new Date().toISOString().split('T')[0], quantity: 1 },
            ]);
        }
    }, [type, fields.length, replace]);

    const SPREAD_TEMPLATES = {
        'bull_call': {
            name: 'Bull Call Spread (Debit)',
            strategy: 'Bull Call Spread',
            side: 'Buy',
            legs: [
                { side: 'Buy', strike: 0, optionType: 'Call', expiration: watch('date'), quantity: 1 },
                { side: 'Sell', strike: 0, optionType: 'Call', expiration: watch('date'), quantity: 1 },
            ]
        },
        'bear_put': {
            name: 'Bear Put Spread (Debit)',
            strategy: 'Bear Put Spread',
            side: 'Buy',
            legs: [
                { side: 'Buy', strike: 0, optionType: 'Put', expiration: watch('date'), quantity: 1 },
                { side: 'Sell', strike: 0, optionType: 'Put', expiration: watch('date'), quantity: 1 },
            ]
        },
        'bull_put': {
            name: 'Bull Put Spread (Credit)',
            strategy: 'Bull Put Spread',
            side: 'Sell',
            legs: [
                { side: 'Sell', strike: 0, optionType: 'Put', expiration: watch('date'), quantity: 1 },
                { side: 'Buy', strike: 0, optionType: 'Put', expiration: watch('date'), quantity: 1 },
            ]
        },
        'bear_call': {
            name: 'Bear Call Spread (Credit)',
            strategy: 'Bear Call Spread',
            side: 'Sell',
            legs: [
                { side: 'Sell', strike: 0, optionType: 'Call', expiration: watch('date'), quantity: 1 },
                { side: 'Buy', strike: 0, optionType: 'Call', expiration: watch('date'), quantity: 1 },
            ]
        },
        'iron_condor': {
            name: 'Iron Condor',
            strategy: 'Iron Condor',
            side: 'Sell',
            legs: [
                { side: 'Sell', strike: 0, optionType: 'Call', expiration: watch('date'), quantity: 1 },
                { side: 'Buy', strike: 0, optionType: 'Call', expiration: watch('date'), quantity: 1 },
                { side: 'Sell', strike: 0, optionType: 'Put', expiration: watch('date'), quantity: 1 },
                { side: 'Buy', strike: 0, optionType: 'Put', expiration: watch('date'), quantity: 1 },
            ]
        },
        'long_straddle': {
            name: 'Long Straddle',
            strategy: 'Straddle',
            side: 'Buy',
            legs: [
                { side: 'Buy', strike: 0, optionType: 'Call', expiration: watch('date'), quantity: 1 },
                { side: 'Buy', strike: 0, optionType: 'Put', expiration: watch('date'), quantity: 1 },
            ]
        },
        'long_strangle': {
            name: 'Long Strangle',
            strategy: 'Strangle',
            side: 'Buy',
            legs: [
                { side: 'Buy', strike: 0, optionType: 'Call', expiration: watch('date'), quantity: 1 },
                { side: 'Buy', strike: 0, optionType: 'Put', expiration: watch('date'), quantity: 1 },
            ]
        }
    };

    const applyTemplate = (templateKey: string) => {
        const template = SPREAD_TEMPLATES[templateKey as keyof typeof SPREAD_TEMPLATES];
        if (template) {
            // Keep existing strikes if possible, or use current entry price
            const currentLegs = getValues('legs') || [];
            const newLegs = template.legs.map((leg, idx) => ({
                ...leg,
                strike: currentLegs[idx]?.strike || 0,
                expiration: currentLegs[idx]?.expiration || watch('date')
            }));

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            replace(newLegs as any);
            setValue('strategy', template.strategy);
            setValue('side', template.side as 'Buy' | 'Sell');
        }
    };

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
                    const getSafeDateString = (d: unknown) => {
                        if (!d) return undefined;
                        if (typeof d === 'object' && 'toDate' in d && typeof (d as any).toDate === 'function') {
                            return (d as any).toDate().toISOString().split('T')[0];
                        }
                        return new Date(d as string | number | Date).toISOString().split('T')[0];
                    };

                    reset({
                        ...(trade as any), // We still need a cast for the bulk object spread into react-hook-form
                        date: getSafeDateString(trade.date) || new Date().toISOString().split('T')[0],
                        exitDate: trade.exitDate ? getSafeDateString(trade.exitDate) : undefined,
                        expiration: trade.expiration ? getSafeDateString(trade.expiration) : undefined,
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

            // Calculate annualized return for closed trades (same formula as TickerAnalytics)
            let annualizedReturn: number | undefined = undefined;
            if (data.status === 'Closed' && pnl !== undefined && data.exitDate) {
                const entryDate = new Date(data.date);
                const exitDate = new Date(data.exitDate);
                const daysHeld = Math.max(1, Math.ceil(Math.abs(exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)));

                // Calculate capital deployed (same logic as TickerAnalytics)
                let capital = 0;
                if (data.type === 'Spread') {
                    // For spreads, capital is often the margin (Strike Diff * 100) or Net Debit
                    if (data.side === 'Sell') {
                        // Credit Spread: Capital = (Strike Diff * 100 * quantity)
                        if (data.legs && data.legs.length >= 2) {
                            const strikes = data.legs.map(l => l.strike);
                            const strikeDiff = Math.abs(Math.max(...strikes) - Math.min(...strikes));
                            capital = strikeDiff * data.quantity * 100;
                        } else {
                            capital = data.entryPrice * data.quantity * 100;
                        }
                    } else {
                        // Debit Spread: Capital = Net Debit
                        capital = data.entryPrice * data.quantity * 100;
                    }
                } else if (data.type === 'Option' && data.side === 'Sell') {
                    // For sold options, capital is strike * quantity * 100
                    capital = data.strike ? data.strike * data.quantity * 100 : (data.entryPrice * data.quantity * 100);
                } else {
                    // For stocks/bought options
                    const multiplier = data.type === 'Option' ? 100 : 1;
                    capital = (data.entryPrice * data.quantity * multiplier);
                }

                if (capital > 0) {
                    const returnPercent = (pnl / capital) * 100;
                    annualizedReturn = returnPercent * (365 / daysHeld);
                    console.log(`Calculated annualized return: ${annualizedReturn.toFixed(2)}% (${daysHeld} days, ${returnPercent.toFixed(2)}% return on $${capital.toFixed(2)} capital)`);
                }
            }

            const riskRewardRatio = (data.stopLoss && data.target)
                ? calculateRiskReward(data.entryPrice, data.stopLoss, data.target, data.side)
                : undefined;

            let formattedSymbol = data.symbol;
            if (data.type === 'Option' && data.strike && data.optionType) {
                const underlying = data.symbol.split(' ')[0];
                const typeLabel = data.optionType.toUpperCase();
                formattedSymbol = `${underlying} $${data.strike} ${typeLabel}`;
            } else if (data.type === 'Spread' && data.legs && data.legs.length >= 2) {
                const underlying = data.symbol.split(' ')[0];
                const strikes = data.legs.map(l => l.strike).sort((a, b) => b - a); // Sort descending
                const optionType = data.legs[0].optionType.toUpperCase();
                formattedSymbol = `${underlying} $${strikes[0]}/$${strikes[1]} ${optionType} Spread`;
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

            const cleanData = (obj: Record<string, unknown>) => {
                const newObj: Record<string, unknown> = {};
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

    const onError = (errors: unknown) => {
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
                            <option value="Spread">Spread</option>
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

                    {/* Spread Details - Only shown if type is Spread */}
                    {type === 'Spread' && (
                        <Grid size={{ xs: 12 }}>
                            <Paper
                                variant="outlined"
                                sx={{
                                    p: 3,
                                    bgcolor: theme => theme.palette.mode === 'dark'
                                        ? 'rgba(16, 185, 129, 0.05)'
                                        : 'rgba(16, 185, 129, 0.02)',
                                    borderColor: 'success.main',
                                    borderRadius: 2,
                                    borderWidth: 1.5
                                }}
                            >
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography
                                        variant="subtitle2"
                                        sx={{
                                            color: 'success.main',
                                            fontWeight: 700,
                                            textTransform: 'uppercase',
                                            letterSpacing: 1
                                        }}
                                    >
                                        Spread Details (Legs)
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                        <TextField
                                            select
                                            label="Select Template"
                                            size="small"
                                            defaultValue=""
                                            onChange={(e) => applyTemplate(e.target.value)}
                                            sx={{ minWidth: 200 }}
                                            SelectProps={{ native: true }}
                                            InputLabelProps={{ shrink: true }}
                                        >
                                            <option value="">-- Choose Template --</option>
                                            {Object.entries(SPREAD_TEMPLATES).map(([key, value]) => (
                                                <option key={key} value={key}>{value.name}</option>
                                            ))}
                                        </TextField>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            color="success"
                                            onClick={() => append({ side: 'Buy', strike: 0, optionType: 'Put', expiration: new Date().toISOString().split('T')[0], quantity: 1 })}
                                        >
                                            Add Leg
                                        </Button>
                                    </Box>
                                </Box>

                                {fields.map((field, index) => (
                                    <Box key={field.id} sx={{ mb: index === fields.length - 1 ? 0 : 3, pb: index === fields.length - 1 ? 0 : 3, borderBottom: index === fields.length - 1 ? 'none' : '1px dashed', borderColor: 'divider' }}>
                                        <Grid container spacing={2} alignItems="center">
                                            <Grid size={{ xs: 12, md: 2 }}>
                                                <TextField
                                                    select
                                                    label="Side"
                                                    fullWidth
                                                    {...register(`legs.${index}.side` as const)}
                                                    SelectProps={{ native: true }}
                                                >
                                                    <option value="Sell">Sell (Short)</option>
                                                    <option value="Buy">Buy (Long)</option>
                                                </TextField>
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 2 }}>
                                                <TextField
                                                    label="Strike"
                                                    type="number"
                                                    fullWidth
                                                    {...register(`legs.${index}.strike` as const, { valueAsNumber: true })}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 2 }}>
                                                <TextField
                                                    select
                                                    label="Type"
                                                    fullWidth
                                                    {...register(`legs.${index}.optionType` as const)}
                                                    SelectProps={{ native: true }}
                                                >
                                                    <option value="Put">Put</option>
                                                    <option value="Call">Call</option>
                                                </TextField>
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 3 }}>
                                                <Controller
                                                    name={`legs.${index}.expiration` as const}
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
                                                                }
                                                            }}
                                                            slotProps={{ textField: { fullWidth: true } }}
                                                        />
                                                    )}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 2 }}>
                                                <TextField
                                                    label="Qty"
                                                    type="number"
                                                    fullWidth
                                                    {...register(`legs.${index}.quantity` as const, { valueAsNumber: true })}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 1 }}>
                                                <Button
                                                    color="error"
                                                    onClick={() => remove(index)}
                                                    disabled={fields.length <= 2}
                                                >
                                                    Remove
                                                </Button>
                                            </Grid>
                                        </Grid>
                                    </Box>
                                ))}
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
