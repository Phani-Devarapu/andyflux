
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importFromJson, importFromCsv, exportToCsv, exportToJson } from '../utils/importExport';

// Mock Firebase modules
const { mockBatchSet, mockBatchCommit, mockWriteBatch, mockDoc, mockCollection, mockDb } = vi.hoisted(() => ({
    mockBatchSet: vi.fn(),
    mockBatchCommit: vi.fn(),
    mockWriteBatch: vi.fn(() => ({
        set: vi.fn(), // We'll set this to mockBatchSet in a moment
        commit: vi.fn(),
    })),
    mockDoc: vi.fn(() => 'mockDocRef'),
    mockCollection: vi.fn(() => 'mockCollectionRef'),
    mockDb: {},
}));

// Setup internal mock implementation
mockWriteBatch.mockImplementation(() => ({
    set: mockBatchSet,
    commit: mockBatchCommit,
}));

vi.mock('firebase/firestore', () => ({
    getFirestore: vi.fn(),
    writeBatch: mockWriteBatch,
    doc: mockDoc,
    collection: mockCollection,
}));

vi.mock('../utils/firebase', () => ({
    db: mockDb
}));

// Mock Papaparse
const { mockParse, mockUnparse } = vi.hoisted(() => ({
    mockParse: vi.fn(),
    mockUnparse: vi.fn(),
}));

vi.mock('papaparse', () => {
    return {
        default: {
            parse: (...args: any[]) => mockParse(...args),
            unparse: (...args: any[]) => mockUnparse(...args)
        },
        // Also mock named exports if they are used as such
        parse: (...args: any[]) => mockParse(...args),
        unparse: (...args: any[]) => mockUnparse(...args)
    };
});

// Mock URL for export tests
global.URL.createObjectURL = vi.fn(() => 'mock-url');
global.Blob = class MockBlob {
    content: any[];
    options: any;
    constructor(content: any[], options: any) {
        this.content = content;
        this.options = options;
    }
} as any;

