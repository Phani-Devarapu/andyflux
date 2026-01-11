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
        console.log('Starting PDF parse for file:', file.name, 'Size:', file.size);

        // Use FileReader to read the file as data URL
        const text = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const arrayBuffer = e.target?.result as ArrayBuffer;

                    // Import pdf.js dynamically
                    const pdfjsLib = await import('pdfjs-dist');

                    // Set worker
                    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
                        'pdfjs-dist/build/pdf.worker.min.mjs',
                        import.meta.url
                    ).toString();

                    // Load PDF
                    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                    const pdf = await loadingTask.promise;

                    console.log('PDF loaded, pages:', pdf.numPages);

                    // Extract text from all pages
                    let fullText = '';
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();

                        // Join text items with spaces, preserving line breaks
                        const pageText = textContent.items
                            .map((item: any) => {
                                // Add newline if this item is on a new line
                                return item.str;
                            })
                            .join(' ');

                        fullText += pageText + '\n';
                    }

                    console.log('Text extracted, length:', fullText.length);
                    console.log('Sample:', fullText.substring(0, 500));

                    resolve(fullText);
                } catch (err) {
                    reject(err);
                }
            };

            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });

        // Detect statement year
        const year = detectStatementYear(text);
        console.log('Detected year:', year);

        // Extract transactions with learning from past expenses
        const transactions = extractTransactions(text, year, pastExpenses);
        console.log('Extracted transactions:', transactions.length);

        if (transactions.length === 0) {
            console.warn('No transactions found. Full text:', text);
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
