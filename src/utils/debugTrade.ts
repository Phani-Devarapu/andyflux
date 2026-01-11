/**
 * Debug script to check trade data and annualized return calculation
 */

import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { parseOptionSymbol } from './optionSymbolParser';
import type { Trade } from '../types/trade';

export async function debugFirstClosedTrade(userId: string) {
    try {
        console.log('=== DEBUG: Fetching first closed trade ===');

        const tradesRef = collection(db, 'users', userId, 'trades');
        const q = query(tradesRef, where('status', '==', 'Closed'), limit(1));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log('No closed trades found');
            return;
        }

        const tradeDoc = snapshot.docs[0];
        const trade = tradeDoc.data() as Trade;

        console.log('\n=== TRADE DATA ===');
        console.log('ID:', tradeDoc.id);
        console.log('Symbol:', trade.symbol);
        console.log('Type:', trade.type);
        console.log('Side:', trade.side);
        console.log('Entry Price:', trade.entryPrice);
        console.log('Exit Price:', trade.exitPrice);
        console.log('Quantity:', trade.quantity);
        console.log('Strike (field):', trade.strike);
        console.log('P/L:', trade.pnl);
        console.log('Entry Date:', trade.date);
        console.log('Exit Date:', trade.exitDate);
        console.log('Current annualizedReturn:', trade.annualizedReturn);

        // Calculate days held
        const exit = new Date(trade.exitDate!);
        const entry = new Date(trade.date);
        const daysHeld = Math.max(1, Math.ceil(Math.abs(exit.getTime() - entry.getTime()) / (1000 * 60 * 60 * 24)));
        console.log('\n=== CALCULATION ===');
        console.log('Days Held:', daysHeld);

        // Calculate capital
        let capital = 0;
        if (trade.type === 'Option' && trade.side === 'Sell') {
            console.log('Trade is a SOLD OPTION');
            if (trade.strike) {
                capital = trade.strike * trade.quantity * 100;
                console.log(`Using strike field: $${trade.strike} × ${trade.quantity} × 100 = $${capital}`);
            } else {
                const parsed = parseOptionSymbol(trade.symbol);
                console.log('Parsed symbol:', parsed);
                if (parsed.strike) {
                    capital = parsed.strike * trade.quantity * 100;
                    console.log(`Using parsed strike: $${parsed.strike} × ${trade.quantity} × 100 = $${capital}`);
                } else {
                    capital = trade.entryPrice * trade.quantity * 100;
                    console.log(`Fallback to entry price: $${trade.entryPrice} × ${trade.quantity} × 100 = $${capital}`);
                }
            }
        } else {
            const multiplier = trade.type === 'Option' ? 100 : 1;
            capital = trade.entryPrice * trade.quantity * multiplier;
            console.log(`Stock/Bought Option: $${trade.entryPrice} × ${trade.quantity} × ${multiplier} = $${capital}`);
        }

        console.log('\nCapital:', capital);
        console.log('P/L:', trade.pnl);

        if (capital > 0 && trade.pnl) {
            const returnPercent = (trade.pnl / capital) * 100;
            const annualizedReturn = returnPercent * (365 / daysHeld);

            console.log('\n=== RESULT ===');
            console.log(`Return %: (${trade.pnl} / ${capital}) × 100 = ${returnPercent.toFixed(2)}%`);
            console.log(`Annualized: ${returnPercent.toFixed(2)}% × (365 / ${daysHeld}) = ${annualizedReturn.toFixed(2)}%`);
            console.log(`\n✅ SHOULD BE: ${annualizedReturn.toFixed(2)}%`);
        } else {
            console.log('\n❌ ERROR: Capital is 0 or P/L is missing');
            console.log('Capital:', capital);
            console.log('P/L:', trade.pnl);
        }

    } catch (err) {
        console.error('Debug failed:', err);
    }
}
