export const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) {
        return '$0.00';
    }
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(value);
};

export const calculatePnL = (entry: number, exit: number, quantity: number, side: 'Buy' | 'Sell') => {
    if (side === 'Buy') {
        return (exit - entry) * quantity;
    }
    return (entry - exit) * quantity;
};

export const calculatePnLPercent = (entry: number, exit: number, side: 'Buy' | 'Sell') => {
    if (entry === 0) return 0;
    if (side === 'Buy') {
        return ((exit - entry) / entry) * 100;
    }
    return ((entry - exit) / entry) * 100;
};

export const calculateRiskReward = (entry: number, stopLoss: number, target: number, side: 'Buy' | 'Sell') => {
    if (side === 'Buy') {
        const risk = entry - stopLoss;
        const reward = target - entry;
        if (risk <= 0) return 0;
        return reward / risk;
    } else {
        const risk = stopLoss - entry;
        const reward = entry - target;
        if (risk <= 0) return 0;
        return reward / risk;
    }
};

import type { Trade } from '../types/trade';

// ... existing functions ...

export const calculateWinRate = (trades: Partial<Trade>[]) => {
    if (!trades || trades.length === 0) return 0;
    const wins = trades.filter(t => (t.pnl || 0) > 0).length;
    return Math.round((wins / trades.length) * 100);
};

export const calculateProfitFactor = (trades: Partial<Trade>[]) => {
    const grossProfit = trades.reduce((acc, t) => acc + ((t.pnl || 0) > 0 ? (t.pnl || 0) : 0), 0);
    const grossLoss = Math.abs(trades.reduce((acc, t) => acc + ((t.pnl || 0) < 0 ? (t.pnl || 0) : 0), 0));

    if (grossLoss === 0) return grossProfit > 0 ? 100 : 0;
    return Number((grossProfit / grossLoss).toFixed(2));
};

export const calculateMaxDrawdown = (trades: Partial<Trade>[]) => {
    if (!trades.length) return 0;
    let peak = 0;
    let maxDrawdown = 0;
    let runningPnL = 0;

    trades.forEach(t => {
        runningPnL += (t.pnl || 0);
        if (runningPnL > peak) peak = runningPnL;
        const drawdown = peak - runningPnL;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });

    return maxDrawdown;
};

export const calculateExpectancy = (trades: Partial<Trade>[]) => {
    if (!trades.length) return 0;
    const totalPnL = trades.reduce((acc, t) => acc + (t.pnl || 0), 0);
    return totalPnL / trades.length;
};
