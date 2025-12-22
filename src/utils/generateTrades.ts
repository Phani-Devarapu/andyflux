import { db } from '../db/db';
import type { Trade, TradeType, TradeSide } from '../types/trade';
import { calculatePnL, calculatePnLPercent } from './calculations';

export const generateTrades = async (userId: string, count: number = 1000) => {
    const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'SPY', 'QQQ', 'AMD', 'META'];
    const types: TradeType[] = ['Stock', 'ETF', 'Option', 'Future', 'Crypto', 'Forex'];
    const sides: TradeSide[] = ['Buy', 'Sell'];
    const strategies = ['Trend', 'Breakout', 'Reversal', 'Scalp', 'Swing'];

    const trades: Trade[] = [];

    for (let i = 0; i < count; i++) {
        const isClosed = Math.random() > 0.1; // 90% closed trades
        const side = sides[Math.floor(Math.random() * sides.length)];
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];
        const entryPrice = Math.floor(Math.random() * 500) + 10;
        const quantity = Math.floor(Math.random() * 100) + 1;

        let exitPrice, pnl, pnlPercentage;

        if (isClosed) {
            // Logic to create random win/loss
            const percentMove = (Math.random() * 0.4) - 0.2; // -20% to +20% move
            if (side === 'Buy') {
                exitPrice = entryPrice * (1 + percentMove);
            } else {
                exitPrice = entryPrice * (1 - percentMove);
            }
            pnl = calculatePnL(entryPrice, exitPrice, quantity, side);
            pnlPercentage = calculatePnLPercent(entryPrice, exitPrice, side);
        }

        const trade: Partial<Trade> = { // Partial<Trade> to bypass id requirement for insert
            userId,
            date: new Date(Date.now() - Math.floor(Math.random() * 10000000000)), // Random date in past
            symbol,
            type: types[Math.floor(Math.random() * types.length)],
            side,
            entryPrice,
            exitPrice,
            quantity,
            status: isClosed ? 'Closed' : 'Open',
            strategy: strategies[Math.floor(Math.random() * strategies.length)],
            pnl,
            pnlPercentage,
            accountId: 'TFSA' as const, // Default account for generated trades
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        trades.push(trade as Trade);
    }

    await db.trades.clear();
    await db.trades.bulkAdd(trades as Trade[]);
    console.log(`Successfully generated ${count} trades for user ${userId}.`);
};
