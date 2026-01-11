/**
 * One-time migration script to backfill annualizedReturn for existing closed trades
 * Run this once to update all old trades in Firestore
 */

import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { parseOptionSymbol } from './optionSymbolParser';
import type { Trade } from '../types/trade';

export async function backfillAnnualizedReturn(userId: string): Promise<{ updated: number; skipped: number; errors: number }> {
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    try {
        console.log('Starting annualized return backfill...');

        // Get all trades for the user
        const tradesRef = collection(db, 'users', userId, 'trades');
        const snapshot = await getDocs(tradesRef);

        console.log(`Found ${snapshot.size} total trades`);

        for (const tradeDoc of snapshot.docs) {
            try {
                const trade = tradeDoc.data() as Trade;

                // Skip if already has annualizedReturn
                if (trade.annualizedReturn !== undefined && trade.annualizedReturn !== null) {
                    skipped++;
                    continue;
                }

                // Skip if not closed or missing required data
                if (trade.status !== 'Closed' || !trade.pnl || !trade.exitDate || !trade.date) {
                    skipped++;
                    continue;
                }

                // Calculate annualized return
                const exit = new Date(trade.exitDate);
                const entry = new Date(trade.date);
                const daysHeld = Math.max(1, Math.ceil(Math.abs(exit.getTime() - entry.getTime()) / (1000 * 60 * 60 * 24)));

                // Calculate capital deployed
                let capital = 0;
                if (trade.type === 'Option' && trade.side === 'Sell') {
                    // For sold options, use strike field if available, otherwise parse from symbol
                    if (trade.strike) {
                        capital = trade.strike * trade.quantity * 100;
                    } else {
                        const parsed = parseOptionSymbol(trade.symbol);
                        capital = parsed.strike ? parsed.strike * trade.quantity * 100 : (trade.entryPrice * trade.quantity * 100);
                    }
                } else {
                    const multiplier = trade.type === 'Option' ? 100 : 1;
                    capital = (trade.entryPrice * trade.quantity * multiplier);
                }

                if (capital > 0) {
                    const returnPercent = (trade.pnl / capital) * 100;
                    const annualizedReturn = returnPercent * (365 / daysHeld);

                    console.log(`Trade ${tradeDoc.id}: P/L=$${trade.pnl}, Capital=$${capital}, Return=${returnPercent.toFixed(2)}%, Annualized=${annualizedReturn.toFixed(2)}%`);

                    // Update the trade in Firestore
                    await updateDoc(doc(db, 'users', userId, 'trades', tradeDoc.id), {
                        annualizedReturn
                    });

                    updated++;
                } else {
                    console.warn(`Trade ${tradeDoc.id}: Capital is 0, skipping`);
                    skipped++;
                }
            } catch (err) {
                console.error(`Error processing trade ${tradeDoc.id}:`, err);
                errors++;
            }
        }

        console.log(`\nBackfill complete!`);
        console.log(`- Updated: ${updated}`);
        console.log(`- Skipped: ${skipped}`);
        console.log(`- Errors: ${errors}`);

        return { updated, skipped, errors };
    } catch (err) {
        console.error('Backfill failed:', err);
        throw err;
    }
}
