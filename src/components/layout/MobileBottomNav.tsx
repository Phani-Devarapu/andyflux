import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import { LayoutDashboard, Calendar, List, PlusCircle, Menu, Wallet } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAccount } from '../../context/AccountContext';

interface MobileBottomNavProps {
    onMenuClick: () => void;
}

export function MobileBottomNav({ onMenuClick }: MobileBottomNavProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const { selectedAccount } = useAccount();

    // Determine current value based on path
    const getCurrentValue = () => {
        const path = location.pathname;
        if (path === '/') return '/';
        if (path.startsWith('/calendar')) return '/calendar';
        if (path.startsWith('/trades')) return '/trades';
        if (path.startsWith('/expenses')) return '/expenses';
        if (path.startsWith('/add')) return '/add';
        return false; // No selection for other paths (they will be accessed via Menu)
    };

    return (
        <Paper
            sx={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                display: { md: 'none' },
                zIndex: 1200,
                borderTop: '1px solid',
                borderColor: 'divider'
            }}
            elevation={10}
        >
            <BottomNavigation
                showLabels
                value={getCurrentValue()}
                onChange={(_, newValue) => {
                    if (newValue === 'menu') {
                        onMenuClick();
                    } else {
                        navigate(newValue);
                    }
                }}
                sx={{
                    height: 64, // Taller for better touch target
                    bgcolor: 'background.paper',
                    '& .MuiBottomNavigationAction-root': {
                        minWidth: 'auto',
                        padding: '6px 0 8px',
                        gap: 0.5,
                        color: 'text.secondary',
                        '&.Mui-selected': {
                            color: 'primary.main',
                        }
                    },
                    '& .MuiBottomNavigationAction-label': {
                        fontSize: '0.7rem',
                        '&.Mui-selected': {
                            fontSize: '0.75rem',
                            fontWeight: 'bold'
                        }
                    }
                }}
            >
                <BottomNavigationAction
                    label="Home"
                    value="/"
                    icon={<LayoutDashboard size={20} />}
                />
                <BottomNavigationAction
                    label="Calendar"
                    value="/calendar"
                    icon={<Calendar size={20} />}
                />
                <BottomNavigationAction
                    label="Add"
                    value="/add"
                    icon={
                        <div style={{
                            backgroundColor: '#10B981',
                            borderRadius: '50%',
                            padding: 8,
                            marginTop: -20,
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'
                        }}>
                            <PlusCircle size={24} color="#fff" />
                        </div>
                    }
                    sx={{
                        '& .MuiBottomNavigationAction-label': {
                            marginTop: 0.5
                        }
                    }}
                />
                <BottomNavigationAction
                    label="Trades"
                    value="/trades"
                    icon={<List size={20} />}
                />
                {selectedAccount === 'PERSONAL' && (
                    <BottomNavigationAction
                        label="Expenses"
                        value="/expenses"
                        icon={<Wallet size={20} />}
                    />
                )}
                <BottomNavigationAction
                    label="Menu"
                    value="menu"
                    icon={<Menu size={20} />}
                />
            </BottomNavigation>
        </Paper>
    );
}
