import * as pdfParse from 'pdf-parse';
import { extractTransactions, detectStatementYear, type ExtractedTransaction } from '../utils/transactionExtractor';
import type { Expense } from '../types/expenseTypes';

/**
 * Parse PDF statement and extract transactions
 */
export async function parsePDFStatement(
    file: File,
    pastExpenses?: Expense[]
): Promise<ExtractedTransaction[]> {
    try {
        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Parse PDF
        const data = await pdfParse(buffer);
        const text = data.text;

        // Detect statement year
        const year = detectStatementYear(text);

        // Extract transactions with learning from past expenses
        const transactions = extractTransactions(text, year, pastExpenses);

        return transactions;
    } catch (error) {
        console.error('PDF parsing error:', error);
        throw new Error('Failed to parse PDF statement. Please ensure it\'s a valid credit card statement.');
    }
}

/**
 * Validate if file is a PDF
 */
export function validatePDFFile(file: File): boolean {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}
