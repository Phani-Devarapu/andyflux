
import { describe, it, expect } from 'vitest';
import { startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';

// Helper function to be tested (simplified version of what will be in the component)
function generateCalendarData(currentMonth: Date, trades: { date: string | Date; pnl?: number }[]) {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    return daysInMonth.map(day => {
        const daysTrades = trades.filter(t => isSameDay(new Date(t.date), day));
        const count = daysTrades.length;
        const pnl = daysTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);

        let intensity = 0;
        if (count > 0) {
            if (count > 5) intensity = 3;
            else if (count > 2) intensity = 2;
            else intensity = 1;
        }

        return {
            date: day,
            count,
            pnl,
            intensity
        };
    });
}

describe('Calendar Heatmap Logic', () => {
    it('correctly aggregates trade data for a month', () => {
        // Use a fixed date for the month
        const currentMonth = new Date(2025, 0, 1); // Jan 2025 Local Time

        // Day 1
        const d1 = new Date(2025, 0, 1);
        // Day 2
        const d2 = new Date(2025, 0, 2);

        const trades = [
            { date: d1.toISOString(), pnl: 100 },
            { date: d1.toISOString(), pnl: -50 },
            { date: d2.toISOString(), pnl: 200 }
        ];

        const data = generateCalendarData(currentMonth, trades);

        const day1 = data.find(d => d.date.getDate() === 1);
        const day2 = data.find(d => d.date.getDate() === 2);
        const day3 = data.find(d => d.date.getDate() === 3);

        expect(day1?.count).toBe(2);
        expect(day1?.pnl).toBe(50);
        expect(day1?.intensity).toBe(1);

        expect(day2?.count).toBe(1);
        expect(day2?.pnl).toBe(200);

        expect(day3?.count).toBe(0);
    });
});
