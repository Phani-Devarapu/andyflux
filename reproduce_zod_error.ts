import { z } from 'zod';

const numberFromAny = z.union([z.number(), z.nan(), z.string(), z.null(), z.undefined()])
    .transform((val) => {
        if (val === '' || val === null || val === undefined) return undefined;
        const parsed = Number(val);
        return isNaN(parsed) ? undefined : parsed;
    });

const schema = z.object({
    exitPrice: numberFromAny.pipe(z.number().min(0, 'Price cannot be negative').optional()),
});

console.log("Testing with NaN:");
try {
    const result = schema.parse({ exitPrice: NaN });
    console.log("Success:", result);
} catch (e) {
    console.error("Error:", JSON.stringify(e, null, 2));
}

console.log("\nTesting with '':");
try {
    const result = schema.parse({ exitPrice: '' });
    console.log("Success:", result);
} catch (e) {
    console.error("Error:", JSON.stringify(e, null, 2));
}

console.log("\nTesting with 'abc':");
try {
    const result = schema.parse({ exitPrice: 'abc' });
    console.log("Success:", result);
} catch (e: unknown) {
    // Expected to fail if coerced to NaN
    console.log("Result for 'abc' parsed to:", Number('abc'));
    console.error("Error:", JSON.stringify(e, null, 2));
}
