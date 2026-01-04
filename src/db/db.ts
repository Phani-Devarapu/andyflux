import Dexie, { type Table } from 'dexie';
import type { Trade } from '../types/trade';
import type { StoredDocument } from '../types/document';
import type { Goal } from '../types/goal';

export class TradingJournalDatabase extends Dexie {
    trades!: Table<Trade>;
    documents!: Table<StoredDocument>;
    goals!: Table<Goal>;

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
                    // Let's set it to 'TFSA' as a safe default for now, or 'NON_REGISTERED' which might be closer to 'General Trading'.
                    // Given user request for TFSA/FHSA/NON_REGISTERED, let's use NON_REGISTERED as the generic fallback.
                    trade.accountId = 'NON_REGISTERED';
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

        // Version 5: Screenshots
        this.version(5).stores({
            trades: '++id, accountId, date, exitDate, symbol, type, side, status, strategy, optionType, expiration, strike, *mistakes, *emotions',
        });

        // Version 6: User ID for Data Isolation
        this.version(6).stores({
            trades: '++id, [userId+accountId], userId, accountId, date, exitDate, symbol, type, side, status, strategy, optionType, expiration, strike, *mistakes, *emotions',
        });

        // Version 7: Documents Table
        this.version(7).stores({
            trades: '++id, [userId+accountId], userId, accountId, date, exitDate, symbol, type, side, status, strategy, optionType, expiration, strike, *mistakes, *emotions',
            documents: '++id, [userId+accountId], userId, accountId, name, storagePath, size, createdAt'
        });

        // Version 8: Goals Table
        this.version(8).stores({
            trades: '++id, [userId+accountId], userId, accountId, date, exitDate, symbol, type, side, status, strategy, optionType, expiration, strike, *mistakes, *emotions',
            documents: '++id, [userId+accountId], userId, accountId, name, storagePath, size, createdAt',
            goals: '++id, [userId+accountId], [userId+accountId+year+month], userId, accountId, year, month, type'
        });
    }
}


export const db = new TradingJournalDatabase();
