import { describe, it, expect } from 'vitest';
import { calculatePnL, calculateProfitFactor, calculateExpectancy, calculateMaxDrawdown } from './calculations';
import type { Trade } from '../types/trade';

describe('Calculation Utils', () => {
    describe('calculatePnL', () => {
        it('calculates correct profit for Long position', () => {
            expect(calculatePnL(100, 110, 10, 'Buy')).toBe(100);
        });
    });

    describe('Advanced Metrics', () => {
        const mockTrades: Partial<Trade>[] = [
            { pnl: 100, date: new Date('2024-01-01') },
            { pnl: -50, date: new Date('2024-01-02') },
            { pnl: 150, date: new Date('2024-01-03') },
            { pnl: -100, date: new Date('2024-01-04') },
        ];

        it('calculateProfitFactor', () => {
            // Gross Profit: 250, Gross Loss: 150 -> PF: 1.67
            expect(calculateProfitFactor(mockTrades as Trade[])).toBe(1.67);
        });

        it('calculateExpectancy', () => {
            // Total PnL: 100, Count: 4 -> Exp: 25
            expect(calculateExpectancy(mockTrades as Trade[])).toBe(25);
        });

        it('calculateMaxDrawdown', () => {
            expect(calculateMaxDrawdown(mockTrades as Trade[])).toBe(100);
        });
    });
});
