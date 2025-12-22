import { createTheme } from '@mui/material/styles';

// Premium Fintech Palette
// Dark Mode: "Obsidian Command Center"
const darkPalette = {
    background: {
        default: '#0B0E14', // Deepest Obsidian
        paper: '#151A23',   // Soft Charcoal
    },
    primary: {
        main: '#3B82F6',   // Electric Blue
        light: '#60A5FA',
        dark: '#2563EB',
        contrastText: '#FFFFFF',
    },
    secondary: {
        main: '#8B5CF6',   // Violet
        light: '#A78BFA',
        dark: '#7C3AED',
        contrastText: '#FFFFFF',
    },
    error: { main: '#EF4444' }, // Red-500
    warning: { main: '#F59E0B' }, // Amber-500
    success: { main: '#10B981' }, // Emerald-500
    text: {
        primary: '#F9FAFB', // Gray-50
        secondary: '#9CA3AF', // Gray-400
    },
    divider: 'rgba(255, 255, 255, 0.08)',
};

// Light Mode: "Private Bank"
const lightPalette = {
    background: {
        default: '#F3F4F6', // Cool Gray 100
        paper: '#FFFFFF',
    },
    primary: {
        main: '#0F172A',   // Slate 900 (High contrast, professional)
        light: '#334155',
        dark: '#020617',
        contrastText: '#FFFFFF',
    },
    secondary: {
        main: '#2563EB',   // Blue 600
        light: '#60A5FA',
        dark: '#1D4ED8',
        contrastText: '#FFFFFF',
    },
    error: { main: '#DC2626' }, // Red-600
    warning: { main: '#D97706' }, // Amber-600
    success: { main: '#059669' }, // Emerald-600
    text: {
        primary: '#111827', // Gray-900
        secondary: '#6B7280', // Gray-500
    },
    divider: 'rgba(0, 0, 0, 0.06)',
};

export const getTheme = (mode: 'light' | 'dark') => {
    const isDark = mode === 'dark';

    return createTheme({
        palette: {
            mode,
            ...(isDark ? darkPalette : lightPalette),
        },
        typography: {
            fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
            h1: { fontWeight: 800, letterSpacing: '-0.025em' },
            h2: { fontWeight: 700, letterSpacing: '-0.025em' },
            h3: { fontWeight: 700, letterSpacing: '-0.025em' },
            h4: { fontWeight: 600, letterSpacing: '-0.025em' },
            h6: { fontWeight: 600 },
            button: { fontWeight: 600, textTransform: 'none', letterSpacing: '0.01em' },
            body2: { letterSpacing: '0.01em' }, // Better readability for dense data
        },
        shape: {
            borderRadius: 12, // Slightly rounder for modern feel
        },
        components: {
            MuiCssBaseline: {
                styleOverrides: {
                    body: {
                        scrollbarColor: isDark ? '#374151 #111827' : '#9ca3af #f3f4f6',
                        '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
                            backgroundColor: 'transparent',
                            width: '8px',
                            height: '8px',
                        },
                        '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
                            borderRadius: 8,
                            backgroundColor: isDark ? '#374151' : '#d1d5db',
                            minHeight: 24,
                        },
                    },
                },
            },
            MuiPaper: {
                styleOverrides: {
                    root: {
                        backgroundImage: 'none',
                        transition: 'all 0.2s ease-in-out',
                    },
                    elevation1: {
                        boxShadow: isDark
                            ? '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3)' // Deep shadow
                            : '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)', // Soft shadow
                    },
                },
            },
            MuiCard: {
                styleOverrides: {
                    root: {
                        border: isDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 0, 0, 0.03)',
                        backdropFilter: 'blur(20px)', // Glassmorphism hint
                    },
                },
            },
            MuiButton: {
                styleOverrides: {
                    root: {
                        borderRadius: 8,
                        boxShadow: 'none',
                        '&:hover': {
                            boxShadow: isDark
                                ? '0 0 15px rgba(59, 130, 246, 0.3)' // Blue glow on hover
                                : '0 4px 12px rgba(0, 0, 0, 0.1)',
                            transform: 'translateY(-1px)',
                        },
                    },
                    containedPrimary: {
                        background: isDark
                            ? 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' // Gradient
                            : '#0F172A',
                    },
                },
            },
            MuiTableCell: {
                styleOverrides: {
                    root: {
                        borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.04)' : '1px solid rgba(0, 0, 0, 0.04)',
                        paddingTop: 16,
                        paddingBottom: 16,
                        fontVariantNumeric: 'tabular-nums', // Aligns numbers perfectly
                    },
                    head: {
                        fontWeight: 600,
                        color: isDark ? '#9CA3AF' : '#6B7280',
                        textTransform: 'uppercase',
                        fontSize: '0.75rem',
                        letterSpacing: '0.05em',
                        background: isDark ? '#151A23' : '#FFFFFF', // Sticky header bg fix
                    },
                },
            },
            MuiOutlinedInput: {
                styleOverrides: {
                    root: {
                        '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
                        },
                    },
                },
            },
            MuiChip: {
                styleOverrides: {
                    root: {
                        fontWeight: 600,
                    },
                    filled: {
                        border: '1px solid transparent',
                    },
                    outlined: {
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    },
                },
            },
        },
    });
};
