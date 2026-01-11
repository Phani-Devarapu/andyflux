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
 * Uses global regex matching since PDF text extraction doesn't preserve line breaks
 */
export function extractNBCTransactions(
    text: string,
    statementYear: number,
    pastExpenses?: Expense[]
): ExtractedTransaction[] {
    const transactions: ExtractedTransaction[] = [];

    console.log('=== NBC TRANSACTION EXTRACTION ===');
    console.log('Input text length:', text.length);

    // NBC transaction pattern - global search across entire text
    // Pattern matches: 11 18 U852780076 11 19 LYFT *2 RIDES 11-17 VANCOUVER BC 18.00
    // Capture groups: (trans month) (trans day) (reference) (post month) (post day) (description) (amount)
    const nbcPattern = /(\d{1,2})\s+(\d{1,2})\s+([A-Z]\d{9,10})\s+(\d{1,2})\s+(\d{1,2})\s+(.+?)\s+([\d,]+\.\d{2})(?=\s|$)/g;

    let match;
    let matchCount = 0;

    while ((match = nbcPattern.exec(text)) !== null) {
        matchCount++;

        const [fullMatch, , , , month, day, description, amountStr] = match;

        console.log(`Match ${matchCount}:`, fullMatch.substring(0, 80));

        // Parse amount (remove commas)
        const amount = parseFloat(amountStr.replace(/,/g, ''));

        // Skip if amount is 0 or invalid
        if (isNaN(amount) || amount === 0) {
            console.log('  ↳ Skipping - invalid amount:', amountStr);
            continue;
        }

        // Parse date
        const monthNum = parseInt(month, 10);
        const dayNum = parseInt(day, 10);

        // Validate month and day
        if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
            console.log('  ↳ Skipping - invalid date:', month, day);
            continue;
        }

        // Infer year
        let year = statementYear;
        const now = new Date();
        if (monthNum === 12 && now.getMonth() === 0) {
            year = statementYear - 1;
        }

        const date = new Date(year, monthNum - 1, dayNum);

        // Clean description
        // Remove trailing province codes (BC, ON, QC, etc.)
        const provinceMatch = description.match(/\s+([A-Z]{2})\s*$/);
        const location = provinceMatch ? provinceMatch[1] : undefined;

        let cleanDescription = description
            .replace(/\s+[A-Z]{2}\s*$/, '') // Remove province code
            .replace(/\s+/g, ' ') // Normalize spaces
            .trim();

        // Skip if description is too short or contains header text
        if (cleanDescription.length < 3 ||
            cleanDescription.includes('DESCRIPTION') ||
            cleanDescription.includes('TRANSACTION')) {
            console.log('  ↳ Skipping - invalid description:', cleanDescription.substring(0, 30));
            continue;
        }

        // Infer category
        const category = inferCategory(cleanDescription, pastExpenses);

        // Calculate confidence
        const confidence = pastExpenses && pastExpenses.some(e =>
            e.description?.toUpperCase().includes(cleanDescription.split(' ')[0])
        ) ? 1.0 : 0.8;

        console.log(`  ✓ Transaction ${transactions.length + 1}:`, {
            date: date.toISOString().split('T')[0],
            description: cleanDescription.substring(0, 30),
            amount,
            category
        });

        transactions.push({
            date,
            description: cleanDescription,
            amount,
            location,
            category,
            rawText: fullMatch.trim(),
            confidence,
        });
    }

    console.log(`=== EXTRACTION COMPLETE ===`);
    console.log(`Patterns matched: ${matchCount}`);
    console.log(`Valid transactions: ${transactions.length}`);

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
 * Looks for statement date patterns and falls back to most recent transaction year
 */
export function detectStatementYear(text: string): number {
    console.log('Detecting statement year...');

    // Pattern 1: Look for "STATEMENT DATE" or "DATE DU RELEVÉ" followed by date
    // Example: "STATEMENT DATE 2024-11-30" or "DATE DU RELEVÉ 30 11 2024"
    const statementDatePatterns = [
        /STATEMENT\s+DATE.*?(\d{4})/i,
        /DATE\s+DU\s+RELEV[ÉE].*?(\d{4})/i,
        /(\d{4})-(\d{2})-(\d{2})/,  // ISO date format
    ];

    for (const pattern of statementDatePatterns) {
        const match = text.match(pattern);
        if (match) {
            const year = parseInt(match[1], 10);
            if (year >= 2020 && year <= 2030) {
                console.log('Found statement year from pattern:', year);
                return year;
            }
        }
    }

    // Pattern 2: Find all 4-digit years and use the most recent one that makes sense
    const allYears = text.match(/\b20\d{2}\b/g);
    if (allYears && allYears.length > 0) {
        const years = allYears
            .map(y => parseInt(y, 10))
            .filter(y => y >= 2020 && y <= 2030);

        if (years.length > 0) {
            // Use the most common year (likely the statement year)
            const yearCounts = years.reduce((acc, year) => {
                acc[year] = (acc[year] || 0) + 1;
                return acc;
            }, {} as Record<number, number>);

            const mostCommonYear = parseInt(
                Object.entries(yearCounts)
                    .sort(([, a], [, b]) => b - a)[0][0],
                10
            );

            console.log('Most common year in statement:', mostCommonYear);
            return mostCommonYear;
        }
    }

    // Default to current year
    const currentYear = new Date().getFullYear();
    console.log('No year found, defaulting to current year:', currentYear);
    return currentYear;
}
