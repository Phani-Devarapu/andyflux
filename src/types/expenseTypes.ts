we already haexport type RecurringFrequency = 'monthly' | 'yearly';

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

// Default Categories for Life Expenses - Rich, Premium Color Palette
export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategory[] = [
    { id: 'housing', name: 'Housing', color: '#FF6B6B', icon: 'Home', isDefault: true },           // Coral Red
    { id: 'food', name: 'Dining Out', color: '#FF8C42', icon: 'Utensils', isDefault: true },       // Vibrant Orange
    { id: 'groceries', name: 'Groceries', color: '#4ECDC4', icon: 'ShoppingCart', isDefault: true }, // Turquoise
    { id: 'laundry', name: 'Laundry', color: '#95E1D3', icon: 'Shirt', isDefault: true },          // Mint
    { id: 'transport', name: 'Transportation', color: '#5B8DEE', icon: 'Car', isDefault: true },   // Periwinkle Blue
    { id: 'utilities', name: 'Utilities', color: '#38B2AC', icon: 'Zap', isDefault: true },        // Teal
    { id: 'bills', name: 'Bills (Phone, Wifi)', color: '#9B59B6', icon: 'Receipt', isDefault: true }, // Amethyst
    { id: 'health', name: 'Health & Wellness', color: '#F06292', icon: 'Heart', isDefault: true }, // Rose Pink
    { id: 'lifestyle', name: 'Lifestyle', color: '#BA68C8', icon: 'ShoppingBag', isDefault: true }, // Orchid
    { id: 'debt', name: 'Debt Payments', color: '#78909C', icon: 'CreditCard', isDefault: true },  // Blue Grey
    { id: 'savings', name: 'Savings & Invest', color: '#26A69A', icon: 'PiggyBank', isDefault: true }, // Jade
    { id: 'education', name: 'Education', color: '#7E57C2', icon: 'GraduationCap', isDefault: true }, // Deep Purple
    { id: 'other', name: 'Other', color: '#A1887F', icon: 'MoreHorizontal', isDefault: true },     // Warm Grey
];
