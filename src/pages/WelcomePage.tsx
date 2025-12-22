import { Box, Typography, Button, Container, Paper, Stack } from '@mui/material';
import { LogIn, TrendingUp, ShieldCheck, Zap } from 'lucide-react';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthDialog } from '../components/auth/AuthDialog';
import { useAuth } from '../context/AuthContext';

export function WelcomePage() {
    const { user } = useAuth();
    const [authOpen, setAuthOpen] = useState(false);

    if (user) {
        return <Navigate to="/" replace />;
    }

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
            <Container maxWidth="md" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', py: 8 }}>
                <Box sx={{ textAlign: 'center', mb: 8 }}>
                    <Box sx={{ display: 'inline-flex', p: 2, bgcolor: 'primary.soft', borderRadius: '24px', mb: 3 }}>
                        <TrendingUp size={48} className="text-primary" />
                    </Box>
                    <Typography variant="h2" fontWeight="900" sx={{ mb: 2, letterSpacing: -1 }}>
                        Andy Flux
                    </Typography>
                    <Typography variant="h5" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto', mb: 4 }}>
                        Your professional trading journal. Track, analyze, and improve your trading performance with confidence.
                    </Typography>
                    <Button
                        variant="contained"
                        size="large"
                        startIcon={<LogIn />}
                        onClick={() => setAuthOpen(true)}
                        sx={{ px: 6, py: 2, borderRadius: 2, fontSize: '1.1rem' }}
                    >
                        Sign In to Start
                    </Button>
                </Box>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={4}>
                    <FeatureCard
                        icon={<ShieldCheck size={32} />}
                        title="Secure & Private"
                        description="Your data is encrypted and strictly isolated. Only you can access your trade logs."
                    />
                    <FeatureCard
                        icon={<Zap size={32} />}
                        title="Fast Sync"
                        description="Seamlessly sync your trades across devices with our optimized cloud infrastructure."
                    />
                    <FeatureCard
                        icon={<TrendingUp size={32} />}
                        title="Advanced Analytics"
                        description="Gain deep insights into your strategy performance with interactive charts."
                    />
                </Stack>
            </Container>

            <Box sx={{ py: 4, textAlign: 'center', borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary">
                    © {new Date().getFullYear()} Andy Flux. All rights reserved.
                </Typography>
            </Box>

            <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
        </Box>
    );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
    return (
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, flex: 1, textAlign: 'center' }}>
            <Box sx={{ display: 'inline-flex', p: 1.5, bgcolor: 'action.hover', borderRadius: '12px', mb: 2, color: 'primary.main' }}>
                {icon}
            </Box>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
                {title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                {description}
            </Typography>
        </Paper>
    );
}
