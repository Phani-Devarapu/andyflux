import type { Trade, TradeType, TradeSide } from '../types/trade';

export type BrokerName = 'wealthsimple' | 'questrade' | 'interactive-brokers' | 'generic';

export interface BrokerAdapter {
    name: BrokerName;
    detect: (headers: string[]) => boolean;
    parse: (row: Record<string, string>) => Partial<Trade> | null;
}

/**
 * Parse date string in various formats
 */
function parseDate(dateStr: string): Date {
    // Try ISO format first
    if (dateStr.includes('T') || dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
        return new Date(dateStr);
    }

    // Try MM/DD/YYYY or DD/MM/YYYY
    const parts = dateStr.split(new RegExp('[-/]'));
    if (parts.length === 3) {
        // Assume MM/DD/YYYY for Wealthsimple (US/Canadian format)
        const month = parseInt(parts[0], 10) - 1;
        const day = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
    }

    return new Date(dateStr);
}

/**
 * Parse price/amount string (removes $, commas, etc.)
 */
function parsePrice(priceStr: string | undefined): number {
    if (!priceStr) return 0;
    return parseFloat(priceStr.replace(/[$,]/g, ''));
}

/**
 * Parse quantity/shares string
 */
function parseQuantity(qtyStr: string | undefined): number {
    if (!qtyStr) return 0;
    return parseFloat(qtyStr.replace(/[,\s]/g, ''));
}

/**
 * Determine trade type from symbol or description
 */
function inferTradeType(symbol: string, description?: string): TradeType {
    const upperSymbol = symbol.toUpperCase();
    const desc = (description || '').toLowerCase();

    if (desc.includes('option') || upperSymbol.includes('CALL') || upperSymbol.includes('PUT')) {
        return 'Option';
    }
    if (desc.includes('etf') || upperSymbol.includes('ETF')) {
        return 'ETF';
    }
    if (desc.includes('future')) {
        return 'Future';
    }
    if (desc.includes('crypto') || desc.includes('bitcoin') || desc.includes('ethereum')) {
        return 'Crypto';
    }
    if (desc.includes('forex') || desc.includes('fx')) {
        return 'Forex';
    }

    return 'Stock';
}

/**
 * Check if symbol is an option (contains expiration date and strike)
 */
function isOptionSymbol(symbol: string): boolean {
    // Options typically have format like: SYMBOL  YYMMDDC/P######
    // Example: IONQ  260116C00075000 (IONQ, Jan 16 2026, Call, $75 strike)
    return /^\s*[A-Z]+\s+\d{6}[CP]\d+/.test(symbol.trim());
}

/**
 * Wealthsimple CSV Adapter
 * Wealthsimple CSV format:
 * transaction_date, settlement_date, account_type, activity_type, activity_sub_type,
 * direction, symbol, underlying symbol, name, currency, quantity, unit_price, commission, net_cash_amount
 */
