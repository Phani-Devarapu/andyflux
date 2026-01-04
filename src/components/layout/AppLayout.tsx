import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { Menu as MenuIcon } from 'lucide-react';
import {
    Box,
    Drawer,
    AppBar,
    Toolbar,
    IconButton,
    alpha
} from '@mui/material';

const DRAWER_WIDTH = 280;

export function AppLayout() {
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    return (
        <Box sx={{ display: 'flex' }}>
            {/* Mobile Header */}
            <AppBar
                position="fixed"
                sx={{
                    width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
                    ml: { md: `${DRAWER_WIDTH}px` },
                    display: { md: 'none' },
                    bgcolor: (theme) => alpha(theme.palette.background.default, 0.7),
                    backdropFilter: 'blur(20px)',
                    backgroundImage: 'none',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    boxShadow: 'none'
                }}
            >
                <Toolbar>
                    <IconButton
                        color="inherit"
                        aria-label="open drawer"
                        edge="start"
                        onClick={handleDrawerToggle}
                        sx={{ mr: 2, display: { md: 'none' } }}
                    >
                        <MenuIcon />
                    </IconButton>
                </Toolbar>
            </AppBar>

            {/* Navigation Drawer */}
            <Box
                component="nav"
                sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
            >
                {/* Mobile Drawer */}
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={handleDrawerToggle}
                    ModalProps={{ keepMounted: true }}
                    sx={{
                        display: { xs: 'block', md: 'none' },
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
                    }}
                >
                    <Sidebar onClose={handleDrawerToggle} />
                </Drawer>

                {/* Desktop Drawer */}
                <Drawer
                    variant="permanent"
                    sx={{
                        display: { xs: 'none', md: 'block' },
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH, borderRight: '1px solid rgba(255,255,255,0.05)' },
                    }}
                    open
                >
                    <Sidebar />
                </Drawer>
            </Box>

            {/* Main Content Area */}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 3,
                    width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
                    minHeight: '100vh',
                    bgcolor: 'background.default',
                    pb: { xs: 8, md: 3 } // Add padding for bottom nav on mobile
                }}
            >
                <Toolbar sx={{ display: { md: 'none' } }} />

                <Box sx={{ maxWidth: '1600px', mx: 'auto' }}>
                    <Outlet />
                </Box>
            </Box>

            <MobileBottomNav onMenuClick={handleDrawerToggle} />
        </Box>
    );
}
