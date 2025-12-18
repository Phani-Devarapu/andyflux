// Test script to validate CSV parsing
// Run with: node test-csv-import.js <path-to-csv-file>

import fs from 'fs';
import Papa from 'papaparse';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple mock of the broker adapter for testing
function parseWealthsimpleRow(lowerRow) {
    const errors = [];
    
    // Required fields
    const transactionDate = lowerRow['transaction_date'];
    if (!transactionDate) {
        errors.push('Missing transaction_date');
        return { error: errors.join('; ') };
    }

    // Get activity_sub_type (BUY/SELL) - skip non-trade activities
    const activitySubType = lowerRow['activity_sub_type']?.trim().toUpperCase();
    const activityType = lowerRow['activity_type']?.trim().toUpperCase();
    
    // Skip non-trade activities
    if (activityType && activityType !== 'TRADE') {
        return { skipped: true, reason: `${activityType} (not a trade)` };
    }
    
    if (!activitySubType || (activitySubType !== 'BUY' && activitySubType !== 'SELL')) {
        errors.push(`Invalid activity_sub_type: ${activitySubType || 'empty'} (must be BUY or SELL)`);
        return { error: errors.join('; ') };
    }

    // Get symbol
    const underlyingSymbol = lowerRow['underlying symbol']?.trim();
    const fullSymbol = lowerRow['symbol']?.trim();
    const symbol = (underlyingSymbol || fullSymbol || '').toUpperCase();
    if (!symbol) {
        errors.push('Missing symbol and underlying symbol');
        return { error: errors.join('; ') };
    }

    // Get quantity
    const quantityStr = lowerRow['quantity']?.trim();
    if (!quantityStr) {
        errors.push('Missing quantity');
        return { error: errors.join('; ') };
    }
    const quantity = Math.abs(parseFloat(quantityStr.replace(/[,\s]/g, '')));
    if (quantity === 0 || isNaN(quantity)) {
        errors.push(`Invalid quantity: ${quantityStr}`);
        return { error: errors.join('; ') };
    }

    // Get unit_price
    const unitPriceStr = lowerRow['unit_price']?.trim();
    if (!unitPriceStr) {
        errors.push('Missing unit_price');
        return { error: errors.join('; ') };
    }
    const entryPrice = parseFloat(unitPriceStr.replace(/[$,]/g, ''));
    if (isNaN(entryPrice) || entryPrice < 0) {
        errors.push(`Invalid unit_price: ${unitPriceStr}`);
        return { error: errors.join('; ') };
    }

    return { success: true, symbol, side: activitySubType === 'SELL' ? 'Sell' : 'Buy', quantity, entryPrice };
}

// Main function
const csvPath = process.argv[2];

if (!csvPath) {
    console.log('Usage: node test-csv-import.js <path-to-csv-file>');
    process.exit(1);
}

if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
}

const csvContent = fs.readFileSync(csvPath, 'utf-8');

Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
        const rows = results.data;
        console.log(`\nTotal rows: ${rows.length}\n`);
        
        let successCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        const errors = [];

        rows.forEach((row, index) => {
            // Convert to lowercase keys
            const lowerRow = {};
            Object.keys(row).forEach(key => {
                lowerRow[key.toLowerCase().trim()] = row[key];
            });

            const result = parseWealthsimpleRow(lowerRow);
            
            if (result.success) {
                successCount++;
                console.log(`✓ Row ${index + 2}: ${result.side} ${result.quantity} ${result.symbol} @ $${result.entryPrice}`);
            } else if (result.skipped) {
                skippedCount++;
                console.log(`⊘ Row ${index + 2}: SKIPPED - ${result.reason}`);
            } else {
                errorCount++;
                console.log(`✗ Row ${index + 2}: ERROR - ${result.error}`);
                errors.push({ row: index + 2, error: result.error, data: row });
            }
        });

        console.log(`\n=== Summary ===`);
        console.log(`Success: ${successCount}`);
        console.log(`Skipped: ${skippedCount}`);
        console.log(`Errors: ${errorCount}`);
        
        if (errors.length > 0) {
            console.log(`\n=== Error Details ===`);
            errors.forEach(({ row, error, data }) => {
                console.log(`\nRow ${row}: ${error}`);
                console.log('  Sample data:', JSON.stringify(data, null, 2).substring(0, 200));
            });
        }
    },
    error: (error) => {
        console.error('CSV parsing error:', error.message);
    }
});

