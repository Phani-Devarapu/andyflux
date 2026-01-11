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

    // NBC transaction pattern - more flexible to handle PDF text extraction
    // Looking for patterns like:
    // 11 18 U852780076 11 19 LYFT *2 RIDES 11-17 VANCOUVER BC 18.00
    // or with pipes: 11 18 | U852780076 | 11 19 | LYFT *2 RIDES 11-17 VANCOUVER BC | 18.00

    // Split text into lines and process each line
    const lines = text.split('\n');

    for (const line of lines) {
        // Look for lines with transaction pattern:
        // Month Day (optional pipe) Reference (optional pipe) Month Day (optional pipe) Description Amount
        const pattern = /(\d{1,2})\s+(\d{1,2})\s+\|?\s*([A-Z0-9]{8,})\s+\|?\s*(\d{1,2})\s+(\d{1,2})\s+\|?\s*(.+?)\s+([\d,]+\.\d{2})\s*$/;
        const match = line.match(pattern);

        if (!match) continue;

        const [, , , reference, month, day, description, amountStr] = match;

        // Parse amount (remove commas)
        const amount = parseFloat(amountStr.replace(/,/g, ''));

        // Skip if amount is 0 or invalid
        if (isNaN(amount) || amount === 0) continue;

        // Parse date
        const monthNum = parseInt(month, 10);
        const dayNum = parseInt(day, 10);

        // Validate month and day
        if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) continue;

        // Infer year (if month is Dec and we're in Jan, use previous year)
        let year = statementYear;
        const now = new Date();
        if (monthNum === 12 && now.getMonth() === 0) {
            year = statementYear - 1;
        }

        const date = new Date(year, monthNum - 1, dayNum);

        // Extract location if present (last 2 uppercase letters before amount)
        const locationMatch = description.match(/\b([A-Z]{2})\s*$/);
        const location = locationMatch ? locationMatch[1] : undefined;

        // Clean description (remove location suffix and extra spaces)
        const cleanDescription = description
            .replace(/\s+[A-Z]{2}\s*$/, '')
            .replace(/\s+/g, ' ')
            .trim();

        // Skip if description is too short (likely not a real transaction)
        if (cleanDescription.length < 3) continue;

        // Infer category with learning from past expenses
        const category = inferCategory(cleanDescription, pastExpenses);

        // Calculate confidence
        const confidence = pastExpenses && pastExpenses.some(e =>
            e.description?.toUpperCase().includes(cleanDescription.split(' ')[0])
        ) ? 1.0 : 0.8;

        transactions.push({
            date,
            description: cleanDescription,
            amount,
            location,
            category,
            rawText: line.trim(),
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
