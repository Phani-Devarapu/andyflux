import * as Papa from 'papaparse';
// import { db } from '../db/db'; // Removed

import type { Trade } from '../types/trade';
import { getBrokerAdapters, detectBroker, type BrokerName } from './brokerAdapters';
import { calculatePnL, calculatePnLPercent } from './calculations';

export const exportToCsv = (trades: Trade[], filename: string = 'trading-journal.csv') => {
    const csv = Papa.unparse(trades.map(t => ({
        ...t,
        date: t.date.toISOString(),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        // Exclude index field if needed, or keep it
    })));

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const exportToJson = (trades: Trade[], filename: string = 'trading-journal.json') => {
    const json = JSON.stringify(trades, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const importFromJson = async (file: File, userId: string) => {
    return new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                const data = JSON.parse(text);
                if (Array.isArray(data)) {
                    // Validate and parse dates
                    const trades = data.map((t: Trade) => {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { id, ...rest } = t; // Exclude ID
                        return {
                            ...rest,
                            userId, // Force userId to current user
                            date: new Date(t.date),
                            createdAt: new Date(t.createdAt),
                            updatedAt: new Date(t.updatedAt),
                            // Handle legs if present
                            legs: t.legs?.map(leg => ({
                                ...leg,
                                expiration: new Date(leg.expiration)
                            }))
                        };
                    });

                    // Firestore Batch Write
                    const { writeBatch, doc: firestoreDoc, collection } = await import('firebase/firestore');
                    const { db: firestoreDb } = await import('../utils/firebase');

                    const batchSize = 450;
                    const chunks = [];
                    for (let i = 0; i < trades.length; i += batchSize) {
                        chunks.push(trades.slice(i, i + batchSize));
                    }

                    for (const chunk of chunks) {
                        const batch = writeBatch(firestoreDb);
                        const collectionRef = collection(firestoreDb, 'users', userId, 'trades');
                        chunk.forEach(trade => {
                            const newDocRef = firestoreDoc(collectionRef);
                            batch.set(newDocRef, trade);
                        });
                        await batch.commit();
                    }

                    resolve();
                } else {
                    reject('Invalid format');
                }
            } catch (err) {
                reject(err);
            }
        };
        reader.readAsText(file);
    });
};

import { type AccountType } from '../context/AccountContext';

