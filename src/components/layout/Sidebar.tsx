import { NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    List as ListIcon,
    PlusCircle,
    Calendar as CalendarIcon,
    BarChart3,
    Sun,
    Moon
} from 'lucide-react';
import {
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Box,
    Typography,
    Paper,
    useTheme,
    IconButton,
    Button
} from '@mui/material';
import { useColorMode } from '../../context/ColorModeContext';
import { useAccount } from '../../context/AccountContext';
import logo from '../../assets/logo.png';

export function Sidebar({ onClose }: { onClose?: () => void }) {
    const location = useLocation();
    const theme = useTheme();
    const { mode, toggleColorMode } = useColorMode();
    const { selectedAccount, switchAccount } = useAccount();

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: CalendarIcon, label: 'Calendar', path: '/calendar' },
        { icon: ListIcon, label: 'Trade Log', path: '/trades' },
        { icon: PlusCircle, label: 'Add Trade', path: '/add' },
        { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    ];

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
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

                <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
                        Account
                    </Typography>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 1,
                            p: 0.5,
                            bgcolor: 'background.default',
                            borderRadius: 2,
                        }}
                    >
                        <Button
                            variant={selectedAccount === 'trading' ? 'contained' : 'outlined'}
                            size="small"
                            onClick={() => switchAccount('trading')}
                            sx={{
                                fontSize: '0.75rem',
                                py: 0.75,
                                textTransform: 'none',
                                fontWeight: selectedAccount === 'trading' ? 'bold' : 'medium',
                            }}
                        >
                            🚀 Trading
                        </Button>
                        <Button
                            variant={selectedAccount === 'investing' ? 'contained' : 'outlined'}
                            size="small"
                            onClick={() => switchAccount('investing')}
                            sx={{
                                fontSize: '0.75rem',
                                py: 0.75,
                                textTransform: 'none',
                                fontWeight: selectedAccount === 'investing' ? 'bold' : 'medium',
                            }}
                        >
                            💰 Investing
                        </Button>
                    </Box>
                </Box>
            </Box>

            <List sx={{ px: 2, mt: 2, flexGrow: 1 }}>
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <ListItem key={item.path} disablePadding sx={{ mb: 1 }}>
                            <ListItemButton
                                component={NavLink}
                                to={item.path}
                                onClick={onClose}
                                sx={{
                                    borderRadius: 3,
                                    backgroundColor: isActive ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                                    color: isActive ? 'primary.main' : 'text.secondary',
                                    '&:hover': {
                                        backgroundColor: isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                    }
                                }}
                            >
                                <ListItemIcon sx={{ minWidth: 40, color: isActive ? 'primary.main' : 'text.secondary' }}>
                                    <item.icon size={20} />
                                </ListItemIcon>
                                <ListItemText
                                    primary={item.label}
                                    primaryTypographyProps={{ fontWeight: isActive ? 700 : 500 }}
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
                            borderRadius: 3,
                            color: 'text.secondary',
                            '&:hover': {
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            }
                        }}
                    >
                        <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}>
                            {mode === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </ListItemIcon>
                        <ListItemText
                            primary={mode === 'dark' ? "Light Mode" : "Dark Mode"}
                            primaryTypographyProps={{ fontWeight: 500 }}
                        />
                    </ListItemButton>
                </ListItem>
            </List>

            <Box sx={{ p: 2 }}>
                <Paper sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 1, textTransform: 'uppercase' }}>
                            Account
                        </Typography>
                        <IconButton onClick={toggleColorMode} size="small" sx={{ ml: 1 }}>
                            {mode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                        </IconButton>
                    </Box>
                    <Typography variant="subtitle2" fontWeight="bold">
                        Default User
                    </Typography>
                    <Typography variant="caption" color="success.main" fontWeight="bold">
                        LIVE
                    </Typography>
                </Paper>
            </Box>
        </Box >
    );
}

