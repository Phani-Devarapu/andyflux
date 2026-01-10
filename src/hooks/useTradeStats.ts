import { useState, useEffect } from 'react';
import {
    collection,
    query,
    where,
    getCountFromServer,
    getAggregateFromServer,
    sum,
} from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useAuth } from '../context/AuthContext';
import { useAccount } from '../context/AccountContext';

export interface TradeStats {
    totalTrades: number;
    totalPnL: number;
    winRate: number;
    avgReturn: number;
    profitFactor: number;
    bestTrade: number;
    worstTrade: number;
    avgWin: number;
    avgLoss: number;
    wins: number;
    losses: number;
}

export function useTradeStats() {
    const { user } = useAuth();
    const { selectedAccount } = useAccount();
    const [stats, setStats] = useState<TradeStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        async function fetchStats() {
            if (!user || !selectedAccount) return;
            setLoading(true);
            try {
                const tradesRef = collection(db, 'users', user.uid, 'trades');
                const q = query(tradesRef, where('accountId', '==', selectedAccount));

                // 1. Get Count
                const countSnapshot = await getCountFromServer(q);
                const totalTrades = countSnapshot.data().count;

                if (totalTrades === 0) {
                    setStats({
                        totalTrades: 0,
                        totalPnL: 0,
                        winRate: 0,
                        avgReturn: 0,
                        profitFactor: 0,
                        bestTrade: 0,
                        worstTrade: 0,
                        avgWin: 0,
                        avgLoss: 0,
                        wins: 0,
                        losses: 0
                    });
                    setLoading(false);
                    return;
                }

                // 2. Get Aggregations (Sum PnL)
                // Firestore 'sum' aggregation is available.
                const aggSnapshot = await getAggregateFromServer(q, {
                    totalPnL: sum('pnl'),
                    // We can't easily get 'winRate' via standard aggregation without filtering.
                    // But we can filter for wins!
                });

                const totalPnL = aggSnapshot.data().totalPnL || 0;

                // 3. Get Wins Count for Win Rate
                const winsQuery = query(tradesRef, where('accountId', '==', selectedAccount), where('pnl', '>', 0));
                const winsSnapshot = await getCountFromServer(winsQuery);
                const wins = winsSnapshot.data().count;
                const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
                const losses = totalTrades - wins;

                // 4. Get Losses Sum for Profit Factor
                const winSumSnapshot = await getAggregateFromServer(winsQuery, {
                    grossProfit: sum('pnl')
                });
                const grossProfit = winSumSnapshot.data().grossProfit || 0;
                const grossLoss = Math.abs(totalPnL - grossProfit); // Derived

                const profitFactor = grossLoss === 0 ? grossProfit : (grossProfit / grossLoss);

                const avgWin = wins > 0 ? grossProfit / wins : 0;
                const avgLoss = losses > 0 ? -grossLoss / losses : 0;

                setStats({
                    totalTrades,
                    totalPnL,
                    winRate,
                    avgReturn: totalTrades > 0 ? totalPnL / totalTrades : 0,
                    profitFactor,
                    bestTrade: 0,
                    worstTrade: 0,
                    avgWin,
                    avgLoss,
                    wins,
                    losses
                });

            } catch (err) {
                console.error("Error fetching trade stats:", err);
                setError(err as Error);
            } finally {
                setLoading(false);
            }
        }

        fetchStats();
    }, [user, selectedAccount]);

    return { stats, loading, error };
}
