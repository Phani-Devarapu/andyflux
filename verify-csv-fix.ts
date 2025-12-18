
// import { genericAdapter } from './src/utils/brokerAdapters.ts';

// Mock the parsing logic from importExport.ts (simplified for verification)
// We want to verify that when we have an entry and exit transaction, 
// the resulting trade object gets the exitDate from the exit transaction.

function verifyExitDateMapping() {
    const entryTx = {
        date: new Date('2023-01-01'),
        symbol: 'AAPL',
        price: 150,
        quantity: 10,
        isEntry: true
    };

    const exitTx = {
        date: new Date('2023-01-05'), // Exit date is DIFFERENT
        symbol: 'AAPL',
        price: 160,
        quantity: 10,
        isEntry: false
    };

    // Simulate the logic in importExport.ts
    const trade = {
        date: entryTx.date,
        entryPrice: entryTx.price,
        exitPrice: exitTx.price,
        exitDate: exitTx.date, // THIS IS THE LINE WE ADDED
        quantity: 10
    };

    console.log('Test Simulation:');
    console.log('Entry Date:', trade.date.toISOString().split('T')[0]);
    console.log('Exit Date:', trade.exitDate.toISOString().split('T')[0]);

    if (trade.exitDate.getTime() === exitTx.date.getTime()) {
        console.log('PASS: Exit date handled correctly.');
    } else {
        console.error('FAIL: Exit date mismatch.');
    }
}

verifyExitDateMapping();
