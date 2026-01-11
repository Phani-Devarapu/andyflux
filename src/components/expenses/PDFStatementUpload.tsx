import { useState, useCallback } from 'react';
import { Box, Button, Typography, CircularProgress, Alert } from '@mui/material';
import { Upload, FileText } from 'lucide-react';
import { parsePDFStatement, validatePDFFile } from '../../services/pdfStatementParser';
import { TransactionReviewDialog } from './TransactionReviewDialog';
import type { ExtractedTransaction } from '../../utils/transactionExtractor';
import { useFirestoreExpenses } from '../../hooks/useFirestoreExpenses';
import { useAuth } from '../../context/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../utils/firebase';

export function PDFStatementUpload() {
    const { user } = useAuth();
    const { expenses } = useFirestoreExpenses();
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [extractedTransactions, setExtractedTransactions] = useState<ExtractedTransaction[]>([]);
    const [showReview, setShowReview] = useState(false);

    const handleFileSelect = useCallback(async (file: File) => {
        setError(null);

        // Validate file
        if (!validatePDFFile(file)) {
            setError('Please upload a valid PDF file');
            return;
        }

        setProcessing(true);

        try {
            // Parse PDF and extract transactions with learning from past expenses
            const transactions = await parsePDFStatement(file, expenses);

            if (transactions.length === 0) {
                setError('No transactions found in the statement. Please ensure it\'s a valid credit card statement.');
                setProcessing(false);
                return;
            }

            // Check for duplicates
            const duplicates = transactions.filter(t => {
                return expenses.some(e =>
                    e.accountId === 'PERSONAL' &&
                    Math.abs(e.amount - t.amount) < 0.01 &&
                    Math.abs(new Date(e.date).getTime() - t.date.getTime()) < 24 * 60 * 60 * 1000
                );
            });

            if (duplicates.length > 0) {
                console.warn(`Found ${duplicates.length} potential duplicates`);
            }

            setExtractedTransactions(transactions);
            setShowReview(true);
        } catch (err) {
            console.error('PDF processing error:', err);
            setError(err instanceof Error ? err.message : 'Failed to process PDF');
        } finally {
            setProcessing(false);
        }
    }, [expenses]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
    };

    const handleImport = async (transactions: ExtractedTransaction[]) => {
        if (!user) {
            console.error('No user logged in');
            throw new Error('You must be logged in to import transactions');
        }

        console.log(`Importing ${transactions.length} transactions...`);

        const expensesRef = collection(db, 'users', user.uid, 'expenses');

        // Import all selected transactions
        const promises = transactions.map(transaction => {
            const expenseData = {
                userId: user.uid,
                accountId: 'PERSONAL',
                date: transaction.date,
                category: transaction.category,
                amount: transaction.amount,
                description: transaction.description,
                currency: 'CAD',
                isRecurring: false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            console.log('Adding expense:', expenseData);
            return addDoc(expensesRef, expenseData);
        });

        await Promise.all(promises);

        console.log(`✓ Successfully imported ${transactions.length} transactions!`);

        // Show success message
        setError(null);
        setExtractedTransactions([]);
        setShowReview(false);
    };

    return (
        <>
            <Box
                sx={{
                    border: '2px dashed',
                    borderColor: 'divider',
                    borderRadius: 2,
                    p: 4,
                    textAlign: 'center',
                    cursor: processing ? 'wait' : 'pointer',
                    bgcolor: 'background.paper',
                    '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: 'action.hover',
                    },
                }}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => !processing && document.getElementById('pdf-upload-input')?.click()}
            >
                <input
                    id="pdf-upload-input"
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    disabled={processing}
                />

                {processing ? (
                    <>
                        <CircularProgress size={48} sx={{ mb: 2 }} />
                        <Typography variant="h6" gutterBottom>
                            Processing Statement...
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Extracting transactions from PDF
                        </Typography>
                    </>
                ) : (
                    <>
                        <FileText size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
                        <Typography variant="h6" gutterBottom>
                            Upload Credit Card Statement
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Drag & drop your PDF statement here, or click to browse
                        </Typography>
                        <Button
                            variant="outlined"
                            startIcon={<Upload size={20} />}
                            onClick={(e) => {
                                e.stopPropagation();
                                document.getElementById('pdf-upload-input')?.click();
                            }}
                        >
                            Choose PDF File
                        </Button>
                        <Typography variant="caption" display="block" sx={{ mt: 2 }} color="text.secondary">
                            Supported: NBC, TD, RBC, and other major banks
                        </Typography>
                    </>
                )}
            </Box>

            {error && (
                <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <TransactionReviewDialog
                open={showReview}
                transactions={extractedTransactions}
                onClose={() => {
                    setShowReview(false);
                    setExtractedTransactions([]);
                }}
                onImport={handleImport}
            />
        </>
    );
}
