import Dexie, { type Table } from 'dexie';
import type { Trade } from '../types/trade';

export class TradingJournalDatabase extends Dexie {
    trades!: Table<Trade>;

    constructor() {
        super('TradingJournalDB');
        this.version(1).stores({
            trades: '++id, date, symbol, type, side, status, strategy',
        });

        // Version 2: Multi-account support
        this.version(2).stores({
            trades: '++id, accountId, date, exitDate, symbol, type, side, status, strategy',
        }).upgrade(tx => {
            return tx.table('trades').toCollection().modify(trade => {
                if (!trade.accountId) {
                    trade.accountId = 'trading';
                }
            });
        });

        // Version 3: Option fields
        this.version(3).stores({
            trades: '++id, accountId, date, exitDate, symbol, type, side, status, strategy, optionType, expiration, strike',
        });

        // Version 4: Mistakes and Emotions
        this.version(4).stores({
            trades: '++id, accountId, date, exitDate, symbol, type, side, status, strategy, optionType, expiration, strike, *mistakes, *emotions',
        });

        // Version 5: Screenshots (No schema change needed if not indexing, but good to track version)
        this.version(5).stores({
            trades: '++id, accountId, date, exitDate, symbol, type, side, status, strategy, optionType, expiration, strike, *mistakes, *emotions',
        });
    }
}

export const db = new TradingJournalDatabase();
