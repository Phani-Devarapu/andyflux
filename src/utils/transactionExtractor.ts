import { inferCategory } from './merchantCategories';
import type { Expense } from '../types/expenseTypes';

export interface ExtractedTransaction {
    date: Date;
    description: string;
    amount: number;
    location?: string;
    category: string;
    rawText: string;
    confidence?: number; // How confident we are in the category (0-1)
}

/**
 * Extract transactions from NBC credit card statement text
 */
export function extractNBCTransactions(
    text: string,
    statementYear: number,
    pastExpenses?: Expense[]
): ExtractedTransaction[] {
    const transactions: ExtractedTransaction[] = [];

    // NBC transaction pattern:
    // 11 18 | U852780076 | 11 19 | LYFT *2 RIDES 11-17 VANCOUVER BC | 18.00
    // Groups: month1 day1 | reference | month2 day2 | description | amount
    const nbcPattern = /(\d{2})\s+(\d{2})\s+\|\s+[A-Z0-9]+\s+\|\s+(\d{2})\s+(\d{2})\s+\|\s+(.+?)\s+\|\s+([\d,]+\.\d{2})/g;

    let match;
    while ((match = nbcPattern.exec(text)) !== null) {
        const [fullMatch, , , month, day, description, amountStr] = match;

        // Parse amount (remove commas)
        const amount = parseFloat(amountStr.replace(/,/g, ''));

        // Skip if amount is 0 or invalid
        if (isNaN(amount) || amount === 0) continue;

        // Parse date
        const monthNum = parseInt(month, 10);
        const dayNum = parseInt(day, 10);

        // Infer year (if month is Dec and we're in Jan, use previous year)
        let year = statementYear;
        const now = new Date();
        if (monthNum === 12 && now.getMonth() === 0) {
            year = statementYear - 1;
        }

        const date = new Date(year, monthNum - 1, dayNum);

        // Extract location if present (last 2 uppercase letters)
        const locationMatch = description.match(/\b([A-Z]{2})\s*$/);
        const location = locationMatch ? locationMatch[1] : undefined;

        // Clean description (remove location suffix)
        const cleanDescription = description.replace(/\s+[A-Z]{2}\s*$/, '').trim();

        // Infer category with learning from past expenses
        const category = inferCategory(cleanDescription, pastExpenses);

        // Calculate confidence (1.0 if learned from history, 0.8 if from database, 0.5 if pattern-based)
        const confidence = pastExpenses && pastExpenses.some(e =>
            e.description?.toUpperCase().includes(cleanDescription.split(' ')[0])
        ) ? 1.0 : 0.8;

        transactions.push({
            date,
            description: cleanDescription,
            amount,
            location,
            category,
            rawText: fullMatch,
            confidence,
        });
    }

    return transactions;
}

/**
 * Extract transactions from generic statement text
 * Tries multiple patterns
 */
export function extractTransactions(
    text: string,
    statementYear?: number,
    pastExpenses?: Expense[]
): ExtractedTransaction[] {
    const year = statementYear || new Date().getFullYear();

    // Try NBC format first
    const nbcTransactions = extractNBCTransactions(text, year, pastExpenses);
    if (nbcTransactions.length > 0) {
        return nbcTransactions;
    }

    // TODO: Add more bank formats here
    // - TD format
    // - RBC format
    // - CIBC format

    return [];
}

/**
 * Detect statement year from text
 */
export function detectStatementYear(text: string): number {
    // Look for year in statement date
    const yearMatch = text.match(/20\d{2}/);
    if (yearMatch) {
        return parseInt(yearMatch[0], 10);
    }

    // Default to current year
    return new Date().getFullYear();
}
