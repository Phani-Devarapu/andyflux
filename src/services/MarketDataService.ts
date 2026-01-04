
interface YahooPriceResponse {
    chart: {
        result: Array<{
            meta: {
                currency: string;
                symbol: string;
                regularMarketPrice: number;
                previousClose: number;
                regularMarketTime: number;
            };
            timestamp: number[];
            indicators: {
                quote: Array<{
                    close: number[];
                    volume: number[];
                }>;
            };
        }>;
        error: unknown;
    };
}

export const MarketDataService = {
    async getQuote(symbol: string): Promise<{ price: number; previousClose: number } | null> {
        try {
            // Use the local proxy configured in vite.config.ts
            // /api/yahoo maps to https://query1.finance.yahoo.com
            const response = await fetch(`/api/yahoo/v8/finance/chart/${symbol}?interval=1d&range=1d`);

            if (!response.ok) {
                console.error(`Market Data Error: ${response.statusText}`);
                return null;
            }

            const data: YahooPriceResponse = await response.json();
            const result = data.chart.result?.[0];

            if (result && result.meta) {
                return {
                    price: result.meta.regularMarketPrice,
                    previousClose: result.meta.previousClose
                };
            }
            return null;
        } catch (error) {
            console.error('Failed to fetch market data:', error);
            return null;
        }
    }
};