describe('importExportUtils', () => {
    const userId = 'test-user-id';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('importFromJson', () => {
        it('should correctly parse JSON and batch write to Firestore', async () => {
            const mockFile = new File([JSON.stringify([
                {
                    id: '1',
                    date: '2023-01-01T10:00:00.000Z',
                    symbol: 'AAPL',
                    side: 'Buy',
                    quantity: 10,
                    entryPrice: 150,
                    status: 'Open',
                    createdAt: '2023-01-01T10:00:00.000Z',
                    updatedAt: '2023-01-01T10:00:00.000Z'
                }
            ])], 'test.json', { type: 'application/json' });

            await importFromJson(mockFile, userId);

            expect(mockWriteBatch).toHaveBeenCalledWith(mockDb);
            expect(mockCollection).toHaveBeenCalledWith(mockDb, 'users', userId, 'trades');
            expect(mockDoc).toHaveBeenCalled();
            expect(mockBatchSet).toHaveBeenCalledTimes(1);
            expect(mockBatchCommit).toHaveBeenCalledTimes(1);

            const storedTrade = mockBatchSet.mock.calls[0][1];
            expect(storedTrade).toMatchObject({
                userId,
                symbol: 'AAPL',
                quantity: 10,
                status: 'Open'
            });
        });

        it('should reject invalid JSON format', async () => {
            const mockFile = new File(['invalid-json'], 'test.json', { type: 'application/json' });
            await expect(importFromJson(mockFile, userId)).rejects.toBeDefined();
        });
    });

    describe('importFromCsv', () => {
        it('should correctly parse Generic CSV and match simple entry/exit', async () => {
            // Mock Papa.parse implementation for this test
            mockParse.mockImplementation((_file, config) => {
                const rows = [
                    // Using header-transformed keys (lowercase) as they appear in the data array passed to 'complete'
                    // The adapter logic does another pass of lowercasing, but let's provide clean data
                    { 'date': '2023-01-01', 'symbol': 'AAPL', 'side': 'Buy', 'price': '150', 'shares': '10' },
                    { 'date': '2023-01-05', 'symbol': 'AAPL', 'side': 'Sell', 'price': '160', 'shares': '10' }
                ];
                if (config && config.complete) config.complete({ data: rows });
                return {} as any;
            });

            const mockFile = new File([''], 'test.csv', { type: 'text/csv' });
            const result = await importFromCsv(mockFile, 'generic', 'TFSA', userId);

            expect(result.success).toBe(1); // 1 matched trade (Buy + Sell = 1 Closed Trade)
            expect(result.failed).toBe(0);
            expect(mockWriteBatch).toHaveBeenCalled();

            const storedTrade = mockBatchSet.mock.calls[0][1];
            expect(storedTrade).toMatchObject({
                symbol: 'AAPL',
                quantity: 10,
                entryPrice: 150,
                exitPrice: 160,
                status: 'Closed'
            });
        });

        it('should correctly parse Wealthsimple CSV', async () => {
            mockParse.mockImplementation((_file, config) => {
                const rows = [
                    {
                        'transaction_date': '2023-01-01',
                        'activity_type': 'TRADE',
                        'activity_sub_type': 'BUY',
                        'symbol': 'WS',
                        'quantity': '5',
                        'unit_price': '50.00',
                        'currency': 'USD'
                    },
                    {
                        'transaction_date': '2023-01-10',
                        'activity_type': 'TRADE',
                        'activity_sub_type': 'SELL',
                        'symbol': 'WS',
                        'quantity': '5',
                        'unit_price': '60.00',
                        'currency': 'USD'
                    }
                ];
                if (config && config.complete) config.complete({ data: rows });
                return {} as any;
            });

            const mockFile = new File([''], 'ws.csv', { type: 'text/csv' });
            const result = await importFromCsv(mockFile, 'wealthsimple', 'TFSA', userId);

            expect(result.success).toBe(1);
            expect(result.failed).toBe(0);

            const storedTrade = mockBatchSet.mock.calls[0][1];
            expect(storedTrade).toMatchObject({
                symbol: 'WS',
                quantity: 5,
                entryPrice: 50,
                exitPrice: 60,
                status: 'Closed'
            });
        });

        it('should handle unmatched trades (Open positions)', async () => {
            mockParse.mockImplementation((_file, config) => {
                const rows = [
                    { 'date': '2023-02-01', 'symbol': 'GOOG', 'side': 'Buy', 'price': '100', 'shares': '20' }
                ];
                if (config && config.complete) config.complete({ data: rows });
                return {} as any;
            });

            const mockFile = new File([''], 'open.csv', { type: 'text/csv' });
            const result = await importFromCsv(mockFile, 'generic', 'TFSA', userId);

            expect(result.success).toBe(1);
            const storedTrade = mockBatchSet.mock.calls[0][1];
            expect(storedTrade.status).toBe('Open');
            expect(storedTrade.quantity).toBe(20);
        });
        it('should handle CSV with error callback', async () => {
            mockParse.mockImplementation((_file, config) => {
                if (config && config.error) config.error(new Error('CSV Parse Error'));
                return {} as any;
            });

            const mockFile = new File([''], 'error.csv', { type: 'text/csv' });
            await expect(importFromCsv(mockFile, 'generic', 'TFSA', userId)).rejects.toThrow('CSV Parse Error');
        });
    });

    describe('exportToCsv', () => {
        it('should export trades to CSV', () => {
            // Mock URL.createObjectURL and document.createElement
            const mockClick = vi.fn();
            const mockLink = {
                href: '',
                setAttribute: vi.fn(),
                click: mockClick,
                style: {}
            };

            // Mock document methods
            const originalCreateElement = document.createElement;
            const originalAppendChild = document.body.appendChild;
            const originalRemoveChild = document.body.removeChild;

            document.createElement = vi.fn(() => mockLink) as any;
            document.body.appendChild = vi.fn();
            document.body.removeChild = vi.fn();

            const trades = [{
                id: '1',
                date: new Date('2023-01-01'),
                symbol: 'AAPL',
                side: 'Buy',
                quantity: 10,
                entryPrice: 100,
                status: 'Open',
                createdAt: new Date(),
                updatedAt: new Date(),
                type: 'Stock'
            }] as any;

            // Mock Papa.unparse
            mockUnparse.mockReturnValue('csv-content');

            exportToCsv(trades, 'test.csv');

            expect(mockUnparse).toHaveBeenCalled();
            expect(document.createElement).toHaveBeenCalledWith('a');
            expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'test.csv');
            expect(document.body.appendChild).toHaveBeenCalled();
            expect(mockClick).toHaveBeenCalled();
            expect(document.body.removeChild).toHaveBeenCalled();

            // Restore
            document.createElement = originalCreateElement;
            document.body.appendChild = originalAppendChild;
            document.body.removeChild = originalRemoveChild;
        });
    });

    describe('exportToJson', () => {
        it('should export trades to JSON', () => {
            const mockClick = vi.fn();
            const mockLink = {
                href: '',
                setAttribute: vi.fn(),
                click: mockClick
            };

            const originalCreateElement = document.createElement;
            const originalAppendChild = document.body.appendChild;
            const originalRemoveChild = document.body.removeChild;

            document.createElement = vi.fn(() => mockLink) as any;
            document.body.appendChild = vi.fn();
            document.body.removeChild = vi.fn();

            const trades = [{ symbol: 'AAPL' }] as any;

            exportToJson(trades, 'test.json');

            expect(global.URL.createObjectURL).toHaveBeenCalled();
            expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'test.json');
            expect(mockClick).toHaveBeenCalled();

            document.createElement = originalCreateElement;
            document.body.appendChild = originalAppendChild;
            document.body.removeChild = originalRemoveChild;
        });
    });
});
