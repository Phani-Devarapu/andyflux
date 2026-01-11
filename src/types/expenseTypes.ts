export type RecurringFrequency = 'monthly' | 'yearly';

export interface Expense {
    id?: string;
    userId: string;
    accountId: string; // TFSA, FHSA, etc.
    date: Date;
    category: string;
    amount: number; // Always stored in CAD
    currency?: 'CAD' | 'USD' | 'INR'; // Original currency
    originalAmount?: number; // Amount in original currency
    exchangeRate?: number; // Rate used for conversion (1 CAD = x Original)
    description?: string;

    // Feature: Recurring / Subscriptions
    isRecurring: boolean;
    frequency?: RecurringFrequency;

    createdAt?: Date;
    updatedAt?: Date;
}

export interface RecurringExpenseRule {
    id?: string;
    userId: string;
    accountId: string;
    category: string;
    amount: number;
    description?: string;
    frequency: RecurringFrequency;
    lastGeneratedDate?: Date; // To prevent duplicates
    nextDueDate: Date;
    isActive: boolean;
}

export interface ExpenseCategory {
    id?: string; // e.g., "software", "education"
    name: string;
    color: string;
    icon: string; // Lucide icon name
    isDefault?: boolean; // System provided categories
}

// Default Categories for Life Expenses - Vibrant, Highly Distinct Colors
export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategory[] = [
    { id: 'housing', name: 'Housing', color: '#DC2626', icon: 'Home', isDefault: true },           // Deep Red
    { id: 'food', name: 'Dining Out', color: '#EA580C', icon: 'Utensils', isDefault: true },       // Bright Orange
    { id: 'groceries', name: 'Groceries', color: '#16A34A', icon: 'ShoppingCart', isDefault: true }, // Green
    { id: 'laundry', name: 'Laundry', color: '#0891B2', icon: 'Shirt', isDefault: true },          // Cyan
    { id: 'transport', name: 'Transportation', color: '#2563EB', icon: 'Car', isDefault: true },   // Royal Blue
    { id: 'utilities', name: 'Utilities', color: '#059669', icon: 'Zap', isDefault: true },        // Emerald
    { id: 'bills', name: 'Bills (Phone, Wifi)', color: '#7C3AED', icon: 'Receipt', isDefault: true }, // Violet
    { id: 'health', name: 'Health & Wellness', color: '#DB2777', icon: 'Heart', isDefault: true }, // Pink
    { id: 'lifestyle', name: 'Lifestyle', color: '#9333EA', icon: 'ShoppingBag', isDefault: true }, // Purple
    { id: 'debt', name: 'Debt Payments', color: '#475569', icon: 'CreditCard', isDefault: true },  // Slate
    { id: 'savings', name: 'Savings & Invest', color: '#0D9488', icon: 'PiggyBank', isDefault: true }, // Teal
    { id: 'education', name: 'Education', color: '#4F46E5', icon: 'GraduationCap', isDefault: true }, // Indigo
    { id: 'other', name: 'Other', color: '#78716C', icon: 'MoreHorizontal', isDefault: true },     // Stone
];
