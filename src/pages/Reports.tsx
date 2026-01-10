import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Paper, Tabs, Tab, Typography, useTheme } from '@mui/material';
import { Activity, BarChart3, PieChart } from 'lucide-react';
import { ActivityReport } from './ActivityReport';
import { TickerAnalytics } from './TickerAnalytics';
import { StrategyAnalytics } from './StrategyAnalytics';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`reports-tabpanel-${index}`}
            aria-labelledby={`reports-tab-${index}`}
            {...other}
        >
            {value === index && <Box>{children}</Box>}
        </div>
    );
}

export function Reports() {
    const theme = useTheme();
    const [searchParams, setSearchParams] = useSearchParams();

    // Get initial tab from URL query parameter
    const getInitialTab = () => {
        const tabParam = searchParams.get('tab');
        switch (tabParam) {
            case 'ticker':
                return 1;
            case 'strategy':
                return 2;
            default:
                return 0; // Default to Activity Report
        }
    };

    const [activeTab, setActiveTab] = useState(getInitialTab());

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);

        // Update URL query parameter
        const tabNames = ['activity', 'ticker', 'strategy'];
        setSearchParams({ tab: tabNames[newValue] });
    };

    return (
        <Box sx={{ animation: 'fade-in 0.5s', '@keyframes fade-in': { from: { opacity: 0 }, to: { opacity: 1 } } }}>
            {/* Header */}
            <Box sx={{ mb: 3 }}>
                <Typography
                    variant="h3"
                    fontWeight={900}
                    sx={{
                        background: theme.palette.mode === 'dark'
                            ? 'linear-gradient(45deg, #60A5FA 30%, #A78BFA 90%)'
                            : 'linear-gradient(45deg, #2563EB 30%, #7C3AED 90%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        mb: 1,
                        letterSpacing: '-0.02em'
                    }}
                >
                    Reports
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
                    Comprehensive analytics and insights for your trading activity
                </Typography>
            </Box>

            {/* Tabs Navigation */}
            <Paper
                elevation={2}
                sx={{
                    borderRadius: 3,
                    overflow: 'hidden',
                    mb: 3,
                    bgcolor: 'background.paper'
                }}
            >
                <Tabs
                    value={activeTab}
                    onChange={handleTabChange}
                    variant="fullWidth"
                    sx={{
                        borderBottom: 1,
                        borderColor: 'divider',
                        '& .MuiTab-root': {
                            py: 2,
                            textTransform: 'none',
                            fontSize: '1rem',
                            fontWeight: 600,
                            minHeight: 64,
                        },
                        '& .Mui-selected': {
                            color: 'primary.main',
                        }
                    }}
                >
                    <Tab
                        icon={<Activity size={20} />}
                        iconPosition="start"
                        label="Activity Report"
                        id="reports-tab-0"
                        aria-controls="reports-tabpanel-0"
                    />
                    <Tab
                        icon={<BarChart3 size={20} />}
                        iconPosition="start"
                        label="Ticker Analytics"
                        id="reports-tab-1"
                        aria-controls="reports-tabpanel-1"
                    />
                    <Tab
                        icon={<PieChart size={20} />}
                        iconPosition="start"
                        label="Strategy Analytics"
                        id="reports-tab-2"
                        aria-controls="reports-tabpanel-2"
                    />
                </Tabs>
            </Paper>

            {/* Tab Panels */}
            <TabPanel value={activeTab} index={0}>
                <ActivityReport />
            </TabPanel>
            <TabPanel value={activeTab} index={1}>
                <TickerAnalytics />
            </TabPanel>
            <TabPanel value={activeTab} index={2}>
                <StrategyAnalytics />
            </TabPanel>
        </Box>
    );
}