export const importFromCsv = async (
    file: File,
    broker: BrokerName | 'auto' = 'auto',
    accountId: AccountType = 'TFSA',
    userId: string
): Promise<{ success: number; failed: number; errors: string[] }> => {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim(), // Trim whitespace from headers
            transform: (value) => value?.trim(), // Trim whitespace from values
            complete: async (results) => {
                try {
                    const rows = results.data as Record<string, string>[];
                    if (rows.length === 0) {
                        reject(new Error('CSV file is empty or has no valid rows'));
                        return;
                    }

                    // Detect broker if auto
                    let selectedBroker = broker;
                    if (broker === 'auto') {
                        const headers = Object.keys(rows[0]);
                        selectedBroker = detectBroker(headers);
                    }

                    // Get the appropriate adapter
                    const adapters = getBrokerAdapters();
                    const adapter = adapters.find(a => a.name === selectedBroker) || adapters.find(a => a.name === 'generic');

                    if (!adapter) {
                        reject(new Error('No suitable broker adapter found'));
                        return;
                    }

                    // Filter out completely empty rows and footer rows
                    const validRows = rows.filter(row => {
                        const keys = Object.keys(row);
                        // Check if row has any non-empty values
                        const hasData = keys.some(key => {
                            const value = row[key];
                            return value && typeof value === 'string' && value.trim().length > 0;
                        });
                        // Skip rows that look like footers (e.g., "As of...")
                        const firstValue = keys.length > 0 ? (row[keys[0]] || '').toString().toLowerCase() : '';
                        const isFooter = firstValue.includes('as of') || firstValue.includes('generated');
                        return hasData && !isFooter;
                    });

                    // First pass: Parse all transactions
                    interface Transaction {
                        rowIndex: number;
                        date: Date;
                        symbol: string; // Underlying symbol for display
                        fullSymbol: string; // Full symbol for matching (e.g., "SOFI  260116C00040000")
                        direction: 'LONG' | 'SHORT'; // Position direction from CSV
                        action: 'BUY' | 'SELL'; // activity_sub_type
                        isEntry: boolean; // true if this is an entry transaction
                        price: number;
                        quantity: number;
                        fees: number;
                        type: string;
                        notes: string;
                    }

                    const transactions: Transaction[] = [];
                    const errors: string[] = [];
                    let failedCount = 0;

                    for (let i = 0; i < validRows.length; i++) {
                        const row = validRows[i];
                        try {
                            const parsed = adapter.parse(row);
                            if (parsed) {
                                // Ensure required fields are present
                                if (parsed.date && parsed.symbol && parsed.entryPrice && parsed.quantity) {
                                    // Get full symbol and direction from original row
                                    const lowerRow: Record<string, string> = {};
                                    Object.keys(row).forEach(key => {
                                        lowerRow[key.toLowerCase().trim()] = row[key];
                                    });
                                    const fullSymbol = (lowerRow['symbol']?.trim() || parsed.symbol).toUpperCase();
                                    const direction = (lowerRow['direction']?.trim() || 'LONG').toUpperCase() as 'LONG' | 'SHORT';
                                    const action = parsed.side === 'Sell' ? 'SELL' : 'BUY';

                                    // Determine if this is an entry or exit transaction
                                    // LONG: BUY = entry, SELL = exit
                                    // SHORT: SELL = entry, BUY = exit
                                    const isEntry = direction === 'LONG'
                                        ? (action === 'BUY')
                                        : (action === 'SELL');

                                    transactions.push({
                                        rowIndex: i + 2, // +2 because row 1 is header, and we're 0-indexed
                                        date: parsed.date instanceof Date ? parsed.date : new Date(parsed.date),
                                        symbol: parsed.symbol, // Underlying symbol for display
                                        fullSymbol: fullSymbol, // Full symbol for matching
                                        direction: direction,
                                        action: action,
                                        isEntry: isEntry,
                                        price: parsed.entryPrice,
                                        quantity: parsed.quantity,
                                        fees: parsed.fees || 0,
                                        type: parsed.type || 'Stock',
                                        notes: parsed.notes || '',
                                    });
                                } else {
                                    failedCount++;
                                    const missingFields = [];
                                    if (!parsed.date) missingFields.push('date');
                                    if (!parsed.symbol) missingFields.push('symbol');
                                    if (!parsed.entryPrice) missingFields.push('entryPrice');
                                    if (!parsed.quantity) missingFields.push('quantity');
                                    errors.push(`Row ${i + 2}: Missing required fields: ${missingFields.join(', ')}`);
                                }
                            }
                            // If parsed is null, it means the row was intentionally skipped (e.g., non-trade activity)
                            // Don't count these as failures
                        } catch (err) {
                            failedCount++;
                            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
                            errors.push(`Row ${i + 2}: ${errorMsg}`);
                        }
                    }

                    // Second pass: Match entry and exit transactions by full symbol (FIFO)
                    const trades: Trade[] = [];
                    const symbolGroups = new Map<string, Transaction[]>();

                    // Group transactions by full symbol (this ensures options match correctly)
                    transactions.forEach(tx => {
                        const matchKey = tx.fullSymbol;
                        if (!symbolGroups.has(matchKey)) {
                            symbolGroups.set(matchKey, []);
                        }
                        symbolGroups.get(matchKey)!.push(tx);
                    });

                    // Process each symbol group
                    symbolGroups.forEach((txs) => {
                        // Sort by date
                        txs.sort((a, b) => a.date.getTime() - b.date.getTime());

                        // FIFO matching: match oldest entry with oldest exit
                        const entryQueue: Transaction[] = [];
                        const exitQueue: Transaction[] = [];

                        txs.forEach(tx => {
                            if (tx.isEntry) {
                                entryQueue.push(tx);
                            } else {
                                exitQueue.push(tx);
                            }
                        });

                        // Get the underlying symbol and direction from first transaction
                        const firstTx = txs[0];
                        const displaySymbol = firstTx.symbol;
                        const fullSymbolForTrade = firstTx.fullSymbol; // Use full symbol for options
                        const isShort = firstTx.direction === 'SHORT';

                        // For options, use full symbol; for stocks, use underlying symbol
                        const tradeSymbol = firstTx.type === 'Option' ? fullSymbolForTrade : displaySymbol;

                        // Match entries with exits
                        while (entryQueue.length > 0 && exitQueue.length > 0) {
                            const entry = entryQueue[0];
                            const exit = exitQueue[0];
                            const matchedQty = Math.min(entry.quantity, exit.quantity);

                            // Create combined trade
                            const now = new Date();
                            const tradeSide: 'Buy' | 'Sell' = isShort ? 'Sell' : 'Buy';
                            const pnl = calculatePnL(entry.price, exit.price, matchedQty, tradeSide);
                            const pnlPercent = calculatePnLPercent(entry.price, exit.price, tradeSide);
                            const totalFees = (entry.fees || 0) + (exit.fees || 0);

                            const trade: Trade = {
                                userId,
                                accountId,
                                date: entry.date, // Use entry date as trade date
                                symbol: tradeSymbol, // Use full symbol for options, underlying for stocks
                                type: entry.type as Trade['type'],
                                side: tradeSide,
                                entryPrice: entry.price,
                                exitPrice: exit.price,
                                exitDate: exit.date,
                                quantity: matchedQty,
                                status: 'Closed',
                                pnl: pnl - totalFees, // Subtract fees from P/L
                                pnlPercentage: pnlPercent,
                                fees: totalFees,
                                notes: `Matched trade: ${entry.notes || ''} → ${exit.notes || ''}`.trim() || 'Imported from Wealthsimple',
                                createdAt: now,
                                updatedAt: now,
                            };

                            trades.push(trade);

                            // Reduce quantities
                            entry.quantity -= matchedQty;
                            exit.quantity -= matchedQty;

                            // Remove fully matched transactions
                            if (entry.quantity === 0) entryQueue.shift();
                            if (exit.quantity === 0) exitQueue.shift();
                        }

                        // Handle unmatched entries (open positions)
                        entryQueue.forEach(entry => {
                            if (entry.quantity > 0) {
                                const now = new Date();
                                const tradeSide: 'Buy' | 'Sell' = isShort ? 'Sell' : 'Buy';
                                const trade: Trade = {
                                    userId,
                                    accountId,
                                    date: entry.date,
                                    symbol: tradeSymbol,
                                    type: entry.type as Trade['type'],
                                    side: tradeSide,
                                    entryPrice: entry.price,
                                    quantity: entry.quantity,
                                    status: 'Open',
                                    fees: entry.fees || 0,
                                    notes: entry.notes || `Imported from Wealthsimple (open ${isShort ? 'short' : 'long'} position)`,
                                    createdAt: now,
                                    updatedAt: now,
                                };
                                trades.push(trade);
                            }
                        });

                        // Handle unmatched exits (entry might be in a different CSV or before export date)
                        // Treat as open trade since we don't have the entry - user can close it later when they have entry data
                        exitQueue.forEach(exit => {
                            if (exit.quantity > 0) {
                                // Create an open trade - the exit price becomes the current price
                                // User needs to add entry price and then close the trade
                                const now = new Date();
                                const tradeSide: 'Buy' | 'Sell' = isShort ? 'Sell' : 'Buy';
                                const trade: Trade = {
                                    userId,
                                    accountId,
                                    date: exit.date,
                                    symbol: tradeSymbol,
                                    type: exit.type as Trade['type'],
                                    side: tradeSide,
                                    entryPrice: exit.price, // Use exit price as placeholder entry - needs manual update
                                    quantity: exit.quantity,
                                    status: 'Open', // Mark as open since we don't have complete trade data
                                    fees: exit.fees || 0,
                                    notes: `${exit.notes || 'Imported from Wealthsimple'} - WARNING: Entry transaction not found. This was an exit transaction - please update entry price and close the trade when ready.`,
                                    createdAt: now,
                                    updatedAt: now,
                                };
                                trades.push(trade);
                                errors.push(`Row ${exit.rowIndex}: Exit transaction without matching entry for ${displaySymbol} - Created as OPEN trade (entry price needs update)`);
                            }
                        });
                    });

                    const successCount = trades.length;

                    // Bulk add trades to database (Firestore)
                    if (trades.length > 0) {
                        try {
                            const { writeBatch, doc: firestoreDoc, collection } = await import('firebase/firestore');
                            const { db: firestoreDb } = await import('../utils/firebase');

                            // Firestore batches are limited to 500 operations
                            const batchSize = 450;
                            const chunks = [];
                            for (let i = 0; i < trades.length; i += batchSize) {
                                chunks.push(trades.slice(i, i + batchSize));
                            }

                            for (const chunk of chunks) {
                                const batch = writeBatch(firestoreDb);
                                const collectionRef = collection(firestoreDb, 'users', userId, 'trades');

                                chunk.forEach(trade => {
                                    // Let Firestore generate ID
                                    const newDocRef = firestoreDoc(collectionRef);
                                    batch.set(newDocRef, trade);
                                });
                                await batch.commit();
                            }
                        } catch (err) {
                            console.error("Firestore batch write failed", err);
                            // Re-throw to be caught by outer catch
                            throw err;
                        }
                    }

                    resolve({
                        success: successCount,
                        failed: failedCount,
                        errors: errors.slice(0, 10), // Limit errors to first 10
                    });
                } catch (err) {
                    reject(err);
                }
            },
            error: (error) => {
                reject(new Error(`CSV parsing error: ${error.message}`));
            },
        });
    });
};
