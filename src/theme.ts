import { createTheme } from '@mui/material/styles';

export const getTheme = (mode: 'light' | 'dark') => createTheme({
    palette: {
        mode,
        ...(mode === 'dark' ? {
            // Dark Mode
            primary: { main: '#10B981' }, // Emerald 500
            secondary: { main: '#F43F5E' }, // Rose 500
            background: {
                default: '#0F172A', // Slate 900
                paper: '#1E293B',   // Slate 800
            },
            text: {
                primary: '#F8FAFC', // Slate 50
                secondary: '#94A3B8', // Slate 400
            },
            divider: 'rgba(148, 163, 184, 0.1)',
            success: { main: '#10B981' },
            error: { main: '#EF4444' },
        } : {
            // Light Mode
            primary: { main: '#059669' }, // Emerald 600
            secondary: { main: '#E11D48' }, // Rose 600
            background: {
                default: '#F8FAFC', // Slate 50
                paper: '#FFFFFF',   // White
            },
            text: {
                primary: '#0F172A', // Slate 900
                secondary: '#64748B', // Slate 500
            },
            divider: 'rgba(0, 0, 0, 0.1)',
            success: { main: '#10B981' },
            error: { main: '#EF4444' },
        }),
    },
    typography: {
        fontFamily: '"Plus Jakarta Sans", "Inter", "Roboto", "sans-serif"',
        h1: { fontWeight: 700 },
        h2: { fontWeight: 700 },
        h3: { fontWeight: 600 },
        h4: { fontWeight: 600 },
        h5: { fontWeight: 600 },
        h6: { fontWeight: 600 },
    },
    shape: {
        borderRadius: 12,
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    textTransform: 'none',
                    fontWeight: 600,
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    borderRadius: 16,
                    backgroundImage: 'none',
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 16,
                    backgroundImage: 'none',
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    borderBottom: mode === 'dark' ? '1px solid rgba(148, 163, 184, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                },
            },
        },
    },
});