export const wealthsimpleAdapter: BrokerAdapter = {
    name: 'wealthsimple',
    detect: (headers: string[]) => {
        const lowerHeaders = headers.map(h => h.toLowerCase().trim());
        return (
            (lowerHeaders.includes('transaction_date') || lowerHeaders.some(h => h.includes('transaction_date'))) &&
            lowerHeaders.includes('activity_sub_type') &&
            lowerHeaders.includes('quantity') &&
            lowerHeaders.includes('unit_price')
        );
    },
    parse: (row: Record<string, string>): Partial<Trade> | null => {
        // Wealthsimple uses exact column names, but handle case-insensitive
        const lowerRow: Record<string, string> = {};
        Object.keys(row).forEach(key => {
            lowerRow[key.toLowerCase().trim()] = row[key];
        });

        // Required fields
        const transactionDate = lowerRow['transaction_date'];
        if (!transactionDate) {
            throw new Error('Missing transaction_date');
        }

        // Check activity_type first - skip non-trade activities
        const activityType = lowerRow['activity_type']?.trim().toUpperCase();

        // Skip non-trade activities (OptionExpiry, dividends, fees, transfers, etc.)
        // Return null instead of throwing so these are silently skipped
        if (activityType && activityType !== 'TRADE') {
            return null; // Silently skip non-trade rows
        }

        // Now check activity_sub_type (BUY/SELL) - only for TRADE activities
        const activitySubType = lowerRow['activity_sub_type']?.trim().toUpperCase();
        if (!activitySubType || (activitySubType !== 'BUY' && activitySubType !== 'SELL')) {
            throw new Error(`Invalid activity_sub_type: ${activitySubType || 'empty'} (must be BUY or SELL)`);
        }
        const side: TradeSide = activitySubType === 'SELL' ? 'Sell' : 'Buy';

        // Get symbol - prefer underlying_symbol, fallback to symbol
        const underlyingSymbol = lowerRow['underlying symbol']?.trim();
        const fullSymbol = lowerRow['symbol']?.trim();
        const symbol = (underlyingSymbol || fullSymbol || '').toUpperCase();
        if (!symbol) {
            throw new Error('Missing symbol and underlying symbol');
        }

        // Get quantity (can be negative for sells, use absolute value)
        const quantityStr = lowerRow['quantity']?.trim();
        if (!quantityStr) {
            throw new Error('Missing quantity');
        }
        const quantity = Math.abs(parseQuantity(quantityStr));
        if (quantity === 0 || isNaN(quantity)) {
            throw new Error(`Invalid quantity: ${quantityStr}`);
        }

        // Get unit_price (price per share/contract)
        const unitPriceStr = lowerRow['unit_price']?.trim();
        if (!unitPriceStr) {
            throw new Error('Missing unit_price');
        }
        const entryPrice = parsePrice(unitPriceStr);
        if (isNaN(entryPrice) || entryPrice < 0) {
            throw new Error(`Invalid unit_price: ${unitPriceStr}`);
        }

        // Get commission (fees)
        const commissionStr = lowerRow['commission']?.trim();
        const fees = commissionStr ? parsePrice(commissionStr) : 0;

        // Get additional info for notes
        const name = lowerRow['name']?.trim();
        const currency = lowerRow['currency']?.trim();

        // Determine trade type
        // Check if it's an option by looking at the full symbol format
        const isOption = isOptionSymbol(fullSymbol || '');
        const tradeType: TradeType = isOption ? 'Option' : inferTradeType(symbol, name);

        // Build notes
        const notesParts = [];
        if (name) notesParts.push(name);
        if (fullSymbol && fullSymbol !== symbol) notesParts.push(`Full symbol: ${fullSymbol}`);
        if (currency && currency !== 'USD') notesParts.push(`Currency: ${currency}`);
        if (activityType && activityType !== 'TRADE') notesParts.push(`Activity: ${activityType}`);
        const notes = notesParts.length > 0
            ? `Imported from Wealthsimple - ${notesParts.join(', ')}`
            : 'Imported from Wealthsimple';

        const date = parseDate(transactionDate);
        const now = new Date();

        return {
            date,
            symbol,
            type: tradeType,
            side,
            entryPrice,
            quantity,
            fees,
            status: 'Closed', // Wealthsimple exports are completed trades
            notes,
            createdAt: now,
            updatedAt: now,
        };
    }
};

/**
 * Generic CSV Adapter - tries to auto-detect common column names
 */
export const genericAdapter: BrokerAdapter = {
    name: 'generic',
    detect: () => true, // Always available as fallback
    parse: (row: Record<string, string>): Partial<Trade> | null => {
        const lowerRow: Record<string, string> = {};
        Object.keys(row).forEach(key => {
            lowerRow[key.toLowerCase()] = row[key];
        });

        // Try to find common fields
        const dateKey = Object.keys(lowerRow).find(k => k.includes('date'));
        const symbolKey = Object.keys(lowerRow).find(k =>
            k.includes('symbol') || k.includes('ticker') || k.includes('stock')
        );
        const sideKey = Object.keys(lowerRow).find(k =>
            k.includes('side') || k.includes('type') || k.includes('action')
        );
        const qtyKey = Object.keys(lowerRow).find(k =>
            k.includes('quantity') || k.includes('qty') || k.includes('shares')
        );
        const priceKey = Object.keys(lowerRow).find(k =>
            k.includes('price') || k.includes('entry')
        );

        if (!dateKey || !symbolKey || !qtyKey) {
            return null;
        }

        const symbol = lowerRow[symbolKey]?.trim().toUpperCase();
        if (!symbol) return null;

        const sideStr = sideKey ? lowerRow[sideKey]?.toLowerCase() : '';
        const side: TradeSide = sideStr.includes('sell') || sideStr.includes('short') ? 'Sell' : 'Buy';
        const quantity = parseQuantity(lowerRow[qtyKey]);
        const entryPrice = priceKey ? parsePrice(lowerRow[priceKey]) : 0;

        if (quantity === 0) return null;

        const date = parseDate(lowerRow[dateKey]);
        const now = new Date();

        return {
            date,
            symbol,
            type: inferTradeType(symbol),
            side,
            entryPrice,
            quantity,
            status: 'Closed',
            notes: 'Imported from CSV',
            createdAt: now,
            updatedAt: now,
        };
    }
};

/**
 * Get all available broker adapters
 */
export const getBrokerAdapters = (): BrokerAdapter[] => {
    return [wealthsimpleAdapter, genericAdapter];
};

/**
 * Detect broker from CSV headers
 */
export const detectBroker = (headers: string[]): BrokerName => {
    const adapters = getBrokerAdapters();
    for (const adapter of adapters) {
        if (adapter.detect(headers)) {
            return adapter.name;
        }
    }
    return 'generic';
};

