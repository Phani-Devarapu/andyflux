/**
 * Enhanced Merchant to Category Mapping
 * Auto-categorize expenses based on merchant names with learning capabilities
 */

import type { Expense } from '../types/expenseTypes';

export const MERCHANT_CATEGORIES: Record<string, string> = {
    // Transportation
    'LYFT': 'Transportation',
    'UBER': 'Transportation',
    'PRESTO': 'Transportation',
    'TRANSIT': 'Transportation',
    'PARKING': 'Transportation',
    'GAS': 'Transportation',
    'ESSO': 'Transportation',
    'SHELL': 'Transportation',
    'PETRO': 'Transportation',
    'CHEVRON': 'Transportation',
    'MOBIL': 'Transportation',
    'TAXI': 'Transportation',
    'CAB': 'Transportation',

    // Groceries
    'WALMART': 'Groceries',
    'LOBLAWS': 'Groceries',
    'SOBEYS': 'Groceries',
    'METRO': 'Groceries',
    'COSTCO': 'Groceries',
    'NO FRILLS': 'Groceries',
    'FRESHCO': 'Groceries',
    'FOOD BASICS': 'Groceries',
    'SUPERSTORE': 'Groceries',
    'SAFEWAY': 'Groceries',
    'WHOLE FOODS': 'Groceries',
    'TRADER JOE': 'Groceries',
    'FARM BOY': 'Groceries',

    // Dining Out
    'RESTAURANT': 'Dining Out',
    'MCDONALD': 'Dining Out',
    'TIM HORTONS': 'Dining Out',
    'STARBUCKS': 'Dining Out',
    'SUBWAY': 'Dining Out',
    'PIZZA': 'Dining Out',
    'BURGER': 'Dining Out',
    'CAFE': 'Dining Out',
    'COFFEE': 'Dining Out',
    'BISTRO': 'Dining Out',
    'GRILL': 'Dining Out',
    'SUSHI': 'Dining Out',
    'THAI': 'Dining Out',
    'CHINESE': 'Dining Out',
    'INDIAN': 'Dining Out',
    'ITALIAN': 'Dining Out',
    'WENDY': 'Dining Out',
    'A&W': 'Dining Out',
    'HARVEY': 'Dining Out',
    'CHIPOTLE': 'Dining Out',

    // Utilities & Bills
    'VIRGIN PLUS': 'Utilities',
    'ROGERS': 'Utilities',
    'BELL': 'Utilities',
    'TELUS': 'Utilities',
    'FIDO': 'Utilities',
    'FREEDOM': 'Utilities',
    'HYDRO': 'Utilities',
    'ENBRIDGE': 'Utilities',
    'TORONTO HYDRO': 'Utilities',
    'INTERNET': 'Utilities',
    'PHONE': 'Utilities',
    'MOBILE': 'Utilities',

    // Shopping & Retail
    'AMAZON': 'Lifestyle',
    'BEST BUY': 'Lifestyle',
    'CANADIAN TIRE': 'Lifestyle',
    'WINNERS': 'Lifestyle',
    'DOLLARAMA': 'Lifestyle',
    'IKEA': 'Lifestyle',
    'HOME DEPOT': 'Lifestyle',
    'LOWES': 'Lifestyle',
    'TARGET': 'Lifestyle',
    'ZARA': 'Apparel',
    'H&M': 'Apparel',
    'GAP': 'Apparel',
    'OLD NAVY': 'Apparel',

    // Entertainment & Subscriptions
    'CINEPLEX': 'Lifestyle',
    'NETFLIX': 'Lifestyle',
    'SPOTIFY': 'Lifestyle',
    'APPLE.COM': 'Lifestyle',
    'GOOGLE': 'Lifestyle',
    'YOUTUBE': 'Lifestyle',
    'DISNEY': 'Lifestyle',
    'PRIME VIDEO': 'Lifestyle',
    'HBO': 'Lifestyle',

    // Health & Wellness
    'PHARMACY': 'Health & Wellness',
    'SHOPPERS': 'Health & Wellness',
    'REXALL': 'Health & Wellness',
    'MEDICAL': 'Health & Wellness',
    'DENTAL': 'Health & Wellness',
    'DOCTOR': 'Health & Wellness',
    'CLINIC': 'Health & Wellness',
    'HOSPITAL': 'Health & Wellness',
    'GYM': 'Health & Wellness',
    'FITNESS': 'Health & Wellness',
    'YOGA': 'Health & Wellness',

    // Education
    'UNIVERSITY': 'Education',
    'COLLEGE': 'Education',
    'SCHOOL': 'Education',
    'TUITION': 'Education',
    'BOOK': 'Education',
    'COURSE': 'Education',

    // Financial
    'PAYMENT': 'Debt Payments',
    'TRANSFER': 'Other',
    'BANK': 'Other',
    'ATM': 'Other',
    'FEE': 'Bills (Phone, Wifi)',
};

