
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Re-creating the schema logic for unit testing
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
    legs: z.array(legSchema).optional(),
    status: z.enum(['Open', 'Closed']),
}).refine((data) => {
    if (data.status === 'Closed' && !data.exitDate) {
        return false;
    }
    return true;
}, {
    message: 'Exit date is required for closed trades',
    path: ['exitDate'],
}).refine((data) => {
    if (data.type === 'Spread' && (!data.legs || data.legs.length < 2)) {
        return false;
    }
    return true;
}, {
    message: 'At least 2 legs are required for a spread',
    path: ['legs'],
});

// Helper for PnL calculation testing
const calculatePnL = (entry: number, exit: number, quantity: number, side: 'Buy' | 'Sell', isOption: boolean) => {
    const multiplier = isOption ? 100 : 1;
    if (side === 'Buy') {
        return (exit - entry) * quantity * multiplier;
    }
    return (entry - exit) * quantity * multiplier;
};

// Helper for Capital calculation testing
const calculateCapital = (trade: any) => {
    if (trade.type === 'Spread') {
        if (trade.side === 'Sell') {
            if (trade.legs && trade.legs.length >= 2) {
                const strikes = trade.legs.map((l: any) => l.strike);
                const strikeDiff = Math.abs(Math.max(...strikes) - Math.min(...strikes));
                return strikeDiff * trade.quantity * 100;
            }
            return trade.entryPrice * trade.quantity * 100;
        }
        return trade.entryPrice * trade.quantity * 100;
    }
    return trade.entryPrice * trade.quantity * (trade.type === 'Option' ? 100 : 1);
};

describe('Spread Support Logic', () => {
    describe('Validation', () => {
        it('validates a correct spread trade', () => {
            const result = tradeSchema.safeParse({
                date: '2025-01-01',
                symbol: 'AAPL',
                type: 'Spread',
                side: 'Sell',
                entryPrice: 2.5,
                quantity: 1,
                status: 'Open',
                legs: [
                    { side: 'Sell', strike: 150, optionType: 'Put', expiration: '2025-02-01', quantity: 1 },
                    { side: 'Buy', strike: 140, optionType: 'Put', expiration: '2025-02-01', quantity: 1 }
                ]
            });
            expect(result.success).toBe(true);
        });

        it('fails if spread has fewer than 2 legs', () => {
            const result = tradeSchema.safeParse({
                date: '2025-01-01',
                symbol: 'AAPL',
                type: 'Spread',
                side: 'Sell',
                entryPrice: 2.5,
                quantity: 1,
                status: 'Open',
                legs: [
                    { side: 'Sell', strike: 150, optionType: 'Put', expiration: '2025-02-01', quantity: 1 }
                ]
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('At least 2 legs are required for a spread');
            }
        });
    });

    describe('Calculations', () => {
        it('calculates capital (margin) for a credit spread', () => {
            const trade = {
                type: 'Spread',
                side: 'Sell',
                entryPrice: 2.5,
                quantity: 1,
                legs: [
                    { side: 'Sell', strike: 150 },
                    { side: 'Buy', strike: 140 }
                ]
            };
            const capital = calculateCapital(trade);
            // (150 - 140) * 1 * 100 = 10 * 100 = 1000
            expect(capital).toBe(1000);
        });

        it('calculates capital for a debit spread', () => {
            const trade = {
                type: 'Spread',
                side: 'Buy',
                entryPrice: 3.5,
                quantity: 2,
                legs: [
                    { side: 'Buy', strike: 150 },
                    { side: 'Sell', strike: 160 }
                ]
            };
            const capital = calculateCapital(trade);
            // 3.5 * 2 * 100 = 700
            expect(capital).toBe(700);
        });

        it('calculates PnL for a closed spread', () => {
            const entryPrice = 2.5; // Net Credit
            const exitPrice = 0.5;  // Net Cost to Close
            const quantity = 1;
            const side = 'Sell'; // Credit Spread

            const pnl = calculatePnL(entryPrice, exitPrice, quantity, side, true);
            // (2.5 - 0.5) * 1 * 100 = 200
            expect(pnl).toBe(200);
        });
    });

    describe('Symbol Generation Logic', () => {
        it('verifies the symbol formatting logic', () => {
            const underlying = 'AAPL';
            const legs = [
                { side: 'Sell', strike: 150, optionType: 'Put' },
                { side: 'Buy', strike: 140, optionType: 'Put' }
            ];

            const strikes = legs.map(l => l.strike).sort((a, b) => b - a);
            const optionType = legs[0].optionType.toUpperCase();
            const formattedSymbol = `${underlying} $${strikes[0]}/$${strikes[1]} ${optionType} Spread`;

            expect(formattedSymbol).toBe('AAPL $150/$140 PUT Spread');
        });
    });
});
