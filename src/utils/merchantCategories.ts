/**
 * Enhanced Merchant to Category Mapping
 * Auto-categorize expenses based on merchant names with learning capabilities
 */

import type { Expense } from '../types/expenseTypes';

export const MERCHANT_CATEGORIES: Record<string, string> = {
    // Transportation
    'LYFT': 'transport',
    'UBER': 'transport',
    'PRESTO': 'transport',
    'TRANSIT': 'transport',
    'PARKING': 'transport',
    'GAS': 'transport',
    'ESSO': 'transport',
    'SHELL': 'transport',
    'PETRO': 'transport',
    'CHEVRON': 'transport',
    'MOBIL': 'transport',
    'TAXI': 'transport',
    'CAB': 'transport',

    // Groceries
    'WALMART': 'groceries',
    'LOBLAWS': 'groceries',
    'SOBEYS': 'groceries',
    'METRO': 'groceries',
    'COSTCO': 'groceries',
    'NO FRILLS': 'groceries',
    'FRESHCO': 'groceries',
    'FOOD BASICS': 'groceries',
    'SUPERSTORE': 'groceries',
    'SAFEWAY': 'groceries',
    'WHOLE FOODS': 'groceries',
    'TRADER JOE': 'groceries',
    'FARM BOY': 'groceries',

    // Dining Out
    'RESTAURANT': 'food',
    'MCDONALD': 'food',
    'SUBWAY': 'food',
    'PIZZA': 'food',
    'BURGER': 'food',
    'GRILL': 'food',
    'SUSHI': 'food',
    'THAI': 'food',
    'CHINESE': 'food',
    'INDIAN': 'food',
    'ITALIAN': 'food',
    'WENDY': 'food',
    'A&W': 'food',
    'HARVEY': 'food',
    'CHIPOTLE': 'food',

    // Coffee
    'TIM HORTONS': 'coffee',
    'STARBUCKS': 'coffee',
    'CAFE': 'coffee',
    'COFFEE': 'coffee',
    'BISTRO': 'coffee',
    'DUNKIN': 'coffee',
    'SECOND CUP': 'coffee',
    'BALZAC': 'coffee',

    // Utilities & Bills
    'VIRGIN PLUS': 'utilities',
    'ROGERS': 'utilities',
    'BELL': 'utilities',
    'TELUS': 'utilities',
    'FIDO': 'utilities',
    'FREEDOM': 'utilities',
    'HYDRO': 'utilities',
    'ENBRIDGE': 'utilities',
    'TORONTO HYDRO': 'utilities',
    'INTERNET': 'utilities',
    'PHONE': 'utilities',
    'MOBILE': 'utilities',

    // Shopping & Retail
    'AMAZON': 'lifestyle',
    'BEST BUY': 'lifestyle',
    'CANADIAN TIRE': 'lifestyle',
    'WINNERS': 'lifestyle',
    'DOLLARAMA': 'lifestyle',
    'IKEA': 'lifestyle',
    'HOME DEPOT': 'lifestyle',
    'LOWES': 'lifestyle',
    'TARGET': 'lifestyle',
    'ZARA': 'apparel',
    'H&M': 'apparel',
    'GAP': 'apparel',
    'OLD NAVY': 'apparel',

    // Entertainment & Subscriptions
    'CINEPLEX': 'lifestyle',
    'NETFLIX': 'lifestyle',
    'SPOTIFY': 'lifestyle',
    'APPLE.COM': 'lifestyle',
    'GOOGLE': 'lifestyle',
    'YOUTUBE': 'lifestyle',
    'DISNEY': 'lifestyle',
    'PRIME VIDEO': 'lifestyle',
    'HBO': 'lifestyle',

    // Health & Wellness
    'PHARMACY': 'health',
    'SHOPPERS': 'health',
    'REXALL': 'health',
    'MEDICAL': 'health',
    'DENTAL': 'health',
    'DOCTOR': 'health',
    'CLINIC': 'health',
    'HOSPITAL': 'health',
    'GYM': 'health',
    'FITNESS': 'health',
    'YOGA': 'health',

    // Education
    'UNIVERSITY': 'education',
    'COLLEGE': 'education',
    'SCHOOL': 'education',
    'TUITION': 'education',
    'BOOK': 'education',
    'COURSE': 'education',

    // Financial
    'PAYMENT': 'debt',
    'TRANSFER': 'other',
    'BANK': 'other',
    'ATM': 'other',
    'FEE': 'bills',
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
        { keywords: ['GROCERY', 'SUPERMARKET', 'MARKET', 'PRODUCE'], category: 'groceries' },
        { keywords: ['GAS', 'FUEL', 'PETRO', 'STATION'], category: 'transport' },
        { keywords: ['RESTAURANT', 'CAFE', 'COFFEE', 'DINER', 'EATERY', 'FOOD'], category: 'food' },
        { keywords: ['PHARMACY', 'DRUG', 'MEDICAL', 'HEALTH'], category: 'health' },
        { keywords: ['CLOTHING', 'APPAREL', 'FASHION', 'WEAR'], category: 'apparel' },
        { keywords: ['ELECTRIC', 'UTILITY', 'WATER', 'POWER'], category: 'utilities' },
        { keywords: ['INSURANCE'], category: 'bills' },
        { keywords: ['RENT', 'MORTGAGE', 'LEASE'], category: 'housing' },
        { keywords: ['LAUNDRY', 'DRY CLEAN'], category: 'laundry' },
        { keywords: ['COFFEE', 'STARBUCKS', 'TIM HORTONS', 'BALZAC'], category: 'coffee' },
    ];

    for (const { keywords, category } of patterns) {
        if (keywords.some(keyword => upperDesc.includes(keyword))) {
            return category;
        }
    }

    // 4. Default
    return 'other';
}
