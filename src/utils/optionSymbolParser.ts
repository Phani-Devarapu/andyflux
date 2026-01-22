/**
 * Parse option symbol and return formatted display string
 * Format: SYMBOL YYMMDDC/P######
 * Example: "SOFI  251107C00042000" -> "SOFI $42 CALL"
 * Also handles display format: "SOFI $42 CALL" -> underlying: "SOFI"
 */
export function parseOptionSymbol(symbol: string): {
    display: string;
    underlying: string;
    strike?: number;
    optionType?: 'CALL' | 'PUT';
    expiration?: string;
} {
    if (!symbol) {
        return { display: symbol, underlying: symbol };
    }

    const trimmed = symbol.trim();

    // Check if it's already in display format (e.g., "SOFI $32 CALL")
    // Pattern: TICKER $STRIKE CALL/PUT
    const displayPattern = /^([A-Z]+)\s+\$(\d+(?:\.\d+)?)\s+(CALL|PUT)$/i;
    const displayMatch = trimmed.match(displayPattern);

    if (displayMatch) {
        const [, underlying, strikeStr, optionType] = displayMatch;
        return {
            display: trimmed,
            underlying: underlying,
            strike: parseFloat(strikeStr),
            optionType: optionType.toUpperCase() as 'CALL' | 'PUT'
        };
    }

    // Check if it looks like an option symbol (has date pattern and C/P)
    // Pattern: SYMBOL YYMMDDC/P###### (with variable spacing)
    // Example: "SOFI  260116C00040000" or "RGTI 251107C00042000"
    const optionPattern = /^([A-Z]+)\s+(\d{6})([CP])(\d+)$/;
    const match = trimmed.match(optionPattern);

    // Also try pattern without space: SYMBOLYYMMDDC/P######
    if (!match) {
        const noSpacePattern = /^([A-Z]+)(\d{6})([CP])(\d+)$/;
        const noSpaceMatch = trimmed.match(noSpacePattern);
        if (noSpaceMatch) {
            const [, underlying, dateStr, callPut, strikeStr] = noSpaceMatch;
            return parseOptionDetails(underlying, dateStr, callPut, strikeStr);
        }
    }

    if (!match) {
        // Not an option symbol, return as-is
        return { display: symbol, underlying: symbol };
    }

    if (match) {
        const [, underlying, dateStr, callPut, strikeStr] = match;
        return parseOptionDetails(underlying, dateStr, callPut, strikeStr);
    }

    // Not an option symbol, return as-is
    return { display: symbol, underlying: symbol };
}

function parseOptionDetails(underlying: string, dateStr: string, callPut: string, strikeStr: string) {
    // Parse strike price
    // Wealthsimple format examples:
    // "00040000" = $40.00 (8 digits, divide by 1000)
    // "00200000" = $200.00 (8 digits, divide by 1000)
    // "00042000" = $42.00 (8 digits, divide by 1000)
    let strike: number;
    const strikeNum = parseInt(strikeStr, 10);

    // Common Wealthsimple format: 8 digits = strike * 1000
    // So 00040000 = 40.00, 00110000 = 110.00, 00200000 = 200.00
    if (strikeStr.length === 8) {
        strike = strikeNum / 1000;
    } else if (strikeStr.length === 5) {
        // 5 digits: might be strike * 100 (e.g., 00420 = 42.00)
        strike = strikeNum / 100;
    } else {
        // For other lengths, try dividing by 1000 first, then 100
        strike = strikeNum / 1000;
        if (strike < 0.01) {
            strike = strikeNum / 100;
        }
        if (strike < 0.01) {
            strike = strikeNum;
        }
    }

    // Round to 2 decimal places
    strike = Math.round(strike * 100) / 100;

    // Parse expiration date (YYMMDD)
    const year = 2000 + parseInt(dateStr.substring(0, 2), 10);
    const month = parseInt(dateStr.substring(2, 4), 10);
    const day = parseInt(dateStr.substring(4, 6), 10);
    const expiration = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const optionType: 'CALL' | 'PUT' = callPut === 'C' ? 'CALL' : 'PUT';
    const display = `${underlying} $${strike} ${optionType}`;

    return {
        display,
        underlying,
        strike,
        optionType,
        expiration
    };
}

/**
 * Format symbol for display - parses options, returns formatted string
 */
export function formatSymbolForDisplay(symbol: string, tradeType?: string): string {
    if (tradeType === 'Option') {
        const parsed = parseOptionSymbol(symbol);
        return parsed.display;
    }
    if (tradeType === 'Spread') {
        return symbol; // Spreads are already formatted in TradeForm
    }
    return symbol;
}

