import * as pdfjsLib from 'pdfjs-dist';
import { extractTransactions, detectStatementYear, type ExtractedTransaction } from '../utils/transactionExtractor';
import type { Expense } from '../types/expenseTypes';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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

        // Load PDF document
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        // Extract text from all pages
        let fullText = '';
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');
            fullText += pageText + '\n';
        }

        // Detect statement year
        const year = detectStatementYear(fullText);

        // Extract transactions with learning from past expenses
        const transactions = extractTransactions(fullText, year, pastExpenses);

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