/**
 * Normalize merchant name for better matching
 */
function normalizeMerchant(description: string): string {
    return description
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, '') // Remove special characters
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
}

/**
 * Calculate similarity between two strings (simple Levenshtein-like)
 */
function similarity(a: string, b: string): number {
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;

    if (longer.length === 0) return 1.0;

    // Check if shorter is contained in longer
    if (longer.includes(shorter)) {
        return shorter.length / longer.length;
    }

    return 0;
}

/**
 * Learn from user's past categorizations
 */
export function learnFromHistory(
    description: string,
    expenses: Expense[]
): string | null {
    const normalized = normalizeMerchant(description);

    // Find similar past expenses
    const similar = expenses
        .filter(e => {
            const expenseDesc = normalizeMerchant(e.description || '');
            return similarity(normalized, expenseDesc) > 0.7;
        })
        .sort((a, b) => {
            const simA = similarity(normalized, normalizeMerchant(a.description || ''));
            const simB = similarity(normalized, normalizeMerchant(b.description || ''));
            return simB - simA;
        });

    if (similar.length > 0) {
        // Use the most similar expense's category
        return similar[0].category;
    }

    return null;
}

/**
 * Enhanced category inference with learning
 */
export function inferCategory(description: string, pastExpenses?: Expense[]): string {
    const upperDesc = normalizeMerchant(description);

    // 1. Learn from user's history (highest priority)
    if (pastExpenses && pastExpenses.length > 0) {
        const learned = learnFromHistory(description, pastExpenses);
        if (learned) {
            return learned;
        }
    }

    // 2. Check for exact/partial matches in merchant database
    for (const [merchant, category] of Object.entries(MERCHANT_CATEGORIES)) {
        if (upperDesc.includes(merchant)) {
            return category;
        }
    }

    // 3. Pattern-based inference
    const patterns = [
        { keywords: ['GROCERY', 'SUPERMARKET', 'MARKET', 'PRODUCE'], category: 'Groceries' },
        { keywords: ['GAS', 'FUEL', 'PETRO', 'STATION'], category: 'Transportation' },
        { keywords: ['RESTAURANT', 'CAFE', 'COFFEE', 'DINER', 'EATERY', 'FOOD'], category: 'Dining Out' },
        { keywords: ['PHARMACY', 'DRUG', 'MEDICAL', 'HEALTH'], category: 'Health & Wellness' },
        { keywords: ['CLOTHING', 'APPAREL', 'FASHION', 'WEAR'], category: 'Apparel' },
        { keywords: ['ELECTRIC', 'UTILITY', 'WATER', 'POWER'], category: 'Utilities' },
        { keywords: ['INSURANCE'], category: 'Bills (Phone, Wifi)' },
        { keywords: ['RENT', 'MORTGAGE', 'LEASE'], category: 'Housing' },
        { keywords: ['LAUNDRY', 'DRY CLEAN'], category: 'Laundry' },
    ];

    for (const { keywords, category } of patterns) {
        if (keywords.some(keyword => upperDesc.includes(keyword))) {
            return category;
        }
    }

    // 4. Default
    return 'Other';
}
