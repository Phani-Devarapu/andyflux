export type GoalType = 'PnL' | 'Volume' | 'WinRate';

export interface Goal {
    id?: string;
    userId: string;
    accountId: string;
    year: number;
    month: number; // 1-12
    type: GoalType;
    targetAmount: number;
    // We don't necessarily need currentAmount here if we calculate it dynamically, 
    // but caching it might be useful. For now, let's keep it simple and calculate dynamically.
    createdAt: Date;
    updatedAt: Date;
}
