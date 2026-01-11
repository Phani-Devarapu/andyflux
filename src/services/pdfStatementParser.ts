import * as pdfjsLib from 'pdfjs-dist';
import { extractTransactions, detectStatementYear, type ExtractedTransaction } from '../utils/transactionExtractor';
import type { Expense } from '../types/expenseTypes';

// Set worker source - use local worker for better reliability
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

/**
 * Parse PDF statement and extract transactions
 */
export async function parsePDFStatement(
    file: File,
    pastExpenses?: Expense[]
): Promise<ExtractedTransaction[]> {
    try {
        console.log('Starting PDF parse for file:', file.name, 'Size:', file.size);

        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        console.log('File read successfully, buffer size:', arrayBuffer.byteLength);

        // Load PDF document
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        console.log('PDF loaded successfully, pages:', pdf.numPages);

        // Extract text from all pages
        let fullText = '';
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');
            fullText += pageText + '\n';
            console.log(`Page ${pageNum} extracted, length:`, pageText.length);
        }

        console.log('Full text extracted, total length:', fullText.length);
        console.log('First 500 chars:', fullText.substring(0, 500));

        // Detect statement year
        const year = detectStatementYear(fullText);
        console.log('Detected year:', year);

        // Extract transactions with learning from past expenses
        const transactions = extractTransactions(fullText, year, pastExpenses);
        console.log('Extracted transactions:', transactions.length);

        if (transactions.length === 0) {
            console.warn('No transactions found. Text sample:', fullText.substring(0, 1000));
        }

        return transactions;
    } catch (error) {
        console.error('PDF parsing error details:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }
        throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Validate if file is a PDF
 */
export function validatePDFFile(file: File): boolean {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}
