
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '100vh',
                        bgcolor: 'background.default',
                        p: 3
                    }}
                >
                    <Paper elevation={3} sx={{ p: 4, maxWidth: 600, width: '100%', borderRadius: 2, textAlign: 'center' }}>
                        <AlertTriangle size={48} color="#d32f2f" style={{ marginBottom: 16 }} />
                        <Typography variant="h5" gutterBottom fontWeight="bold" color="error">
                            Something went wrong
                        </Typography>
                        <Typography variant="body1" color="text.secondary" paragraph>
                            The application encountered an unexpected error.
                        </Typography>

                        <Box sx={{ mt: 2, mb: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1, textAlign: 'left', overflow: 'auto', maxHeight: 300 }}>
                            <Typography variant="subtitle2" color="error" fontFamily="monospace">
                                {this.state.error && this.state.error.toString()}
                            </Typography>
                            {this.state.errorInfo && (
                                <Typography variant="caption" fontFamily="monospace" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                                    {this.state.errorInfo.componentStack}
                                </Typography>
                            )}
                        </Box>

                        <Button
                            variant="contained"
                            startIcon={<RefreshCw />}
                            onClick={() => window.location.reload()}
                        >
                            Reload Application
                        </Button>
                    </Paper>
                </Box>
            );
        }

        return this.props.children;
    }
}
