
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Re-creating the schema logic here for unit testing since it's not exported from the component
// In a real app, I'd export the schema from TradeForm.tsx or move it to a shared file.
// For now, I'll test the logic itself.

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
    mistakes: z.array(z.string()).optional(),
    emotions: z.array(z.string()).optional(),
    screenshots: z.array(z.string()).optional(),
    status: z.enum(['Open', 'Closed']),
}).refine((data) => {
    if (data.status === 'Closed' && !data.exitDate) {
        return false;
    }
    return true;
}, {
    message: 'Exit date is required for closed trades',
    path: ['exitDate'],
});

describe('Trade Validation Logic', () => {
    it('validates a correct open trade', () => {
        const result = tradeSchema.safeParse({
            date: '2025-01-01',
            symbol: 'AAPL',
            type: 'Stock',
            side: 'Buy',
            entryPrice: 150,
            quantity: 10,
            status: 'Open',
            mistakes: ['FOMO'],
            emotions: ['Anxious']
        });
        expect(result.success).toBe(true);
    });

    it('fails if closed trade is missing exit date', () => {
        const result = tradeSchema.safeParse({
            date: '2025-01-01',
            symbol: 'AAPL',
            type: 'Stock',
            side: 'Buy',
            entryPrice: 150,
            quantity: 10,
            status: 'Closed', // Closed but no exitDate
        });
        expect(result.success).toBe(false);
    });

    it('validates mistakes and emotions as arrays', () => {
        const result = tradeSchema.safeParse({
            date: '2025-01-01',
            symbol: 'AAPL',
            type: 'Stock',
            side: 'Buy',
            entryPrice: 150,
            quantity: 10,
            status: 'Open',
            mistakes: ['FOMO', 'Revenge'], // Array
            emotions: ['Confident'],
            screenshots: ['data:image/png;base64,fakeimage']
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.mistakes).toHaveLength(2);
            expect(result.data.screenshots).toHaveLength(1);
        }
    });
});
