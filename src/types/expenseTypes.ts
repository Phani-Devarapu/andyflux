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

// Default Categories for Life Expenses
export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategory[] = [
    { id: 'housing', name: 'Housing', color: '#EF4444', icon: 'Home', isDefault: true },
    { id: 'food', name: 'Dining Out', color: '#F97316', icon: 'Utensils', isDefault: true },
    { id: 'groceries', name: 'Groceries', color: '#22C55E', icon: 'ShoppingCart', isDefault: true },
    { id: 'laundry', name: 'Laundry', color: '#06B6D4', icon: 'Shirt', isDefault: true },
    { id: 'transport', name: 'Transportation', color: '#3B82F6', icon: 'Car', isDefault: true },
    { id: 'utilities', name: 'Utilities', color: '#10B981', icon: 'Zap', isDefault: true },
    { id: 'bills', name: 'Bills (Phone, Wifi)', color: '#8B5CF6', icon: 'Receipt', isDefault: true },
    { id: 'health', name: 'Health & Wellness', color: '#EC4899', icon: 'Heart', isDefault: true },
    { id: 'lifestyle', name: 'Lifestyle', color: '#A855F7', icon: 'ShoppingBag', isDefault: true },
    { id: 'debt', name: 'Debt Payments', color: '#64748B', icon: 'CreditCard', isDefault: true },
    { id: 'savings', name: 'Savings & Invest', color: '#14B8A6', icon: 'PiggyBank', isDefault: true },
    { id: 'education', name: 'Education', color: '#6366F1', icon: 'GraduationCap', isDefault: true },
    { id: 'other', name: 'Other', color: '#94A3B8', icon: 'MoreHorizontal', isDefault: true },
];
