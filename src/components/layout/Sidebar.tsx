import { useNavigate, useLocation } from 'react-router-dom';
import {
    Calendar,
    LayoutDashboard,
    List as ListIcon,
    LogOut,
    Cloud,
    LogIn,
    PlusCircle,
    Sun,
    Moon,
    FileText,
    Wallet
} from 'lucide-react';
import {
    Box,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography,
    Stack,
    Divider,
    Button,
    Avatar,
    useTheme,
    alpha,
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { AuthDialog } from '../auth/AuthDialog';
import { DataManagementDialog } from '../settings/DataManagementDialog';
import { useColorMode } from '../../context/ColorModeContext';
import { useAccount, type AccountType } from '../../context/AccountContext';
import { useState } from 'react';
import logo from '../../assets/logo.png';
import { GoalsWidget } from '../widgets/GoalsWidget';

const MENU_ITEMS = [
    { text: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { text: 'Calendar', icon: Calendar, path: '/calendar' },
    { text: 'Trade Log', icon: ListIcon, path: '/trades' },
    { text: 'Add Trade', icon: PlusCircle, path: '/add' },
    { text: 'Reports', icon: FileText, path: '/reports' },
    { text: 'Expenses', icon: Wallet, path: '/expenses' },
    // { text: 'Settings', icon: Settings, path: '/settings' },
];

interface SidebarProps {
    onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const { user, signOut } = useAuth();
    const { mode, toggleColorMode } = useColorMode();
    const { selectedAccount, switchAccount } = useAccount();
    const [authOpen, setAuthOpen] = useState(false);
    const [dataOpen, setDataOpen] = useState(false);

    const handleNavigation = (path: string) => {
        navigate(path);
        onClose?.(); // Close drawer if provided
    };

    // Filter menu items based on selected account
    const filteredItems = MENU_ITEMS.filter(item => {
        if (selectedAccount === 'PERSONAL') {
            // For Personal account: Include Expenses, Dashboard, Calendar.
            // Exclude: Trade Log, Add Trade, Reports
            const excludedPaths = ['/trades', '/add', '/reports'];
            return !excludedPaths.includes(item.path);
        } else {
            // In TFSA/FHSA/Non-Reg: Exclude Expenses
            return item.path !== '/expenses';
        }
    });

    return (
        <>
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
                {/* Logo Area */}
                <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderBottom: `1px solid ${theme.palette.divider}`, gap: 2 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <img src={logo} alt="Andy Flux" style={{ height: 42, objectFit: 'contain' }} />
                        <Typography variant="h6" fontWeight="bold" sx={{
                            background: 'linear-gradient(45deg, #10B981, #3B82F6)',
                            backgroundClip: 'text',
                            textFillColor: 'transparent',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            letterSpacing: 1
                        }}>
                            ANDY FLUX
                        </Typography>
                    </Box>

                    {/* Account Switcher */}
                    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
                            Account
                        </Typography>
                        <Box sx={{ p: 0.5 }}>
                            <Button
                                fullWidth
                                variant="outlined"
                                onClick={() => {
                                    // Using a Menu for a cleaner dropdown feel than native select
                                    // Or just use a Select. Let's use a nice Select.
                                }}
                                sx={{
                                    justifyContent: 'space-between',
                                    textTransform: 'none',
                                    color: 'text.primary',
                                    borderColor: 'divider',
                                    '&:hover': { borderColor: 'primary.main' },
                                    display: 'none' // Hidden for now, replacing with Select below
                                }}
                            >
                                {selectedAccount}
                            </Button>
                            {/* Actual Select Implementation */}
                            <Box sx={{ position: 'relative' }}>
                                <select
                                    value={selectedAccount}
                                    onChange={(e) => switchAccount(e.target.value as AccountType)}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '8px',
                                        border: `1px solid ${theme.palette.divider}`,
                                        backgroundColor: theme.palette.background.default,
                                        color: theme.palette.text.primary,
                                        fontSize: '0.9rem',
                                        cursor: 'pointer',
                                        outline: 'none',
                                        appearance: 'none', // Remove native arrow
                                        backgroundImage: `linear-gradient(45deg, transparent 50%, ${theme.palette.text.secondary} 50%), linear-gradient(135deg, ${theme.palette.text.secondary} 50%, transparent 50%)`,
                                        backgroundPosition: 'calc(100% - 20px) calc(1em + 2px), calc(100% - 15px) calc(1em + 2px)',
                                        backgroundSize: '5px 5px, 5px 5px',
                                        backgroundRepeat: 'no-repeat',
                                        fontFamily: 'inherit'
                                    }}
                                >
                                    {(() => {
                                        const { availableAccounts } = useAccount();
                                        const accountLabels: Record<AccountType, string> = {
                                            'TFSA': '🍁 TFSA',
                                            'FHSA': '🏠 FHSA',
                                            'NON_REGISTERED': '💵 Non-Registered',
                                            'PERSONAL': '💳 Personal'
                                        };

                                        return availableAccounts.map(account => (
                                            <option key={account} value={account}>
                                                {accountLabels[account]}
                                            </option>
                                        ));
                                    })()}
                                </select>
                            </Box>
                        </Box>
                    </Box>
                </Box>

                {/* Navigation Items (Scrollable Area) */}
                <Box sx={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                    <List sx={{ px: 2 }}>
                        {filteredItems.map((item) => {
                            const Icon = item.icon;
                            const active = location.pathname.startsWith(item.path) && item.path !== '/'
                                ? true
                                : location.pathname === item.path;
                            return (
                                <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
                                    <ListItemButton
                                        onClick={() => handleNavigation(item.path)}
                                        selected={active}
                                        sx={{
                                            borderRadius: 2,
                                            py: 1.5,
                                            color: active ? 'primary.main' : 'text.secondary',
                                            bgcolor: active ? (theme) => alpha(theme.palette.primary.main, 0.1) : 'transparent',
                                            '&:hover': {
                                                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                                                color: 'primary.main',
                                            },
                                            '&.Mui-selected': {
                                                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                                                '&:hover': {
                                                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.15),
                                                },
                                            },
                                        }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
                                            <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={item.text}
                                            primaryTypographyProps={{
                                                fontWeight: active ? 700 : 500,
                                                fontSize: '0.9rem',
                                            }}
                                        />
                                    </ListItemButton>
                                </ListItem>
                            );
                        })}

                        {/* Theme Toggle Button */}
                        <ListItem disablePadding sx={{ mb: 1, mt: 2 }}>
                            <ListItemButton
                                onClick={toggleColorMode}
                                sx={{
                                    borderRadius: 2,
                                    py: 1.5,
                                    color: 'text.secondary',
                                    '&:hover': {
                                        bgcolor: 'action.hover',
                                        color: 'text.primary',
                                    }
                                }}
                            >
                                <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
                                    {mode === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                                </ListItemIcon>
                                <ListItemText
                                    primary={mode === 'dark' ? "Light Mode" : "Dark Mode"}
                                    primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }}
                                />
                            </ListItemButton>
                        </ListItem>
                    </List>

                    <Box sx={{ px: 2, mb: 2, mt: 'auto' }}>
                        <GoalsWidget />
                    </Box>
                </Box>

                <Divider sx={{ mx: 3 }} />

                {/* User / Auth Section */}
                <Box sx={{ px: 3, pb: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {user ? (
                        <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                                <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.875rem', fontWeight: 'bold' }}>
                                    {user.email?.charAt(0).toUpperCase()}
                                </Avatar>
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography variant="body2" fontWeight={600} noWrap>
                                        {user.email?.split('@')[0]}
                                    </Typography>
                                    <Typography variant="caption" color="success.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Cloud size={10} /> Sync Active
                                    </Typography>
                                </Box>
                            </Box>

                            <Stack spacing={1}>
                                <Button
                                    variant="outlined"
                                    color="inherit"
                                    size="small"
                                    onClick={() => handleNavigation('/account-management')}
                                    fullWidth
                                    sx={{ borderColor: 'divider', color: 'text.secondary' }}
                                >
                                    Account Management
                                </Button>
                                <Button
                                    variant="outlined"
                                    color="error"
                                    size="small"
                                    startIcon={<LogOut size={14} />}
                                    onClick={() => signOut()}
                                    fullWidth
                                >
                                    Sign Out
                                </Button>
                            </Stack>
                        </Box>
                    ) : (
                        <Button
                            variant="contained"
                            startIcon={<LogIn size={18} />}
                            onClick={() => setAuthOpen(true)}
                            fullWidth
                            sx={{ borderRadius: 2, py: 1 }}
                        >
                            Sign In to Sync
                        </Button>
                    )}
                </Box>
            </Box >

            <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
            <DataManagementDialog open={dataOpen} onClose={() => setDataOpen(false)} />
        </>
    );
}
