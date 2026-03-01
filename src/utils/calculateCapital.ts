/**
 * Shared utility to calculate the capital deployed for a trade.
 *
 * Convention:
 *  - option entryPrice is stored as the TOTAL per-contract cost (e.g. $505 for one contract),
 *    NOT the per-share premium ($5.05). So we do NOT multiply options by 100.
 *  - spread entryPrice is the per-share net debit/credit, so we DO multiply by 100.
 *  - for sold options (CSP / CC), we use strike × qty × 100 as the capital at risk.
 *  - for sold spreads (credit spreads), we use strike-diff × qty × 100 as the margin.
 */

import type { Trade } from '../types/trade';
import { parseOptionSymbol } from './optionSymbolParser';

// Minimal interface needed from each leg — only strike matters for capital calculation
interface LegLike {
    strike: number;
    side?: string;
    optionType?: string;
    quantity?: number;
    expiration?: Date | string;
}

export function calculateCapital(trade: {
    type: Trade['type'];
    side: Trade['side'];
    entryPrice: number;
    quantity: number;
    strike?: number;
    symbol: string;
    legs?: LegLike[];
    fees?: number;
}): number {
    if (trade.type === 'Spread') {
        if (trade.side === 'Sell') {
            // Credit Spread: margin = strike diff × qty × 100
            if (trade.legs && trade.legs.length >= 2) {
                const strikes = trade.legs.map(l => l.strike || 0);
                const strikeDiff = Math.abs(Math.max(...strikes) - Math.min(...strikes));
                return strikeDiff * trade.quantity * 100;
            }
            // Fallback: treat entryPrice as per-share net credit
            return trade.entryPrice * trade.quantity * 100;
        } else {
            // Debit Spread: net debit × qty × 100
            return trade.entryPrice * trade.quantity * 100;
        }
    }

    if (trade.type === 'Option' && trade.side === 'Sell') {
        // Sold option (CSP / Covered Call): capital at risk = strike notional
        if (trade.strike) {
            return trade.strike * trade.quantity * 100;
        }
        const parsed = parseOptionSymbol(trade.symbol);
        if (parsed.strike) {
            return parsed.strike * trade.quantity * 100;
        }
        // Fallback: use entryPrice (total per-contract)
        return trade.entryPrice * trade.quantity;
    }

    // Bought option or stock/ETF/crypto/forex/future
    // Option entryPrice = total per-contract cost (no ×100 needed)
    return trade.entryPrice * trade.quantity;
}
