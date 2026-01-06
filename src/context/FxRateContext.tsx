
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface FxRates {
    USD: number; // 1 CAD = x USD
    INR: number; // 1 CAD = x INR
    // We store rates relative to CAD (Base)
}

interface FxRateContextType {
    rates: FxRates | null;
    isLoading: boolean;
    error: string | null;
    convert: (amount: number, fromCurrency: string, toCurrency: string) => number;
    refreshRates: () => Promise<void>;
}

const FxRateContext = createContext<FxRateContextType | undefined>(undefined);

export const FxRateProvider = ({ children }: { children: ReactNode }) => {
    // We might need account info later for specific fetching policies, but for now just fetch.
    const [rates, setRates] = useState<FxRates | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchRates = async () => {
        // Only needed for personal account potentially, but useful generally if we allow currency switching.
        // User specifically mentioned "when ever we open personal account we need to call".
        // But if we put this provider at App level, it can react to account changes.

        setIsLoading(true);
        setError(null);
        try {
            // Fetch rates with CAD as base
            const response = await fetch('https://api.frankfurter.app/latest?from=CAD&to=USD,INR');
            if (!response.ok) {
                throw new Error('Failed to fetch exchange rates');
            }
            const data = await response.json();

            // data.rates will contain { USD: 0.74, INR: 60.5 } etc.
            setRates(data.rates);
        } catch (err) {
            console.error(err);
            setError('Failed to load exchange rates');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Fetch initially and when account changes to Personal (if not already fetched)
        // Or just fetch once on mount and maybe refresh occasionally.
        // Let's fetch on mount.
        fetchRates();
    }, []);

    const convert = (amount: number, fromCurrency: string, toCurrency: string): number => {
        if (fromCurrency === toCurrency) return amount;
        if (!rates) return amount; // Fallback

        // Normalize to CAD first
        let amountInCAD = amount;
        if (fromCurrency !== 'CAD') {
            // If 1 CAD = 60 INR, and we have 600 INR. 
            // 600 / 60 = 10 CAD.
            const rate = rates[fromCurrency as keyof FxRates];
            if (rate) {
                amountInCAD = amount / rate;
            }
        }

        // Convert from CAD to target
        if (toCurrency === 'CAD') return amountInCAD;

        const targetRate = rates[toCurrency as keyof FxRates];
        if (targetRate) {
            return amountInCAD * targetRate;
        }

        return amountInCAD;
    };

    return (
        <FxRateContext.Provider value={{ rates, isLoading, error, convert, refreshRates: fetchRates }}>
            {children}
        </FxRateContext.Provider>
    );
};

export const useFxRates = () => {
    const context = useContext(FxRateContext);
    if (context === undefined) {
        throw new Error('useFxRates must be used within a FxRateProvider');
    }
    return context;
};
