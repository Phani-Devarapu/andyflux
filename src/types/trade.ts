export type TradeType = 'Stock' | 'ETF' | 'Option' | 'Future' | 'Crypto' | 'Forex';
export type TradeSide = 'Buy' | 'Sell';
export type TradeStatus = 'Open' | 'Closed';
export type WinLoss = 'Win' | 'Loss' | 'Breakeven' | 'Open';

import { type AccountType } from '../context/AccountContext';

export interface Trade {
    id?: number;
    userId: string;
    accountId: AccountType;
    date: Date;
    symbol: string;
    type: TradeType;
    side: TradeSide;
    entryPrice: number;
    exitPrice?: number;
    exitDate?: Date;
    quantity: number;
    // Option specific fields
    strike?: number;
    expiration?: Date;
    optionType?: 'Call' | 'Put';
    stopLoss?: number;
    target?: number;
    status: TradeStatus;
    pnl?: number;
    pnlPercentage?: number;
    riskRewardRatio?: number;
    strategy?: string; // e.g., "Reversal", "Trend", "FOMO"
    timeframe?: string;
    emotions?: string[];
    notes?: string;
    fees?: number;
    mistakes?: string[];
    screenshots?: string[]; // Array of base64 or blob URLs? Storing images in IndexedDB can be heavy, maybe just store 1-2.
    createdAt: Date;
    updatedAt: Date;
}

export interface TradeFilter {
    startDate?: Date;
    endDate?: Date;
    symbol?: string;
    status?: TradeStatus;
    strategy?: string;
}
