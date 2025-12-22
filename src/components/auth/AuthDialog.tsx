import { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    TextField,
    Button,
    Stack,
    Alert,
    Tab,
    Tabs,
    Box
} from '@mui/material';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider
} from 'firebase/auth';
import { auth } from '../../utils/firebase';

interface AuthDialogProps {
    open: boolean;
    onClose: () => void;
}

export const AuthDialog = ({ open, onClose }: AuthDialogProps) => {
    const [tab, setTab] = useState(0);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleAuth = async (isSignUp: boolean) => {
        setLoading(true);
        setError(null);
        try {
            if (isSignUp) {
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
            onClose();
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message.replace('Firebase: ', ''));
            } else {
                setError('An unknown error occurred');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError(null);
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            onClose();
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message.replace('Firebase: ', ''));
            } else {
                setError('An unknown error occurred');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
                    <Tab label="Sign In" />
                    <Tab label="Sign Up" />
                </Tabs>
            </DialogTitle>
            <DialogContent>
                <Stack spacing={3} sx={{ mt: 2 }}>
                    {error && <Alert severity="error">{error}</Alert>}

                    <Button
                        variant="outlined"
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        fullWidth
                    >
                        Continue with Google
                    </Button>

                    <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                        <span style={{ background: '#fff', padding: '0 10px', color: '#666', zIndex: 1 }}>OR</span>
                        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px solid #ccc' }} />
                    </Box>

                    <TextField
                        label="Email"
                        type="email"
                        fullWidth
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
                    />
                    <TextField
                        label="Password"
                        type="password"
                        fullWidth
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                    />
                    <Button
                        variant="contained"
                        onClick={() => handleAuth(tab === 1)}
                        disabled={loading}
                        fullWidth
                        size="large"
                    >
                        {loading ? 'Please wait...' : (tab === 0 ? 'Sign In' : 'Sign Up')}
                    </Button>
                </Stack>
            </DialogContent>
        </Dialog>
    );
};
